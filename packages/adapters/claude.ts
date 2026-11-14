import { readFileSync } from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { cleanEnv, gone } from "./environment";
import { LEVELS, type ModelInfo, type ContextUse } from "../domain/model";
import { NO_TOOLS, claudeQuota, usage, type ToolKit } from "./tools";
/** tools that only read (files, the web's search results, a skill's instructions): never ask */
const SAFE = ["Read", "Glob", "Grep", "WebSearch", "Skill"];
/** the --tools list: reviewers read; builders also write; the shell, web and skills when switched on */
export function claudeTools(readonly: boolean, shell: boolean, kit: ToolKit) {
  const t = ["Read", "Glob", "Grep"];
  if (!readonly) t.push("Write", "Edit");
  if (!readonly && shell) t.push("Bash", "PowerShell");
  if (kit.web) t.push("WebSearch", "WebFetch");
  if (kit.claudePlugins.length) t.push("Skill");
  return t.join(",");
}
export type Approval = (tool: string, input: unknown) => Promise<boolean>;
export class ClaudeSession {
  private child: ChildProcessWithoutNullStreams;
  /** context window use after the latest reply */
  context?: ContextUse;
  /** the CLI process id, for the Job Object */
  get pid() {
    return this.child.pid;
  }
  private pending?: {
    resolve: (text: string) => void;
    reject: (e: Error) => void;
    delta: (text: string) => void;
    approve: Approval;
    text: string;
  };
  private ready: Promise<void>;
  private closed = false;
  private stderr = "";
  lastActive = Date.now();
  sessionId = "";
  constructor(
    executable: string,
    cwd: string,
    readonly model: string,
    readonly: boolean,
    readonly effort?: string,
    resume?: string,
    /** --mcp-config value: a JSON file path with the project's servers, or none */
    mcpConfig = '{"mcpServers":{}}',
    /** builder only: add the shell (Bash, or PowerShell on Windows without Git Bash); each call still goes through the owner's approval */
    shell = false,
    /** Plugins & tools: web search, skills and plugins (reviewers: none) */
    kit: ToolKit = NO_TOOLS,
  ) {
    const args = [
      "--print",
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--permission-prompt-tool",
      "stdio",
      "--permission-mode",
      "manual",
      "--restricted",
      // the claude.ai account's connectors (Gmail, Calendar, Docs…) come in only without the strict flag
      ...(kit.connectors ? [] : ["--strict-mcp-config"]),
      "--mcp-config",
      mcpConfig,
      "--setting-sources=",
      // skills (from plugins) need the Skill tool and the skill list; without plugins there is nothing to list
      ...(kit.claudePlugins.length ? [] : ["--disable-slash-commands"]),
      ...(kit.instructions ? ["--append-system-prompt", kit.instructions] : []),
      "--tools",
      claudeTools(readonly, shell, kit),
      ...kit.claudePlugins.flatMap((p) => ["--plugin-dir", p.dir]),
      ...(model ? ["--model", model] : []),
      ...(effort ? ["--effort", effort] : []),
      // a restarted process (new effort/model, or after sleeping) continues the same conversation
      ...(resume ? ["--resume", resume] : []),
    ];
    this.child = spawn(executable, args, {
      cwd,
      env: cleanEnv(),
      shell: false,
      windowsHide: true,
    });
    this.child.stderr.on("data", (b) => {
      this.stderr = (this.stderr + b).slice(-4000);
    });
    let readyResolve: () => void, readyReject: (e: Error) => void;
    this.ready = new Promise((resolve, reject) => {
      readyResolve = resolve;
      readyReject = reject;
    });
    const timer = setTimeout(
      () => readyReject(new Error("Claude handshake timed out")),
      30000,
    );
    this.ready.finally(() => clearTimeout(timer)).catch(() => {});
    this.child.on("error", (e) => {
      readyReject(e);
      this.fail(e);
    });
    this.child.on("close", (code) => {
      this.closed = true;
      const error = new Error(
        this.stderr || `Claude closed (${code}); outcome may be uncertain`,
      );
      readyReject(error);
      this.fail(error);
    });
    createInterface({ input: this.child.stdout }).on("line", (line) => {
      if (!line.trim().startsWith("{")) return;
      try {
        const e = JSON.parse(line);
        if (
          e.type === "control_response" &&
          e.response?.request_id === "init"
        ) {
          if (e.response.subtype === "error")
            readyReject(new Error(e.response.error));
          else readyResolve();
        }
        if (e.type === "system" && e.session_id) this.sessionId = e.session_id;
        if (e.type === "rate_limit_event") {
          const q = claudeQuota(e.rate_limit_info);
          if (q) usage.report("claude", q);
        }
        if (e.type === "control_request") {
          void this.permission(e, readonly);
          return;
        }
        // context: what the latest top-level reply carried in and out, of the window the turn's result names
        if (e.type === "assistant" && !e.parent_tool_use_id && e.message?.usage) {
          const u = e.message.usage;
          this.context = { used: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.output_tokens ?? 0), size: this.context?.size ?? 0, model: e.message.model };
        }
        if (e.type === "result" && this.context && e.modelUsage)
          this.context.size = e.modelUsage[this.context.model ?? ""]?.contextWindow ?? Math.max(0, ...Object.values<any>(e.modelUsage).map((m) => m?.contextWindow ?? 0));
        const p = this.pending;
        if (!p) return;
        if (
          e.type === "stream_event" &&
          e.event?.delta?.type === "text_delta"
        ) {
          p.text += e.event.delta.text;
          p.delta(e.event.delta.text);
        }
        if (e.type === "result") {
          this.lastActive = Date.now();
          this.pending = undefined;
          if (e.is_error)
            p.reject(new Error(e.result || e.errors?.join("\n") || e.subtype));
          else p.resolve(e.result || p.text);
        }
      } catch (err) {
        this.fail(new Error("Invalid Claude stream: " + String(err)));
      }
    });
    this.write({
      type: "control_request",
      request_id: "init",
      request: { subtype: "initialize", hooks: {} },
    });
  }
  private write(value: unknown) {
    if (!this.closed) this.child.stdin.write(JSON.stringify(value) + "\n");
  }
  private fail(error: Error) {
    this.pending?.reject(error);
    this.pending = undefined;
  }
  private async permission(e: any, readonly: boolean) {
    const r = e.request;
    let result: unknown = {
      behavior: "deny",
      message: "Unsupported control request",
    };
    if (r?.subtype === "can_use_tool") {
      const read = SAFE.includes(r.tool_name);
      // a chat without a project never edits; it may still ask you before a web fetch or an MCP tool
      const askable = !readonly || r.tool_name === "WebFetch" || String(r.tool_name).startsWith("mcp__");
      const allowed = read || (askable && !!this.pending && (await this.pending.approve(r.tool_name, r.input)));
      result = allowed
        ? { behavior: "allow", updatedInput: r.input }
        : {
            behavior: "deny",
            message: "Denied by Walt permission policy or user",
          };
    }
    this.write({
      type: "control_response",
      response: {
        subtype: "success",
        request_id: e.request_id,
        response: result,
      },
    });
  }
  async warm() {
    await this.ready;
  }
  async run(prompt: string, delta: (text: string) => void, approve: Approval, images: string[] = []) {
    await this.ready;
    if (this.closed) throw new Error("Claude process is closed");
    if (this.pending) throw new Error("Session already busy");
    // pictures you attached go along as image blocks
    const type = (f: string) => ({ jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" })[f.split(".").pop()!.toLowerCase()] ?? "image/png";
    const content = images.length
      ? [{ type: "text", text: prompt }, ...images.map((f) => ({ type: "image", source: { type: "base64", media_type: type(f), data: readFileSync(f).toString("base64") } }))]
      : prompt;
    return new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject, delta, approve, text: "" };
      this.write({
        type: "user",
        message: { role: "user", content },
        parent_tool_use_id: null,
        session_id: this.sessionId || "",
      });
    });
  }
  interrupt() {
    this.write({
      type: "control_request",
      request_id: randomUUID(),
      request: { subtype: "interrupt" },
    });
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
        if (this.child.pid) {
          const killer = spawn(
            "taskkill.exe",
            ["/PID", String(this.child.pid), "/T", "/F"],
            {
              windowsHide: true,
              shell: false,
            },
          );
          killer.once("error", reject);
          killer.once("close", (code) => {
            // taskkill fails when the process exited on its own a moment earlier; that is a clean stop too
            if (code === 0 || this.closed || gone(this.child.pid!)) resolve();
            else
              reject(
                new Error(
                  "Process shutdown could not be verified. Restart Walt and inspect recovery.",
                ),
              );
          });
        } else resolve();
      }, 3000);
      this.child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

/** models this Claude account can use, from the CLI's initialize response (same list as the Claude app's picker) */
export function claudeModels(executable: string, cwd: string): Promise<ModelInfo[]> {
  return new Promise((resolve, reject) => {
    const p = spawn(executable, ["--print", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--setting-sources=", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}'], { cwd, env: cleanEnv(), shell: false, windowsHide: true });
    const timer = setTimeout(() => { p.kill(); reject(new Error("Claude model list timed out")); }, 30000);
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    createInterface({ input: p.stdout }).on("line", (line) => {
      let m: any;
      try { m = JSON.parse(line); } catch { return; }
      if (m.type !== "control_response" || m.response?.request_id !== "models") return;
      clearTimeout(timer);
      p.kill();
      const list: any[] = m.response.response?.models || [];
      resolve(
        list.map((x) => ({
          id: x.value,
          label: x.value === "default" ? "Default" : x.displayName,
          efforts: (x.supportedEffortLevels || []).filter((e: string) => (LEVELS as string[]).includes(e)),
          isDefault: x.value === "default",
          // aliases (opus, sonnet, …) are the current models; full ids are older ones
          more: /^claude-/.test(x.value),
        })),
      );
    });
    p.stdin.write(JSON.stringify({ type: "control_request", request_id: "models", request: { subtype: "initialize", hooks: {} } }) + "\n");
  });
}
