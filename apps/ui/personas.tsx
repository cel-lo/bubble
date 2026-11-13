// Personas: Settings page (S03 + W18 editor), HTML helpers for the room, and composer autocomplete.
import React, { useState } from "react";
import type { State, PersonaDef, Engine, Effort, Room } from "../../packages/domain/model";
import { EFFORTS, LEVELS } from "../../packages/domain/model";
import { aliases } from "../../packages/domain/command";
import { T, av, ic, role as roleTag, dot } from "./generated/kit.mjs";
import { esc } from "./markdown";
import { personaStatus, personaLine, ENGINE_LABEL } from "./onboarding";

type Invoke = (method: string, input?: unknown) => Promise<any>;
const Html = ({ h }: { h: string }) => <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: h }} />;
/** model aliases each CLI documents; anything else can be typed */
const MODEL_HINTS: Record<Engine, string[]> = { claude: ["opus", "sonnet", "haiku", "fable"], codex: [], gemini: [] };

// ---------- HTML helpers for the room (the room view is built from design-kit HTML strings) ----------
const PROC: Record<string, [string, string]> = { busy: ["Working", T.green], warm: ["Ready", T.blue], cold: ["Asleep", T.faint], wait: ["Waiting", T.amber] };
export const personaItem = (p: PersonaDef, r: string, st: string, detail: string) =>
  `<div class="item" data-hot="persona:${esc(p.id)}">${av(p.avatar, 36)}<div class="f1"><div class="row sb"><span class="t">${esc(p.name)}</span>${roleTag(p.avatar, r)}</div><div class="p row g6">${dot(PROC[st][1], 7)}<span>${PROC[st][0]} · ${esc(detail)}</span></div></div></div>`;
export const personaMsg = (p: PersonaDef, r: string, time: string, body: string) =>
  `<div class="msg">${av(p.avatar, 32)}<div class="col" style="min-width:0"><div class="mh"><span class="n">${esc(p.name)}</span>${roleTag(p.avatar, r)}<span>${time}</span></div><div class="bub">${body}</div></div></div>`;
/** the chip under cello's message that shows what Walt read from @mention and /commands */
export function metaChip(meta: NonNullable<Room["messages"][number]["meta"]>, name: (id: string) => string, setting: boolean) {
  const who = meta.to ? name(meta.to) : "everyone";
  const what = [meta.effort && `effort ${meta.effort}`, meta.model && `model ${esc(meta.model)}`].filter(Boolean).join(" · ");
  const text = setting ? `${who} now uses ${what} in this room` : [`→ ${who}`, what, meta.keep && "kept for this room"].filter(Boolean).join(" · ");
  return `<div class="row" style="justify-content:flex-end;margin:-8px 0 10px"><span class="chip">${ic("steer", 13, T.sub)}${text}</span></div>`;
}

// ---------- composer autocomplete ----------
export interface Suggestion { label: string; hint: string; insert: string; replace: number }
export function complete(before: string, state: State, room: Room): Suggestion[] {
  const inRoom = new Set([room.builder, ...room.reviewers, ...(room.members || [])]);
  // @ menu only while the text after @ can still start a persona name (so "@Opus /effort " moves on)
  const at = before.match(/(?:^|\s)@([^@/\n]{0,30})$/);
  const q = at?.[1].toLowerCase() ?? "";
  const named = at ? state.personas.filter((p) => p.name.toLowerCase().startsWith(q) || p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q))) : [];
  if (at && named.length)
    return named
      .sort((a, b) => Number(inRoom.has(b.id)) - Number(inRoom.has(a.id)))
      .slice(0, 6)
      .map((p) => ({ label: "@" + p.name, hint: inRoom.has(p.id) ? personaLine(p) : "not in this room", insert: "@" + p.name + " ", replace: at[1].length + 1 }));
  // effort levels follow the mentioned persona's engine; with no mention, the ones every member accepts
  const mentioned = aliases(state.personas).find(([a]) => before.toLowerCase().includes("@" + a))?.[1];
  const engines = (mentioned ? [mentioned] : [...inRoom]).map((id) => state.personas.find((p) => p.id === id)?.engine).filter(Boolean) as Engine[];
  const eff = before.match(/\/effort\s+(\w*)$/i);
  if (eff) {
    const levels = LEVELS.filter((l) => engines.every((e) => EFFORTS[e].includes(l)));
    if (!levels.length) return [{ label: "no effort setting", hint: "this engine has none", insert: "", replace: 0 }];
    return levels.filter((l) => l.startsWith(eff[1].toLowerCase())).map((l) => ({ label: l, hint: "this turn · add keep to save", insert: l + " ", replace: eff[1].length }));
  }
  const mod = before.match(/\/model\s+([\w.:/-]*)$/i);
  if (mod) return [...new Set(engines.flatMap((e) => MODEL_HINTS[e]))].filter((m) => m.startsWith(mod[1])).map((m) => ({ label: m, hint: "model alias", insert: m + " ", replace: mod[1].length }));
  const slash = before.match(/(?:^|\s)\/(\w*)$/);
  if (slash)
    return [["effort", "low … max, for this turn"], ["model", "another model, for this turn"]]
      .filter(([c]) => c.startsWith(slash[1].toLowerCase()))
      .map(([c, h]) => ({ label: "/" + c, hint: h, insert: "/" + c + " ", replace: slash[1].length + 1 }));
  return [];
}

// ---------- Settings · Personas ----------
const blank = (): Omit<PersonaDef, "id"> & { id?: string } => ({ name: "", engine: "claude", model: "", strengths: [], avatar: "claude" });
export function PersonaSettings({ state, invoke }: { state: State; invoke: Invoke }) {
  const [edit, setEdit] = useState<(Omit<PersonaDef, "id"> & { id?: string }) | null>(null);
  const [strengths, setStrengths] = useState("");
  const open = (p: Omit<PersonaDef, "id"> & { id?: string }) => { setEdit({ ...p }); setStrengths(p.strengths.join(", ")); };
  const save = async () => {
    if (!edit) return;
    const ok = await invoke("persona.save", { ...edit, strengths: strengths.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6) });
    if (ok) setEdit(null);
  };
  const levels = edit ? EFFORTS[edit.engine] : [];
  return (
    <div className="col g12">
      <div className="row sb">
        <div className="s13 dim">A persona is an engine + model + effort + what it is good at. Mention it in a room with @name.</div>
        <button className="btn g" style={{ border: 0 }} onClick={() => open(blank())}>New persona</button>
      </div>
      {edit && (
        <div className="card col g12" style={{ padding: 18, borderColor: T.green }}>
          <div className="s15 b">{edit.id ? `Edit ${edit.name}` : "New persona"}</div>
          <div className="row g12">
            <label className="f1"><div className="s12 dim" style={{ marginBottom: 4 }}>Name (used for @mention)</div><input aria-label="Persona name" style={{ width: "100%" }} value={edit.name} maxLength={40} placeholder="e.g. GPT 6.1 Sol" onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label><div className="s12 dim" style={{ marginBottom: 4 }}>Engine</div>
              <select aria-label="Engine" value={edit.engine} onChange={(e) => { const engine = e.target.value as Engine; setEdit({ ...edit, engine, effort: EFFORTS[engine].includes(edit.effort!) ? edit.effort : undefined, avatar: engine === "claude" ? (edit.avatar === "sonnet" ? "sonnet" : "claude") : engine }); }}>
                {(["claude", "codex", "gemini"] as Engine[]).map((e) => <option key={e} value={e}>{ENGINE_LABEL[e]}</option>)}
              </select></label>
          </div>
          <div className="row g12">
            <label className="f1"><div className="s12 dim" style={{ marginBottom: 4 }}>Model id or alias (empty = the CLI's default)</div>
              <input aria-label="Model" list="model-hints" style={{ width: "100%" }} value={edit.model} maxLength={80} placeholder={edit.engine === "claude" ? "opus, sonnet, or a full id" : "the model id the CLI accepts"} onChange={(e) => setEdit({ ...edit, model: e.target.value.trim() })} />
              <datalist id="model-hints">{MODEL_HINTS[edit.engine].map((m) => <option key={m} value={m} />)}</datalist></label>
            <label><div className="s12 dim" style={{ marginBottom: 4 }}>Effort</div>
              <select aria-label="Effort" disabled={!levels.length} value={edit.effort ?? ""} onChange={(e) => setEdit({ ...edit, effort: (e.target.value || undefined) as Effort | undefined })}>
                <option value="">{levels.length ? "CLI default" : "not supported"}</option>
                {levels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select></label>
            <label><div className="s12 dim" style={{ marginBottom: 4 }}>Avatar</div>
              <select aria-label="Avatar" value={edit.avatar} onChange={(e) => setEdit({ ...edit, avatar: e.target.value as PersonaDef["avatar"] })}>
                {(["codex", "claude", "sonnet", "gemini"] as const).map((a) => <option key={a} value={a}>{a}</option>)}
              </select></label>
          </div>
          <label><div className="s12 dim" style={{ marginBottom: 4 }}>Good at (comma separated, up to 6)</div><input aria-label="Strengths" style={{ width: "100%" }} value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Code changes, Tests" /></label>
          <div className="s12 dim">{personaStatus(edit.engine, state.engines).ready ? "This engine is ready on this laptop." : `${ENGINE_LABEL[edit.engine]}: ${personaStatus(edit.engine, state.engines).label}. You can save it now and use it once the engine works.`}</div>
          <div className="row g8"><button className="btn g" style={{ border: 0 }} onClick={save}>Save persona</button><button className="btn" style={{ border: 0 }} onClick={() => setEdit(null)}>Cancel</button></div>
        </div>
      )}
      {state.personas.map((p) => {
        const s = personaStatus(p.engine, state.engines);
        return (
          <div key={p.id} className="card row g12" style={{ padding: "14px 16px" }}>
            <Html h={av(p.avatar, 36)} />
            <div className="f1">
              <div className="row g8"><span className="s15 b">{p.name}</span><span className="s12 dim">@{p.name}</span></div>
              <div className="s12 dim" style={{ marginTop: 2 }}>{personaLine(p)}</div>
              <div className="row g6" style={{ marginTop: 6, flexWrap: "wrap" }}>{p.strengths.map((t) => <span key={t} className="chip" style={{ fontSize: 11, padding: "2px 7px" }}>{t}</span>)}</div>
            </div>
            <span className="row g6 s12" style={{ width: 170 }}><span style={{ width: 7, height: 7, borderRadius: 7, background: s.color, display: "block" }} />{s.label}</span>
            <button className="btn sm" style={{ border: 0 }} onClick={() => open(p)}>Edit</button>
            <button className="btn sm r" style={{ border: 0 }} onClick={() => confirm(`Delete ${p.name}? Rooms that use it must drop it first.`) && invoke("persona.delete", p.id)}>Delete</button>
          </div>
        );
      })}
    </div>
  );
}
