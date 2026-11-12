export type Persona = "codex" | "claude" | "sonnet" | "gemini";
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
