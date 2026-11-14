// Gemini adapter: one long-lived `gemini --acp` per persona session (Agent Client Protocol: JSON-RPC 2.0 over
// stdio). Checked against Gemini CLI 0.68.0: initialize → session/new (or session/load) → session/prompt, text as
// session/update agent_message_chunk, tool approvals as session/request_permission, Stop as session/cancel.
// Walt runs the CLI's own JS with node, because Node cannot start npm's gemini.cmd shim without a shell.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, delimiter, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { cleanEnv, gone } from "./environment";
import type { Approval } from "./claude";
import type { ModelInfo } from "../domain/model";

/** node.exe and Gemini CLI's bundle/gemini.js behind the npm shim; undefined when either is missing */
export function geminiCommand(shim?: string) {
  if (!shim) return undefined;
  const js = join(dirname(shim), "node_modules", "@google", "gemini-cli", "bundle", "gemini.js");
  const local = join(dirname(shim), "node.exe");
  const node = existsSync(local) ? local : (process.env.PATH || "").split(delimiter).filter(isAbsolute).map((d) => join(d, "node.exe")).find(existsSync);
  return existsSync(js) && node ? { node, js } : undefined;
}
/** signed in: the Google login leaves oauth_creds.json; an API key or Vertex choice is in settings.json */
export function geminiSignedIn(home = homedir()) {
  if (existsSync(join(home, ".gemini", "oauth_creds.json"))) return true;
  try {
    const t = JSON.parse(readFileSync(join(home, ".gemini", "settings.json"), "utf8"))?.security?.auth?.selectedType;
    return !!t && t !== "oauth-personal";
  } catch {
    return false;
  }
}

type Cmd = { node: string; js: string };
/** a tool call Walt shows the owner, in the shapes the approval card knows (Shell, Edit) */
export function askFor(tc: any): { tool: string; input: unknown } {
  const raw = tc?.rawInput ?? {};
  if (tc?.kind === "execute") return { tool: "Shell", input: { command: raw.command ?? tc.title, cwd: raw.dir_path ?? raw.directory, reason: raw.description } };
  const diffs = (tc?.content ?? []).filter((c: any) => c?.type === "diff");
  if (["edit", "delete", "move"].includes(tc?.kind) || diffs.length)
    return {
      tool: "Edit",
      input: {
        changes: diffs.map((d: any) => {
          const lines = (s: unknown) => (s ? String(s).split("\n") : []);
          return { path: d.path, kind: d.oldText == null ? "add" : "update", diff: [...lines(d.oldText).map((l) => "-" + l), ...lines(d.newText).map((l) => "+" + l)].join("\n") };
        }),
        reason: tc.title,
      },
    };
  if (tc?.kind === "fetch") return { tool: "WebFetch", input: { url: raw.url ?? raw.prompt ?? tc.title } };
  return { tool: String(tc?.title ?? tc?.kind ?? "tool"), input: raw };
}
/** the option that says yes once / no once (ACP lets the agent name them) */
export function choose(options: any[] = [], allow: boolean) {
  const want = allow ? ["allow_once", "allow_always"] : ["reject_once", "reject_always"];
  const o = want.map((k) => options.find((x) => x?.kind === k)).find(Boolean);
  return o ? { outcome: { outcome: "selected", optionId: o.optionId } } : { outcome: { outcome: "cancelled" } };
}
/** what may run in a read-only chat (reviews, chats without a project): looking, never changing */
const CHANGES = new Set(["edit", "delete", "move", "execute"]);

class Acp {
  readonly child: ChildProcessWithoutNullStreams;
  closed = false;
  stderr = "";
  private id = 0;
  private calls = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  constructor(cmd: Cmd, args: string[], cwd: string, private readonly onMessage: (m: any) => void) {
    this.child = spawn(cmd.node, [cmd.js, "--acp", ...args], { cwd, env: cleanEnv(), shell: false, windowsHide: true });
    this.child.stderr.on("data", (b) => (this.stderr = (this.stderr + b).slice(-4000)));
    this.child.on("error", (e) => this.fail(e));
    this.child.on("close", (code) => {
      this.closed = true;
      this.fail(new Error(this.stderr.trim().slice(-800) || `Gemini closed (${code}); outcome may be uncertain`));
    });
    createInterface({ input: this.child.stdout }).on("line", (line) => {
      let m: any;
      try {
        m = JSON.parse(line);
      } catch {
        return;
      }
      if (m.id != null && !m.method) {
        const c = this.calls.get(m.id);
        this.calls.delete(m.id);
        if (m.error) c?.reject(new Error(m.error.message || JSON.stringify(m.error)));
        else c?.resolve(m.result);
      } else this.onMessage(m);
    });
  }
  write(v: unknown) {
    if (!this.closed) this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...(v as object) }) + "\n");
  }
  call(method: string, params: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
      const i = ++this.id;
      this.calls.set(i, { resolve, reject });
      this.write({ id: i, method, params });
    });
  }
  fail(e: Error) {
    for (const c of this.calls.values()) c.reject(e);
    this.calls.clear();
  }
  init() {
    return this.call("initialize", { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } });
  }
}
/** "Gemini API key is missing" is what an unsigned CLI says: tell the owner what to do instead */
const signIn = (e: Error) => (/api key is missing|authentication required|not configured/i.test(e.message) ? new Error("Gemini is not signed in. Open a terminal, run gemini once and pick Log in with Google.") : e);

export class GeminiSession {
  private acp: Acp;
  private ready: Promise<void>;
  sessionId?: string;
  lastActive = Date.now();
  private pending?: { delta: (t: string) => void; approve: Approval; text: string };
  /** Customize · Instructions go with the first message (ACP has no system prompt) */
  private brief: string;
  constructor(
    cmd: Cmd,
    readonly cwd: string,
    readonly model: string,
    private readonly readonly: boolean,
    readonly effort?: string,
    resume?: string,
    instructions = "",
  ) {
    this.brief = instructions ? `Instructions from the user, for this whole chat:\n${instructions}\n\n` : "";
    const acp = (this.acp = new Acp(cmd, model && model !== "default" ? ["-m", model] : [], cwd, (m) => this.onMessage(m)));
    this.ready = (async () => {
      await acp.init();
      const params = { cwd, mcpServers: [] };
      // a failed resume starts a new session; Walt resends what the model missed, so the chat carries on
      const r = resume
        ? await acp.call("session/load", { sessionId: resume, ...params }).then(() => ({ sessionId: resume }), () => acp.call("session/new", params))
        : await acp.call("session/new", params);
      this.sessionId = r.sessionId;
    })().catch((e) => {
      throw signIn(e);
    });
    const timer = setTimeout(() => acp.fail(new Error("Gemini did not start within 60 s")), 60000);
    this.ready.finally(() => clearTimeout(timer)).catch(() => {});
  }
  get pid() {
    return this.acp.child.pid;
  }
  get alive() {
    return !this.acp.closed;
  }
  get busy() {
    return !!this.pending;
  }
  private onMessage(m: any) {
    if (m.method === "session/request_permission" && m.id != null) return void this.permission(m);
    if (m.id != null) return this.acp.write({ id: m.id, error: { code: -32601, message: `Walt does not offer ${m.method}` } });
    const u = m.params?.update;
    if (m.method !== "session/update" || !this.pending || m.params?.sessionId !== this.sessionId) return;
    if (u?.sessionUpdate === "agent_message_chunk" && u.content?.type === "text" && u.content.text) {
      this.pending.text += u.content.text;
      this.pending.delta(u.content.text);
    }
  }
  private async permission(m: any) {
    const tc = m.params?.toolCall;
    // read-only chats never change anything; elsewhere every change asks the owner (Gemini already lets reads run)
    if (this.readonly && CHANGES.has(tc?.kind)) return this.acp.write({ id: m.id, result: choose(m.params?.options, false) });
    const ask = askFor(tc);
    const allowed = !!this.pending && (await this.pending.approve(ask.tool, ask.input).catch(() => false));
    this.acp.write({ id: m.id, result: choose(m.params?.options, allowed) });
  }
  async warm() {
    await this.ready;
  }
  async run(prompt: string, delta: (t: string) => void, approve: Approval, images: string[] = []) {
    await this.ready;
    if (this.acp.closed) throw new Error("Gemini process is closed");
    if (this.pending) throw new Error("Session already busy");
    this.pending = { delta, approve, text: "" };
    const blocks = [
      { type: "text", text: this.brief + prompt },
      ...images.map((f) => ({ type: "image", mimeType: `image/${extname(f).slice(1).replace("jpg", "jpeg")}`, data: readFileSync(f).toString("base64") })),
    ];
    this.brief = "";
    try {
      const r = await this.acp.call("session/prompt", { sessionId: this.sessionId, prompt: blocks });
      const text = this.pending.text;
      if (r?.stopReason === "refusal" && !text) throw new Error("Gemini declined to answer.");
      return text || (r?.stopReason === "cancelled" ? "(stopped)" : "");
    } catch (e) {
      throw signIn(e as Error);
    } finally {
      this.pending = undefined;
      this.lastActive = Date.now();
    }
  }
  interrupt() {
    if (this.sessionId) this.acp.write({ method: "session/cancel", params: { sessionId: this.sessionId } });
  }
  async stop() {
    if (this.acp.closed) return;
    this.interrupt();
    this.acp.child.stdin.end();
    const pid = this.acp.child.pid;
    await new Promise((r) => setTimeout(r, 1500));
    if (pid && !gone(pid)) this.acp.child.kill();
  }
}

/** models this Google account can use: Gemini lists them when a session starts (the same list as /model) */
export async function geminiModels(cmd: Cmd, cwd: string): Promise<ModelInfo[]> {
  const acp = new Acp(cmd, [], cwd, () => {});
  const timer = setTimeout(() => acp.child.kill(), 60000);
  try {
    await acp.init();
    const r = await acp.call("session/new", { cwd, mcpServers: [] }).catch((e) => {
      throw signIn(e);
    });
    const cur = r?.models?.currentModelId;
    return (r?.models?.availableModels ?? []).map((m: any) => ({ id: String(m.modelId), label: String(m.name ?? m.modelId), efforts: [], isDefault: m.modelId === cur }));
  } finally {
    clearTimeout(timer);
    acp.child.kill();
  }
}
