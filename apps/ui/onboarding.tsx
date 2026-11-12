// Setup screens W01–W04 as real React views. They copy the layout and classes of the FigCraft frames
// (design/screens.mjs `setup()`), but every value shown comes from Walt's state, never from design samples.
import React, { useEffect, useState } from "react";
import type { State, Persona, Template, EngineReport } from "../../packages/domain/model";
import { T, ENG, ic, av, wordmark, titlebar } from "./generated/kit.mjs";

type Invoke = (method: string, input?: unknown) => Promise<any>;
export type SetupStep = "welcome" | "engines" | "project" | "team";
const STEPS = ["Language", "Engines", "Project", "Team"];
const ORDER: SetupStep[] = ["welcome", "engines", "project", "team"];
const Html = ({ h }: { h: string }) => <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: h }} />;
const pill = (t: string, c: string) => (
  <span className="pill" style={{ background: c + "29", color: c }}>{t}</span>
);
export const engineOf = (p: Persona) => (p === "sonnet" ? "claude" : p);
// Only Claude has an adapter today; Codex and Gemini stay honest about it.
export const ADAPTERS = new Set(["claude"]);
export function personaStatus(p: Persona, engines: EngineReport[]) {
  const e = engines.find((x) => x.engine === engineOf(p));
  if (!e || !e.installed) return { ready: false, label: "Not installed", color: T.dim };
  if (!ADAPTERS.has(e.engine)) return { ready: false, label: "Adapter not built yet", color: T.dim };
  if (e.auth !== "ok") return { ready: false, label: "Login needed", color: T.amber };
  return { ready: true, label: "Ready", color: T.green };
}
const INSTALL: Record<string, string> = {
  codex: "npm install -g @openai/codex",
  claude: "npm install -g @anthropic-ai/claude-code",
  gemini: "npm install -g @google/gemini-cli",
};
const LOGIN: Record<string, string> = { codex: "codex login", claude: "claude  →  /login", gemini: "gemini" };

function Frame({ step, children, footer }: { step: SetupStep; children: React.ReactNode; footer: React.ReactNode }) {
  const at = ORDER.indexOf(step);
  const winAction = (e: React.MouseEvent) => {
    const s = (e.target as HTMLElement).closest(".wctl span");
    if (s) window.walt.window(["minimize", "maximize", "close"][[...s.parentElement!.children].indexOf(s)]);
  };
  return (
    <div className="win">
      <div onClick={winAction}><Html h={titlebar("", true)} /></div>
      <div className="bd" style={{ flexDirection: "column", alignItems: "center", padding: "34px 0 0", overflow: "auto" }}>
        <div className="row g20">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span style={{ width: 40, height: 1, background: "#3A3A3C", display: "block" }} />}
              <div className={`row g8 s13 ${i === at ? "b" : i < at ? "sub" : "dim"}`}>
                <span style={{ width: 22, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, ...(i < at ? { background: T.green, color: "#04170B" } : i === at ? { background: "#fff", color: "#000" } : { background: "#2C2C2E", color: T.dim }) }}>
                  {i < at ? "✓" : i + 1}
                </span>
                {s}
              </div>
            </React.Fragment>
          ))}
        </div>
        <div style={{ width: 1040, flex: 1, paddingTop: 34 }} className="col">{children}</div>
        <div className="row sb" style={{ width: 1040, padding: "18px 0 28px", borderTop: `1px solid ${T.line2}` }}>{footer}</div>
      </div>
    </div>
  );
}
const Btn = ({ kind = "", onClick, children, disabled }: { kind?: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
  <button className={`btn ${kind} ${disabled ? "dis" : ""}`} style={{ border: 0 }} disabled={disabled} onClick={onClick}>{children}</button>
);
const next = <Html h={ic("arrow", 15, "#04170B", 2.2)} />;
const back = <Html h={ic("back", 15, T.text)} />;

export function Setup({ state, step, setStep, projectId, invoke, onProject, onRoom, onCancel }: {
  state: State; step: SetupStep; setStep: (s: SetupStep) => void; projectId: string; invoke: Invoke;
  onProject: (id: string) => void; onRoom: (id: string) => void; onCancel: () => void;
}) {
  if (step === "welcome") return <Welcome state={state} invoke={invoke} go={() => setStep("engines")} />;
  if (step === "engines") return <Engines state={state} invoke={invoke} back={() => setStep("welcome")} go={() => setStep("project")} />;
  if (step === "project") return <NewProject invoke={invoke} back={state.projects.length ? onCancel : () => setStep("engines")} done={onProject} />;
  return <Team state={state} invoke={invoke} projectId={projectId} back={onCancel} done={onRoom} />;
}

function Welcome({ state, invoke, go }: { state: State; invoke: Invoke; go: () => void }) {
  const set = (locale: "en" | "id") => invoke("settings", { ...state.settings, locale });
  const system = navigator.language.toLowerCase().startsWith("id") ? "id" : "en";
  return (
    <Frame step="welcome" footer={<><span className="s13 dim">No Walt account needed. Everything stays on this laptop.</span><Btn kind="g" onClick={go}>Continue{next}</Btn></>}>
      <div className="col" style={{ alignItems: "center", textAlign: "center", paddingTop: 40 }}>
        <Html h={wordmark(44)} />
        <div className="s24 b" style={{ marginTop: 26 }}>One project. Your AI team. You lead.</div>
        <div className="s15 dim" style={{ marginTop: 10, maxWidth: 560, lineHeight: 1.55 }}>
          Walt puts Codex, Claude and Gemini in one room with you. They hand work to each other, review each other's changes, and you can follow it all from the Ce:L island.
        </div>
        <div className="row g20" style={{ marginTop: 34 }}>
          {(["codex", "claude", "gemini"] as const).map((e) => (
            <div key={e} className="col g8" style={{ alignItems: "center" }}><Html h={av(e, 64)} /><span className="s13 sub">{e === "claude" ? "Claude" : ENG[e].name}</span></div>
          ))}
        </div>
        <div className="lbl" style={{ marginTop: 44 }}>Language · Bahasa</div>
        <div className="seg" style={{ padding: 3 }}>
          {([["English", "en"], ["Bahasa Indonesia", "id"], ["Follow Windows", system]] as const).map(([label, value], i) => (
            <span key={label} className={i < 2 && state.settings.locale === value ? "on" : ""} style={{ padding: "7px 18px", fontSize: 14, cursor: "pointer" }} onClick={() => set(value as "en" | "id")}>{label}</span>
          ))}
        </div>
        <div className="s12 dim" style={{ marginTop: 10 }}>You can change this later in Settings.</div>
      </div>
    </Frame>
  );
}

function Engines({ state, invoke, back: goBack, go }: { state: State; invoke: Invoke; back: () => void; go: () => void }) {
  const [checking, setChecking] = useState(false);
  const check = async () => { setChecking(true); await invoke("doctor"); setChecking(false); };
  useEffect(() => { void check(); }, []);
  const ready = (["claude"] as const).filter((e) => personaStatus(e, state.engines).ready).length;
  return (
    <Frame step="engines" footer={<><Btn kind="o" onClick={goBack}>{back}Back</Btn><div className="row g12"><span className="s13 dim">{ready} of 3 ready · you can continue with at least one</span><Btn kind="g" disabled={!ready} onClick={go}>Continue{next}</Btn></div></>}>
      <div className="s24 b">Connect your engines</div>
      <div className="s14 dim" style={{ marginTop: 6 }}>Walt runs the official CLIs you are already signed in to. No API keys, and Walt never sees your password.</div>
      <div className="row g16" style={{ marginTop: 26, alignItems: "stretch" }}>
        {(["codex", "claude", "gemini"] as const).map((e) => {
          const r = state.engines.find((x) => x.engine === e);
          const s = personaStatus(e, state.engines);
          return (
            <div key={e} className="card f1" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="row g12"><Html h={av(e, 44)} /><div className="f1"><div className="s16 b">{e === "claude" ? "Claude Code" : e === "codex" ? "Codex CLI" : "Gemini CLI"}</div><div className="s12 dim" style={{ marginTop: 2 }}>{r ? (r.installed ? r.version : "not found on PATH") : checking ? "checking…" : "not checked"}</div></div>{pill(checking && !r ? "Checking" : s.label, s.color)}</div>
              {r && !r.installed && <><div className="s13 sub">Install it, then sign in once in a terminal.</div><div className="mono" style={{ background: "#141416", borderRadius: 10, padding: "10px 12px", fontSize: 13, userSelect: "text" }}>{INSTALL[e]}</div></>}
              {r?.installed && r.auth === "required" && <><div className="s13 sub">Sign in once in a terminal. Walt uses the same login afterwards.</div><div className="mono" style={{ background: "#141416", borderRadius: 10, padding: "10px 12px", fontSize: 13, userSelect: "text" }}>{LOGIN[e]}</div></>}
              {r?.installed && !ADAPTERS.has(e) && <div className="s13 sub">Installed. Walt's adapter for this engine is not built yet.</div>}
              {s.ready && <div className="s13 sub">Signed in with your subscription. Claude Opus and Claude Sonnet both run on it.</div>}
              <div className="f1" />
              <div className="row sb s12 dim"><span>{r ? "Checked just now" : ""}</span><span className="row g6" style={{ color: T.blue, cursor: "pointer" }} onClick={check}><Html h={ic("refresh", 14, T.blue)} />Check again</span></div>
            </div>
          );
        })}
      </div>
      <div className="row g10 s13" style={{ marginTop: 22, padding: "12px 14px", background: "#202022", borderRadius: 12 }}>
        <Html h={ic("shield", 17, T.green)} /><span className="sub">API key variables are removed before Walt starts an engine, so your subscription is always the one used.</span>
      </div>
    </Frame>
  );
}

function NewProject({ invoke, back: goBack, done }: { invoke: Invoke; back: () => void; done: (id: string) => void }) {
  const [f, setF] = useState({ name: "", root: "", goal: "", constraints: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const choose = async () => { const root = await window.walt.folder(); if (root) setF((v) => ({ ...v, root, name: v.name || root.split(/[\\/]/).pop() || "" })); };
  const create = async () => { const p = await invoke("project", f); if (p) done(p.id); };
  return (
    <Frame step="project" footer={<><Btn kind="o" onClick={goBack}>{back}Back</Btn><Btn kind="g" disabled={!f.name.trim() || !f.root} onClick={create}>Continue{next}</Btn></>}>
      <div className="row g20" style={{ alignItems: "flex-start" }}>
        <div className="f1 col g16">
          <div className="s24 b">New project</div>
          <label><div className="s13 dim" style={{ marginBottom: 6 }}>Name</div><input aria-label="Project name" style={{ width: "100%" }} value={f.name} onChange={set("name")} /></label>
          <div>
            <div className="s13 dim" style={{ marginBottom: 6 }}>Folder</div>
            <div className="card" style={{ padding: "12px 14px", borderColor: f.root ? T.green : undefined }}>
              <div className="row g10"><Html h={ic("folder", 16, T.sub)} /><span className={`mono s13 ${f.root ? "" : "dim"}`}>{f.root || "No folder chosen yet"}</span><span className="f1" /><Btn kind="sm" onClick={choose}>Choose…</Btn></div>
              <div className="s12 dim" style={{ marginTop: 8 }}>Walt checks the folder when you continue. It is never moved.</div>
            </div>
          </div>
          <label><div className="s13 dim" style={{ marginBottom: 6 }}>Goal</div><textarea aria-label="Project goal" rows={3} style={{ width: "100%", resize: "vertical" }} value={f.goal} onChange={set("goal")} /></label>
          <label><div className="s13 dim" style={{ marginBottom: 6 }}>Constraints</div><textarea aria-label="Constraints" rows={2} style={{ width: "100%", resize: "vertical" }} placeholder="One per line, e.g. Keep the API contract" value={f.constraints} onChange={set("constraints")} /></label>
        </div>
        <div className="card" style={{ width: 360, padding: 18, marginTop: 52 }}>
          <div className="s14 b">What Walt saves</div>
          {[["file", "Project brief", "goal, constraints, folder"], ["shield", "One writer at a time", "agents never edit this folder together"], ["db", "History on this laptop", "%APPDATA%\\Walt · nothing in the cloud"], ["eye", "Your folder is not moved", "Walt only reads and edits inside it"]].map(([i, t, d]) => (
            <div key={t} className="row g10" style={{ marginTop: 14, alignItems: "flex-start" }}><Html h={ic(i, 17, T.sub)} /><div><div className="s13 b">{t}</div><div className="s12 dim" style={{ marginTop: 2 }}>{d}</div></div></div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

const TEMPLATES: [Template, string, string, number, number][] = [
  ["build_review", "Build & Review", "1 builder, 1 reviewer", 4, 1],
  ["triad", "Triad", "1 builder, 2 reviewers in parallel", 6, 2],
  ["roundtable", "Roundtable", "Everyone talks, no file edits", 4, 0],
];
const PERSONAS: Persona[] = ["codex", "claude", "sonnet", "gemini"];
const NAME: Record<Persona, string> = { codex: "Codex", claude: "Claude Opus", sonnet: "Claude Sonnet", gemini: "Gemini" };

function Team({ state, invoke, projectId, back: goBack, done }: { state: State; invoke: Invoke; projectId: string; back: () => void; done: (id: string) => void }) {
  const [template, setTemplate] = useState<Template>("build_review");
  const [roles, setRoles] = useState<Record<Persona, string>>({ codex: "Free", claude: "Reviewer", sonnet: "Builder", gemini: "Free" });
  const role = (p: Persona) => (personaStatus(p, state.engines).ready ? roles[p] : "Free");
  const builder = PERSONAS.find((p) => role(p) === "Builder");
  const reviewers = PERSONAS.filter((p) => role(p) === "Reviewer");
  const need = TEMPLATES.find((t) => t[0] === template)![4];
  const problem = template === "roundtable"
    ? (builder || reviewers.length ? "" : "Pick at least one persona")
    : !builder ? "Pick a builder" : reviewers.length < need ? `Pick ${need} reviewer${need > 1 ? "s" : ""}` : "";
  const setRole = (p: Persona, r: string) => setRoles((v) => {
    const out = { ...v, [p]: r };
    if (r === "Builder") for (const q of PERSONAS) if (q !== p && out[q] === "Builder") out[q] = "Free";
    return out;
  });
  const create = async () => {
    const all = PERSONAS.filter((p) => role(p) !== "Free");
    const r = await invoke("room", { projectId, title: "Main", template, builder: builder || all[0], reviewers: template === "roundtable" ? all.filter((p) => p !== (builder || all[0])) : reviewers.slice(0, need) });
    if (r) done(r.id);
  };
  return (
    <Frame step="team" footer={<><Btn kind="o" onClick={goBack}>{back}Back</Btn><div className="row g12"><span className="s13 dim">{problem || `Budget: ${TEMPLATES.find((t) => t[0] === template)![3]} turns per exchange · only you can add more`}</span><Btn kind="g" disabled={!!problem} onClick={create}>Create room</Btn></div></>}>
      <div className="s24 b">How should the team work?</div>
      <div className="row g12" style={{ marginTop: 20 }}>
        {TEMPLATES.map(([id, t, d, b]) => {
          const on = id === template;
          return (
            <div key={id} className="card f1" onClick={() => setTemplate(id)} style={{ padding: 14, cursor: "pointer", ...(on ? { borderColor: T.green, background: "#1E2A22" } : {}) }}>
              <Html h={ic(id === "triad" ? "users" : id === "roundtable" ? "chat" : "diff", 20, on ? T.green : T.sub)} />
              <div className="s14 b" style={{ marginTop: 10 }}>{t}</div>
              <div className="s12 dim" style={{ marginTop: 4, lineHeight: 1.45, minHeight: 34 }}>{d}</div>
              <div className="s12" style={{ marginTop: 8, color: on ? T.green : T.sub }}>{b} turns</div>
            </div>
          );
        })}
      </div>
      <div className="lbl" style={{ marginTop: 26 }}>Personas in this room</div>
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="row s12 dim" style={{ padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}><span style={{ width: 250 }}>Persona</span><span style={{ width: 200 }}>Role</span><span style={{ width: 200 }}>Engine · model</span><span className="f1">Status</span></div>
        {PERSONAS.map((p) => {
          const s = personaStatus(p, state.engines);
          return (
            <div key={p} className="row" style={{ padding: "10px 16px", borderTop: `1px solid ${T.line2}`, opacity: s.ready ? 1 : 0.5 }}>
              <span className="row g10" style={{ width: 250 }}><Html h={av(p, 30)} /><span className="s14 b">{NAME[p]}</span></span>
              <span style={{ width: 200 }}>
                <select aria-label={`Role for ${NAME[p]}`} disabled={!s.ready} value={s.ready ? roles[p] : "Free"} onChange={(e) => setRole(p, e.target.value)} style={{ fontSize: 13, padding: "4px 9px", width: 150 }}>
                  <option>Builder</option><option>Reviewer</option><option>Free</option>
                </select>
              </span>
              <span style={{ width: 200 }} className="s13 sub">{p === "claude" ? "Claude Code · Opus" : p === "sonnet" ? "Claude Code · Sonnet" : p === "codex" ? "Codex CLI" : "Gemini CLI"}</span>
              <span className="f1 row g6 s13"><span style={{ width: 7, height: 7, borderRadius: 7, background: s.color, display: "block" }} />{s.label}</span>
            </div>
          );
        })}
      </div>
      <div className="row g8 s12 dim" style={{ marginTop: 12 }}><Html h={ic("users", 14)} />Roles are not tied to an engine. Swap them any time.</div>
    </Frame>
  );
}
