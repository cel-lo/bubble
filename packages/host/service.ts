import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { Store } from "../storage/store";
import { Supervisor } from "../adapters/supervisor";
import {
  budgets,
  overlaps,
  takeTurn,
  type State,
  type Room,
  type Persona,
  type Template,
  type PersonaDef,
  type Message,
  type Tune,
  DEFAULT_PERSONAS,
  EFFORTS,
  effortsOf,
  isApi,
  enginesOn,
  type Provider,
  type Engine,
  type Effort,
  type TeamTemplate,
  defaultStrengths,
  type EngineReport,
} from "../domain/model";
import { parseMessage, decision, autoBuilder, plain, usageLimit, type Parsed } from "../domain/command";
import { canonicalRoot, manifest } from "./files";
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn, execFile } from "node:child_process";
import { cleanEnv } from "../adapters/environment";
import { userMcpServers } from "../adapters/codex";
import { ApiSession, apiModels } from "../adapters/api";
import { NO_TOOLS, resolveTools, claudePlugins, codexPlugins, media, synced, usage, syncedPlugin, attachments, saveImage, IMAGE_EXT, skillsIn, pluginSkills, codexPluginDir, type ToolKit } from "../adapters/tools";

const WALT_MD = "<!-- Written by Walt from a chat. Export again to refresh it; delete it any time. -->";

/** a reviewer's last "VERDICT: APPROVE | CHANGES" line: true, false, or undefined when it gave none */
export function verdict(text: string) {
  const v = [...text.matchAll(/VERDICT:\s*\**\s*(APPROVE|CHANGES)/gi)].at(-1)?.[1].toUpperCase();
  return v === "APPROVE" ? true : v === "CHANGES" ? false : undefined;
}
export class Host extends EventEmitter {
  state: State;
  readonly supervisor = new Supervisor();
  private leases = new Map<string, string>();
  private answers = new Map<string, (allow: boolean) => void>();
  private active = new Set<string>();
  constructor(readonly store: Store) {
    // generated pictures live with the rest of Walt's data
    media.dir = join(store.dir, "images");
    synced.dir = join(store.dir, "claude-skills");
    super();
    this.state = store.load();
    this.syncApi();
    usage.report = (engine, q) => {
      this.state.usage = { ...this.state.usage, [engine]: q };
      this.commit("engine.usage");
    };
    if (!this.state.personas?.length) this.state.personas = structuredClone(DEFAULT_PERSONAS);
    // Gemini CLI is gone (Google stopped it for personal accounts): its personas carry on as Antigravity
    for (const p of this.state.personas)
      if ((p.engine as string) === "gemini") Object.assign(p, { engine: "antigravity", avatar: "antigravity", model: "", effort: undefined, name: p.name === "Gemini" ? "Antigravity" : p.name });
    if (!this.state.personas.some((p) => p.engine === "antigravity")) this.state.personas.push(structuredClone(DEFAULT_PERSONAS.find((p) => p.engine === "antigravity")!));
    for (const r of this.state.rooms)
      if (["running", "awaiting_user"].includes(r.state)) {
        r.state = "recovery_required";
        r.pause = true;
        r.messages.push({
          id: randomUUID(),
          author: "Walt",
          text: "The previous run has no terminal receipt. Inspect project files before retrying; nothing was replayed.",
          at: new Date().toISOString(),
        });
      }
    for (const room of this.state.rooms) {
      if (room.state === "recovery_required") {
        const project = this.state.projects.find(
          (p) => p.id === room.projectId,
        );
        if (project) this.leases.set(project.root, room.id);
      }
    }
    this.state.asks = [];
    this.commit("recovery");
  }
  commit(type = "state.updated") {
    this.store.save(this.state, type);
    this.emit("state", this.state);
  }
  room(id: string) {
    const r = this.state.rooms.find((r) => r.id === id);
    if (!r) throw new Error("Room not found");
    return r;
  }
  persona(id: string) {
    const p = this.state.personas.find((p) => p.id === id);
    if (!p) throw new Error(`Persona ${id} not found`);
    return p;
  }
  private inRoom(r: Room) {
    return [r.builder, ...r.reviewers, ...(r.members || [])];
  }
  /** effective model/effort: this message > room default for the persona > room default for everyone > persona */
  private tune(r: Room, p: PersonaDef, msg: Tune): Tune {
    const t = { ...r.tune?.["*"], ...r.tune?.[p.id] };
    if (msg.effort) t.effort = msg.effort;
    if (msg.model) t.model = msg.model;
    if (t.effort && !effortsOf(p.engine).includes(t.effort))
      throw new Error(effortsOf(p.engine).length ? `${p.name} accepts effort ${effortsOf(p.engine).join(", ")}.` : `${p.name} runs on ${p.engine}, which has no effort setting.`);
    return t;
  }
  savePersona(input: Omit<PersonaDef, "id"> & { id?: string }) {
    const name = input.name.trim();
    if (!name) throw new Error("Give the persona a name.");
    if (this.state.personas.some((p) => p.id !== input.id && p.name.toLowerCase() === name.toLowerCase()))
      throw new Error("Another persona already has that name.");
    if (input.effort && !effortsOf(input.engine).includes(input.effort))
      throw new Error(`${input.engine} does not accept effort ${input.effort}.`);
    // an API has no "default model": store the one Customize picked, so the persona keeps working
    if (isApi(input.engine) && (!input.model || input.model === "default")) {
      const def = this.state.catalog?.[input.engine]?.find((m) => m.isDefault)?.id;
      if (!def) throw new Error("Walt has no model list for this API yet. Check its key in Customize · AI & models.");
      input = { ...input, model: def };
    }
    const old = input.id ? this.persona(input.id) : undefined;
    const id = old?.id ?? (name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "persona") + "-" + randomUUID().slice(0, 4);
    const p: PersonaDef = { ...input, name, id };
    if (!p.effort) delete p.effort;
    if (old) {
      for (const k of Object.keys(old) as (keyof PersonaDef)[]) delete old[k];
      Object.assign(old, p);
    } else this.state.personas.push(p);
    this.commit("persona.saved");
    return p;
  }
  /** the persona for an engine + model (+ effort), made on first use and named after the model, e.g. "Haiku 5.5" */
  personaFor(t: { engine: Engine; model: string; effort?: Effort }) {
    // an API has no "default model" of its own: use the one picked in Customize, else the first it lists
    if (isApi(t.engine) && (!t.model || t.model === "default")) {
      const id = this.state.catalog?.[t.engine]?.find((m) => m.isDefault)?.id;
      if (!id) throw new Error("Walt has no model list for this API yet. Check its key in Customize · AI & models.");
      t = { ...t, model: id, effort: undefined };
    }
    const same =(p: PersonaDef) => p.engine === t.engine && (p.model || "default") === (t.model || "default") && p.effort === t.effort;
    const hit = this.state.personas.find(same);
    if (hit) return hit;
    const info = this.state.catalog?.[t.engine]?.find((m) => m.id === t.model);
    if (this.state.catalog?.[t.engine] && !info) throw new Error(`${t.model} is not available for this account.`);
    const base = (info && info.label !== "Default" ? info.label : `${{ codex: "Codex", claude: "Claude", antigravity: "Antigravity" }[t.engine as string] ?? t.engine} default`) + (t.effort ? ` ${t.effort}` : "");
    let name = base;
    for (let i = 2; this.state.personas.some((p) => p.name.toLowerCase() === name.toLowerCase()); i++) name = `${base} (${i})`;
    const avatar = t.engine === "claude" ? "claude" : t.engine;
    return this.savePersona({ name, engine: t.engine, model: t.model, effort: t.effort, strengths: defaultStrengths(t.engine, t.model), avatar });
  }
  /** MCP servers found in the user's Claude Code and Codex configs */
  mcpServers() {
    const claude = Object.keys(this.supervisor.claudeMcp());
    const codex = userMcpServers();
    const off = new Set(this.state.settings.tools?.off ?? []);
    return [...new Set([...claude, ...codex])].sort().map((name) => ({
      name,
      engines: [claude.includes(name) && "claude", codex.includes(name) && "codex"].filter(Boolean) as Engine[],
      on: !off.has("mcp:" + name),
    }));
  }
  /** a picture you pasted, dropped or picked in the composer: saved with the others, named for the message */
  saveAttachment(base64: string, ext: string) {
    if (!IMAGE_EXT.includes(ext)) throw new Error("Attach a PNG, JPEG, WebP or GIF picture.");
    const md = saveImage(`att-${Date.now()}-${randomUUID().slice(0, 8)}`, base64, "attached image", ext);
    return { markdown: md, name: md.match(/img\/([^)]+)\)/)![1] };
  }
  /** Settings · Plugins & tools: the switches, and every plugin and MCP server Walt found */
  tools() {
    const t = this.state.settings.tools ?? {};
    const off = new Set(t.off ?? []);
    return {
      switches: { images: t.images ?? true, web: t.web ?? true, apps: t.apps ?? true, connectors: t.connectors ?? true, codexPlugins: t.codexPlugins ?? true, claudePlugins: t.claudePlugins ?? true, browser: t.browser ?? false, computer: t.computer ?? false },
      claude: [...claudePlugins(), ...[syncedPlugin()].filter((p) => !!p)].map((p) => ({ id: p!.id, name: p!.name, version: p!.version, on: !off.has("claude:" + p!.id) })),
      codex: codexPlugins().map((id) => ({ id, name: id.split("@")[0], on: !off.has("codex:" + id) })),
      mcp: this.mcpServers(),
    };
  }
  /** the skills the AI can use now, per plugin that is switched on: the composer's + menu lists them */
  skills() {
    const k = this.kit(false);
    const groups: { engine: Engine; plugin: string; skills: { name: string; description: string }[] }[] = [
      ...k.claudePlugins.map((p) => ({ engine: "claude" as Engine, plugin: p.id === "claude-ai-skills" ? "claude.ai" : p.id.split("@")[0], skills: pluginSkills(p.dir) })),
      ...k.codexPlugins.map((id) => ({ engine: "codex" as Engine, plugin: id.split("@")[0], skills: ((d) => (d ? pluginSkills(d) : []))(codexPluginDir(id)) })),
      // the user's own Codex skills come along whenever Codex plugins are on
      ...(k.codexPlugins.length ? [{ engine: "codex" as Engine, plugin: "Your skills", skills: skillsIn(join(homedir(), ".codex", "skills")) }] : []),
    ];
    return groups.filter((g) => g.skills.length);
  }
  /** flip a switch (`key` in ToolSettings) or one item ("mcp:x", "claude:id", "codex:id"); live sessions restart on their next turn */
  setTool(key: string, on: boolean) {
    const t = (this.state.settings.tools ??= {});
    if (/^(mcp|claude|codex):/.test(key)) t.off = on ? (t.off ?? []).filter((k) => k !== key) : [...new Set([...(t.off ?? []), key])];
    else if (["images", "web", "apps", "connectors", "codexPlugins", "claudePlugins", "browser", "computer"].includes(key)) (t as Record<string, unknown>)[key] = on;
    else throw new Error("Unknown tool switch " + key);
    this.commit("settings.tools");
    return this.tools();
  }
  /** what a turn may use: reviewers only read the project, everyone else gets Plugins & tools */
  private kit(reviewer: boolean): ToolKit {
    const instructions = (this.state.settings.instructions ?? "").trim();
    if (reviewer) return { ...NO_TOOLS, instructions };
    return { ...resolveTools(this.state.settings.tools, this.mcpServers().map((s) => s.name)), instructions };
  }
  /** save a team template; a template with the same name is replaced */
  saveTeam(input: Omit<TeamTemplate, "id">) {
    const name = input.name.trim();
    if (!name) throw new Error("Give the template a name.");
    if (input.picks.length < 2) throw new Error("A team template needs at least two models.");
    if (!input.talk && input.picks.filter((p) => p.role === "Builder").length !== 1) throw new Error("A build team needs exactly one builder.");
    if (!input.talk && input.picks.some((p) => p.role === "Builder" && isApi(p.engine))) throw new Error("An API model cannot edit files, so it cannot be the builder. Pick Claude or Codex to build.");
    const teams = (this.state.teams ??= []);
    const old = teams.find((x) => x.name.toLowerCase() === name.toLowerCase());
    const t: TeamTemplate = { ...input, name, id: old?.id ?? randomUUID() };
    this.state.teams = old ? teams.map((x) => (x === old ? t : x)) : [...teams, t];
    this.commit("team.saved");
    return t;
  }
  deleteTeam(id: string) {
    this.state.teams = (this.state.teams ?? []).filter((x) => x.id !== id);
    this.commit("team.deleted");
  }
  deletePersona(id: string) {
    const used = this.state.rooms.filter((r) => r.state !== "ended" && this.inRoom(r).includes(id));
    if (used.length) throw new Error(`Remove it from ${used.map((r) => r.title).join(", ")} first.`);
    this.persona(id);
    this.state.personas = this.state.personas.filter((p) => p.id !== id);
    this.commit("persona.deleted");
  }
  /** add a persona to a room as reviewer or plain member (answers when mentioned), or take it out */
  member(roomId: string, persona: string, role: "Builder" | "Reviewer" | "Member" | "Remove") {
    const r = this.room(roomId);
    if (this.active.has(roomId)) throw new Error("Change the team after this run.");
    this.persona(persona);
    if (persona === r.builder) throw new Error("Pick another builder before moving this persona.");
    if (role === "Builder" && r.template === "roundtable") throw new Error("A roundtable has no builder.");
    if (role === "Builder" && r.template !== "direct") this.canBuild(persona);
    r.reviewers = r.reviewers.filter((p) => p !== persona);
    r.members = (r.members || []).filter((p) => p !== persona);
    if (role === "Builder") this.swapBuilder(r, persona);
    if (role === "Reviewer") r.reviewers.push(persona);
    if (role === "Member") r.members.push(persona);
    this.commit("room.members");
    return r;
  }
  /** `persona` builds; the old builder reviews in its place */
  private swapBuilder(r: Room, persona: string) {
    const old = r.builder;
    r.reviewers = r.reviewers.map((p) => (p === persona ? old : p));
    if (!r.reviewers.includes(old)) r.reviewers.unshift(old);
    r.members = (r.members || []).filter((p) => p !== persona);
    r.builder = persona;
  }
  setAuto(roomId: string, on: boolean) {
    const r = this.room(roomId);
    r.auto = on;
    this.commit("room.auto");
    return r;
  }
  async doctor() {
    const api = this.state.engines.filter((e) => isApi(e.engine));
    this.state.engines = [...(await this.supervisor.doctor()), ...api];
    this.commit("engine.auth");
    const ok = this.state.engines.filter((e) => e.auth === "ok").map((e) => e.engine);
    this.state.catalog = { ...this.state.catalog, ...(await this.supervisor.catalog(ok)) };
    this.commit("engine.catalog");
    await this.checkApis();
    return this.state.engines;
  }

  // ---------- API providers (Groq, 9Router …): settings here, keys only in memory ----------
  private keys = new Map<string, string>();
  /** the desktop app decrypts the saved keys and hands them over at start and after each change */
  setKeys(keys: Record<string, string>) {
    this.keys = new Map(Object.entries(keys));
    this.syncApi();
    return this.checkApis();
  }
  private syncApi() {
    this.supervisor.setApi(new Map((this.state.settings.providers ?? []).map((p) => [`api:${p.id}`, { baseUrl: p.baseUrl, key: this.keys.get(p.id) }])));
  }
  /** list each provider's models with its key: that is the sign-in check, and the models go in the pickers */
  async checkApis(only?: string) {
    const providers = (this.state.settings.providers ?? []).filter((p) => !only || p.id === only);
    await Promise.all(
      providers.map(async (p) => {
        const engine = `api:${p.id}` as const;
        const keyed = this.keys.has(p.id);
        let report: EngineReport;
        try {
          const models = await apiModels({ baseUrl: p.baseUrl, key: this.keys.get(p.id) });
          if (!models.length) throw new Error("The API lists no chat models.");
          const def = models.find((m) => m.id === p.model) ?? models[0];
          this.state.catalog = { ...this.state.catalog, [engine]: models.map((m) => ({ ...m, isDefault: m === def })) };
          report = { engine, installed: true, version: new URL(p.baseUrl).host, auth: "ok", detail: `${models.length} models`, keyed };
        } catch (e) {
          const msg = String((e as Error).message ?? e);
          report = { engine, installed: true, version: new URL(p.baseUrl).host, auth: /\b40[13]\b/.test(msg) || (!keyed && /\b4\d\d\b/.test(msg)) ? "required" : "error", detail: /fetch failed|ECONNREFUSED|timeout/i.test(msg) ? `Cannot reach ${p.baseUrl}. Is it running?` : msg, keyed };
        }
        this.state.engines = [...this.state.engines.filter((x) => x.engine !== engine), report];
      }),
    );
    this.commit("engine.api");
    return this.state.engines.filter((e) => isApi(e.engine));
  }
  /** add or change a provider (name, base URL, default model); its key is saved by the desktop app */
  async saveProvider(input: { id?: string; name: string; baseUrl: string; model?: string }) {
    const name = input.name.trim();
    if (!name || name.length > 40) throw new Error("Give the API a name (up to 40 characters).");
    let base: URL;
    try {
      base = new URL(input.baseUrl.trim());
    } catch {
      throw new Error("The base URL is not a web address, e.g. https://api.groq.com/openai/v1");
    }
    if (!/^https?:$/.test(base.protocol)) throw new Error("The base URL must start with https:// (or http:// for one on this laptop).");
    const list = (this.state.settings.providers ??= []);
    const old = input.id ? list.find((p) => p.id === input.id) : undefined;
    if (input.id && !old) throw new Error("That API was removed.");
    if (list.some((p) => p !== old && p.name.toLowerCase() === name.toLowerCase())) throw new Error(`There is already an API called ${name}.`);
    let id = old?.id ?? (name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "api");
    for (let i = 2; !old && list.some((p) => p.id === id); i++) id = id.replace(/-\d+$/, "") + "-" + i;
    const p: Provider = { id, name, baseUrl: base.toString().replace(/\/+$/, ""), ...(input.model ? { model: input.model } : {}) };
    this.state.settings.providers = old ? list.map((x) => (x === old ? p : x)) : [...list, p];
    this.syncApi();
    this.commit("provider.saved");
    await this.checkApis(id);
    return p;
  }
  /** take a provider out; refused while a chat still has one of its models */
  removeProvider(id: string) {
    const engine = `api:${id}`;
    const mine = new Set(this.state.personas.filter((p) => p.engine === engine).map((p) => p.id));
    const used = this.state.rooms.filter((r) => r.state !== "ended" && this.inRoom(r).some((p) => mine.has(p)));
    if (used.length) throw new Error(`Its models are still in ${used.map((r) => r.title).join(", ")}. Remove them or end those chats first.`);
    this.state.settings.providers = (this.state.settings.providers ?? []).filter((p) => p.id !== id);
    this.state.personas = this.state.personas.filter((p) => !mine.has(p.id));
    this.state.engines = this.state.engines.filter((e) => e.engine !== engine);
    if (this.state.catalog) delete this.state.catalog[engine as Engine];
    if (this.state.settings.lastTarget?.engine === engine) delete this.state.settings.lastTarget;
    this.keys.delete(id);
    this.syncApi();
    this.commit("provider.removed");
  }
  /** API models only talk: they cannot be the one who edits the project */
  private canBuild(persona: string) {
    const p = this.persona(persona);
    if (isApi(p.engine)) throw new Error(`${p.name} works through an API, so it can chat and review but cannot edit files. Make a Claude or Codex model the builder.`);
  }
  projectOf(r: Room) {
    return r.projectId ? this.state.projects.find((p) => p.id === r.projectId) : undefined;
  }
  /** a chat without a project runs in its own empty folder under Walt's data, read-only */
  rootOf(r: Room) {
    const p = this.projectOf(r);
    if (p) return p.root;
    const dir = join(this.store.dir, "chats", r.id);
    mkdirSync(dir, { recursive: true });
    return dir;
  }
  /** the persona slot a chat uses for an engine: the current one if it matches, else the first of that engine */
  private slot(r: Room, engine: Engine) {
    if (this.persona(r.builder).engine === engine) return r.builder;
    const p = this.state.personas.find((p) => p.engine === engine);
    // an API added in Customize gets its first persona when a chat first picks it
    if (!p && isApi(engine)) return this.personaFor({ engine, model: "default" }).id;
    if (!p) throw new Error(`No persona runs on ${engine}.`);
    return p.id;
  }
  /** pick the model (and effort) a plain chat talks to, like the model menu in the Claude or ChatGPT app */
  setTarget(roomId: string, t: { engine: Engine; model: string; effort?: Effort }) {
    const r = this.room(roomId);
    if (r.template !== "direct") throw new Error("Team chats pick models per member in the Team panel.");
    if (this.active.has(roomId)) throw new Error("Change the model after this reply.");
    if (isApi(t.engine) && (!t.model || t.model === "default")) t = { ...t, model: this.state.catalog?.[t.engine]?.find((m) => m.isDefault)?.id ?? t.model };
    const info = this.state.catalog?.[t.engine]?.find((m) => m.id === t.model);
    if (this.state.catalog?.[t.engine] && !info) throw new Error(`${t.model} is not available for this account.`);
    if (t.effort && info && !info.efforts.includes(t.effort)) throw new Error(`${info.label} accepts effort ${info.efforts.join(", ") || "none"}.`);
    const p = this.slot(r, t.engine);
    r.builder = p;
    r.tune = { ...r.tune, [p]: { model: t.model, ...(t.effort && { effort: t.effort }) } };
    this.state.settings.lastTarget = t;
    this.commit("room.target");
    return r;
  }
  /** a new plain chat, in a project or on its own, talking to the last model you picked */
  newChat(projectId: string) {
    if (projectId && !this.state.projects.some((p) => p.id === projectId)) throw new Error("Project not found");
    const t = this.state.settings.lastTarget ?? { engine: "claude" as Engine, model: "default" };
    const builder = this.state.personas.find((p) => p.engine === t.engine)?.id ?? this.state.personas[0].id;
    const r = this.createRoom({ projectId, title: "New chat", template: "direct", builder, reviewers: [] });
    r.tune = { [builder]: { model: t.model, ...(t.effort && { effort: t.effort }) } };
    this.commit();
    return r;
  }
  /** starts a command line in a new terminal window (tests replace it) */
  launch = (cmdline: string) =>
    spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", cmdline], { windowsVerbatimArguments: true, detached: true, stdio: "ignore", env: cleanEnv() }).unref();
  /** open a terminal in the chat's folder that resumes the CLI session, so the conversation continues outside Walt */
  continueInCli(roomId: string, persona?: Persona) {
    const r = this.room(roomId);
    const who = persona ?? r.builder;
    const p = this.persona(who);
    const id = r.sessions?.[`${who}:false`] ?? r.sessions?.[`${who}:true`];
    if (!id) throw new Error(`${p.name} has not answered in this chat yet, so there is nothing to continue.`);
    if (!/^[\w-]{1,100}$/.test(id)) throw new Error("This chat's session id looks wrong; Walt will not pass it to a terminal.");
    const dir = this.rootOf(r);
    // inside "…" cmd takes & | ^ < > literally, but still expands %VAR%
    if (/["%]/.test(dir)) throw new Error("The folder name has a % or quote, which the terminal cannot take. Open it yourself and resume there.");
    if (isApi(p.engine) || p.engine === "antigravity") throw new Error(`${p.name} has no terminal app to continue in.`);
    const exe = p.engine === "codex" ? this.supervisor.codex || this.supervisor.codexExe() : this.supervisor.claude;
    if (!exe || /["%]/.test(exe)) throw new Error(`${p.engine === "codex" ? "Codex CLI" : "Claude Code"} was not found.`);
    const args = p.engine === "codex" ? `resume ${id}` : `--resume ${id}`;
    const cmdline = `start "Walt" /D "${dir}" "${exe}" ${args}`;
    this.launch(cmdline);
    return { command: `${p.engine === "codex" ? "codex" : "claude"} ${args}`, dir };
  }
  /** the chat as Markdown: project, team, latest revision and the recent conversation (last 40 messages) */
  contextMarkdown(r: Room) {
    const p = this.projectOf(r);
    const name = (id: string, model?: string) => {
      const d = this.state.personas.find((x) => x.id === id);
      const m = model ?? r.tune?.[id]?.model ?? (d?.model || "default");
      const list = (d && this.state.catalog?.[d.engine]) || [];
      const label = (list.find((x) => x.id === m) ?? (m === "default" ? list.find((x) => x.isDefault) : undefined))?.label;
      if (id === "cello") return "You";
      if (!d) return id;
      if (r.template === "direct" && label && label !== "Default") return label;
      return label && label !== "Default" && label !== d.name ? `${d.name} (${label})` : d.name;
    };
    const role = (id: string) => (id === r.builder ? "builder, can edit files" : r.reviewers.includes(id) ? "reviewer, read-only" : "member, answers when @mentioned");
    const a = r.artifacts.at(-1);
    return [
      WALT_MD,
      `# ${p ? p.name + " · " : ""}${r.title}`,
      `Exported ${new Date().toLocaleString("sv-SE").slice(0, 16)} from Walt.`, // sv-SE gives local time as YYYY-MM-DD HH:MM
      p && `## Project\n\n- Folder: ${p.root}\n- Goal: ${p.goal || "-"}\n- Rules: ${p.constraints.trim().replace(/\n+/g, "; ") || "-"}`,
      r.template !== "direct" && `## Team\n\n${[r.builder, ...r.reviewers, ...(r.members || [])].map((id) => `- ${name(id)}: ${role(id)}`).join("\n")}`,
      a && `## Latest revision\n\nr${a.revision} · ${a.accepted ? "accepted" : "not accepted yet"} · reviewed by ${a.reviews.map((v) => name(v.persona)).join(", ") || "nobody"}`,
      `## Conversation (last ${Math.min(40, r.messages.length)} messages)`,
      ...r.messages
        .filter((m) => m.text.trim() && m.kind !== "setting")
        .slice(-40)
        .map((m) => `**${m.author === "Walt" ? "Walt" : name(m.author, m.meta?.model)}:** ${m.text.trim().slice(0, 4000)}`),
    ]
      .filter(Boolean)
      .join("\n\n") + "\n";
  }
  /** write WALT.md into the project (only over a WALT.md Walt wrote); a chat without a project gets the text back */
  exportContext(roomId: string) {
    const r = this.room(roomId);
    const text = this.contextMarkdown(r);
    const p = this.projectOf(r);
    if (!p) return { text };
    const file = join(p.root, "WALT.md");
    if (existsSync(file) && !readFileSync(file, "utf8").startsWith(WALT_MD)) throw new Error("This project already has a WALT.md that Walt did not write. Rename it, then export again.");
    writeFileSync(file, text);
    return { path: file, text };
  }
  rename(roomId: string, title: string) {
    this.room(roomId).title = title.trim().slice(0, 80) || "New chat";
    this.commit();
  }
  deleteRoom(roomId: string) {
    if (this.active.has(roomId)) throw new Error("Stop the reply before deleting this chat.");
    this.room(roomId);
    this.state.rooms = this.state.rooms.filter((r) => r.id !== roomId);
    this.state.asks = this.state.asks.filter((a) => a.roomId !== roomId);
    this.commit("room.deleted");
  }
  async project(input: {
    name: string;
    root: string;
    goal: string;
    constraints: string;
  }) {
    const root = await canonicalRoot(input.root);
    if (this.state.projects.some((p) => overlaps(root, p.root)))
      throw new Error(
        "This folder overlaps an existing project. Use that project.",
      );
    const p = { ...input, root, id: randomUUID() };
    this.state.projects.push(p);
    this.commit();
    return p;
  }
  createRoom(input: {
    projectId: string;
    title: string;
    template: Template;
    builder: Persona;
    reviewers: Persona[];
  }) {
    if (input.projectId && !this.state.projects.some((p) => p.id === input.projectId))
      throw new Error("Project not found");
    if (!input.projectId && !["direct", "roundtable"].includes(input.template))
      throw new Error("A chat without a project can only talk; pick a project folder to build and review.");
    for (const p of [input.builder, ...input.reviewers]) this.persona(p);
    if (input.template === "build_review" || input.template === "triad") this.canBuild(input.builder);
    const r: Room = {
      ...input,
      id: randomUUID(),
      state: "idle",
      messages: [],
      used: 0,
      budget: budgets[input.template],
      step: "ready",
      pause: false,
      artifacts: [],
      queue: [],
    };
    this.state.rooms.push(r);
    this.commit();
    return r;
  }
  message(r: Room, author: string, text: string, kind?: string) {
    const m: Message = {
      id: randomUUID(),
      author,
      text,
      at: new Date().toISOString(),
      kind,
    };
    r.messages.push(m);
    this.commit();
    return m;
  }
  /** the open DECISION: question in a chat (the last message, from an AI, with the chat not working), or none */
  decisionOf(r: Room) {
    const last = r.messages.at(-1);
    if (!last || this.active.has(r.id) || r.state === "running" || !this.state.personas.some((p) => p.id === last.author)) return undefined;
    const d = decision(last.text);
    return d && { asker: last.author, ...d };
  }
  /** answer a decision: back to the builder as a plain message, to anyone else as an @mention */
  async decide(roomId: string, option: string, via?: "island") {
    const r = this.room(roomId);
    const d = this.decisionOf(r);
    // the island sends the option as it showed it (plain text); match either form
    const picked = d?.options.find((o) => o === option || plain(o) === option);
    if (!d || !picked) throw new Error("That decision was already answered.");
    const direct = r.template === "direct" || d.asker === r.builder;
    await this.send(roomId, direct ? picked : `@${this.persona(d.asker).name} ${picked}`, via);
  }
  async send(id: string, text: string, via?: "island") {
    const r = this.room(id);
    if (r.state === "ended" || r.state === "recovery_required")
      throw new Error("Resolve recovery or create a new room first.");
    const cmd = parseMessage(text, this.state.personas);
    if (cmd.to && !this.inRoom(r).includes(cmd.to))
      throw new Error(`${this.persona(cmd.to).name} is not in this room. Add it from the room header first.`);
    // check the effort against every persona it could apply to, before anything is stored
    for (const p of cmd.to ? [cmd.to] : this.inRoom(r)) this.tune(r, this.persona(p), { effort: cmd.effort, model: cmd.model });
    const meta = cmd.to || cmd.effort || cmd.model ? { to: cmd.to, effort: cmd.effort, model: cmd.model, keep: cmd.keep } : undefined;
    if (cmd.keep) {
      r.tune ??= {};
      const k = cmd.to ?? "*";
      r.tune[k] = { ...r.tune[k], ...(cmd.effort && { effort: cmd.effort }), ...(cmd.model && { model: cmd.model }) };
    }
    if (!cmd.text) {
      if (!meta) throw new Error("Write a task.");
      this.message(r, "cello", text, "setting").meta = meta;
      this.commit();
      return;
    }
    if (this.active.has(id)) {
      r.queue.push(text);
      this.message(r, "cello", text, "queued").meta = meta;
      this.commit();
      return;
    }
    // every message you send is a new task with a fresh turn budget, like a normal chat; the budget only caps the
    // automatic build → review → fix loop inside one task, so two AIs cannot bounce work back and forth forever
    r.used = 0;
    r.budget = budgets[r.template];
    if (r.title === "New chat") r.title = cmd.text.replace(/\s+/g, " ").slice(0, 48);
    this.message(r, "cello", text).meta = via ? { ...meta, via } : meta;
    this.commit();
    this.active.add(id);
    void this.exchange(r, cmd).finally(() => this.active.delete(id));
  }
  private async turn(
    r: Room,
    persona: Persona,
    prompt: string,
    readonly: boolean,
    msg: Tune = {},
    step = readonly ? "review" : "build",
    /** pictures attached to your message */
    images: string[] = [],
  ) {
    if (r.pause) throw new Error("Paused before dispatch");
    const def = this.persona(persona);
    const tune = this.tune(r, def, msg);
    const slot = `${persona}:${readonly}`;
    this.supervisor.claudeShell = !!this.state.settings.claudeShell;
    // a read-only turn inside a project is a review (or a question to a member): project files only
    const session = await this.supervisor.get(r.id, def, this.rootOf(r), readonly, tune, r.sessions?.[slot], this.kit(readonly && !!this.projectOf(r)));
    // an API keeps no conversation of its own: a new session (first message, or after Walt restarted) gets the chat so far
    if (session instanceof ApiSession && session.fresh) {
      const before = this.unseen(r, "");
      if (before) prompt = `The chat so far:\n${before}\n\nNow:\n${prompt}`;
    }
    takeTurn(r);
    r.step = step;
    this.commit("run.started");
    const m = this.message(r, persona, "");
    // remember which model answered, so switching models later does not relabel old replies
    m.meta = { model: tune.model ?? def.model, effort: tune.effort ?? def.effort };
    let flush = 0,
      saved = Date.now();
    let result: string;
    try {
      result = await session.run(
        prompt,
        (delta) => {
          m.text += delta;
          // the window gets only the new text 5x a second; disk and the full state follow every 2 s
          if (Date.now() - flush > 200) {
            flush = Date.now();
            this.emit("delta", { room: r.id, id: m.id, text: m.text });
          }
          if (Date.now() - saved > 2000) {
            saved = Date.now();
            this.commit("output.delta");
          }
        },
        async (tool, input) => {
          const ask = {
            id: randomUUID(),
            roomId: r.id,
            kind: "tool_approval" as const,
            title: tool,
            input,
            persona,
          };
          this.state.asks.push(ask);
          r.state = "awaiting_user";
          this.commit("ask.opened");
          return new Promise<boolean>((resolve) =>
            this.answers.set(ask.id, resolve),
          );
        },
        images,
      );
    } catch (error) {
      await session.stop();
      const limit = usageLimit(String(error));
      if (limit) throw Object.assign(new Error(String(error).replace(/^Error: /, "")), { limit: { persona, ...limit } });
      throw error;
    } finally {
      // keep the CLI's session id on the chat: resume after a restart, and "Continue in Claude Code / Codex"
      if (session.sessionId) (r.sessions ??= {})[slot] = session.sessionId;
      const c = "context" in session ? session.context : undefined;
      if (c?.size) (r.context ??= {})[persona] = { used: c.used, size: c.size, model: tune.model ?? def.model, at: Date.now() };
    }
    m.text = result;
    this.commit("run.finished");
    return result;
  }
/** a run failed: a usage limit gets its own card (who, when it resets, hand-off buttons), anything else stays an error */
  private failed(r: Room, e: unknown) {
    const limit = (e as { limit?: { persona: Persona; reset?: string } }).limit;
    if (!limit) return void this.message(r, "Walt", String(e), "error");
    const m = this.message(r, "Walt", String(e).replace(/^Error: /, ""), "limit");
    m.meta = { to: limit.persona, reset: limit.reset };
  }
  /** after a usage limit: give the work to `to` and send your last message again. Plain chats switch model
   * (`to` = "engine:model"); team chats hand the builder's job to another member (`to` = persona id), or take a
   * reviewer that hit its limit out of the reviews for now. */
  async handOff(roomId: string, to: string) {
    const r = this.room(roomId);
    const last = r.messages.at(-1);
    if (last?.kind !== "limit" || !last.meta?.to) throw new Error("There is no usage limit to work around in this chat.");
    const hit = last.meta.to;
    const task = [...r.messages].reverse().find((m) => m.author === "cello" && m.kind !== "setting" && m.kind !== "queued");
    if (!task) throw new Error("Nothing to send again.");
    if (r.template === "direct") {
      const i = to.indexOf(":");
      this.setTarget(roomId, { engine: to.slice(0, i) as Engine, model: to.slice(i + 1) });
    } else if (hit === r.builder) {
      this.member(roomId, to, "Builder");
    } else {
      this.member(roomId, hit, "Member");
    }
    if (r.used >= r.budget) r.budget = r.used + budgets[r.template];
    await this.send(roomId, task.text);
  }
  /** a plain chat: the message goes as written; the CLI session remembers the conversation */
  /** messages `who` has not seen: everything after its last reply, minus the message being sent now; newest kept, about 12k chars */
  unseen(r: Room, who: Persona) {
    const msgs = r.messages.slice(0, -1);
    const from = msgs.map((m) => m.author).lastIndexOf(who) + 1;
    const name = (m: Message) => {
      if (m.author === "cello") return "User";
      const p = this.state.personas.find((x) => x.id === m.author);
      return (p && this.state.catalog?.[p.engine]?.find((x) => x.id === m.meta?.model)?.label) ?? p?.name ?? m.author;
    };
    const lines = msgs
      .slice(from)
      .filter((m) => m.text.trim() && m.author !== "Walt" && m.kind !== "setting" && m.kind !== "error")
      .map((m) => `[${name(m)}] ${m.text.trim().slice(0, 2000)}`);
    let out = "";
    for (const l of lines.reverse()) {
      if (out.length + l.length > 12000) break;
      out = l + "\n" + out;
    }
    return out.trim();
  }
  private async chat(r: Room, cmd: Parsed) {
    const p = this.projectOf(r);
    try {
      if (p && [...this.leases.keys()].some((root) => overlaps(root, p.root)))
        throw new Error("Another chat is changing this project. Wait for it to finish.");
      if (p) this.leases.set(p.root, r.id);
      r.state = "running";
      r.pause = false;
      const who = cmd.to || r.builder;
      const first = !r.messages.some((m) => m.author === who);
      const brief = p && first ? `Project ${p.name} (${p.root}). Goal: ${p.goal || "-"}. Constraints: ${p.constraints || "-"}. Reply in the language the user writes in.\n\n` : "";
      // each CLI keeps its own session, so a model switched in mid-chat gets what it missed as a recap
      const missed = this.unseen(r, who);
      const recap = missed ? `Earlier in this chat another model was answering; you did not see these messages:\n${missed}\n\nNow the user writes:\n` : "";
      const before = p ? await manifest(p.root) : undefined;
      const att = attachments(cmd.text);
      await this.turn(r, who, brief + recap + att.text, !p, { effort: cmd.effort, model: cmd.model }, undefined, att.files);
      if (p && before) {
        const after = await manifest(p.root);
        if (after.hash !== before.hash) {
          for (const a of r.artifacts) a.accepted = false;
          r.artifacts.push({ revision: r.artifacts.length + 1, ...after, reviews: [], accepted: false });
          this.commit("artifact.registered");
        }
      }
      r.step = "ready";
      r.state = r.pause ? "paused" : "idle";
    } catch (e) {
      r.state = r.pause ? "paused" : "idle";
      r.step = "needs attention";
      this.failed(r, e);
    } finally {
      if (p && this.leases.get(p.root) === r.id) this.leases.delete(p.root);
      this.commit();
    }
  }
  private async exchange(r: Room, cmd: Parsed) {
    if (r.template === "direct" || !this.projectOf(r)) return this.chat(r, cmd);
    const att = attachments(cmd.text);
    const goal = att.text;
    const msg: Tune = { effort: cmd.effort, model: cmd.model };
    const p = this.state.projects.find((p) => p.id === r.projectId)!;
    try {
      if ([...this.leases.keys()].some((root) => overlaps(root, p.root)))
        throw new Error(
          "Another room owns this project. Wait for it to finish.",
        );
      this.leases.set(p.root, r.id);
      r.state = "running";
      r.pause = false;
      const before = await manifest(p.root);
      const packet = {
        schemaVersion: 2,
        goal,
        projectGoal: p.goal,
        constraints: p.constraints,
        replyLocale: this.state.settings.locale,
        fileRefs: before.files,
        budget: { max: r.budget, remaining: r.budget - r.used },
        acceptance:
          "Explain changes and provide actual test evidence. Never claim a test ran without executing it.",
        decisions:
          "If you need the user to choose before you can continue, stop and end your reply with one line 'DECISION: <question>' followed by 2 to 4 lines that start with '- ', one option each. Walt shows them as buttons.",
      };
      let asked = false;
      r.packet = packet;
      this.commit("handoff");
      const mention = cmd.to;
      if (r.template === "roundtable") {
        for (const persona of [r.builder, ...r.reviewers]) {
          if (r.pause) break;
          await this.turn(r, persona, JSON.stringify(packet), true, msg, undefined, att.files);
        }
      } else if (mention && mention !== r.builder) {
        // a mentioned reviewer or member answers read-only: only the builder edits files, so there is no new revision
        await this.turn(r, mention, JSON.stringify(packet), true, msg, undefined, att.files);
      } else {
        if (r.auto) {
          const team = [r.builder, ...r.reviewers].filter((id) => !isApi(this.persona(id).engine)).map((id) => ({ id, strengths: ((p) => (p?.strengths.length ? p.strengths : p ? defaultStrengths(p.engine, p.model) : []))(this.state.personas.find((p) => p.id === id)) }));
          const pick = autoBuilder(goal, team, r.builder);
          if (pick.id !== r.builder) {
            const name = (id: string) => this.state.personas.find((p) => p.id === id)?.name ?? id;
            const old = r.builder;
            this.swapBuilder(r, pick.id);
            this.message(r, "Walt", `Auto roles: ${name(pick.id)} builds this one (good at ${pick.why}); ${name(old)} reviews. Stop now if you want it the other way.`);
          }
        }
        // build → review → (fix → review again) until every reviewer approves, the budget runs out, or a verdict is missing
        let findings: { reviewer: string; text: string }[] = [];
        let prevFiles = before.files;
        for (let round = 0; ; round++) {
          const prompt = round
            ? JSON.stringify({
                ...packet,
                role: `Builder · fix round ${round}`,
                findings,
                instruction:
                  "Reviewers asked for changes on your last revision. Fix the findings that are correct; if you disagree with one, say why instead of changing it. The same reviewers check the new revision.",
              })
            : JSON.stringify(packet);
          const said = await this.turn(r, r.builder, prompt, false, msg, round ? "fix" : "build", round ? [] : att.files);
          const after = await manifest(p.root);
          for (const a of r.artifacts) a.accepted = false;
          const artifact = {
            revision: r.artifacts.length + 1,
            ...after,
            reviews: [] as { persona: Persona; text: string; hash: string }[],
            accepted: false,
          };
          r.artifacts.push(artifact);
          this.commit("artifact.registered");
          // the builder asked you to choose: wait for the answer instead of reviewing a half-done revision
          if (decision(said)) {
            asked = true;
            break;
          }
          // what changed since the last revision
          const changed = Object.keys(artifact.files).filter((f) => prevFiles[f] !== artifact.files[f]);
          const deleted = Object.keys(prevFiles).filter((f) => !(f in artifact.files));
          prevFiles = artifact.files;
          if (mention || r.pause) break;
          // a first build that edited nothing (it ran tests, answered, planned) has nothing to review
          if (!round && !changed.length && !deleted.length) {
            this.message(r, "Walt", "No files changed, so there is nothing to review.");
            break;
          }
          // every reviewer in the team reviews (members added later included); the template only set the first team
          const reviewers = r.reviewers;
          if (!reviewers.length) throw new Error("Add a reviewer to this chat.");
          if (r.budget - r.used < reviewers.length)
            throw new Error("Budget insufficient for review round. Add turns.");
          // the text of each changed file, so every reviewer can check it even when its CLI reads files only through commands (Codex)
          let room = 60_000;
          const contents = changed.map((path) => {
            if (artifact.files[path].startsWith("size:")) return { path, content: "(over 20 MB, not included)" };
            let text: string;
            try {
              text = readFileSync(join(p.root, path), "utf8");
            } catch {
              return { path, content: "(could not be read)" };
            }
            if (text.includes("\0")) return { path, content: "(binary file)" };
            const cap = Math.max(0, Math.min(20_000, room));
            if (text.length > cap) text = text.slice(0, cap) + "\n… (cut here; read the file for the rest)";
            room -= text.length;
            return { path, content: text };
          });
          const reviewPacket = JSON.stringify({
            ...packet,
            role: "Independent read-only reviewer",
            artifact: { revision: artifact.revision, hash: artifact.hash, changed: contents, deleted },
            builderReply: said.slice(0, 8000),
            instruction:
              "Review this exact revision. The changed files are included above; you may read other files too (read-only commands such as cat, type, rg or git diff are fine), but do not edit anything. Reviewers cannot run tests or builds: judge the test evidence in builderReply, and say so if it is missing. Report findings with file, line, severity and evidence. Other reviewers are independent. End with one line: VERDICT: APPROVE if nothing must change, or VERDICT: CHANGES if something must be fixed.",
          });
          const results = await Promise.allSettled(
            reviewers.map(async (persona) => ({
              persona,
              text: await this.turn(r, persona, reviewPacket, true, msg),
              hash: artifact.hash,
            })),
          );
          for (const result of results)
            if (result.status === "fulfilled")
              artifact.reviews.push(result.value);
            else
              this.message(
                r,
                "Walt",
                "Review incomplete: " + String(result.reason),
              );
          const current = await manifest(p.root);
          if (current.hash !== artifact.hash)
            throw new Error("Files changed during review. Reviews are stale.");
          if (artifact.reviews.length < reviewers.length || r.pause) break;
          const name = (id: string) => this.persona(id).name;
          const unclear = artifact.reviews.filter((v) => verdict(v.text) === undefined);
          if (unclear.length) {
            this.message(r, "Walt", `${unclear.map((v) => name(v.persona)).join(", ")} gave no verdict on r${artifact.revision}. Read the review and decide: accept, or ask the builder for a fix.`);
            break;
          }
          findings = artifact.reviews.filter((v) => verdict(v.text) === false).map((v) => ({ reviewer: name(v.persona), text: v.text }));
          if (!findings.length) {
            this.message(r, "Walt", `r${artifact.revision} approved by ${artifact.reviews.map((v) => name(v.persona)).join(" and ")}. Your acceptance is next.`);
            break;
          }
          if (r.budget - r.used < 1 + reviewers.length) {
            this.message(r, "Walt", `${findings.map((f) => f.reviewer).join(" and ")} asked for changes on r${artifact.revision}, and the automatic loop has used its turns for this task. Send "fix the review findings" to start a fix round, or accept as it is.`);
            break;
          }
          this.message(r, "Walt", `Fix round ${round + 1}: ${findings.map((f) => f.reviewer).join(" and ")} asked for changes on r${artifact.revision}; ${name(r.builder)} fixes them.`);
        }
      }
      r.state = r.pause ? "paused" : "idle";
      r.step = r.pause ? "paused" : asked ? "awaiting decision" : "awaiting acceptance";
      this.commit("room.done");
    } catch (e) {
      r.state = r.pause ? "paused" : "idle";
      r.step = "needs attention";
      this.failed(r, e);
    } finally {
      if (this.leases.get(p.root) === r.id) this.leases.delete(p.root);
      this.commit();
    }
  }
  control(id: string, action: string) {
    const r = this.room(id);
    if (r.state === "recovery_required") {
      if (action !== "recovered")
        throw new Error("Check the project files, then press I checked, continue. Walt never retries an interrupted run on its own.");
      // you looked at the files after the interrupted run: unlock the chat and its project; nothing is replayed
      r.state = "idle";
      r.pause = false;
      r.step = "ready";
      const p = this.projectOf(r);
      if (p && this.leases.get(p.root) === r.id) this.leases.delete(p.root);
      this.message(r, "Walt", "You checked the project after the interrupted run. The chat can continue.");
      this.commit("recovery.done");
      return;
    }
    if (action === "pause") {
      r.pause = true;
      if (!this.active.has(id)) r.state = "paused";
    } else if (action === "interrupt") {
      r.pause = true;
      this.supervisor.interrupt(id);
      for (const ask of this.state.asks.filter((a) => a.roomId === id))
        this.answer(ask.id, false);
    } else if (action === "resume") {
      if (this.active.has(id))
        throw new Error("Wait for the current run to finish.");
      r.pause = false;
      r.state = "idle";
    } else if (action === "continue") {
      if (this.active.has(id))
        throw new Error("Wait for the current run to finish.");
      r.budget += 2;
      r.state = "idle";
      r.pause = false;
    } else if (action === "end") {
      if (this.active.has(id))
        throw new Error("Interrupt and wait before ending the room.");
      r.state = "ended";
    } else throw new Error("Unknown action");
    this.commit();
  }
  answer(id: string, allow: boolean) {
    const ask = this.state.asks.find((a) => a.id === id);
    const resolve = this.answers.get(id);
    if (!ask || !resolve) throw new Error("Approval is no longer active");
    this.answers.delete(id);
    this.state.asks = this.state.asks.filter((a) => a.id !== id);
    this.room(ask.roomId).state = "running";
    this.commit("ask.resolved");
    resolve(allow);
  }
  /** what the latest revision changed: git diff against HEAD when the project is a git repo, else the new text of each file */
  async diff(roomId: string, revision?: number) {
    const r = this.room(roomId);
    const at = revision ? r.artifacts.findIndex((x) => x.revision === revision) : r.artifacts.length - 1;
    const a = r.artifacts[at];
    const root = this.projectOf(r)?.root;
    if (!a || !root) return { revision: 0, files: [] };
    // an older revision: compared with the one before it (git diff then shows today's file against HEAD, so it is only exact for the latest)
    const prev: Record<string, string> = r.artifacts[at - 1]?.files ?? (r.packet as { fileRefs?: Record<string, string> })?.fileRefs ?? {};
    const paths = [...new Set([...Object.keys(a.files), ...Object.keys(prev)])].filter((f) => prev[f] !== a.files[f]).sort();
    const git = (args: string[]) =>
      new Promise<string>((ok) => execFile("git", ["-c", "core.quotepath=off", ...args], { cwd: root, env: cleanEnv(), timeout: 10_000, maxBuffer: 4_000_000, windowsHide: true }, (e, out) => ok(e ? "" : out)));
    let room = 400_000;
    const files = [];
    for (const path of paths.slice(0, 60)) {
      const status = !(path in prev) ? "added" : !(path in a.files) ? "deleted" : "changed";
      let patch = status === "deleted" ? "" : await git(["diff", "--no-color", "HEAD", "--", path]);
      if (!patch && status !== "deleted") {
        // untracked, or no git: show the file as all new lines
        try {
          const text = a.files[path].startsWith("size:") ? "(over 20 MB)" : readFileSync(join(root, path), "utf8");
          patch = text.includes("\0") ? "(binary file)" : (status === "changed" ? "@@ no git history for this file: the whole new text @@\n" : "") + text.split(/\r?\n/).map((l) => "+" + l).join("\n");
        } catch {
          patch = "(could not be read)";
        }
      }
      if (patch.length > room) patch = patch.slice(0, Math.max(0, room)) + "\n… (cut here)";
      room -= patch.length;
      files.push({ path, status, patch });
    }
    return { revision: a.revision, files, more: Math.max(0, paths.length - 60) };
  }
  /** copy the database to <data>/backups; the newest 10 are kept */
  backup() {
    const dir = join(this.store.dir, "backups");
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toLocaleString("sv-SE").replace(/[: ]/g, "-");
    const file = join(dir, `walt-${stamp}.sqlite`);
    this.store.backup(file);
    for (const old of this.backups().slice(10)) rmSync(join(dir, old.name), { force: true });
    return { file };
  }
  backups() {
    const dir = join(this.store.dir, "backups");
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((n) => /^walt-.*\.sqlite$/.test(n))
      .map((name) => ({ name, size: statSync(join(dir, name)).size, at: statSync(join(dir, name)).mtime.toISOString() }))
      .sort((a, b) => b.at.localeCompare(a.at));
  }
  async accept(id: string) {
    const r = this.room(id);
    if (this.active.has(id)) throw new Error("Wait for the run to finish");
    const a = r.artifacts.at(-1);
    if (!a) throw new Error("No artifact");
    const p = this.state.projects.find((p) => p.id === r.projectId)!;
    // you accept the files of this revision: one of them changed or gone since blocks it; a file that another chat
    // (or you) added to the project later is not part of it
    const now = (await manifest(p.root)).files;
    const moved = Object.keys(a.files).filter((f) => now[f] !== a.files[f]);
    if (moved.length)
      throw new Error(
        `r${a.revision} is out of date: ${moved.slice(0, 3).join(", ")}${moved.length > 3 ? ` and ${moved.length - 3} more` : ""} changed after it was made. Send a message so the builder makes a new revision, then accept that one.`,
      );
    a.accepted = true;
    this.commit();
  }
  async close() {
    for (const resolve of this.answers.values()) resolve(false);
    await this.supervisor.stop();
    this.store.close();
  }
}
