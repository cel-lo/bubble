import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, delimiter, isAbsolute } from "node:path";
import type { EngineReport, PersonaDef, Tune } from "../domain/model";
import { capture } from "./environment";
import { ClaudeSession } from "./claude";
export class Supervisor {
  sessions = new Map<string, ClaudeSession>();
  /** last Claude session id per room:persona:readonly, to resume after a restart */
  private resumeIds = new Map<string, string>();
  claude = join(homedir(), ".local", "bin", "claude.exe");
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
            detail:
              engine === "claude"
                ? "CLI subscription login"
                : "Adapter compatibility verification required",
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
  async get(room: string, p: PersonaDef, root: string, readonly: boolean, tune: Tune = {}) {
    if (p.engine !== "claude")
      throw new Error(`${p.name} runs on ${p.engine}, and Walt's ${p.engine} adapter is not built yet.`);
    const key = room + ":" + p.id + ":" + readonly;
    const model = tune.model ?? p.model;
    const effort = tune.effort ?? p.effort;
    let s = this.sessions.get(key);
    if (s?.alive && (s.model !== model || s.effort !== effort)) {
      if (s.busy) throw new Error(`${p.name} is busy; change model or effort after this turn.`);
      await this.retire(key, s);
    }
    if (!s?.alive) {
      if ([...this.sessions.values()].filter((s) => s.alive).length >= 6)
        throw new Error("Maximum 6 warm processes reached. Wait for idle sessions to sleep.");
      s = new ClaudeSession(this.claude, root, model, readonly, effort, this.resumeIds.get(key));
      this.sessions.set(key, s);
    }
    return s;
  }
  private async retire(key: string, s: ClaudeSession) {
    if (s.sessionId) this.resumeIds.set(key, s.sessionId);
    await s.stop();
    this.sessions.delete(key);
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
  }
}
