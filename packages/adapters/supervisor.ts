import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, delimiter, isAbsolute, dirname } from "node:path";
import type { EngineReport, PersonaDef, Tune } from "../domain/model";
import { capture } from "./environment";
import { ClaudeSession, claudeModels } from "./claude";
import { CodexSession, codexModels } from "./codex";
import { Job } from "./job";
import { tmpdir } from "node:os";
import type { Engine, ModelInfo } from "../domain/model";
type Session = ClaudeSession | CodexSession;
export class Supervisor {
  sessions = new Map<string, Session>();
  /** every CLI process goes in here, so a crash of Walt still ends them and what they started */
  readonly job = new Job();
  /** last session/thread id per room:persona:readonly, to resume after a restart */
  private resumeIds = new Map<string, string>();
  claude = join(homedir(), ".local", "bin", "claude.exe");
  /** Settings · Permissions: Claude builders get Bash (approval per command) */
  claudeShell = false;
  codex = "";
  /** the native codex.exe behind npm's codex.cmd shim (Node cannot spawn .cmd without a shell) */
  codexExe(found = this.find("codex")) {
    if (!found || /\.exe$/i.test(found)) return found;
    const exe = join(dirname(found), "node_modules", "@openai", "codex", "node_modules", "@openai", "codex-win32-x64", "vendor", "x86_64-pc-windows-msvc", "bin", "codex.exe");
    return existsSync(exe) ? exe : undefined;
  }
  find(name: string) {
    // npm global installs (codex, gemini) are .cmd shims in %APPDATA%\npm, which is not always on Electron's PATH
    const dirs = [...(process.env.PATH || "").split(delimiter), process.env.APPDATA ? join(process.env.APPDATA, "npm") : ""].filter(isAbsolute);
    return dirs.flatMap((d) => [join(d, name + ".exe"), join(d, name + ".cmd")]).find(existsSync);
  }
  async doctor(): Promise<EngineReport[]> {
    return Promise.all(
      ["codex", "claude", "gemini"].map(async (engine) => {
        const exe =
          engine === "claude" && existsSync(this.claude)
            ? this.claude
            : engine === "codex"
              ? this.codexExe()
              : this.find(engine);
        if (!exe)
          return {
            engine,
            installed: false,
            version: "—",
            auth: "unknown",
            quota: "unknown" as const,
            detail: "Not installed / native executable not found",
          };
        try {
          const version = await capture(exe, ["--version"]);
          let auth = "unknown";
          if (engine === "claude") {
            this.claude = exe;
            const status = JSON.parse(await capture(exe, ["auth", "status"]));
            auth =
              status.loggedIn && status.authMethod === "claude.ai"
                ? "ok"
                : "required";
          } else if (engine === "codex") {
            this.codex = exe;
            auth = /logged in/i.test(await capture(exe, ["login", "status"]).catch(() => "")) ? "ok" : "required";
          } else if (engine === "gemini") {
            // gemini has no status command; its Google sign-in leaves this file
            auth = existsSync(join(homedir(), ".gemini", "oauth_creds.json")) ? "ok" : "required";
          }
          return {
            engine,
            installed: true,
            version,
            auth,
            quota: "unknown" as const,
            detail: engine === "gemini" ? "Adapter not built yet" : "CLI subscription login",
          };
        } catch (e) {
          return {
            engine,
            installed: true,
            version: "unknown",
            auth: "unknown",
            quota: "unknown" as const,
            detail: String(e),
          };
        }
      }),
    );
  }
  /** MCP set each live session was started with, so a change restarts it */
  private mcpOf = new Map<string, string>();
  /** the user's Claude Code MCP servers (~/.claude.json, user scope): name -> definition */
  claudeMcp(file = join(homedir(), ".claude.json")): Record<string, unknown> {
    try {
      return JSON.parse(readFileSync(file, "utf8")).mcpServers ?? {};
    } catch {
      return {};
    }
  }
  /** a --mcp-config file holding only the servers this project turned on (a file, so their env secrets stay off the command line) */
  private claudeMcpFile(names: string[]) {
    const all = this.claudeMcp();
    const mcpServers = Object.fromEntries(names.filter((n) => n in all).map((n) => [n, all[n]]));
    if (!Object.keys(mcpServers).length) return undefined;
    const json = JSON.stringify({ mcpServers });
    const dir = join(tmpdir(), "walt-mcp");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, createHash("sha256").update(json).digest("hex").slice(0, 16) + ".json");
    writeFileSync(file, json);
    return file;
  }
  /** `resume`: the id saved on the chat, used when this process has none of its own (first turn after a restart); `mcp`: servers the project turned on */
  async get(room: string, p: PersonaDef, root: string, readonly: boolean, tune: Tune = {}, resume?: string, mcp: string[] = []) {
    if (p.engine === "gemini")
      throw new Error(`${p.name} runs on gemini, and Walt's gemini adapter is not built yet.`);
    if (p.engine === "codex" && !(this.codex ||= this.codexExe() || ""))
      throw new Error("Codex CLI was not found. Install it with npm install -g @openai/codex, then sign in with codex login.");
    const key = room + ":" + p.id + ":" + readonly;
    const model = tune.model ?? p.model;
    const effort = tune.effort ?? p.effort;
    let s = this.sessions.get(key);
    // Codex runs MCP tools without an approval request, so a read-only Codex session (a reviewer) never gets any
    if (p.engine === "codex" && readonly) mcp = [];
    const shell = p.engine === "claude" && !readonly && this.claudeShell;
    const mcpKey = [...mcp].sort().join(",") + (shell ? "+sh" : "");
    if (s?.alive && (s.model !== model || s.effort !== effort || (this.mcpOf.get(key) ?? "") !== mcpKey)) {
      if (s.busy) throw new Error(`${p.name} is busy; change model or effort after this turn.`);
      await this.retire(key, s);
    }
    if (!s?.alive) {
      if ([...this.sessions.values()].filter((s) => s.alive).length >= 6)
        throw new Error("Maximum 6 warm processes reached. Wait for idle sessions to sleep.");
      s = p.engine === "codex"
        ? new CodexSession(this.codex, root, model, readonly, effort, this.resumeIds.get(key) ?? resume, mcp)
        : new ClaudeSession(this.claude, root, model, readonly, effort, this.resumeIds.get(key) ?? resume, this.claudeMcpFile(mcp), shell);
      this.mcpOf.set(key, mcpKey);
      this.sessions.set(key, s);
      this.job.add(s.pid);
    }
    return s;
  }
  private async retire(key: string, s: Session) {
    if (s.sessionId) this.resumeIds.set(key, s.sessionId);
    await s.stop();
    this.sessions.delete(key);
  }
  /** models per signed-in engine; an engine whose list fails is left out rather than guessed */
  async catalog(engines: string[]) {
    const out: Partial<Record<Engine, ModelInfo[]>> = {};
    await Promise.all([
      engines.includes("claude") && existsSync(this.claude) ? claudeModels(this.claude, tmpdir()).then((m) => (out.claude = m)).catch(() => {}) : null,
      engines.includes("codex") && (this.codex ||= this.codexExe() || "") ? codexModels(this.codex, tmpdir()).then((m) => (out.codex = m)).catch(() => {}) : null,
    ]);
    return out;
  }
  /** live agent processes, for the UI (not persisted) */
  list() {
    return [...this.sessions]
      .filter(([, s]) => s.alive)
      .map(([key, s]) => ({ room: key.split(":")[0], persona: key.split(":")[1], busy: s.busy }));
  }
  interrupt(room: string) {
    for (const [key, s] of this.sessions)
      if (key.startsWith(room + ":")) s.interrupt();
  }
  async sleep(minutes: number) {
    for (const [key, s] of this.sessions)
      if (!s.busy && Date.now() - s.lastActive > minutes * 60000) {
        await this.retire(key, s);
      }
  }
  async stop() {
    await Promise.all([...this.sessions.values()].map((s) => s.stop()));
    this.sessions.clear();
    this.job.close();
  }
}
