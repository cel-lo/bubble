/** a persona id; the record lives in State.personas */
export type Persona = string;
/** an app Walt runs (CLI), or an API provider added in Customize ("api:<provider id>") */
export type Engine = "codex" | "claude" | "antigravity" | ApiEngine;
export type ApiEngine = `api:${string}`;
export const isApi = (e: string): e is ApiEngine => e.startsWith("api:");
export type Effort = "low" | "medium" | "high" | "xhigh" | "max" | "ultra";
/** one of the design kit's avatar tiles; an API provider gets a letter tile */
export type Avatar = "codex" | "claude" | "sonnet" | "antigravity" | ApiEngine;
/** an OpenAI-compatible API (Groq, 9Router, OpenRouter …). Its key is kept encrypted by the desktop app, never here */
/** xAI (Grok): Walt uses its Responses API with web and X search instead of chat completions */
export const isXai = (baseUrl: string) => {
  try {
    return /(^|\.)api\.x\.ai$/i.test(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
};
/** one call to an API model, as the API reported it (tokens may be missing when the API does not say) */
export interface ApiCall {
  model: string;
  input?: number;
  output?: number;
  /** server-side tools the API ran for it (Grok: x_search_calls, web_search_calls, x_posts_fetched …) */
  tools?: Record<string, number>;
  ms: number;
  ok: boolean;
  error?: string;
}
/** Customize · AI & models: the call log of every API provider, newest first */
export interface ApiCallLog extends ApiCall {
  at: number;
  /** provider id (the engine is "api:" + id) */
  provider: string;
  room: string;
}
export interface Provider {
  /** short id: the engine is "api:" + id */
  id: string;
  name: string;
  /** base URL ending before /chat/completions, e.g. https://api.groq.com/openai/v1 */
  baseUrl: string;
  /** model new chats with this provider start on; else the first one it lists */
  model?: string;
}
/** the engines a chat can use now: the CLIs with an adapter, then the API providers */
export const enginesOn = (s: { settings: { providers?: Provider[] } }): Engine[] => [...ENGINES_ON, ...(s.settings.providers ?? []).map((p) => `api:${p.id}` as ApiEngine)];
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
 * (gpt-6/6.1 models; the luna models stop at max, Codex rejects ultra there). Antigravity over ACP: none. */
export const LEVELS: Effort[] = ["low", "medium", "high", "xhigh", "max", "ultra"];
export const EFFORTS: Record<"codex" | "claude" | "antigravity", Effort[]> = {
  claude: ["low", "medium", "high", "xhigh", "max"],
  codex: LEVELS,
  antigravity: [],
};
/** API providers take no effort setting */
export const effortsOf = (e: Engine): Effort[] => (EFFORTS as Record<string, Effort[]>)[e] ?? [];
export const DEFAULT_PERSONAS: PersonaDef[] = [
  { id: "codex", name: "Codex", engine: "codex", model: "", strengths: ["Code changes", "Tests", "Refactors"], avatar: "codex" },
  { id: "claude", name: "Claude Opus", engine: "claude", model: "opus", strengths: ["Planning", "Hard reviews", "Architecture"], avatar: "claude" },
  { id: "sonnet", name: "Claude Sonnet", engine: "claude", model: "sonnet", strengths: ["Quick features", "Docs", "UI copy"], avatar: "sonnet" },
  { id: "antigravity", name: "Antigravity", engine: "antigravity", model: "", strengths: ["Second opinion", "Web research", "Long files"], avatar: "antigravity" },
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
export const ENGINES_ON: Engine[] = ["claude", "codex", "antigravity"];
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
  /** to: the first persona mentioned; also: the others mentioned in the same message */
  meta?: { to?: Persona; also?: Persona[]; keep?: boolean; via?: "island"; reset?: string } & Tune;
}
export interface Artifact {
  revision: number;
  hash: string;
  files: Record<string, string>;
  reviews: { persona: Persona; text: string; hash: string }[];
  accepted: boolean;
  /** an old revision whose file list was dropped to keep the saved state small (diff cannot open it) */
  trimmed?: boolean;
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
  /** more builders besides `builder`: they edit files too when mentioned (several at once work in parallel) */
  builders?: Persona[];
  /** personas in the room besides builder and reviewers (answer only when mentioned) */
  members?: Persona[];
  /** room defaults set with `/effort … keep` or `/model … keep`; key "*" = everyone */
  tune?: Record<Persona, Tune>;
  /** CLI session / thread id per "persona:readonly", so a chat resumes after a restart and can continue in the CLI */
  sessions?: Record<string, string>;
  /** context use per persona, from its latest reply in this chat */
  context?: Record<Persona, ContextUse & { at: number }>;
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
  /** API providers: a key is saved for it */
  keyed?: boolean;
}
/** how full a model's context window is, as its CLI reported after the last reply */
export interface ContextUse {
  used: number;
  size: number;
  /** the model that reported it (Claude names its own; others leave it out) */
  model?: string;
}
/** the plan usage the engine reported last: one bar per limit window (5 hours, a week), like the apps' usage popovers */
export interface Quota {
  windows: { mins: number; percent: number; resetsAt: number }[];
  /** the plan refuses messages right now */
  limited: boolean;
  at: string;
}
/** Settings · Plugins & tools. Unset = the default (on, except browser and computer use) */
/** Settings · Browser. Unset = the default in brackets */
export interface BrowserSettings {
  /** what the address bar searches with (google) */
  search?: "google" | "duckduckgo" | "bing";
  /** web links in chat messages open in Walt's Browser tab, or in your own browser (walt) */
  links?: "walt" | "system";
  /** Annotate sends a picture of the page with the marks; off = the notes only, fewer tokens (on) */
  shots?: boolean;
  /** pages may download files, each with a Save as dialog (off) */
  downloads?: boolean;
}
export interface ToolSettings {
  /** ChatGPT image generation in Codex */
  images?: boolean;
  /** web search: Codex's own, Claude's WebSearch / WebFetch */
  web?: boolean;
  /** ChatGPT apps and connectors in Codex */
  apps?: boolean;
  /** all Codex plugins and skills; single ones are switched off in `off` */
  codexPlugins?: boolean;
  /** all Claude Code plugins and skills; single ones are switched off in `off` */
  claudePlugins?: boolean;
  /** the connectors of your claude.ai account (Gmail, Calendar, Claude Docs…) in Claude */
  connectors?: boolean;
  /** Codex browser use and computer use act on your screen: off unless turned on */
  browser?: boolean;
  computer?: boolean;
  /** single items switched off: "mcp:<server>", "claude:<plugin id>", "codex:<plugin id>" */
  off?: string[];
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
  /** plan usage per engine; Codex reports it any time, Claude with each reply */
  usage?: Partial<Record<Engine, Quota>>;
  /** API calls, newest first (the last 200) */
  apiCalls?: ApiCallLog[];
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
    /** the Ce:L island may answer DECISION: questions (default on); tool approvals always open Walt */
    islandAnswers?: boolean;
    tools?: ToolSettings;
    /** Customize · Instructions: sent to every AI, like ChatGPT's custom instructions */
    instructions?: string;
    /** the window's close button: hide to the tray (default, so the island stays connected) or quit Walt */
    closeAction?: "tray" | "quit";
    /** Windows notifications when an AI needs you or finishes while Walt is in the background (default on) */
    notify?: boolean;
    /** onboarding (Welcome + Engines) seen */
    onboarded?: boolean;
    /** Customize · AI & models · API providers */
    providers?: Provider[];
    /** Settings · Browser (the side panel's browser) */
    browser?: BrowserSettings;
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
/** everyone in the room who may edit files: the builder first, then the extra builders */
export const buildersOf = (r: Room): Persona[] => [r.builder, ...(r.builders ?? []).filter((p) => p !== r.builder)];
export function takeTurn(room: Room) {
  if (room.used >= room.budget)
    throw new Error("Turn budget exhausted. Continue from Walt to add turns.");
  room.used++;
}
/** "Good at" for a persona Walt makes from a model pick, so Auto roles has something to go on */
export function defaultStrengths(engine: Engine, model: string) {
  if (engine === "codex") return ["Code changes", "Tests", "Refactors"];
  if (engine === "antigravity") return ["Second opinion", "Web research", "Long files"];
  // an API model only talks: it cannot read or edit the project
  if (isApi(engine)) return ["Second opinion", "Explaining", "Writing"];
  if (/opus|fable/i.test(model)) return ["Planning", "Hard reviews", "Architecture"];
  if (/haiku/i.test(model)) return ["Quick features", "Docs", "Fix small bugs"];
  return ["Quick features", "Docs", "UI copy"];
}
