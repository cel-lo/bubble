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
} from "../domain/model";
import { parseMessage, type Parsed } from "../domain/command";
import { canonicalRoot, manifest } from "./files";
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
    return this.state.engines;
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
    if (!this.state.projects.some((p) => p.id === input.projectId))
      throw new Error("Project not found");
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
    if (r.used >= r.budget)
      throw new Error("Budget exhausted. Add turns with Continue.");
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
    const p = this.state.projects.find((p) => p.id === r.projectId)!;
    const def = this.persona(persona);
    const session = await this.supervisor.get(r.id, def, p.root, readonly, this.tune(r, def, msg));
    takeTurn(r);
    r.step = readonly ? "review" : "build";
    this.commit("run.started");
    const m = this.message(r, persona, "");
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
  private async exchange(r: Room, cmd: Parsed) {
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
      } else {
        await this.turn(r, mention || r.builder, JSON.stringify(packet), false, msg);
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
        if (!mention && r.template !== "direct" && !r.pause) {
          const reviewers = r.reviewers.slice(
            0,
            r.template === "triad" ? 2 : 1,
          );
          if (reviewers.length !== (r.template === "triad" ? 2 : 1))
            throw new Error("Assign the required reviewers.");
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
