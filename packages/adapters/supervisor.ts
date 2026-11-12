import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, delimiter, isAbsolute } from "node:path";
import type { EngineReport, Persona } from "../domain/model";
import { capture } from "./environment";
import { ClaudeSession } from "./claude";
export class Supervisor {
  sessions = new Map<string, ClaudeSession>();
  claude = join(homedir(), ".local", "bin", "claude.exe");
  find(name: string) {
    const dirs = (process.env.PATH || "").split(delimiter).filter(isAbsolute);
    return dirs.map((d) => join(d, name + ".exe")).find(existsSync);
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
  get(room: string, persona: Persona, root: string, readonly: boolean) {
    if (persona !== "claude" && persona !== "sonnet")
      throw new Error(
        `${persona} adapter is not verified on this laptop. Select Claude Opus or Sonnet.`,
      );
    const key = room + ":" + persona + ":" + readonly;
    let s = this.sessions.get(key);
    if (!s?.alive) {
      if ([...this.sessions.values()].filter((s) => s.alive).length >= 6)
        throw new Error(
          "Maximum 6 warm processes reached. Wait for idle sessions to sleep.",
        );
      s = new ClaudeSession(
        this.claude,
        root,
        persona === "sonnet" ? "sonnet" : "opus",
        readonly,
      );
      this.sessions.set(key, s);
    }
    return s;
  }
  interrupt(room: string) {
    for (const [key, s] of this.sessions)
      if (key.startsWith(room + ":")) s.interrupt();
  }
  async sleep(minutes: number) {
    for (const [key, s] of this.sessions)
      if (!s.busy && Date.now() - s.lastActive > minutes * 60000) {
        await s.stop();
        this.sessions.delete(key);
      }
  }
  async stop() {
    await Promise.all([...this.sessions.values()].map((s) => s.stop()));
    this.sessions.clear();
  }
}
