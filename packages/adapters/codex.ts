// Codex adapter: one long-lived `codex app-server` (JSON-RPC over stdio) per persona session.
// Protocol checked against `codex app-server generate-ts` from codex-cli 0.167.2.
// Same surface as ClaudeSession so the host does not care which engine runs a turn.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { cleanEnv, gone } from "./environment";
import type { Approval } from "./claude";
import { LEVELS, type ModelInfo, type ContextUse } from "../domain/model";
import { NO_TOOLS, saveImage, codexQuota, usage, type ToolKit } from "./tools";

/** Features Walt always turns off: hooks run the user's own commands, sub-agents run outside Walt's view */
const ALWAYS_OFF = ["hooks", "multi_agent"];
/** names of the user's own MCP servers, so each can be switched off for Walt sessions (names only, no values) */
export function userMcpServers(config = join(homedir(), ".codex", "config.toml")) {
  try {
    return [...new Set([...readFileSync(config, "utf8").matchAll(/^\[mcp_servers\.([A-Za-z0-9_-]+)\]/gm)].map((m) => m[1]))];
  } catch {
    return [];
  }
}
/** the user's own skills (~/.codex/skills/<name>/SKILL.md); Codex would read them every turn, each read asking for approval */
export function userSkills(dir = join(homedir(), ".codex", "skills")) {
  try {
    return readdirSync(dir)
      .map((d) => join(dir, d, "SKILL.md"))
      .filter((p) => existsSync(p) && !p.includes("'")); // a TOML literal string cannot hold '
  } catch {
    return [];
  }
}
/** `servers` = MCP servers to switch off; `skills` = the user's skills, off unless plugins are on; `kit` = Plugins & tools */
export function codexArgs(servers = userMcpServers(), skills = userSkills(), kit: ToolKit = NO_TOOLS, plugins: string[] = []) {
  const off = [
    ...ALWAYS_OFF,
    ...(kit.images ? [] : ["image_generation"]),
    ...(kit.apps ? [] : ["apps"]),
    ...(kit.codexPlugins.length ? [] : ["plugins"]),
    ...(kit.browser ? [] : ["browser_use", "in_app_browser"]),
    ...(kit.computer ? [] : ["computer_use"]),
  ];
  const pluginsOff = plugins.filter((p) => !kit.codexPlugins.includes(p) && !/["\\]/.test(p));
  return [
    ...off.flatMap((f) => ["--disable", f]),
    "-c",
    `web_search="${kit.web ? "live" : "disabled"}"`,
    ...servers.flatMap((s) => ["-c", `mcp_servers.${s}.enabled=false`]),
    ...pluginsOff.flatMap((p) => ["-c", `plugins."${p}".enabled=false`]),
    ...(skills.length && !kit.codexPlugins.length ? ["-c", `skills.config=[${skills.map((p) => `{path='${p}',enabled=false}`).join(",")}]`] : []),
    "app-server",
  ];
}
/** a command that only reads, lists or searches files (Codex's own parse of it): safe to run without asking */
export function onlyReads(actions: unknown) {
  return Array.isArray(actions) && actions.length > 0 && actions.every((a: any) => ["read", "listFiles", "search"].includes(a?.type));
}

type Pending = { resolve: (text: string) => void; reject: (e: Error) => void; delta: (t: string) => void; approve: Approval; text: string; last: string; images: string[] };
export class CodexSession {
  private child: ChildProcessWithoutNullStreams;
  /** context window use after the latest turn */
  context?: ContextUse;
  /** the CLI process id, for the Job Object */
  get pid() {
    return this.child.pid;
  }
  private ready: Promise<void>;
  private closed = false;
  private stderr = "";
  private id = 0;
  private calls = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private pending?: Pending;
  private turnId = "";
  /** items seen in the current turn, so an approval can show which files or command it is about */
  private items = new Map<string, any>();
  lastActive = Date.now();
  sessionId = "";
  constructor(
    executable: string,
    readonly cwd: string,
    readonly model: string,
    private readonly readonly: boolean,
    readonly effort?: string,
    resume?: string,
    /** Plugins & tools for this session (reviewers: none) */
    kit: ToolKit = NO_TOOLS,
    /** the user's Codex plugins, so the ones switched off in Walt can be named */
    plugins: string[] = [],
  ) {
    const args = codexArgs(userMcpServers().filter((s) => !kit.mcp.includes(s)), userSkills(), kit, plugins);
    this.child = spawn(executable, args, { cwd, env: cleanEnv(), shell: false, windowsHide: true });
    this.child.stderr.on("data", (b) => (this.stderr = (this.stderr + b).slice(-4000)));
    this.child.on("error", (e) => this.fail(e));
    this.child.on("close", (code) => {
      this.closed = true;
      this.fail(new Error(this.stderr.replace(/\x1b\[[0-9;]*m/g, "").trim().slice(-800) || `Codex closed (${code}); outcome may be uncertain`));
    });
    createInterface({ input: this.child.stdout }).on("line", (line) => this.onLine(line));
    this.ready = (async () => {
      await this.call("initialize", { clientInfo: { name: "walt", title: "Walt", version: "0.1.0" }, capabilities: { experimentalApi: false, requestAttestation: false } });
      this.write({ method: "initialized" });
      const thread = {
        cwd,
        // untrusted: anything beyond plain reads asks; reviewers also get a read-only sandbox
        approvalPolicy: "untrusted",
        sandbox: readonly ? "read-only" : "workspace-write",
        ...(model ? { model } : {}),
        ...(kit.instructions ? { developerInstructions: kit.instructions } : {}),
      };
      // shortcut: a failed resume silently starts a new thread (Walt resends the full packet each turn, so the task
      // context survives); show "new session" in the timeline once resume state is surfaced in the UI
      const r = resume
        ? await this.call("thread/resume", { threadId: resume, ...thread }).catch(() => this.call("thread/start", thread))
        : await this.call("thread/start", thread);
      this.sessionId = r.thread.id;
      void this.call("account/rateLimits/read", {}).then((x) => report(x?.rateLimits), () => {});
    })();
    const timer = setTimeout(() => this.fail(new Error("Codex handshake timed out")), 30000);
    this.ready.finally(() => clearTimeout(timer)).catch(() => {});
  }
  private write(v: unknown) {
    if (!this.closed) this.child.stdin.write(JSON.stringify(v) + "\n");
  }
  private call(method: string, params: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
      const i = ++this.id;
      this.calls.set(i, { resolve, reject });
      this.write({ id: i, method, params });
    });
  }
  private fail(e: Error) {
    for (const c of this.calls.values()) c.reject(e);
    this.calls.clear();
    this.pending?.reject(e);
    this.pending = undefined;
  }
  private onLine(line: string) {
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
      return;
    }
    if (m.id != null && m.method) return void this.serverRequest(m);
    const p = m.params || {};
    if (m.method === "account/rateLimits/updated") return void report(p.rateLimits ?? p);
    if (p.threadId && p.threadId !== this.sessionId) return;
    // what the last request carried, of the model's window (as Codex's own status line counts it)
    if (m.method === "thread/tokenUsage/updated" && p.tokenUsage?.modelContextWindow)
      return void (this.context = { used: p.tokenUsage.last?.totalTokens ?? 0, size: p.tokenUsage.modelContextWindow });
    if (m.method === "item/started" || m.method === "item/completed") this.items.set(p.item.id, p.item);
    const run = this.pending;
    if (!run) return;
    if (m.method === "item/agentMessage/delta") {
      run.text += p.delta;
      run.delta(p.delta);
    }
    if (m.method === "item/completed" && p.item.type === "agentMessage") run.last = p.item.text;
    // a generated picture arrives as base64 PNG: keep it in Walt's images folder and show it in the reply
    if (m.method === "item/completed" && p.item.type === "imageGeneration" && typeof p.item.result === "string" && p.item.result) {
      const md = saveImage(`${this.sessionId}-${p.item.id}`, p.item.result, p.item.revisedPrompt || "image");
      run.images.push(md);
      run.text += `\n\n${md}\n\n`;
      run.delta(`\n\n${md}\n\n`);
    }
    if (m.method === "turn/completed") {
      this.lastActive = Date.now();
      this.pending = undefined;
      const t = p.turn;
      if (t.status === "completed") run.resolve([run.last || run.text, ...run.images.filter((i) => !(run.last || run.text).includes(i))].join("\n\n"));
      else run.reject(new Error(t.error?.message || `Codex turn ${t.status}`));
    }
  }
  private async serverRequest(m: any) {
    const p = m.params || {};
    const legacy = m.method === "applyPatchApproval" || m.method === "execCommandApproval";
    const ask =
      m.method === "item/commandExecution/requestApproval" || m.method === "execCommandApproval"
        ? { tool: "Shell", input: { command: p.command, cwd: p.cwd, reason: p.reason ?? undefined } }
        : m.method === "item/fileChange/requestApproval" || m.method === "applyPatchApproval"
          ? { tool: "Edit", input: { changes: (this.items.get(p.itemId)?.changes ?? p.fileChanges ?? []).map((c: any) => ({ path: c.path, kind: c.kind?.type ?? c.kind, diff: c.diff })), reason: p.reason ?? undefined } }
          : undefined;
    // reading skill or project files: no need to ask (anything that writes, runs code or is unclear still asks)
    if (ask?.tool === "Shell" && onlyReads(p.commandActions ?? this.items.get(p.itemId)?.commandActions)) {
      this.write({ id: m.id, result: { decision: legacy ? "approved" : "accept" } });
      return;
    }
    if (!ask) {
      // extra permissions, user-input prompts, MCP elicitations, tool calls: Walt grants none of these
      this.write({ id: m.id, error: { code: -32601, message: `Walt does not allow ${m.method}` } });
      return;
    }
    // Walt hears about every request (a read-only turn is refused there and says why); read-only stays refused here too
    const allowed = !!this.pending && (await this.pending.approve(ask.tool, ask.input)) && !this.readonly;
    const decision = legacy ? (allowed ? "approved" : { denied: { rejection: "Denied by Walt permission policy or user" } }) : allowed ? "accept" : "decline";
    this.write({ id: m.id, result: { decision } });
  }
  async warm() {
    await this.ready;
  }
  async run(prompt: string, delta: (t: string) => void, approve: Approval, images: string[] = []) {
    await this.ready;
    if (this.closed) throw new Error("Codex process is closed");
    if (this.pending) throw new Error("Session already busy");
    this.items.clear();
    return new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject, delta, approve, text: "", last: "", images: [] };
      this.call("turn/start", {
        threadId: this.sessionId,
        input: [{ type: "text", text: prompt, text_elements: [] }, ...images.map((path) => ({ type: "localImage", path }))],
        ...(this.effort ? { effort: this.effort } : {}),
      })
        .then((r) => (this.turnId = r.turn.id))
        .catch((e) => this.fail(e));
    });
  }
  interrupt() {
    if (this.turnId && this.pending) void this.call("turn/interrupt", { threadId: this.sessionId, turnId: this.turnId }).catch(() => {});
  }
  get alive() {
    return !this.closed;
  }
  get busy() {
    return !!this.pending;
  }
  async stop() {
    if (this.closed) return;
    this.interrupt();
    this.child.stdin.end();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.child.pid) return resolve();
        const killer = spawn("taskkill.exe", ["/PID", String(this.child.pid), "/T", "/F"], { windowsHide: true, shell: false });
        killer.once("error", reject);
        // taskkill fails when the process exited on its own a moment earlier; that is a clean stop too
        killer.once("close", (code) => (code === 0 || this.closed || gone(this.child.pid!) ? resolve() : reject(new Error("Codex shutdown could not be verified. Restart Walt and inspect recovery."))));
      }, 3000);
      this.child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

const report = (r: unknown) => {
  const q = codexQuota(r);
  if (q) usage.report("codex", q);
};

/** models this ChatGPT account can use in Codex (`model/list`, same list as the Codex app's picker) */
export async function codexModels(executable: string, cwd: string): Promise<ModelInfo[]> {
  const p = spawn(executable, codexArgs(), { cwd, env: cleanEnv(), shell: false, windowsHide: true });
  let id = 0;
  const calls = new Map<number, (m: any) => void>();
  createInterface({ input: p.stdout }).on("line", (line) => {
    try {
      const m = JSON.parse(line);
      if (m.id != null && !m.method) calls.get(m.id)?.(m);
    } catch {}
  });
  const call = (method: string, params: unknown) =>
    new Promise<any>((resolve, reject) => {
      const i = ++id;
      calls.set(i, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
      p.stdin.write(JSON.stringify({ id: i, method, params }) + "\n");
    });
  const timer = setTimeout(() => p.kill(), 30000);
  try {
    await call("initialize", { clientInfo: { name: "walt", title: "Walt", version: "0.1.0" }, capabilities: { experimentalApi: false, requestAttestation: false } });
    const out: any[] = [];
    let cursor: string | null = null;
    do {
      const r = await call("model/list", { cursor });
      out.push(...r.data);
      cursor = r.nextCursor ?? null;
    } while (cursor);
    // the same short-lived process also brings the plan usage, so it shows before the first message
    await call("account/rateLimits/read", {}).then((x) => report(x?.rateLimits), () => {});
    return out
      .filter((m) => !m.hidden)
      .map((m) => ({
        id: m.model || m.id,
        label: m.displayName,
        efforts: m.supportedReasoningEfforts.map((e: any) => e.reasoningEffort).filter((e: string) => (LEVELS as string[]).includes(e)),
        defaultEffort: m.defaultReasoningEffort,
        isDefault: m.isDefault,
      }));
  } finally {
    clearTimeout(timer);
    p.kill();
  }
}
