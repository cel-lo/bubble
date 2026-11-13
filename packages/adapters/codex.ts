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

/** Features that give the agent tools outside the project folder or outside Walt's approval broker. */
const OFF = ["apps", "plugins", "browser_use", "in_app_browser", "computer_use", "image_generation", "hooks", "multi_agent"];
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
export function codexArgs(servers = userMcpServers(), skills = userSkills()) {
  return [
    ...OFF.flatMap((f) => ["--disable", f]),
    ...servers.flatMap((s) => ["-c", `mcp_servers.${s}.enabled=false`]),
    ...(skills.length ? ["-c", `skills.config=[${skills.map((p) => `{path='${p}',enabled=false}`).join(",")}]`] : []),
    "app-server",
  ];
}

type Pending = { resolve: (text: string) => void; reject: (e: Error) => void; delta: (t: string) => void; approve: Approval; text: string; last: string };
export class CodexSession {
  private child: ChildProcessWithoutNullStreams;
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
  ) {
    this.child = spawn(executable, codexArgs(), { cwd, env: cleanEnv(), shell: false, windowsHide: true });
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
      };
      // shortcut: a failed resume silently starts a new thread (Walt resends the full packet each turn, so the task
      // context survives); show "new session" in the timeline once resume state is surfaced in the UI
      const r = resume
        ? await this.call("thread/resume", { threadId: resume, ...thread }).catch(() => this.call("thread/start", thread))
        : await this.call("thread/start", thread);
      this.sessionId = r.thread.id;
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
    if (p.threadId && p.threadId !== this.sessionId) return;
    if (m.method === "item/started" || m.method === "item/completed") this.items.set(p.item.id, p.item);
    const run = this.pending;
    if (!run) return;
    if (m.method === "item/agentMessage/delta") {
      run.text += p.delta;
      run.delta(p.delta);
    }
    if (m.method === "item/completed" && p.item.type === "agentMessage") run.last = p.item.text;
    if (m.method === "turn/completed") {
      this.lastActive = Date.now();
      this.pending = undefined;
      const t = p.turn;
      if (t.status === "completed") run.resolve(run.last || run.text);
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
    if (!ask) {
      // extra permissions, user-input prompts, MCP elicitations, tool calls: Walt grants none of these
      this.write({ id: m.id, error: { code: -32601, message: `Walt does not allow ${m.method}` } });
      return;
    }
    const allowed = !this.readonly && !!this.pending && (await this.pending.approve(ask.tool, ask.input));
    const decision = legacy ? (allowed ? "approved" : { denied: { rejection: "Denied by Walt permission policy or user" } }) : allowed ? "accept" : "decline";
    this.write({ id: m.id, result: { decision } });
  }
  async warm() {
    await this.ready;
  }
  async run(prompt: string, delta: (t: string) => void, approve: Approval) {
    await this.ready;
    if (this.closed) throw new Error("Codex process is closed");
    if (this.pending) throw new Error("Session already busy");
    this.items.clear();
    return new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject, delta, approve, text: "", last: "" };
      this.call("turn/start", {
        threadId: this.sessionId,
        input: [{ type: "text", text: prompt, text_elements: [] }],
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
