// ACP adapter: one long-lived agent per persona session speaking the Agent Client Protocol (JSON-RPC 2.0 over stdio).
// Used for Antigravity CLI (`agy acp`, Google's replacement for Gemini CLI). Flow: initialize → session/new (or
// session/load) → session/prompt; text as session/update agent_message_chunk; tool approvals as
// session/request_permission; Stop as session/cancel. The protocol side was checked against Gemini CLI 0.68's ACP
// server (same protocol); agy itself was not installed when this was written.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { cleanEnv, gone } from "./environment";
import type { Approval } from "./claude";
import type { ModelInfo } from "../domain/model";

/** how to start the agent's ACP server, e.g. { exe: "…\\agy.exe", args: ["acp"] } */
export interface AcpCommand {
  exe: string;
  args: string[];
}

/** a tool call Walt shows the owner, in the shapes the approval card knows (Shell, Edit, WebFetch) */
export function askFor(tc: any): { tool: string; input: unknown } {
  const raw = tc?.rawInput ?? {};
  if (tc?.kind === "execute") return { tool: "Shell", input: { command: raw.command ?? raw.CommandLine ?? tc.title, cwd: raw.dir_path ?? raw.directory ?? raw.Cwd, reason: raw.description } };
  let diffs = (tc?.content ?? []).filter((c: any) => c?.type === "diff");
  // agy's write_file sends no diff, only { Path, Content }: show it as a new file
  if (!diffs.length && raw.Path && raw.Content != null) diffs = [{ path: raw.Path, newText: raw.Content }];
  if (["edit", "delete", "move"].includes(tc?.kind) || diffs.length)
    return {
      tool: "Edit",
      input: {
        changes: diffs.map((d: any) => {
          const lines = (s: unknown) => (s ? String(s).replace(/\r?\n$/, "").split(/\r?\n/) : []);
          return { path: d.path, kind: d.oldText == null ? "add" : "update", diff: [...lines(d.oldText).map((l) => "-" + l), ...lines(d.newText).map((l) => "+" + l)].join("\n") };
        }),
        reason: tc.title,
      },
    };
  if (tc?.kind === "fetch") return { tool: "WebFetch", input: { url: raw.url ?? raw.Url ?? raw.prompt ?? tc.title } };
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
/** looking around the project: allowed without a card (agy in strict mode asks for these too) */
const LOOKS = new Set(["read", "search", "think"]);

class Acp {
  readonly child: ChildProcessWithoutNullStreams;
  closed = false;
  stderr = "";
  private id = 0;
  private calls = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  constructor(cmd: AcpCommand, cwd: string, private readonly onMessage: (m: any) => void) {
    this.child = spawn(cmd.exe, cmd.args, { cwd, env: cleanEnv(), shell: false, windowsHide: true });
    this.child.stderr.on("data", (b) => (this.stderr = (this.stderr + b).slice(-4000)));
    this.child.on("error", (e) => this.fail(e));
    this.child.on("close", (code) => {
      this.closed = true;
      this.fail(new Error(this.stderr.trim().slice(-800) || `Antigravity closed (${code}); outcome may be uncertain`));
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
/** an agent that is not signed in says so in many words: tell the owner what to do instead */
export const SIGN_IN = "Antigravity is not signed in. Open a terminal, run agy once and sign in with Google.";
const signIn = (e: Error) => (/api key is missing|authenticat|not signed|sign[ -]?in|log[ -]?in|unauthori[sz]ed|credential/i.test(e.message) ? new Error(SIGN_IN) : e);

export class AcpSession {
  private acp: Acp;
  private ready: Promise<void>;
  sessionId?: string;
  lastActive = Date.now();
  private pending?: { delta: (t: string) => void; approve: Approval; text: string };
  /** Customize · Instructions go with the first message (ACP has no system prompt) */
  private brief: string;
  constructor(
    cmd: AcpCommand,
    readonly cwd: string,
    readonly model: string,
    private readonly readonly: boolean,
    readonly effort?: string,
    resume?: string,
    instructions = "",
  ) {
    this.brief = instructions ? `Instructions from the user, for this whole chat:\n${instructions}\n\n` : "";
    const acp = (this.acp = new Acp(cmd, cwd, (m) => this.onMessage(m)));
    this.ready = (async () => {
      await acp.init();
      const params = { cwd, mcpServers: [] };
      // a failed resume starts a new session; Walt resends what the model missed, so the chat carries on
      const r = resume
        ? await acp.call("session/load", { sessionId: resume, ...params }).then(() => ({ sessionId: resume }), () => acp.call("session/new", params))
        : await acp.call("session/new", params);
      this.sessionId = r.sessionId;
      // the model picked in Walt, when the agent offers model switching and it is not already on it
      const offered: any[] = r?.models?.availableModels ?? [];
      if (model && model !== "default" && r?.models?.currentModelId !== model && offered.some((m) => m.modelId === model))
        await acp.call("session/set_model", { sessionId: this.sessionId, modelId: model }).catch(() => {});
    })().catch((e) => {
      throw signIn(e);
    });
    const timer = setTimeout(() => acp.fail(new Error("Antigravity did not start within 60 s")), 60000);
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
    // read-only chats never change anything; elsewhere every change asks the owner
    if (this.readonly && CHANGES.has(tc?.kind)) return this.acp.write({ id: m.id, result: choose(m.params?.options, false) });
    if (LOOKS.has(tc?.kind)) return this.acp.write({ id: m.id, result: choose(m.params?.options, true) });
    const ask = askFor(tc);
    const allowed = !!this.pending && (await this.pending.approve(ask.tool, ask.input).catch(() => false));
    this.acp.write({ id: m.id, result: choose(m.params?.options, allowed) });
  }
  async warm() {
    await this.ready;
  }
  async run(prompt: string, delta: (t: string) => void, approve: Approval, images: string[] = []) {
    await this.ready;
    if (this.acp.closed) throw new Error("Antigravity process is closed");
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
      if (r?.stopReason === "refusal" && !text) throw new Error("Antigravity declined to answer.");
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

/** the models the signed-in account can use, as the agent lists them when a session starts; [] when it lists none */
export async function acpModels(cmd: AcpCommand, cwd: string): Promise<ModelInfo[]> {
  const acp = new Acp(cmd, cwd, () => {});
  const timer = setTimeout(() => acp.child.kill(), 60000);
  try {
    await acp.init();
    const r = await acp.call("session/new", { cwd, mcpServers: [] }).catch((e) => {
      throw signIn(e);
    });
    // close it so the check leaves no empty conversation behind (agy offers session/close)
    await acp.call("session/close", { sessionId: r?.sessionId }).catch(() => {});
    const cur = r?.models?.currentModelId;
    return (r?.models?.availableModels ?? []).map((m: any) => ({ id: String(m.modelId), label: String(m.name ?? m.modelId), efforts: [], isDefault: m.modelId === cur }));
  } finally {
    clearTimeout(timer);
    acp.child.kill();
  }
}
