// First launch (W01 language, W02 engines) and the New project / Team panels. Layout and classes follow the
// FigCraft frames; every value comes from Walt's state. Only engines with a working adapter are shown.
import React, { useEffect, useState } from "react";
import type { State, EngineReport, PersonaDef, Engine, Quota, Provider } from "../../packages/domain/model";
import { ENGINES_ON, isApi } from "../../packages/domain/model";
import { T, ic, av, wordmark } from "./generated/kit.mjs";
import { Dropdown } from "./menu";
import { t } from "./i18n";

type Invoke = (method: string, input?: unknown) => Promise<any>;
export const Html = ({ h }: { h: string }) => <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: h }} />;
const pill = (t: string, c: string) => <span className="pill" style={{ background: c + "29", color: c }}>{t}</span>;
export const ADAPTERS = new Set<string>(ENGINES_ON);
export const ENGINE_LABEL: Record<string, string> = { codex: "Codex CLI", claude: "Claude Code", gemini: "Gemini CLI" };
export const ENGINE_NAME: Record<string, string> = { codex: "ChatGPT · Codex", claude: "Claude", gemini: "Gemini" };
/** API providers get their names from Customize; App calls this on every render, like setLocale */
export function registerProviders(ps: Provider[] = []) {
  for (const p of ps) {
    ENGINE_NAME["api:" + p.id] = p.name;
    ENGINE_LABEL["api:" + p.id] = `${p.name} API`;
  }
}
/** whether a persona on this engine can run here right now */
export function personaStatus(engine: string, engines: EngineReport[]) {
  const e = engines.find((x) => x.engine === engine);
  if (isApi(engine)) {
    if (!e) return { ready: false, label: t("Checking…"), color: T.dim };
    if (e.auth === "ok") return { ready: true, label: t("Ready"), color: T.green };
    return e.auth === "required" ? { ready: false, label: t(e.keyed ? "Key refused" : "Key needed"), color: T.amber } : { ready: false, label: t("Not reachable"), color: T.red };
  }
  if (!e || !e.installed) return { ready: false, label: t("Not installed"), color: T.dim };
  if (!ADAPTERS.has(e.engine)) return { ready: false, label: t("Adapter not built yet"), color: T.dim };
  if (e.auth !== "ok") return { ready: false, label: t("Login needed"), color: T.amber };
  return { ready: true, label: t("Ready"), color: T.green };
}
/** the account's name for a model id, e.g. "opus" -> "Opus 5.5" */
/** catalog label; "" or "default" means the CLI's own default (Codex has no "default" entry, so name its default model) */
export function modelLabel(state: State, engine: Engine, id: string) {
  const list = state.catalog?.[engine] ?? [];
  const hit = list.find((m) => m.id === id);
  if (hit) return hit.label;
  if (id && id !== "default") return id;
  const d = list.find((m) => m.isDefault);
  return d ? t("Default ({0})", d.label) : t("Default");
}
/** "Claude Code · Opus 5.5 · effort high" */
export const personaLine = (p: PersonaDef, state?: State) =>
  [ENGINE_LABEL[p.engine], state ? modelLabel(state, p.engine, p.model || "default") : p.model || t("CLI default model"), p.effort && t("effort {0}", p.effort)].filter(Boolean).join(" · ");
const INSTALL: Record<string, string> = { codex: "npm install -g @openai/codex", claude: "npm install -g @anthropic-ai/claude-code", gemini: "npm install -g @google/gemini-cli" };
const LOGIN: Record<string, string> = { codex: "codex login", claude: "claude  →  /login", gemini: "gemini" };

/** draggable title bar with only the window buttons */
export function TitleBar() {
  return (
    <div className="tb" style={{ height: 36 }}>
      <span style={{ flex: 1 }} />
      <div className="wctl">
        {(["min", "max", "x"] as const).map((n, i) => (
          <span key={n} role="button" aria-label={t(["Minimize", "Maximize", "Close"][i])} style={{ height: 36 }} onClick={() => window.walt.window(["minimize", "maximize", "close"][i])}>
            <Html h={ic(n, 14, T.dim, 1.4)} />
          </span>
        ))}
      </div>
    </div>
  );
}

/** setup layout; `bare` drops the window chrome and stepper so it can sit inside the main window */
function Frame({ steps, at, children, footer, bare }: { steps?: string[]; at?: number; children: React.ReactNode; footer: React.ReactNode; bare?: boolean }) {
  const body = (
    <>
      {steps && (
        <div className="row g20">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span style={{ width: 40, height: 1, background: "#3A3A3C", display: "block" }} />}
              <div className={`row g8 s13 ${i === at ? "b" : i < at! ? "sub" : "dim"}`}>
                <span style={{ width: 22, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, ...(i < at! ? { background: T.green, color: "#04170B" } : i === at ? { background: "#fff", color: "#000" } : { background: "#2C2C2E", color: T.dim }) }}>{i < at! ? "✓" : i + 1}</span>
                {t(s)}
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
      <div style={{ width: "min(1040px, 100%)", flex: 1, paddingTop: steps ? 34 : 0 }} className="col">{children}</div>
      <div className="row sb" style={{ width: "min(1040px, 100%)", padding: "18px 0 28px", borderTop: `1px solid ${T.line2}` }}>{footer}</div>
    </>
  );
  if (bare) return <div className="col" style={{ flex: 1, overflow: "auto", padding: "32px 40px 0", alignItems: "center" }}>{body}</div>;
  return (
    <div className="win">
      <TitleBar />
      <div className="bd" style={{ flexDirection: "column", alignItems: "center", padding: "34px 0 0", overflow: "auto" }}>{body}</div>
    </div>
  );
}
export const Btn = ({ kind = "", onClick, children, disabled }: { kind?: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
  <button className={`btn ${kind} ${disabled ? "dis" : ""}`} style={{ border: 0 }} disabled={disabled} onClick={onClick}>{children}</button>
);
const next = <Html h={ic("arrow", 15, "#04170B", 2.2)} />;
const back = <Html h={ic("back", 15, T.text)} />;
const STEPS = ["Language", "Engines"];

export function Welcome({ state, invoke, go }: { state: State; invoke: Invoke; go: () => void }) {
  const set = (locale: "en" | "id") => invoke("settings", { locale });
  const system = navigator.language.toLowerCase().startsWith("id") ? "id" : "en";
  return (
    <Frame steps={STEPS} at={0} footer={<><span className="s13 dim">{t("No Walt account needed. Everything stays on this laptop.")}</span><Btn kind="g" onClick={go}>{t("Continue")}{next}</Btn></>}>
      <div className="col" style={{ alignItems: "center", textAlign: "center", paddingTop: 40 }}>
        <Html h={wordmark(44)} />
        <div className="s24 b" style={{ marginTop: 26 }}>{t("One project. Your AI team. You lead.")}</div>
        <div className="s15 dim" style={{ marginTop: 10, maxWidth: 560, lineHeight: 1.55 }}>
          Walt puts your AI models in one place with you. Chat with one, or let them build and review each other's work, and follow it from the Ce:L island.
        </div>
        <div className="row g20" style={{ marginTop: 34 }}>
          {ENGINES_ON.map((e) => (
            <div key={e} className="col g8" style={{ alignItems: "center" }}><Html h={av(e, 64)} /><span className="s13 sub">{ENGINE_NAME[e]}</span></div>
          ))}
        </div>
        <div className="lbl" style={{ marginTop: 44 }}>{t("Language · Bahasa")}</div>
        <div className="seg" style={{ padding: 3 }}>
          {([["English", "en"], ["Bahasa Indonesia", "id"], ["Follow Windows", system]] as const).map(([label, value], i) => (
            <span key={label} className={i < 2 && state.settings.locale === value ? "on" : ""} style={{ padding: "7px 18px", fontSize: 14 }} onClick={() => set(value as "en" | "id")}>{t(label)}</span>
          ))}
        </div>
        <div className="s12 dim" style={{ marginTop: 10 }}>{t("You can change this later in Customize.")}</div>
      </div>
    </Frame>
  );
}

/** plan usage, as in the apps' own usage popovers: one bar per limit window */
const windowName = (mins: number) => (mins === 10080 ? t("Weekly limit") : t("{0}-hour limit", Math.round(mins / 60)));
const resetText = (at: number) => {
  const ms = at * 1000 - Date.now();
  if (ms <= 0) return t("Resets now");
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (!h) return t("Resets in {0} min", Math.max(1, m));
  return h < 24 ? t("Resets in {0} h {1} min", h, m) : t("Resets {0}", new Date(at * 1000).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }));
};
export const usageColor = (percent: number, limited = false) => (limited || percent >= 100 ? T.red : percent >= 80 ? T.amber : T.blue);
/** the window closest to its limit; what the sidebar shows */
export const worst = (q: Quota) => Math.max(...q.windows.map((w) => w.percent));
export function UsageBars({ q }: { q: Quota }) {
  return (
    <div className="col g10">
      {q.limited && <div className="s13" style={{ color: T.red }}>{t("Limit reached. New messages wait until it resets.")}</div>}
      {q.windows.map((w) => (
        <div key={w.mins}>
          <div className="row sb s12"><span>{windowName(w.mins)}</span><span className="dim">{t("{0}% used", w.percent)}</span></div>
          <div role="progressbar" aria-label={windowName(w.mins)} aria-valuenow={w.percent} aria-valuemin={0} aria-valuemax={100} style={{ height: 6, borderRadius: 3, background: T.line, marginTop: 5, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, w.percent)}%`, height: "100%", background: usageColor(w.percent, q.limited) }} />
          </div>
          {!!w.resetsAt && <div className="s12 dim" style={{ marginTop: 4 }}>{resetText(w.resetsAt)}</div>}
        </div>
      ))}
    </div>
  );
}

/** engine cards; used in onboarding and in Customize · AI & models */
export function EngineCards({ state, invoke }: { state: State; invoke: Invoke }) {
  const [checking, setChecking] = useState(false);
  const check = async () => { setChecking(true); await invoke("doctor"); setChecking(false); };
  return (
    <div className="row g16" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
      {ENGINES_ON.map((e) => {
        const r = state.engines.find((x) => x.engine === e);
        const s = personaStatus(e, state.engines);
        const models = state.catalog?.[e] ?? [];
        return (
          <div key={e} className="card f1" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, minWidth: 320 }}>
            <div className="row g12"><Html h={av(e, 44)} /><div className="f1"><div className="s16 b">{ENGINE_LABEL[e]}</div><div className="s12 dim" style={{ marginTop: 2 }}>{r ? (r.installed ? r.version : "not found on PATH") : checking ? "checking…" : "not checked"}</div></div>{pill(checking ? "Checking" : s.label, checking ? T.dim : s.color)}</div>
            {r && !r.installed && <><div className="s13 sub">{t("Install it, then sign in once in a terminal.")}</div><div className="mono" style={{ background: "#141416", borderRadius: 10, padding: "10px 12px", fontSize: 13, userSelect: "text" }}>{INSTALL[e]}</div></>}
            {r?.installed && r.auth === "required" && <><div className="s13 sub">{t("Sign in once in a terminal. Walt uses the same login afterwards.")}</div><div className="mono" style={{ background: "#141416", borderRadius: 10, padding: "10px 12px", fontSize: 13, userSelect: "text" }}>{LOGIN[e]}</div></>}
            {s.ready && <div className="s13 sub">{models.length ? t("Signed in. {0} models on this account.", models.length) : t("Signed in. Model list loads with the next check.")}</div>}
            {!!models.length && <div className="row g6" style={{ flexWrap: "wrap" }}>{models.filter((m) => !m.more).map((m) => <span key={m.id} className="chip" style={{ fontSize: 12 }}>{m.label}</span>)}</div>}
            {s.ready && (
              <div style={{ marginTop: 4 }}>
                <div className="lbl">{t("Plan usage")}</div>
                {state.usage?.[e] ? <UsageBars q={state.usage[e]!} /> : <div className="s12 dim">{t(e === "claude" ? "Shows after your next Claude message." : "Shows after the next check.")}</div>}
              </div>
            )}
            <div className="f1" />
            <div className="row sb s12 dim"><span>{r ? t("Checked this session") : ""}</span><span className="row g6" style={{ color: T.blue, cursor: "pointer" }} onClick={check}><Html h={ic("refresh", 14, T.blue)} />{t("Check again")}</span></div>
          </div>
        );
      })}
    </div>
  );
}

export function Engines({ state, invoke, back: goBack, go }: { state: State; invoke: Invoke; back: () => void; go: () => void }) {
  useEffect(() => { void invoke("doctor"); }, []);
  const ready = ENGINES_ON.filter((e) => personaStatus(e, state.engines).ready).length;
  return (
    <Frame steps={STEPS} at={1} footer={<><Btn kind="o" onClick={goBack}>{back}{t("Back")}</Btn><div className="row g12"><span className="s13 dim">{t("{0} of {1} ready · you can start with one", ready, ENGINES_ON.length)}</span><Btn kind="g" disabled={!ready} onClick={go}>Start chatting{next}</Btn></div></>}>
      <div className="s24 b">Connect your AI</div>
      <div className="s14 dim" style={{ marginTop: 6, marginBottom: 26 }}>{t("Walt runs the official apps you are already signed in to. No API keys, and Walt never sees your password. More AI can be added later in Customize.")}</div>
      <EngineCards state={state} invoke={invoke} />
      <div className="row g10 s13" style={{ marginTop: 22, padding: "12px 14px", background: "#202022", borderRadius: 12 }}>
        <Html h={ic("shield", 17, T.green)} /><span className="sub">{t("API key variables are removed before Walt starts an engine, so your subscription is always the one used.")}</span>
      </div>
    </Frame>
  );
}

export function NewProject({ invoke, back: goBack, done }: { invoke: Invoke; back: () => void; done: (id: string) => void }) {
  const [f, setF] = useState({ name: "", root: "", goal: "", constraints: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const choose = async () => { const root = await window.walt.folder(); if (root) setF((v) => ({ ...v, root, name: v.name || root.split(/[\\/]/).pop() || "" })); };
  const create = async () => { const p = await invoke("project", f); if (p) done(p.id); };
  return (
    <Frame bare footer={<><Btn kind="o" onClick={goBack}>{back}Cancel</Btn><Btn kind="g" disabled={!f.name.trim() || !f.root} onClick={create}>Create project{next}</Btn></>}>
      <div className="row g20" style={{ alignItems: "flex-start" }}>
        <div className="f1 col g16">
          <div className="s24 b">{t("New project")}</div>
          <div className="s13 dim" style={{ marginTop: -8 }}>{t("A project is a folder on this laptop. Its chats can read it, and builders can edit it with your approval.")}</div>
          <label><div className="s13 dim" style={{ marginBottom: 6 }}>Name</div><input aria-label="Project name" style={{ width: "100%" }} value={f.name} onChange={set("name")} /></label>
          <div>
            <div className="s13 dim" style={{ marginBottom: 6 }}>{t("Folder")}</div>
            <div className="card" style={{ padding: "12px 14px", borderColor: f.root ? T.green : undefined }}>
              <div className="row g10"><Html h={ic("folder", 16, T.sub)} /><span className={`mono s13 ${f.root ? "" : "dim"}`}>{f.root || "No folder chosen yet"}</span><span className="f1" /><Btn kind="sm" onClick={choose}>{t("Choose…")}</Btn></div>
              <div className="s12 dim" style={{ marginTop: 8 }}>{t("Walt checks the folder when you continue. It is never moved.")}</div>
            </div>
          </div>
          <label><div className="s13 dim" style={{ marginBottom: 6 }}>Goal</div><textarea aria-label="Project goal" rows={3} style={{ width: "100%", resize: "vertical" }} value={f.goal} onChange={set("goal")} /></label>
          <label><div className="s13 dim" style={{ marginBottom: 6 }}>Constraints</div><textarea aria-label="Constraints" rows={2} style={{ width: "100%", resize: "vertical" }} placeholder="One per line, e.g. Keep the API contract" value={f.constraints} onChange={set("constraints")} /></label>
        </div>
        <div className="card" style={{ width: 340, padding: 18, marginTop: 52 }}>
          <div className="s14 b">{t("What Walt saves")}</div>
          {[["file", "Project brief", "goal, constraints, folder"], ["shield", "One writer at a time", "AI never edit this folder together"], ["db", "History on this laptop", "%APPDATA%\\Walt · nothing in the cloud"], ["eye", "Your folder is not moved", "Walt only reads and edits inside it"]].map(([i, t, d]) => (
            <div key={t} className="row g10" style={{ marginTop: 14, alignItems: "flex-start" }}><Html h={ic(i, 17, T.sub)} /><div><div className="s13 b">{t}</div><div className="s12 dim" style={{ marginTop: 2 }}>{d}</div></div></div>
          ))}
        </div>
      </div>
    </Frame>
  );
}
