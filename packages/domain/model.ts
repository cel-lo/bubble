/** a persona id; the record lives in State.personas */
export type Persona = string;
export type Engine = "codex" | "claude" | "gemini";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max" | "ultra";
/** one of the design kit's avatar tiles */
export type Avatar = "codex" | "claude" | "sonnet" | "gemini";
export interface PersonaDef {
  id: string;
  name: string;
  engine: Engine;
  /** model id or alias passed to the CLI; "" = the CLI's default */
  model: string;
  effort?: Effort;
  strengths: string[];
  avatar: Avatar;
}
/** effort levels each CLI accepts. claude: `claude --help` 2.1.322. codex: app-server `model/list` on 0.167.2
 * (gpt-6/6.1 models; the luna models stop at max, Codex rejects ultra there). gemini has no effort flag. */
export const LEVELS: Effort[] = ["low", "medium", "high", "xhigh", "max", "ultra"];
export const EFFORTS: Record<Engine, Effort[]> = {
  claude: ["low", "medium", "high", "xhigh", "max"],
  codex: LEVELS,
  gemini: [],
};
export const DEFAULT_PERSONAS: PersonaDef[] = [
  { id: "codex", name: "Codex", engine: "codex", model: "", strengths: ["Code changes", "Tests", "Refactors"], avatar: "codex" },
  { id: "claude", name: "Claude Opus", engine: "claude", model: "opus", strengths: ["Planning", "Hard reviews", "Architecture"], avatar: "claude" },
  { id: "sonnet", name: "Claude Sonnet", engine: "claude", model: "sonnet", strengths: ["Quick features", "Docs", "UI copy"], avatar: "sonnet" },
  { id: "gemini", name: "Gemini", engine: "gemini", model: "", strengths: ["Research", "Second opinion", "Long files"], avatar: "gemini" },
];
/** a model the signed-in account can use, as the CLI reports it */
export interface ModelInfo {
  id: string;
  label: string;
  efforts: Effort[];
  defaultEffort?: Effort;
  isDefault?: boolean;
  /** shown under "More models" */
  more?: boolean;
}
/** engines Walt can run today; the others stay hidden until their adapter works */
export const ENGINES_ON: Engine[] = ["claude", "codex"];
/** per-message or per-room override of a persona's model/effort */
export interface Tune {
  model?: string;
  effort?: Effort;
}
export type Template = "direct" | "build_review" | "triad" | "roundtable";
export type RoomState =
  | "idle"
  | "running"
  | "paused"
  | "awaiting_user"
  | "ended"
  | "recovery_required";
export interface Project {
  id: string;
  name: string;
  root: string;
  goal: string;
  constraints: string;
  /** MCP servers (by name, from the user's Claude Code / Codex config) turned on for this project; all others stay off */
  mcp?: string[];
}
export interface Message {
  id: string;
  author: string;
  text: string;
  at: string;
  kind?: string;
  /** what Walt read from @mention and /commands in this message */
  meta?: { to?: Persona; keep?: boolean; via?: "island" } & Tune;
}
export interface Artifact {
  revision: number;
  hash: string;
  files: Record<string, string>;
  reviews: { persona: Persona; text: string; hash: string }[];
  accepted: boolean;
}
export interface Room {
  id: string;
  projectId: string;
  title: string;
  template: Template;
  builder: Persona;
  reviewers: Persona[];
  state: RoomState;
  messages: Message[];
  used: number;
  budget: number;
  step: string;
  pause: boolean;
  artifacts: Artifact[];
  packet?: unknown;
  queue: string[];
  /** personas in the room besides builder and reviewers (answer only when mentioned) */
  members?: Persona[];
  /** room defaults set with `/effort … keep` or `/model … keep`; key "*" = everyone */
  tune?: Record<Persona, Tune>;
  /** CLI session / thread id per "persona:readonly", so a chat resumes after a restart and can continue in the CLI */
  sessions?: Record<string, string>;
  /** Auto roles: before each build task Walt makes the best-fitting reviewer the builder */
  auto?: boolean;
}
export interface Ask {
  id: string;
  roomId: string;
  kind: "tool_approval" | "decision" | "info";
  title: string;
  input: unknown;
  persona: Persona;
}
export interface EngineReport {
  engine: string;
  installed: boolean;
  version: string;
  auth: string;
  detail: string;
  quota: "unknown";
}
/** a saved team: which models join a new team chat, in which role, and whether they build or just talk */
export interface TeamTemplate {
  id: string;
  name: string;
  talk: boolean;
  picks: { engine: Engine; model: string; role: "Builder" | "Reviewer" | "Member"; effort?: Effort }[];
}
export interface State {
  revision: number;
  projects: Project[];
  rooms: Room[];
  asks: Ask[];
  engines: EngineReport[];
  personas: PersonaDef[];
  teams?: TeamTemplate[];
  /** models per engine from the signed-in CLIs; refreshed with the doctor */
  catalog?: Partial<Record<Engine, ModelInfo[]>>;
  /** live agent processes; added to messages for the UI, never stored */
  procs?: { room: string; persona: Persona; busy: boolean }[];
  settings: {
    locale: "en" | "id";
    theme: "dark" | "light";
    idleMinutes: number;
    /** model the next new chat starts with */
    lastTarget?: { engine: Engine; model: string; effort?: Effort };
    /** Claude builders get Bash; every command still asks the owner first (Codex always has its shell) */
    claudeShell?: boolean;
    /** Windows notifications when an AI needs you or finishes while Walt is in the background (default on) */
    notify?: boolean;
    /** onboarding (Welcome + Engines) seen */
    onboarded?: boolean;
  };
}
export const budgets: Record<Template, number> = {
  direct: 1,
  build_review: 4,
  triad: 6,
  roundtable: 4,
};
export function overlaps(a: string, b: string) {
  a = a.replaceAll("\\", "/").replace(/\/$/, "").toLowerCase();
  b = b.replaceAll("\\", "/").replace(/\/$/, "").toLowerCase();
  return a === b || a.startsWith(b + "/") || b.startsWith(a + "/");
}
export function takeTurn(room: Room) {
  if (room.used >= room.budget)
    throw new Error("Turn budget exhausted. Continue from Walt to add turns.");
  room.used++;
}
/** "Good at" for a persona Walt makes from a model pick, so Auto roles has something to go on */
export function defaultStrengths(engine: Engine, model: string) {
  if (engine === "codex") return ["Code changes", "Tests", "Refactors"];
  if (/opus|fable/i.test(model)) return ["Planning", "Hard reviews", "Architecture"];
  if (/haiku/i.test(model)) return ["Quick features", "Docs", "Fix small bugs"];
  return ["Quick features", "Docs", "UI copy"];
}
