/** a persona id; the record lives in State.personas */
export type Persona = string;
export type Engine = "codex" | "claude" | "gemini";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
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
/** effort levels each CLI accepts. claude: `claude --help` 2.1.322. gemini has no effort flag.
 * shortcut: codex values are from its config docs, unverified until the Codex adapter exists */
export const EFFORTS: Record<Engine, Effort[]> = {
  claude: ["low", "medium", "high", "xhigh", "max"],
  codex: ["low", "medium", "high", "xhigh"],
  gemini: [],
};
export const DEFAULT_PERSONAS: PersonaDef[] = [
  { id: "codex", name: "Codex", engine: "codex", model: "", strengths: ["Code changes", "Tests", "Refactors"], avatar: "codex" },
  { id: "claude", name: "Claude Opus", engine: "claude", model: "opus", strengths: ["Planning", "Hard reviews", "Architecture"], avatar: "claude" },
  { id: "sonnet", name: "Claude Sonnet", engine: "claude", model: "sonnet", strengths: ["Quick features", "Docs", "UI copy"], avatar: "sonnet" },
  { id: "gemini", name: "Gemini", engine: "gemini", model: "", strengths: ["Research", "Second opinion", "Long files"], avatar: "gemini" },
];
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
}
export interface Message {
  id: string;
  author: string;
  text: string;
  at: string;
  kind?: string;
  /** what Walt read from @mention and /commands in this message */
  meta?: { to?: Persona; keep?: boolean } & Tune;
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
export interface State {
  revision: number;
  projects: Project[];
  rooms: Room[];
  asks: Ask[];
  engines: EngineReport[];
  personas: PersonaDef[];
  /** live agent processes; added to messages for the UI, never stored */
  procs?: { room: string; persona: Persona; busy: boolean }[];
  settings: {
    locale: "en" | "id";
    theme: "dark" | "light";
    idleMinutes: number;
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
