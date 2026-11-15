import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { NO_TOOLS, kitKey, codexPlugins, type ToolKit } from "./tools";
import { homedir } from "node:os";
import { join, delimiter, isAbsolute, dirname } from "node:path";
import type { EngineReport, PersonaDef, Tune } from "../domain/model";
import { capture } from "./environment";
import { ClaudeSession, claudeModels } from "./claude";
import { CodexSession, codexModels } from "./codex";
import { Job } from "./job";
import { ApiSession, type ApiTarget } from "./api";
import { AcpSession, acpModels, SIGN_IN, type AcpCommand } from "./acp";
import { isApi } from "../domain/model";
import { tmpdir } from "node:os";
import type { Engine, ModelInfo } from "../domain/model";
type Session = ClaudeSession | CodexSession | ApiSession | AcpSession;
/** what every API model is told: it only talks */
const API_SYSTEM = "You are chatting with the user inside Walt, a desktop app. You cannot open, read or change files or run commands; when you need a file, ask the user to paste it. Reply in the language the user writes in.";
export class Supervisor {
  sessions = new Map<string, Session>();
  /** every CLI process goes in here, so a crash of Walt still ends them and what they started */
  readonly job = new Job();
  /** last session/thread id per room:persona:readonly, to resume after a restart */
  private resumeIds = new Map<string, string>();
  claude = join(homedir(), ".local", "bin", "claude.exe");
  /** Settings · Permissions: Claude builders get Bash (approval per command) */
  claudeShell = false;
  /** API providers by engine ("api:groq"): base URL and key, set by the host; keys live only in memory */
  private api = new Map<string, ApiTarget>();
  /** new providers or keys: idle API sessions end, so the next message uses the new key */
  setApi(targets: Map<string, ApiTarget>) {
    this.api = targets;
    for (const [key, s] of this.sessions) if (s instanceof ApiSession && !s.busy) void this.retire(key, s);
  }
  apiTarget(engine: string) {
    return this.api.get(engine);
  }
  codex = "";
  /** Antigravity CLI's ACP server: agy.exe acp (the installer puts agy in %LOCALAPPDATA%\agy\bin) */
  agyCmd(): AcpCommand | undefined {
    const local = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "agy", "bin", "agy.exe") : "";
    const exe = this.find("agy") ?? (local && existsSync(local) ? local : undefined);
    if (!exe) return undefined;
    // agy's ACP server auto-approves workspace edits even in default mode (seen with agy 1.5.9); "strict" makes every
    // tool ask, and Walt answers reads itself. Walt keeps its own agy data folder (~/.gemini/walt) so the owner's agy
    // settings and history stay untouched; the Google login lives in Credential Manager and is shared.
    const dir = join(homedir(), ".gemini", "walt");
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "settings.json"), JSON.stringify({ toolPermission: "strict" }, null, 2));
    } catch {}
    return { exe, args: ["acp", "--app-data-dir", "walt"] };
  }
  /** the models Antigravity listed when the doctor signed in; [] until then */
  private agyModels: ModelInfo[] = [];
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
      ["codex", "claude", "antigravity"].map(async (engine) => {
        const exe =
          engine === "claude" && existsSync(this.claude)
            ? this.claude
            : engine === "codex"
              ? this.codexExe()
              : this.agyCmd()?.exe;
        if (!exe)
          return {
            engine,
            installed: false,
            version: "—",
            auth: "unknown",
            detail: "Not installed / native executable not found",
          };
        try {
          const version = await capture(exe, ["--version"]);
          let detail = engine === "antigravity" ? "Google sign-in" : "CLI subscription login";
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
          } else if (engine === "antigravity") {
            // agy has no status command and keeps its login in Windows Credential Manager: start its ACP server and
            // open a session; that answers "signed in?" and brings the model list.
            // shortcut: this may leave an empty conversation in Antigravity's history; use a status command if agy gets one
            try {
              this.agyModels = await acpModels(this.agyCmd()!, tmpdir());
              auth = "ok";
            } catch (e) {
              auth = (e as Error).message === SIGN_IN ? "required" : "unknown";
              detail = (e as Error).message;
            }
          }
          return {
            engine,
            installed: true,
            version,
            auth,
            detail,
          };
        } catch (e) {
          return {
            engine,
            installed: true,
            version: "unknown",
            auth: "unknown",
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
  /** `resume`: the id saved on the chat, used when this process has none of its own (first turn after a restart); `kit`: its tools */
  async get(room: string, p: PersonaDef, root: string, readonly: boolean, tune: Tune = {}, resume?: string, kit: ToolKit = NO_TOOLS) {
    if (isApi(p.engine) && !this.api.has(p.engine))
      throw new Error(`${p.name}'s API is not set up any more. Add it again in Customize · AI & models.`);
    if (p.engine === "antigravity" && !this.agyCmd())
      throw new Error("Antigravity CLI was not found. Install it (Customize · AI & models shows how), then run agy once to sign in.");
    if (p.engine === "codex" && !(this.codex ||= this.codexExe() || ""))
      throw new Error("Codex CLI was not found. Install it with npm install -g @openai/codex, then sign in with codex login.");
    const key = room + ":" + p.id + ":" + readonly;
    const model = tune.model ?? p.model;
    const effort = tune.effort ?? p.effort;
    let s = this.sessions.get(key);
    const shell = p.engine === "claude" && !readonly && this.claudeShell;
    const mcpKey = kitKey(kit) + (shell ? "+sh" : "");
    if (s?.alive && (s.model !== model || s.effort !== effort || (this.mcpOf.get(key) ?? "") !== mcpKey)) {
      if (s.busy) throw new Error(`${p.name} is busy; change model or effort after this turn.`);
      await this.retire(key, s);
    }
    if (!s?.alive) {
      const warm = [...this.sessions].filter(([, x]) => x.alive && !(x instanceof ApiSession));
      if (warm.length >= 6) {
        // full: the one idle the longest goes to sleep (it resumes its conversation when it is needed again)
        const idle = warm.filter(([, x]) => !x.busy).sort(([, a], [, b]) => a.lastActive - b.lastActive)[0];
        if (!idle) throw new Error("Six AIs are working at once. Wait for one to finish.");
        await this.retire(idle[0], idle[1]);
      }
      s = p.engine === "antigravity"
        ? new AcpSession(this.agyCmd()!, root, model, readonly, effort, this.resumeIds.get(key) ?? resume, kit.instructions)
        : isApi(p.engine)
        ? new ApiSession(this.api.get(p.engine)!, model, [API_SYSTEM, kit.instructions].filter(Boolean).join("\n\n"), effort)
        : p.engine === "codex"
        ? new CodexSession(this.codex, root, model, readonly, effort, this.resumeIds.get(key) ?? resume, kit, codexPlugins())
        : new ClaudeSession(this.claude, root, model, readonly, effort, this.resumeIds.get(key) ?? resume, this.claudeMcpFile(kit.mcp), shell, kit);
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
      // Antigravity's list came with the sign-in check; when it lists none, its own default model
      engines.includes("antigravity") ? (out.antigravity = this.agyModels.length ? this.agyModels : [{ id: "default", label: "Default", efforts: [], isDefault: true }]) : null,
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
      // an API session holds no process, only its conversation: it stays
      if (!(s instanceof ApiSession) && !s.busy && Date.now() - s.lastActive > minutes * 60000) {
        await this.retire(key, s);
      }
  }
  async stop() {
    await Promise.all([...this.sessions.values()].map((s) => s.stop()));
    this.sessions.clear();
    this.job.close();
  }
}
