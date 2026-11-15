// Personas: Settings page (S03 + W18 editor), HTML helpers for the room, and composer autocomplete.
import React, { useState } from "react";
import { Dropdown } from "./menu";
import type { State, PersonaDef, Engine, Effort, Room } from "../../packages/domain/model";
import { EFFORTS, effortsOf, LEVELS, ENGINES_ON, enginesOn } from "../../packages/domain/model";
import { aliases } from "../../packages/domain/command";
import { T, av, ic, role as roleTag, dot } from "./generated/kit.mjs";
import { esc } from "./markdown";
import { personaStatus, personaLine, modelLabel, ENGINE_LABEL } from "./onboarding";
import { t } from "./i18n";

type Invoke = (method: string, input?: unknown) => Promise<any>;
const Html = ({ h }: { h: string }) => <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: h }} />;

// ---------- HTML helpers for the room (the room view is built from design-kit HTML strings) ----------
const PROC: Record<string, [string, string]> = { busy: ["Working", T.green], warm: ["Ready", T.blue], cold: ["Asleep", T.faint], wait: ["Waiting", T.amber] };
export const personaItem = (p: PersonaDef, r: string, st: string, detail: string) =>
  `<div class="item" data-hot="persona:${esc(p.id)}">${av(p.avatar, 36)}<div class="f1"><div class="row sb"><span class="t">${esc(p.name)}</span>${roleTag(p.avatar, r)}</div><div class="p row g6">${dot(PROC[st][1], 7)}<span>${t(PROC[st][0])} · ${esc(detail)}</span></div></div></div>`;
/** an AI message; `name` overrides the persona name (plain chats show the model, e.g. "Opus 5.5"); an empty role hides the tag */
export const personaMsg = (p: PersonaDef, r: string, time: string, body: string, name = p.name) =>
  `<div class="msg">${av(p.avatar, 32)}<div class="col" style="min-width:0"><div class="mh"><span class="n">${esc(name)}</span>${r ? roleTag(p.avatar, r) : ""}<span>${time}</span></div><div class="bub">${body}</div></div></div>`;
/** the chip under cello's message that shows what Walt read from @mention and /commands */
export function metaChip(meta: NonNullable<Room["messages"][number]["meta"]>, name: (id: string) => string, setting: boolean) {
  const who = meta.to ? [meta.to, ...(meta.also ?? [])].map(name).join(" + ") : t("everyone");
  const what = [meta.effort && t("effort {0}", meta.effort), meta.model && t("model {0}", esc(meta.model))].filter(Boolean).join(" · ");
  const text = setting ? t("{0} now uses {1} in this room", who, what) : [`→ ${who}`, what, meta.keep && t("kept for this room")].filter(Boolean).join(" · ");
  return `<div class="row" style="justify-content:flex-end;margin:-8px 0 10px"><span class="chip">${ic("steer", 13, T.sub)}${text}</span></div>`;
}

// ---------- composer autocomplete ----------
export interface Suggestion { label: string; hint: string; insert: string; replace: number }
export function complete(before: string, state: State, room: Room): Suggestion[] {
  const inRoom = new Set([room.builder, ...(room.builders ?? []), ...room.reviewers, ...(room.members || [])]);
  // @ menu only while the text after @ can still start a persona name (so "@Opus /effort " moves on)
  const at = before.match(/(?:^|\s)@([^@/\n]{0,30})$/);
  const q = at?.[1].toLowerCase() ?? "";
  // like a group chat: only the models in this chat can be mentioned
  const named = at ? state.personas.filter((p) => inRoom.has(p.id) && (p.name.toLowerCase().startsWith(q) || p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)))) : [];
  if (at && named.length)
    return named
      .slice(0, 6)
      .map((p) => ({ label: "@" + p.name, hint: personaLine(p), insert: "@" + p.name + " ", replace: at[1].length + 1 }));
  // effort levels follow the mentioned persona's engine; with no mention, the ones every member accepts
  const mentioned = aliases(state.personas).find(([a]) => before.toLowerCase().includes("@" + a))?.[1];
  const engines = (mentioned ? [mentioned] : [...inRoom]).map((id) => state.personas.find((p) => p.id === id)?.engine).filter(Boolean) as Engine[];
  const eff = before.match(/\/effort\s+(\w*)$/i);
  if (eff) {
    const levels = LEVELS.filter((l) => engines.every((e) => effortsOf(e).includes(l)));
    if (!levels.length) return [{ label: "no effort setting", hint: "this engine has none", insert: "", replace: 0 }];
    return levels.filter((l) => l.startsWith(eff[1].toLowerCase())).map((l) => ({ label: l, hint: "this turn · add keep to save", insert: l + " ", replace: eff[1].length }));
  }
  const mod = before.match(/\/model\s+([\w.:/-]*)$/i);
  if (mod)
    return [...new Map(engines.flatMap((e) => state.catalog?.[e] ?? []).map((m) => [m.id, m] as const)).values()]
      .filter((m) => m.id.startsWith(mod[1]) || m.label.toLowerCase().startsWith(mod[1].toLowerCase()))
      .slice(0, 8)
      .map((m) => ({ label: m.id, hint: m.label, insert: m.id + " ", replace: mod[1].length }));
  const slash = before.match(/(?:^|\s)\/(\w*)$/);
  if (slash)
    return [["effort", "low … max, for this turn"], ["model", "another model, for this turn"]]
      .filter(([c]) => c.startsWith(slash[1].toLowerCase()))
      .map(([c, h]) => ({ label: "/" + c, hint: h, insert: "/" + c + " ", replace: slash[1].length + 1 }));
  return [];
}

// ---------- Customize · Personas ----------
const blank = (): Omit<PersonaDef, "id"> & { id?: string } => ({ name: "", engine: "claude", model: "default", strengths: [], avatar: "claude" });
export function PersonaSettings({ state, invoke }: { state: State; invoke: Invoke }) {
  const [edit, setEdit] = useState<(Omit<PersonaDef, "id"> & { id?: string }) | null>(null);
  const [strengths, setStrengths] = useState("");
  const [custom, setCustom] = useState(false);
  const open = (p: Omit<PersonaDef, "id"> & { id?: string }) => {
    setEdit({ ...p });
    setStrengths(p.strengths.join(", "));
    setCustom(!!p.model && p.model !== "default" && !!state.catalog?.[p.engine] && !state.catalog[p.engine]!.some((m) => m.id === p.model));
  };
  const save = async () => {
    if (!edit) return;
    const ok = await invoke("persona.save", { ...edit, strengths: strengths.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6) });
    if (ok) setEdit(null);
  };
  const models = edit ? state.catalog?.[edit.engine] ?? [] : [];
  const info = edit ? models.find((m) => m.id === (edit.model || "default")) : undefined;
  const levels = edit ? (info ? info.efforts : effortsOf(edit.engine)) : [];
  const shown = state.personas.filter((p) => enginesOn(state).includes(p.engine));
  return (
    <div className="col g12">
      <div className="row sb">
        <div className="s13 dim">{t("A persona is an AI + model + effort, saved under a name. Mention it in a chat with @name.")}</div>
        <button className="btn g" style={{ border: 0 }} onClick={() => open(blank())}>{t("New persona")}</button>
      </div>
      {edit && (
        <div className="card col g12" style={{ padding: 18, borderColor: T.green }}>
          <div className="s15 b">{edit.id ? t("Edit {0}", edit.name) : t("New persona")}</div>
          <div className="row g12" style={{ alignItems: "flex-end" }}>
            <label className="f1"><div className="s12 dim" style={{ marginBottom: 4 }}>{t("Name (used for @mention)")}</div><input aria-label={t("Persona name")} style={{ width: "100%" }} value={edit.name} maxLength={40} placeholder={t("e.g. GPT Builder")} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <div><div className="s12 dim" style={{ marginBottom: 4 }}>AI</div>
              <Dropdown label="AI" value={edit.engine} width={170} onChange={(engine) => { setCustom(false); setEdit({ ...edit, engine, model: "default", effort: undefined, avatar: engine === "claude" ? "claude" : engine }); }} options={enginesOn(state).map((e) => ({ value: e, label: ENGINE_LABEL[e] }))} /></div>
          </div>
          <div className="row g12" style={{ alignItems: "flex-end" }}>
            <div className="f1"><div className="s12 dim" style={{ marginBottom: 4 }}>{t("Model")}</div>
              {models.length && !custom ? (
                <Dropdown label="Model" value={edit.model || "default"} width={320} onChange={(v) => (v === "__custom" ? setCustom(true) : setEdit({ ...edit, model: v, effort: undefined }))}
                  options={[...(models.some((m) => m.id === "default") ? [] : [{ value: "default", label: modelLabel(state, edit.engine, "default") }]), ...models.map((m) => ({ value: m.id, label: m.label, hint: m.more ? "older" : undefined })), { value: "__custom", label: t("Other id…") }]} />
              ) : (
                <input aria-label={t("Model id")} style={{ width: "100%" }} value={edit.model} maxLength={80} placeholder={t("the model id the CLI accepts")} onChange={(e) => setEdit({ ...edit, model: e.target.value.trim() })} />
              )}
            </div>
            <div><div className="s12 dim" style={{ marginBottom: 4 }}>{t("Effort")}</div>
              <Dropdown label="Effort" value={(edit.effort ?? "") as string} width={150} disabled={!levels.length} onChange={(v) => setEdit({ ...edit, effort: (v || undefined) as Effort | undefined })}
                options={[{ value: "", label: t(levels.length ? "Default" : "Not supported") }, ...levels.map((l) => ({ value: l as string, label: l[0].toUpperCase() + l.slice(1) }))]} /></div>
            <div><div className="s12 dim" style={{ marginBottom: 4 }}>{t("Avatar")}</div>
              <Dropdown label="Avatar" value={edit.avatar} width={130} onChange={(v) => setEdit({ ...edit, avatar: v as PersonaDef["avatar"] })} options={(["claude", "sonnet", "codex"] as const).map((a) => ({ value: a, label: a === "sonnet" ? "Claude (S)" : a === "claude" ? "Claude" : "Codex" }))} /></div>
          </div>
          <label><div className="s12 dim" style={{ marginBottom: 4 }}>{t("Good at (comma separated, up to 6)")}</div><input aria-label={t("Strengths")} style={{ width: "100%" }} value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder={t("Code changes, Tests")} /></label>
          <div className="s12 dim">{personaStatus(edit.engine, state.engines).ready ? "This AI is ready on this laptop." : `${ENGINE_LABEL[edit.engine]}: ${personaStatus(edit.engine, state.engines).label}.`}</div>
          <div className="row g8"><button className="btn g" style={{ border: 0 }} onClick={save}>{t("Save persona")}</button><button className="btn" style={{ border: 0 }} onClick={() => setEdit(null)}>{t("Cancel")}</button></div>
        </div>
      )}
      {shown.map((p) => {
        const s = personaStatus(p.engine, state.engines);
        return (
          <div key={p.id} className="card row g12" style={{ padding: "14px 16px" }}>
            <Html h={av(p.avatar, 36)} />
            <div className="f1">
              <div className="row g8"><span className="s15 b">{p.name}</span><span className="s12 dim">@{p.name}</span></div>
              <div className="s12 dim" style={{ marginTop: 2 }}>{personaLine(p, state)}</div>
              <div className="row g6" style={{ marginTop: 6, flexWrap: "wrap" }}>{p.strengths.map((t) => <span key={t} className="chip" style={{ fontSize: 11, padding: "2px 7px" }}>{t}</span>)}</div>
            </div>
            <span className="row g6 s12" style={{ width: 150 }}><span style={{ width: 7, height: 7, borderRadius: 7, background: s.color, display: "block" }} />{s.label}</span>
            <button className="btn sm" style={{ border: 0 }} onClick={() => open(p)}>{t("Edit")}</button>
            <button className="btn sm r" style={{ border: 0 }} onClick={() => confirm(t("Delete {0}? Chats that use it must drop it first.", p.name)) && invoke("persona.delete", p.id)}>{t("Delete")}</button>
          </div>
        );
      })}
    </div>
  );
}
