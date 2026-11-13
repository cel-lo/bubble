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
  type Engine,
  type Effort,
} from "../domain/model";
import { parseMessage, type Parsed } from "../domain/command";
import { canonicalRoot, manifest } from "./files";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
export class Host extends EventEmitter {
  state: State;
  readonly supervisor = new Supervisor();
  private leases = new Map<string, string>();
  private answers = new Map<string, (allow: boolean) => void>();
  private active = new Set<string>();
  constructor(readonly store: Store) {
    super();
    this.state = store.load();
    if (!this.state.personas?.length) this.state.personas = structuredClone(DEFAULT_PERSONAS);
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
    if (t.effort && !EFFORTS[p.engine].includes(t.effort))
      throw new Error(EFFORTS[p.engine].length ? `${p.name} accepts effort ${EFFORTS[p.engine].join(", ")}.` : `${p.name} runs on ${p.engine}, which has no effort setting.`);
    return t;
  }
  savePersona(input: Omit<PersonaDef, "id"> & { id?: string }) {
    const name = input.name.trim();
    if (!name) throw new Error("Give the persona a name.");
    if (this.state.personas.some((p) => p.id !== input.id && p.name.toLowerCase() === name.toLowerCase()))
      throw new Error("Another persona already has that name.");
    if (input.effort && !EFFORTS[input.engine].includes(input.effort))
      throw new Error(`${input.engine} does not accept effort ${input.effort}.`);
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
    const same = (p: PersonaDef) => p.engine === t.engine && (p.model || "default") === (t.model || "default") && p.effort === t.effort;
    const hit = this.state.personas.find(same);
    if (hit) return hit;
    const info = this.state.catalog?.[t.engine]?.find((m) => m.id === t.model);
    if (this.state.catalog?.[t.engine] && !info) throw new Error(`${t.model} is not available for this account.`);
    const base = (info && info.label !== "Default" ? info.label : `${t.engine === "codex" ? "Codex" : "Claude"} default`) + (t.effort ? ` ${t.effort}` : "");
    let name = base;
    for (let i = 2; this.state.personas.some((p) => p.name.toLowerCase() === name.toLowerCase()); i++) name = `${base} (${i})`;
    return this.savePersona({ name, engine: t.engine, model: t.model, effort: t.effort, strengths: [], avatar: t.engine === "codex" ? "codex" : "claude" });
  }
  deletePersona(id: string) {
    const used = this.state.rooms.filter((r) => r.state !== "ended" && this.inRoom(r).includes(id));
    if (used.length) throw new Error(`Remove it from ${used.map((r) => r.title).join(", ")} first.`);
    this.persona(id);
    this.state.personas = this.state.personas.filter((p) => p.id !== id);
    this.commit("persona.deleted");
  }
  /** add a persona to a room as reviewer or plain member (answers when mentioned), or take it out */
  member(roomId: string, persona: string, role: "Reviewer" | "Member" | "Remove") {
    const r = this.room(roomId);
    if (this.active.has(roomId)) throw new Error("Change the team after this run.");
    this.persona(persona);
    if (persona === r.builder) throw new Error("Pick another builder before moving this persona.");
    r.reviewers = r.reviewers.filter((p) => p !== persona);
    r.members = (r.members || []).filter((p) => p !== persona);
    if (role === "Reviewer") r.reviewers.push(persona);
    if (role === "Member") r.members.push(persona);
    this.commit("room.members");
    return r;
  }
  async doctor() {
    this.state.engines = await this.supervisor.doctor();
    this.commit("engine.auth");
    const ok = this.state.engines.filter((e) => e.auth === "ok").map((e) => e.engine);
    this.state.catalog = { ...this.state.catalog, ...(await this.supervisor.catalog(ok)) };
    this.commit("engine.catalog");
    return this.state.engines;
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
    if (!p) throw new Error(`No persona runs on ${engine}.`);
    return p.id;
  }
  /** pick the model (and effort) a plain chat talks to, like the model menu in the Claude or ChatGPT app */
  setTarget(roomId: string, t: { engine: Engine; model: string; effort?: Effort }) {
    const r = this.room(roomId);
    if (r.template !== "direct") throw new Error("Team chats pick models per member in the Team panel.");
    if (this.active.has(roomId)) throw new Error("Change the model after this reply.");
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
  async send(id: string, text: string) {
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
    // each message in a plain chat is its own exchange; the turn budget guards the autonomous team loops
    if (r.template === "direct" || r.template === "roundtable") r.used = 0;
    if (r.used >= r.budget)
      throw new Error("Budget exhausted. Add turns with Continue.");
    if (r.title === "New chat") r.title = cmd.text.replace(/\s+/g, " ").slice(0, 48);
    this.message(r, "cello", text).meta = meta;
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
  ) {
    if (r.pause) throw new Error("Paused before dispatch");
    const def = this.persona(persona);
    const tune = this.tune(r, def, msg);
    const session = await this.supervisor.get(r.id, def, this.rootOf(r), readonly, tune);
    takeTurn(r);
    r.step = readonly ? "review" : "build";
    this.commit("run.started");
    const m = this.message(r, persona, "");
    // remember which model answered, so switching models later does not relabel old replies
    m.meta = { model: tune.model ?? def.model, effort: tune.effort ?? def.effort };
    let flush = 0;
    let result: string;
    try {
      result = await session.run(
        prompt,
        (delta) => {
          m.text += delta;
          if (Date.now() - flush > 200) {
            flush = Date.now();
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
      );
    } catch (error) {
      await session.stop();
      throw error;
    }
    m.text = result;
    this.commit("run.finished");
    return result;
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
      await this.turn(r, who, brief + recap + cmd.text, !p, { effort: cmd.effort, model: cmd.model });
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
      this.message(r, "Walt", String(e), "error");
    } finally {
      if (p && this.leases.get(p.root) === r.id) this.leases.delete(p.root);
      this.commit();
    }
  }
  private async exchange(r: Room, cmd: Parsed) {
    if (r.template === "direct" || !this.projectOf(r)) return this.chat(r, cmd);
    const goal = cmd.text;
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
      };
      r.packet = packet;
      this.commit("handoff");
      const mention = cmd.to;
      if (r.template === "roundtable") {
        for (const persona of [r.builder, ...r.reviewers]) {
          if (r.pause) break;
          await this.turn(r, persona, JSON.stringify(packet), true, msg);
        }
      } else if (mention && mention !== r.builder) {
        // a mentioned reviewer or member answers read-only: only the builder edits files, so there is no new revision
        await this.turn(r, mention, JSON.stringify(packet), true, msg);
      } else {
        await this.turn(r, r.builder, JSON.stringify(packet), false, msg);
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
        if (!mention && !r.pause) {
          // every reviewer in the team reviews (members added later included); the template only set the first team
          const reviewers = r.reviewers;
          if (!reviewers.length) throw new Error("Add a reviewer to this chat.");
          if (r.budget - r.used < reviewers.length)
            throw new Error("Budget insufficient for review round. Add turns.");
          const reviewPacket = JSON.stringify({
            ...packet,
            role: "Independent read-only reviewer",
            artifact: {
              revision: artifact.revision,
              hash: artifact.hash,
              files: artifact.files,
            },
            instruction:
              "Review this exact revision. Report findings with file, line, severity and evidence. Do not edit files or run commands. Other reviewers are independent.",
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
        }
      }
      r.state = r.pause ? "paused" : "idle";
      r.step = r.pause ? "paused" : "awaiting acceptance";
      this.commit("room.done");
    } catch (e) {
      r.state = r.pause ? "paused" : "idle";
      r.step = "needs attention";
      this.message(r, "Walt", String(e), "error");
    } finally {
      if (this.leases.get(p.root) === r.id) this.leases.delete(p.root);
      this.commit();
    }
  }
  control(id: string, action: string) {
    const r = this.room(id);
    if (r.state === "recovery_required") {
      throw new Error(
        "Recovery requires inspection before this project can run again. No automatic retry is available.",
      );
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
  async accept(id: string) {
    const r = this.room(id);
    if (this.active.has(id)) throw new Error("Wait for the run to finish");
    const a = r.artifacts.at(-1);
    if (!a) throw new Error("No artifact");
    const p = this.state.projects.find((p) => p.id === r.projectId)!;
    if ((await manifest(p.root)).hash !== a.hash)
      throw new Error("Artifact is stale; review the new revision");
    a.accepted = true;
    this.commit();
  }
  async close() {
    for (const resolve of this.answers.values()) resolve(false);
    await this.supervisor.stop();
    this.store.close();
  }
}
