// Walt main window: Claude-style sidebar (New chat, Search, Customize, Projects with their chats, Chats), the chat view
// with a model picker like the Claude / ChatGPT apps, and the Customize pages. Message bodies, approval and result
// cards still use the design-kit HTML helpers; everything interactive is React.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { State, Room, Persona, PersonaDef, Engine, Effort } from "../../packages/domain/model";
import { ENGINES_ON } from "../../packages/domain/model";
import { decision } from "../../packages/domain/command";
import { T, ic, av, stack, role as roleTag, wordmark, workflow, mine } from "./generated/kit.mjs";
import { md, esc } from "./markdown";
import { Welcome, Engines, NewProject, EngineCards, personaStatus, ENGINE_NAME, ENGINE_LABEL, Html } from "./onboarding";
import { PersonaSettings, personaMsg, metaChip, complete, type Suggestion } from "./personas";
import { Menu, Dropdown, type Item } from "./menu";
import { t, setLocale } from "./i18n";

declare global {
  interface Window {
    walt: {
      call: (method: string, input?: unknown) => Promise<any>;
      folder: () => Promise<string | null>;
      window: (action: string) => void;
      opened: (fn: (roomId: string) => void) => () => void;
      subscribe: (fn: (s: State) => void) => () => void;
      delta: (fn: (d: { room: string; id: string; text: string }) => void) => () => void;
    };
  }
}
type Invoke = (method: string, input?: unknown) => Promise<any>;
type View =
  | { kind: "home" }
  | { kind: "chat"; id: string }
  | { kind: "customize"; tab: string }
  | { kind: "settings"; tab: string }
  | { kind: "project-new" }
  | { kind: "join"; projectId: string; first: boolean }
  | { kind: "search" };
type Panels = { left: boolean; right: boolean; lw: number; rw: number };
const PANELS: Panels = { left: true, right: true, lw: 288, rw: 320 };
type Target = { engine: Engine; model: string; effort?: Effort };

const Icon = ({ n, s = 16, c = T.dim, w = 1.8 }: { n: string; s?: number; c?: string; w?: number }) => <span style={{ display: "flex", flex: "none" }} dangerouslySetInnerHTML={{ __html: ic(n, s, c, w) }} />;
const TEMPLATE: Record<string, string> = { direct: "Chat", build_review: "Build & Review", triad: "Triad", roundtable: "Roundtable" };
const STATE: Record<string, string> = { idle: "Idle", running: "Working", paused: "Paused", awaiting_user: "Waiting for you", ended: "Ended", recovery_required: "Needs checking" };
const cap = (s?: string) => (s ? s[0].toUpperCase() + s.slice(1) : "");
const lastAt = (r: Room) => r.messages.at(-1)?.at ?? "";
const busy = (r: Room) => r.state === "running" || r.state === "awaiting_user";

/** model label for an engine + model id, using the account's catalog ("" or "default" = the CLI default) */
function label(state: State, engine: Engine, id?: string) {
  const list = state.catalog?.[engine] ?? [];
  const plain = !id || id === "default";
  const m = plain ? list.find((x) => x.isDefault) ?? list.find((x) => x.id === "default") : list.find((x) => x.id === id);
  if (m?.label && m.label !== "Default") return m.label;
  return plain ? t("{0} default", ENGINE_NAME[engine]) : id!;
}
/** what a plain chat talks to right now: its builder persona plus the chat's overrides */
function target(state: State, r: Room): Target {
  const p = state.personas.find((x) => x.id === r.builder);
  const t = { ...r.tune?.["*"], ...(p ? r.tune?.[p.id] : {}) };
  return { engine: p?.engine ?? "claude", model: t.model ?? (p?.model || "default"), effort: t.effort ?? p?.effort };
}

function App() {
  const [state, setState] = useState<State>();
  const [view, setView] = useState<View>({ kind: "home" });
  const [step, setStep] = useState<"welcome" | "engines">("welcome");
  const [error, setError] = useState("");
  // panel open/closed and widths: a per-window convenience, so browser storage is enough (try/catch: it can be unavailable)
  const [panels, setPanels] = useState<Panels>(() => {
    try {
      return { ...PANELS, ...JSON.parse(localStorage.getItem("walt.panels") || "{}") };
    } catch {
      return PANELS;
    }
  });
  const setP = (p: Partial<Panels>) =>
    setPanels((o) => {
      const n = { ...o, ...p };
      try {
        localStorage.setItem("walt.panels", JSON.stringify(n));
      } catch {}
      return n;
    });
  useEffect(() => {
    // Ctrl+B toggles the sidebar, Ctrl+Alt+B the side panel (like an editor)
    const key = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      const k = e.key.toLowerCase();
      const go: Record<string, View> = { n: { kind: "home" }, k: { kind: "search" }, ",": { kind: "settings", tab: "general" } };
      if (go[k] && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setView(go[k]);
        return;
      }
      if (k !== "b") return;
      e.preventDefault();
      setPanels((o) => {
        const n = e.altKey ? { ...o, right: !o.right } : { ...o, left: !o.left };
        try {
          localStorage.setItem("walt.panels", JSON.stringify(n));
        } catch {}
        return n;
      });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  // theme class on <html>, so menus and popovers drawn in portals (outside the app div) follow it too
  const theme = state?.settings.theme;
  useEffect(() => void document.documentElement.classList.toggle("light", theme === "light"), [theme]);
  useEffect(() => {
    window.walt
      .call("snapshot")
      .then((s: State) => {
        setState(s);
        void window.walt.call("doctor").catch(() => {});
      })
      .catch((e) => setError(String(e)));
    const off = window.walt.subscribe(setState);
    // streaming text: patch just that message instead of receiving the whole state
    const offDelta = window.walt.delta((d) =>
      setState((s) => s && { ...s, rooms: s.rooms.map((r) => (r.id !== d.room ? r : { ...r, messages: r.messages.map((m) => (m.id === d.id ? { ...m, text: d.text } : m)) })) }),
    );
    const offOpen = window.walt.opened((id) => setView({ kind: "chat", id }));
    return () => (off(), offDelta(), offOpen());
  }, []);
  // a Windows notification when an AI needs you or finishes while Walt is in the background
  const seen = useRef<{ asks: Set<string>; busy: Set<string> } | null>(null);
  useEffect(() => {
    if (!state) return;
    const busyNow = new Set(state.rooms.filter((r) => r.state === "running" || r.state === "awaiting_user").map((r) => r.id));
    const prev = seen.current;
    seen.current = { asks: new Set(state.asks.map((a) => a.id)), busy: busyNow };
    if (!prev || state.settings.notify === false || document.hasFocus() || typeof Notification === "undefined") return;
    const tell = (roomId: string, title: string, body: string) => {
      const n = new Notification(title, { body: body.slice(0, 180), silent: false });
      n.onclick = () => {
        window.walt.window("show");
        setView({ kind: "chat", id: roomId });
      };
    };
    const name = (id: string) => state.personas.find((p) => p.id === id)?.name ?? id;
    const title = (id: string) => state.rooms.find((r) => r.id === id)?.title ?? "Walt";
    for (const a of state.asks) if (!prev.asks.has(a.id)) tell(a.roomId, t("{0} needs you", title(a.roomId)), t("{0} wants to use {1}", name(a.persona), a.title));
    for (const id of prev.busy)
      if (!busyNow.has(id)) {
        const r = state.rooms.find((x) => x.id === id);
        const last = r?.messages.at(-1);
        if (r) tell(id, t("{0} finished", r.title), last ? `${last.author === "Walt" ? "Walt" : r.template === "direct" ? label(state, state.personas.find((p) => p.id === last.author)?.engine ?? "claude", last.meta?.model) : name(last.author)}: ${last.text.replace(/\s+/g, " ")}` : "");
      }
  }, [state]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 9000);
    return () => clearTimeout(t);
  }, [error]);
  const invoke: Invoke = async (method, input) => {
    try {
      setError("");
      return await window.walt.call(method, input);
    } catch (e) {
      setError(String(e).replace(/^Error: (Error invoking remote method '[^']+': )?(Error: )*/, ""));
      return null;
    }
  };
  setLocale(state?.settings.locale ?? "en");
  if (!state) return <div style={{ padding: 40, color: T.text, background: T.bg, height: "100%" }}>Walt · {error || t("Starting…")}</div>;
  // data from before the onboarded flag already has projects: do not walk that user through setup again
  if (!state.settings.onboarded && !state.projects.length) {
    if (step === "welcome") return <Welcome state={state} invoke={invoke} go={() => setStep("engines")} />;
    return <Engines state={state} invoke={invoke} back={() => setStep("welcome")} go={() => invoke("settings", { onboarded: true })} />;
  }
  const newChat = async (projectId = "") => {
    const r = await invoke("chat.new", projectId);
    if (r) setView({ kind: "chat", id: r.id });
  };
  const room = view.kind === "chat" ? state.rooms.find((r) => r.id === view.id) : undefined;
  const open = (id: string) => setView({ kind: "chat", id });
  let main: React.ReactNode;
  let crumb = "";
  if (view.kind === "chat" && room) {
    crumb = `${room.projectId ? state.projects.find((p) => p.id === room.projectId)?.name ?? "" : t("Chats")}  ›  ${room.title}`;
    main = <ChatView key={room.id} state={state} room={room} invoke={invoke} panel={panels.right ? panels.rw : 0} setRw={(rw) => setP({ rw })} />;
  } else if (view.kind === "customize") (crumb = t("Customize")), (main = <Customize state={state} invoke={invoke} tab={view.tab} setTab={(tab) => setView({ kind: "customize", tab })} />);
  else if (view.kind === "settings") (crumb = t("Settings")), (main = <Settings state={state} invoke={invoke} tab={view.tab} setTab={(tab) => setView({ kind: "settings", tab })} />);
  else if (view.kind === "project-new") (crumb = t("New project")), (main = <NewProject invoke={invoke} back={() => setView({ kind: "home" })} done={(id) => setView({ kind: "join", projectId: id, first: true })} />);
  else if (view.kind === "join") (crumb = t(view.first ? "New project" : "New team chat")), (main = <Joins key={view.projectId} state={state} invoke={invoke} projectId={view.projectId} first={view.first} back={() => (view.first ? newChat(view.projectId) : setView({ kind: "home" }))} done={open} />);
  else if (view.kind === "search") (crumb = t("Search")), (main = <Search state={state} open={open} />);
  else (crumb = t("New chat")), (main = <Home state={state} invoke={invoke} opened={open} />);
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <div className="win">
        <Bar crumb={crumb} panels={panels} right={view.kind === "chat"} toggle={(side) => setP(side === "left" ? { left: !panels.left } : { right: !panels.right })} />
        <div className="bd">
          {panels.left && (
            <>
              <Sidebar state={state} view={view} go={setView} invoke={invoke} newChat={newChat} width={panels.lw} />
              <Grip side="left" width={panels.lw} min={220} max={420} def={PANELS.lw} set={(lw) => setP({ lw })} />
            </>
          )}
          <div className="main" style={{ position: "relative" }}>{main}</div>
        </div>
      </div>
      {error && (
        <div role="alert" className="card" onClick={() => setError("")} style={{ position: "fixed", bottom: 24, left: 300, right: 40, padding: "12px 16px", color: "#FF6961", zIndex: 70, cursor: "pointer" }}>
          {error}
        </div>
      )}
    </div>
  );
}

/** title bar: sidebar toggle, where you are, side-panel toggle (chats only), window buttons */
function Bar({ crumb, panels, right, toggle }: { crumb: string; panels: Panels; right: boolean; toggle: (side: "left" | "right") => void }) {
  return (
    <div className="tb" style={{ height: 40, gap: 6, paddingLeft: 8 }}>
      <span className={`tbb ${panels.left ? "on" : ""}`} role="button" aria-label={t("Show or hide the sidebar (Ctrl+B)")} title={t("Sidebar (Ctrl+B)")} aria-pressed={panels.left} onClick={() => toggle("left")}>
        <Icon n="sidebar" s={17} c={panels.left ? T.text : T.dim} />
      </span>
      <span className="s13 dim" style={{ marginLeft: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{crumb}</span>
      <span style={{ flex: 1 }} />
      {right && (
        <span className={`tbb ${panels.right ? "on" : ""}`} role="button" aria-label={t("Show or hide the side panel (Ctrl+Alt+B)")} title={t("Side panel (Ctrl+Alt+B)")} aria-pressed={panels.right} onClick={() => toggle("right")}>
          <Icon n="panel" s={17} c={panels.right ? T.text : T.dim} />
        </span>
      )}
      <div className="wctl">
        {(["min", "max", "x"] as const).map((n, i) => (
          <span key={n} role="button" aria-label={t(["Minimize", "Maximize", "Close"][i])} style={{ height: 40 }} onClick={() => window.walt.window(["minimize", "maximize", "close"][i])}>
            <Icon n={n} s={14} w={1.4} />
          </span>
        ))}
      </div>
    </div>
  );
}

/** drag handle on a panel edge; double-click resets the width */
function Grip({ side, width, min, max, def, set }: { side: "left" | "right"; width: number; min: number; max: number; def: number; set: (w: number) => void }) {
  return (
    <div
      className="grip"
      role="separator"
      aria-orientation="vertical"
      aria-label={t(side === "left" ? "Resize sidebar" : "Resize side panel")}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onDoubleClick={() => set(def)}
      onKeyDown={(e) => {
        const d = e.key === "ArrowLeft" ? -16 : e.key === "ArrowRight" ? 16 : 0;
        if (d) set(Math.min(max, Math.max(min, width + (side === "left" ? d : -d))));
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        const el = e.currentTarget;
        const x0 = e.clientX;
        el.setPointerCapture(e.pointerId);
        el.classList.add("on");
        // end the drag on release, on lost capture, or when a move arrives with no button held (a release we never saw)
        const move = (ev: PointerEvent) => (ev.buttons & 1 ? set(Math.round(Math.min(max, Math.max(min, width + (side === "left" ? ev.clientX - x0 : x0 - ev.clientX))))) : up());
        const up = () => {
          for (const t of ["pointermove", "pointerup", "pointercancel", "lostpointercapture"]) el.removeEventListener(t, t === "pointermove" ? (move as EventListener) : up);
          el.classList.remove("on");
        };
        el.addEventListener("pointermove", move);
        for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(t, up);
      }}
    />
  );
}

const when = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { weekday: "short" });
};
/** everyone in a chat, builder first */
const team = (r: Room) => [r.builder, ...r.reviewers, ...(r.members || [])];
const roleIn = (r: Room, p: Persona) => (p === r.builder ? (r.template === "roundtable" ? "Talks" : "Builder") : r.reviewers.includes(p) ? (r.template === "roundtable" ? "Talks" : "Reviewer") : "Member");

function Sidebar({ state, view, go, invoke, newChat, width }: { state: State; view: View; go: (v: View) => void; invoke: Invoke; newChat: (projectId?: string) => void; width: number }) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState<{ at: DOMRect; items: Item[] } | null>(null);
  const [adding, setAdding] = useState<DOMRect | null>(null);
  const [renaming, setRenaming] = useState("");
  const sel = view.kind === "chat" ? view.id : "";
  const room = state.rooms.find((r) => r.id === sel);
  const pd = (id: string) => state.personas.find((p) => p.id === id);
  const sorted = [...state.rooms].sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
  const more = (e: React.MouseEvent, items: Item[]) => {
    e.stopPropagation();
    setMenu({ at: (e.currentTarget as HTMLElement).getBoundingClientRect(), items });
  };
  const preview = (r: Room) => {
    const m = [...r.messages].reverse().find((m) => m.text.trim());
    if (!m) return t("No messages yet");
    const who = m.author === "cello" ? t("You") : m.author === "Walt" ? "Walt" : r.template === "direct" ? label(state, pd(m.author)?.engine ?? "claude", m.meta?.model) : pd(m.author)?.name ?? m.author;
    return `${who}: ${m.text.replace(/\s+/g, " ").slice(0, 90)}`;
  };
  const actions = (r: Room): Item[] => [
    { label: t("Rename"), onSelect: () => setRenaming(r.id) },
    {
      label: t("Delete"),
      danger: true,
      disabled: busy(r),
      onSelect: () => {
        if (!confirm(t('Delete "{0}"? Its messages are removed from Walt. Project files are not touched.', r.title))) return;
        void invoke("chat.delete", r.id).then(() => sel === r.id && go({ kind: "home" }));
      },
    },
  ];
  const rename = (r: Room) => (
    <div key={r.id} className="navi on">
      <input
        autoFocus
        aria-label={t("Chat name")}
        defaultValue={r.title}
        style={{ width: "100%", padding: "2px 6px", fontSize: 13.5 }}
        onKeyDown={(e) => {
          if (e.key === "Enter") void invoke("chat.rename", { roomId: r.id, title: e.currentTarget.value }).then(() => setRenaming(""));
          if (e.key === "Escape") setRenaming("");
        }}
        onBlur={() => setRenaming("")}
      />
    </div>
  );
  // project chats: avatars of who is in it, last message, time (the W06 room list)
  const richRow = (r: Room) =>
    renaming === r.id ? (
      rename(r)
    ) : (
      <div key={r.id} className={`navi rich ${sel === r.id ? "on" : ""}`} onClick={() => go({ kind: "chat", id: r.id })} title={r.title}>
        <Html h={stack((r.template === "direct" ? [r.builder] : team(r)).map((p) => pd(p)?.avatar ?? "claude"), 20)} />
        <div className="f1" style={{ minWidth: 0 }}>
          <div className="row g6">
            <span className="t b">{r.title}</span>
            {busy(r) && <span style={{ width: 7, height: 7, borderRadius: 7, background: r.state === "awaiting_user" ? T.amber : T.green, flex: "none" }} />}
            <span className="s12 dim when">{when(lastAt(r))}</span>
          </div>
          <div className="pv">{preview(r)}</div>
        </div>
        <span className="x" role="button" aria-label={t("Chat actions")} onClick={(e) => more(e, actions(r))}>
          <Icon n="more" s={15} />
        </span>
      </div>
    );
  const plainRow = (r: Room) =>
    renaming === r.id ? (
      rename(r)
    ) : (
      <div key={r.id} className={`navi ${sel === r.id ? "on" : ""}`} onClick={() => go({ kind: "chat", id: r.id })} title={r.title}>
        <Html h={av(pd(r.builder)?.avatar ?? "claude", 20)} />
        <span className="t">{r.title}</span>
        {busy(r) && <span style={{ width: 7, height: 7, borderRadius: 7, background: r.state === "awaiting_user" ? T.amber : T.green, flex: "none" }} />}
        <span className="s12 dim when">{when(lastAt(r))}</span>
        <span className="x" role="button" aria-label={t("Chat actions")} onClick={(e) => more(e, actions(r))}>
          <Icon n="more" s={15} />
        </span>
      </div>
    );
  const ready = ENGINES_ON.filter((e) => personaStatus(e, state.engines).ready);
  const loose = sorted.filter((r) => !r.projectId);
  const proc = (p: Persona) => state.procs?.find((x) => x.room === sel && x.persona === p);
  return (
    <nav className="nav" aria-label={t("Walt")} style={{ width }}>
      <div style={{ padding: "4px 10px 12px" }}><Html h={wordmark(19)} /></div>
      <div className={`navi ${view.kind === "home" ? "on" : ""}`} role="button" onClick={() => newChat("")}><Icon n="plus" /><span className="t">{t("New chat")}</span></div>
      <div className={`navi ${view.kind === "search" ? "on" : ""}`} role="button" onClick={() => go({ kind: "search" })}><Icon n="search" /><span className="t">{t("Search")}</span></div>
      <div className={`navi ${view.kind === "customize" ? "on" : ""}`} role="button" onClick={() => go({ kind: "customize", tab: "ai" })}><Icon n="sparkle" /><span className="t">{t("Customize")}</span></div>
      <div className="scroll">
        <div className="nhead">
          {t("Projects")}
          <span className="add" role="button" aria-label={t("New project")} title={t("New project")} onClick={() => go({ kind: "project-new" })}><Icon n="plus" s={15} /></span>
        </div>
        {!state.projects.length && <div className="navi sub" style={{ paddingLeft: 10, color: T.dim }} onClick={() => go({ kind: "project-new" })}>{t("Add a project folder")}</div>}
        {state.projects.map((p) => {
          const chats = sorted.filter((r) => r.projectId === p.id);
          const open = !closed[p.id];
          return (
            <React.Fragment key={p.id}>
              <div className="navi" role="button" aria-expanded={open} onClick={() => setClosed({ ...closed, [p.id]: open })} title={p.root}>
                <Icon n={open ? "chevd" : "chevr"} s={14} />
                <span className="t b">{p.name}</span>
                {!open && <span className="s12 dim">{chats.length}</span>}
                <span className="x" role="button" aria-label={t("New chat in project")} title={t("New chat")} onClick={(e) => { e.stopPropagation(); newChat(p.id); }}>
                  <Icon n="plus" s={15} />
                </span>
                <span className="x" role="button" aria-label={t("Project actions")} onClick={(e) => more(e, [
                  { label: t("New chat"), onSelect: () => newChat(p.id) },
                  { label: t("New team chat"), hint: "pick the models", onSelect: () => go({ kind: "join", projectId: p.id, first: false }) },
                ])}>
                  <Icon n="more" s={15} />
                </span>
              </div>
              {open && chats.map(richRow)}
              {open && !chats.length && <div className="navi sub" style={{ color: T.dim }} onClick={() => newChat(p.id)}>{t("No chats yet")}</div>}
            </React.Fragment>
          );
        })}
        <div className="nhead">{t("Chats")}</div>
        {loose.map(plainRow)}
        {!loose.length && <div className="navi sub" style={{ paddingLeft: 10, color: T.dim }}>{t("No chats yet")}</div>}
        {room && room.template !== "direct" && (
          <>
            <div className="nhead" style={{ marginTop: 6 }}>
              {t("Team")} · {room.title}
              <span className="add row g4" role="button" aria-label={t("Add a model to this chat")} style={{ color: T.green, fontSize: 12 }} onClick={(e) => setAdding(e.currentTarget.getBoundingClientRect())}>
                <Icon n="plus" s={14} c={T.green} w={2} />{t("Add")}
              </span>
            </div>
            {room.template !== "roundtable" && (
              <div className="row g8 s12" style={{ padding: "2px 12px 6px" }} title={t("Before each task Walt makes the reviewer whose Good at fits best the builder.")}>
                <span className="f1 dim">{t("Auto roles")}</span>
                <div className="seg">{([[false, "Off"], [true, "On"]] as const).map(([v, l]) => <span key={l} className={!!room.auto === v ? "on" : ""} onClick={() => invoke("room.auto", { roomId: room.id, on: v })}>{t(l)}</span>)}</div>
              </div>
            )}
            {team(room).map((id) => {
              const p = pd(id);
              if (!p) return null;
              const pr = proc(id);
              const [st, c] = pr ? (pr.busy ? [t("Working"), T.green] : [t("Ready"), T.blue]) : [t("Asleep"), T.faint];
              const r = roleIn(room, id);
              return (
                <div key={id} className="navi rich" title={`${p.name} · ${label(state, p.engine, p.model)}`}>
                  <Html h={av(p.avatar, 30)} />
                  <div className="f1" style={{ minWidth: 0 }}>
                    <div className="row g6"><span className="t b">{p.name}</span><Html h={roleTag(p.avatar, t(r))} /></div>
                    <div className="pv row g6"><span style={{ width: 7, height: 7, borderRadius: 7, background: c, flex: "none" }} />{st} · {label(state, p.engine, room.tune?.[id]?.model ?? p.model)}</div>
                  </div>
                  {r !== "Builder" && r !== "Talks" && (
                    <span className="x" role="button" aria-label={`${p.name} actions`} onClick={(e) => more(e, [
                      { label: t("Make builder"), onSelect: () => invoke("member", { roomId: room.id, persona: id, role: "Builder" }) },
                      { label: t(r === "Reviewer" ? "Make member" : "Make reviewer"), onSelect: () => invoke("member", { roomId: room.id, persona: id, role: r === "Reviewer" ? "Member" : "Reviewer" }) },
                      { label: t("Remove from chat"), danger: true, onSelect: () => invoke("member", { roomId: room.id, persona: id, role: "Remove" }) },
                    ])}>
                      <Icon n="more" s={15} />
                    </span>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
      <div className="row g8 s12 dim" style={{ padding: "8px 4px 0 10px", borderTop: `1px solid ${T.line2}` }}>
        <Icon n="shield" s={14} c={ready.length ? T.green : T.amber} />
        <span className="f1">{ready.length ? t("{0} ready", ready.map((e) => ENGINE_NAME[e]).join(" + ")) : t("No AI ready · open Customize")}</span>
        <span className={`tbb ${view.kind === "settings" ? "on" : ""}`} role="button" aria-label={t("Settings")} title={t("Settings")} onClick={() => go({ kind: "settings", tab: "general" })}>
          <Icon n="gear" s={17} c={view.kind === "settings" ? T.text : T.dim} />
        </span>
      </div>
      {menu && <Menu at={menu.at} items={menu.items} onClose={() => setMenu(null)} />}
      {adding && room && <AddModel state={state} room={room} invoke={invoke} at={adding} onClose={() => setAdding(null)} />}
    </nav>
  );
}

/** pick a model from the account's list and add it to a team chat (the "Add model" button) */
function AddModel({ state, room, invoke, at, onClose }: { state: State; room: Room; invoke: Invoke; at: DOMRect; onClose: () => void }) {
  const [pick, setPick] = useState<{ engine: Engine; model: string } | null>(null);
  const [as, setAs] = useState<"Reviewer" | "Member">("Member");
  const [effort, setEffort] = useState("");
  const [older, setOlder] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const ids = team(room);
  const inTeam = (e: Engine, id: string) => ids.some((pid) => {
    const p = state.personas.find((x) => x.id === pid);
    const m = room.tune?.[pid]?.model ?? (p?.model || "default");
    // "default" means the CLI's default model, so it matches the catalog's default entry
    return p?.engine === e && (m === id || (m === "default" && !!state.catalog?.[e]?.find((x) => x.id === id)?.isDefault));
  });
  const info = pick && state.catalog?.[pick.engine]?.find((m) => m.id === pick.model);
  const add = async () => {
    if (!pick) return;
    const p = await invoke("persona.for", { ...pick, ...(effort && { effort }) });
    if (p && (await invoke("member", { roomId: room.id, persona: p.id, role: as }))) onClose();
  };
  const W = 360;
  const left = Math.min(Math.max(8, at.left), window.innerWidth - W - 8);
  // open below the button, or above it when there is more room there (the sidebar's Team · Add sits low);
  // only the model list scrolls, so the Add / Cancel row is always on screen
  const below = window.innerHeight - at.bottom - 14, above = at.top - 14;
  const place = below >= 460 || below >= above ? { top: at.bottom + 6, maxHeight: Math.min(640, below) } : { bottom: window.innerHeight - at.top + 6, maxHeight: Math.min(640, above) };
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 59 }} onMouseDown={onClose} />
      <div
        ref={ref}
        className="menu col"
        role="dialog"
        aria-label={t("Add a model to {0}", room.title)}
        style={{ position: "fixed", left, width: W, zIndex: 60, padding: 10, overflow: "hidden", ...place }}
        onKeyDown={(e) => e.key === "Enter" && pick && (e.preventDefault(), void add())}
      >
        <div className="row sb" style={{ padding: "2px 4px 8px" }}><span className="s15 b">{t("Add a model to {0}", room.title)}</span><span role="button" aria-label={t("Close")} onClick={onClose}><Icon n="x" s={15} /></span></div>
        <input autoFocus aria-label={t("Search models")} placeholder={t("Search models")} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", padding: "7px 10px", fontSize: 13.5 }} />
        <div style={{ overflow: "auto", minHeight: 0, flex: 1, marginTop: 6 }}>
          {ENGINES_ON.map((e) => {
            const all = (state.catalog?.[e] ?? []).filter((m) => m.id !== "default" && (!q || m.label.toLowerCase().includes(q.toLowerCase())));
            const list = q || older ? all : all.filter((m) => !m.more);
            return (
              <React.Fragment key={e}>
                <div className="mlabel">{ENGINE_NAME[e]}</div>
                {!all.length && <div className="mi" style={{ opacity: 0.5 }}>{personaStatus(e, state.engines).ready ? t(q ? "No match" : "Loading models…") : personaStatus(e, state.engines).label}</div>}
                {list.map((m) => {
                  const has = inTeam(e, m.id);
                  const on = pick?.engine === e && pick.model === m.id;
                  return (
                    <div key={m.id} className={`mi ${on ? "act" : ""}`} role="option" aria-selected={on} aria-disabled={has} style={{ opacity: has ? 0.45 : 1, gap: 10 }} onClick={() => !has && (setPick({ engine: e, model: m.id }), setEffort(""))}>
                      <Html h={av(e === "codex" ? "codex" : /sonnet/i.test(m.label) ? "sonnet" : "claude", 22)} />
                      <span className="b f1">{m.label}</span>
                      {has ? <span className="h">{t("In this chat")}</span> : on && <Icon n="checkc" s={16} c={T.green} />}
                    </div>
                  );
                })}
                {!q && !older && all.some((m) => m.more) && <div className="mi" style={{ color: T.dim }} onClick={() => setOlder(true)}>More models ({all.filter((m) => m.more).length})</div>}
              </React.Fragment>
            );
          })}
        </div>
        <div className="msep" />
        <div className="row g10" style={{ padding: "4px 4px" }}>
          <span className="s13 dim f1">{t("Joins as")}</span>
          <div className="seg">{(["Reviewer", "Member"] as const).map((r) => <span key={r} className={as === r ? "on" : ""} onClick={() => setAs(r)}>{r}</span>)}</div>
        </div>
        <div className="row g10" style={{ padding: "6px 4px" }}>
          <span className="s13 dim f1">{t("Effort")}</span>
          <Dropdown label={t("Effort")} value={effort} width={140} disabled={!info?.efforts.length} onChange={setEffort} options={[{ value: "", label: t("Default") }, ...(info?.efforts ?? []).map((l) => ({ value: l as string, label: cap(l) }))]} />
        </div>
        <div className="s12 dim" style={{ padding: "4px 4px 0", lineHeight: 1.5 }}>{as === "Member" ? "Members answer only when you @mention them." : "Reviewers read every new revision, read-only."} The builder stays the only one who edits files.</div>
        <div className="row g8" style={{ padding: "10px 4px 2px", justifyContent: "flex-end" }}>
          <button type="button" className="btn" style={{ border: 0 }} onClick={onClose}>{t("Cancel")}</button>
          <button type="button" className="btn g" style={{ border: 0, opacity: pick ? 1 : 0.4 }} disabled={!pick} onClick={add}>{info ? t("Add {0}", info.label) : t("Pick a model")}</button>
        </div>
      </div>
    </>
  );
}

/** chip in the composer, like the model menu in the Claude and ChatGPT apps */
function ModelChip({ state, value, pick }: { state: State; value: Target; pick: (t: Target) => void }) {
  const [at, setAt] = useState<DOMRect | null>(null);
  const list0 = state.catalog?.[value.engine] ?? [];
  const info = list0.find((m) => m.id === value.model) ?? (value.model === "default" || !value.model ? list0.find((m) => m.isDefault) : undefined);
  const items: Item[] = [];
  for (const e of ENGINES_ON) {
    const list = state.catalog?.[e] ?? [];
    items.push({ kind: "label", label: ENGINE_NAME[e] });
    if (!list.length) {
      const s = personaStatus(e, state.engines);
      items.push({ label: s.ready ? t("Loading models…") : s.label, disabled: true });
      continue;
    }
    const opt = (m: (typeof list)[number]): Item => ({
      label: m.label,
      checked: value.engine === e && value.model === m.id,
      onSelect: () => pick({ engine: e, model: m.id, effort: value.effort && m.efforts.includes(value.effort) ? value.effort : undefined }),
    });
    items.push(...list.filter((m) => !m.more).map(opt));
    const older = list.filter((m) => m.more);
    if (older.length) items.push({ label: t("More models"), submenu: older.map(opt) });
  }
  const levels = info?.efforts ?? [];
  items.push({ kind: "sep" }, {
    label: t("Effort"),
    hint: value.effort ? cap(value.effort) : t("Default"),
    disabled: !levels.length,
    submenu: [{ label: t("Default"), checked: !value.effort, onSelect: () => pick({ ...value, effort: undefined }) }, ...levels.map((l) => ({ label: cap(l), checked: value.effort === l, onSelect: () => pick({ ...value, effort: l }) }))],
  });
  return (
    <>
      <button type="button" className="mchip" aria-label={t("Model and effort")} aria-haspopup="menu" onClick={(e) => setAt(at ? null : e.currentTarget.getBoundingClientRect())}>
        <span>{label(state, value.engine, value.model)}</span>
        {value.effort && <span style={{ color: T.dim }}>{cap(value.effort)}</span>}
        <Icon n="chevd" s={14} />
      </button>
      {at && <Menu at={at} side="above" width={260} items={items} onClose={() => setAt(null)} />}
    </>
  );
}

/** message box: Enter sends, Shift+Enter breaks the line, @ and / open the shortcut menu */
function Composer({ state, room, placeholder, chip, footer, onSend, onStop, working }: {
  state: State; room?: Room; placeholder: string; chip?: React.ReactNode; footer?: React.ReactNode; onSend: (text: string) => Promise<boolean>; onStop?: () => void; working?: boolean;
}) {
  const [text, setText] = useState("");
  const [list, setList] = useState<Suggestion[]>([]);
  const [act, setAct] = useState(0);
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const t = ref.current!;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 220) + "px";
  }, [text]);
  useEffect(() => ref.current?.focus(), [room?.id]);
  const refresh = (v: string, caret: number) => {
    setList(room ? complete(v.slice(0, caret), state, room) : []);
    setAct(0);
  };
  const pick = (s: Suggestion) => {
    const t = ref.current!;
    const pos = t.selectionStart;
    const start = pos - s.replace;
    const v = text.slice(0, start) + s.insert + text.slice(pos);
    setText(v);
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(start + s.insert.length, start + s.insert.length);
      refresh(v, start + s.insert.length);
    });
  };
  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      if (await onSend(text)) {
        setText("");
        setList([]);
      }
    } finally {
      setSending(false);
    }
  };
  const can = !!text.trim() && !sending;
  return (
    <div className="comp" style={{ position: "relative" }}>
      {!!list.length && (
        <div className="menu" role="listbox" style={{ position: "absolute", bottom: "100%", left: "max(24px, calc(50% - 380px))", marginBottom: 6, width: 360 }}>
          {list.map((s, i) => (
            <div key={s.label + i} className={`mi ${i === act ? "act" : ""}`} role="option" aria-selected={i === act} onMouseDown={(e) => { e.preventDefault(); if (s.insert) pick(s); else setList([]); }}>
              <span className="b">{s.label}</span><span className="h">{s.hint}</span>
            </div>
          ))}
        </div>
      )}
      <div className="cbox" style={{ maxWidth: 760 }}>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={placeholder}
          aria-label={t("Message")}
          onChange={(e) => {
            setText(e.target.value);
            refresh(e.target.value, e.target.selectionStart);
          }}
          onBlur={() => setTimeout(() => setList([]), 120)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            const nav = ["ArrowDown", "ArrowUp", "Tab", "Escape"].includes(e.key) || (e.key === "Enter" && !e.shiftKey);
            if (list.length && nav) {
              e.preventDefault();
              if (e.key === "ArrowDown") setAct((act + 1) % list.length);
              else if (e.key === "ArrowUp") setAct((act - 1 + list.length) % list.length);
              else if (e.key === "Escape" || !list[act].insert) setList([]);
              else pick(list[act]);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {chip}
        {working && onStop ? (
          <button type="button" className="send" aria-label={t("Stop")} style={{ border: 0, background: "#FF453A33", cursor: "pointer" }} onClick={onStop}><Icon n="stop" s={16} c="#FF6961" w={2.2} /></button>
        ) : (
          <button type="button" className="send" aria-label={t("Send")} disabled={!can} style={{ border: 0, cursor: can ? "pointer" : "default", opacity: can ? 1 : 0.4 }} onClick={send}><Icon n="up" s={18} c="#04170B" w={2.2} /></button>
        )}
      </div>
      {footer && <div className="route" style={{ maxWidth: 760 }}>{footer}</div>}
    </div>
  );
}

/** start screen: type and pick a model; the chat is created on send (like the Claude app) */
function Home({ state, invoke, opened }: { state: State; invoke: Invoke; opened: (id: string) => void }) {
  const ready = ENGINES_ON.filter((e) => personaStatus(e, state.engines).ready);
  const [tg, setT] = useState<Target>(state.settings.lastTarget ?? { engine: ready[0] ?? "claude", model: "default" });
  const hour = new Date().getHours();
  return (
    <div className="col" style={{ flex: 1, minHeight: 0 }}>
      <div className="empty">
        <Html h={wordmark(34)} />
        <div className="s24 b" style={{ color: T.text, marginTop: 12 }}>{t(hour < 11 ? "Good morning" : hour < 15 ? "Good afternoon" : hour < 19 ? "Good evening" : "Good night")}</div>
        <div className="s14">{t(ready.length ? "Ask anything, or open a project on the left to work on its files." : "No AI is ready yet. Open Customize · AI & models.")}</div>
      </div>
      <Composer
        state={state}
        placeholder={t("How can Walt help today?")}
        chip={<ModelChip state={state} value={tg} pick={setT} />}
        footer={<span className="dim">{t("A chat without a project can read and talk, not edit files.")}</span>}
        onSend={async (text) => {
          const r = await invoke("chat.new", "");
          if (!r) return false;
          if ((await invoke("chat.target", { roomId: r.id, ...tg })) === null) return false;
          opened(r.id);
          await invoke("send", { roomId: r.id, text });
          return true;
        }}
      />
    </div>
  );
}

type Diff = { revision: number; files: { path: string; status: string; patch: string }[]; more?: number };
/** the latest revision's changes, read-only: git diff when the project uses git, else the new text */
function DiffView({ diff, title, onClose }: { diff: Diff; title: string; onClose: () => void }) {
  const [open, setOpen] = useState(0);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const f = diff.files[open];
  const color = (l: string) => (l.startsWith("+++") || l.startsWith("---") || l.startsWith("diff ") || l.startsWith("index ") ? { color: T.faint } : l.startsWith("+") ? { background: T.green + "1f", color: T.green } : l.startsWith("-") ? { background: T.red + "1f", color: T.red } : l.startsWith("@@") ? { color: T.blue } : {});
  const tag: Record<string, string> = { added: "A", deleted: "D", changed: "M" };
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label={t("Changes in r{0}", diff.revision)} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card col" style={{ width: "min(1100px, 92vw)", height: "84vh", padding: 0, overflow: "hidden" }}>
        <div className="row g10" style={{ padding: "14px 18px", borderBottom: `1px solid ${T.line}` }}>
          <Icon n="diff" s={18} />
          <span className="s15 b f1">{title} · {t("Changes in r{0}", diff.revision)}</span>
          <span className="tbb" role="button" aria-label={t("Close")} onClick={onClose}><Icon n="x" s={16} /></span>
        </div>
        {!diff.files.length ? (
          <div className="s13 dim" style={{ padding: 24 }}>{t("No file changes in this revision.")}</div>
        ) : (
          <div className="row" style={{ flex: 1, minHeight: 0, alignItems: "stretch" }}>
            <div className="col" style={{ width: 260, borderRight: `1px solid ${T.line}`, overflow: "auto", padding: 6 }}>
              {diff.files.map((x, i) => (
                <div key={x.path} className={`navi${i === open ? " on" : ""}`} title={x.path} onClick={() => setOpen(i)}>
                  <span className="mono s11" style={{ color: x.status === "added" ? T.green : x.status === "deleted" ? T.red : T.amber, width: 12 }}>{tag[x.status]}</span>
                  <span className="t s13" style={{ direction: "rtl", textAlign: "left" }}>{x.path}</span>
                </div>
              ))}
              {!!diff.more && <div className="s12 dim" style={{ padding: 10 }}>{t("+{0} more files", diff.more)}</div>}
            </div>
            <pre className="mono f1" style={{ margin: 0, overflow: "auto", fontSize: 12.5, lineHeight: 1.55, padding: "10px 0" }}>
              {f.status === "deleted" ? <div className="dim" style={{ padding: "0 16px" }}>{t("File deleted.")}</div> : f.patch.split("\n").map((l, i) => <div key={i} style={{ padding: "0 16px", whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...color(l) }}>{l || " "}</div>)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatView({ state, room, invoke, panel, setRw }: { state: State; room: Room; invoke: Invoke; panel: number; setRw: (w: number) => void }) {
  const direct = room.template === "direct";
  const [adding, setAdding] = useState<DOMRect | null>(null);
  const [tab, setTab] = useState(direct ? "Files" : "Task");
  const [menuAt, setMenuAt] = useState<DOMRect | null>(null);
  const [note, setNote] = useState("");
  const [diff, setDiff] = useState<Diff | null>(null);
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(""), 6000);
    return () => clearTimeout(id);
  }, [note]);
  const cli = (e: string) => (e === "codex" ? "Codex" : "Claude Code");
  const resume = async (persona: string) => {
    const r = await invoke("cli.continue", { roomId: room.id, persona });
    if (r) setNote(t("Opened a terminal: {0}", r.command));
  };
  const exportIt = async () => {
    const r = await invoke("context.export", room.id);
    if (!r) return;
    if (r.path) return setNote(t("Saved {0}", r.path));
    await navigator.clipboard.writeText(r.text).then(() => setNote(t("Context copied")), () => setNote(t("Could not reach the clipboard")));
  };
  // "…" in the header: carry the chat on outside Walt
  const chatMenu = (): Item[] => [
    room.template === "direct"
      ? { label: t("Continue in {0}", cli(pd(room.builder)?.engine ?? "claude")), hint: t("terminal"), onSelect: () => void resume(room.builder) }
      : {
          label: t("Continue in the CLI"),
          submenu: team(room).flatMap((id) => {
            const p = pd(id);
            return p ? [{ label: p.name, hint: cli(p.engine), onSelect: () => void resume(id) }] : [];
          }),
        },
    { label: project ? t("Export context to WALT.md") : t("Copy context"), hint: project ? project.name : "Markdown", onSelect: () => void exportIt() },
  ];
  const tl = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const project = room.projectId ? state.projects.find((p) => p.id === room.projectId) : undefined;
  const pd = (id: string) => state.personas.find((p) => p.id === id);
  const asks = state.asks.filter((a) => a.roomId === room.id);
  const last = room.messages.at(-1);
  const tg = target(state, room);
  useLayoutEffect(() => {
    if (stick.current && tl.current) tl.current.scrollTop = tl.current.scrollHeight;
  }, [room.messages.length, last?.text.length, asks.length]);
  const roleOf = (p: Persona) => (direct ? "" : p === room.builder ? "Builder" : room.reviewers.includes(p) ? "Reviewer" : room.members?.includes(p) ? "Member" : "");
  // plain chats name replies by the model that answered (stored on the message), team chats by persona
  const nameOf = (id: string, meta?: { model?: string }) => {
    const p = pd(id);
    if (!p) return id;
    return direct ? label(state, p.engine, meta?.model ?? tg.model) : p.name;
  };
  // the latest AI reply may end with a DECISION; its options become buttons until you answer
  const lastAi = [...room.messages].reverse().find((m) => pd(m.author));
  const asking = lastAi && !busy(room) && lastAi === room.messages.at(-1) ? decision(lastAi.text) : undefined;
  const choices = asking
    ? `<div class="row g8" style="margin:4px 0 0 44px;flex-wrap:wrap"><span class="s12 dim">${esc(t("Your choice"))}:</span>${asking.options.map((o, i) => `<button class="btn sm" data-hot="decide:${i}" style="border:0">${esc(o)}</button>`).join("")}</div>`
    : "";
  const html =
    room.messages
      .map((m) =>
        m.author === "cello"
          ? mine(new Date(m.at).toLocaleTimeString(), esc(m.text)) + (m.meta?.to || m.meta?.effort || m.kind === "setting" ? metaChip(m.meta ?? {}, (id) => esc(nameOf(id)), m.kind === "setting") : "")
          : pd(m.author)
            ? personaMsg(pd(m.author)!, t(roleOf(m.author)), new Date(m.at).toLocaleTimeString(), md(m.text) || (busy(room) && m === last ? '<span class="dim">Thinking…</span>' : "…"), nameOf(m.author, m.meta)) + (m === lastAi ? choices : "")
            : `<div class="card s13" style="margin:12px 0;padding:12px;color:${m.kind === "error" ? T.red : T.sub}">${esc(m.text)}</div>`,
      )
      .join("") +
    asks
      .map(
        (a) =>
          `<div class="card" style="padding:14px;margin:10px 0 0 44px;border-color:${T.amber}80"><div class="row g8">${ic("warn", 17, T.amber)}<span class="s14 b">${t("{0} wants to use {1}", esc(nameOf(a.persona)), esc(a.title))}</span></div><pre class="mono" style="margin:10px 0;background:#141416;border-radius:10px;padding:10px 12px;font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow:auto">${esc(askBody(a.input))}</pre><div class="row g8"><button class="btn g" data-hot="allow:${a.id}" style="border:0">${t("Allow once")}</button><button class="btn" data-hot="deny:${a.id}" style="border:0">${t("Deny")}</button></div></div>`,
      )
      .join("") +
    (room.artifacts.length && !busy(room) ? (direct ? changed(room) : deliverable(state, room, room.artifacts.at(-1)!)) : "") +
    // a run cut off by a crash or a forced close: the project stays locked until you have looked at the files
    (room.state === "recovery_required"
      ? `<div class="card" style="padding:14px;margin:12px 0 0 44px;border-color:${T.amber}80"><div class="row g8">${ic("warn", 17, T.amber)}<span class="s14 b">${esc(t("The last run stopped before it finished"))}</span></div><div class="s13 sub" style="margin:8px 0 12px;line-height:1.5">${esc(t("Walt closed or crashed while an AI was working. Check the project files (some edits may be half done); Walt does not retry on its own."))}</div><button class="btn g" data-hot="control:recovered" style="border:0">${esc(t("I checked, continue"))}</button></div>`
      : "");
  const act = async (e: React.MouseEvent) => {
    const h = (e.target as HTMLElement).closest<HTMLElement>("[data-hot]")?.dataset.hot;
    if (!h) return;
    if (h.startsWith("allow:") || h.startsWith("deny:")) await invoke("approval", { id: h.split(":")[1], allow: h.startsWith("allow:") });
    else if (h === "accept") await invoke("accept", room.id);
    else if (h === "diff") setDiff(await invoke("diff", room.id));
    else if (h.startsWith("control:")) await invoke("control", { roomId: room.id, action: h.slice(8) });
    else if (h.startsWith("member:")) {
      const [, persona, role] = h.split(":");
      await invoke("member", { roomId: room.id, persona, role });
    } else if (h.startsWith("tab:")) setTab(h.slice(4));
    else if (h.startsWith("decide:") && asking && lastAi) {
      // the builder's question goes back as a plain message (build, then review); anyone else's as an @mention
      const o = asking.options[Number(h.slice(7))];
      await invoke("send", { roomId: room.id, text: direct || lastAi.author === room.builder ? o : `@${pd(lastAi.author)!.name} ${o}` });
    }
  };
  const status = t(room.state === "awaiting_user" ? "Waiting for your approval" : busy(room) ? (room.step === "review" ? "Reviewing" : room.step === "fix" ? "Fixing review findings" : "Working") : room.step === "awaiting decision" ? "Waiting for your choice" : "");
  return (
    <div className="row" style={{ flex: 1, minHeight: 0, alignItems: "stretch" }}>
      <div className="col" style={{ flex: 1, minWidth: 0 }}>
        <div className="rh">
          <div className="f1" style={{ minWidth: 0 }}>
            <div className="s16 b" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{room.title}</div>
            <div className="s12 dim" style={{ marginTop: 2 }}>
              {note ? (
                <span style={{ color: T.green }}>{note}</span>
              ) : (
                <>
                  {project ? `${project.name} · ${project.root}` : t("Chat · no project folder")}
                  {status && <span style={{ color: room.state === "awaiting_user" ? T.amber : T.green }}> · {status}</span>}
                </>
              )}
            </div>
          </div>
          {!direct && (
            <>
              <Html h={stack(team(room).map((p) => pd(p)?.avatar ?? "claude"), 26)} />
              <button type="button" className="btn sm" style={{ border: 0 }} aria-haspopup="dialog" aria-expanded={!!adding} onClick={(e) => setAdding(adding ? null : e.currentTarget.getBoundingClientRect())}>
                <Icon n="plus" s={14} c={T.text} w={2} />{t("Add model")}
              </button>
            </>
          )}
          <span className="tbb" role="button" aria-label={t("Chat menu")} aria-haspopup="menu" onClick={(e) => setMenuAt(e.currentTarget.getBoundingClientRect())}>
            <Icon n="more" s={17} />
          </span>
        </div>
        {menuAt && <Menu at={menuAt} width={280} items={chatMenu()} onClose={() => setMenuAt(null)} />}
        {diff && <DiffView diff={diff} title={room.title} onClose={() => setDiff(null)} />}
        {adding && <AddModel state={state} room={room} invoke={invoke} at={new DOMRect(adding.right - 360, adding.y, 360, adding.height)} onClose={() => setAdding(null)} />}
        {!direct && (
          <div
            dangerouslySetInnerHTML={{ __html: workflow({ mode: t(TEMPLATE[room.template]), steps: (room.template === "roundtable" ? ["Answer"] : ["Build", "Review", "Fix"]).map((s) => t(s)), stepIdx: room.step === "fix" ? 2 : room.step === "review" ? 1 : room.step === "build" ? 0 : -1, done: room.step === "awaiting acceptance", status: t(STATE[room.state] ?? room.state), turn: t("{0} of {1}", room.used, room.budget), controls: busy(room) } as any).replace(">Turn ", `>${t("Turn")} `).replace("Pause after turn", t("Pause after turn")).replace(/(#FF6961[^>]*>[^<]*<\/svg>)Stop</, `$1${t("Stop")}<`) }}
            onClick={(e) => {
              const b = (e.target as HTMLElement).closest(".btn");
              if (b) void invoke("control", { roomId: room.id, action: /stop/i.test(b.textContent || "") ? "interrupt" : "pause" });
            }}
          />
        )}
        <div
          className="tl"
          ref={tl}
          onScroll={(e) => {
            const d = e.currentTarget;
            stick.current = d.scrollHeight - d.scrollTop - d.clientHeight < 80;
          }}
          onClick={act}
        >
          {room.messages.length || asks.length ? (
            <div className="tli" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div className="empty" style={{ height: "100%" }}>
              <div className="s16 b" style={{ color: T.text }}>{direct ? t("Chat with {0}", label(state, tg.engine, tg.model)) : `${t(TEMPLATE[room.template])} · ${project?.name ?? ""}`}</div>
              <div className="s13">{t(project ? (direct ? "It can read this project and edit files after you allow each change." : "Describe the task. The builder works, then the reviewers check the same revision.") : "It can talk and read, but cannot edit files in a chat without a project.")}</div>
            </div>
          )}
        </div>
        <Composer
          state={state}
          room={room}
          placeholder={direct ? t("Message {0}", label(state, tg.engine, tg.model)) : t("Message {0}, or @mention someone", room.title)}
          working={busy(room)}
          onStop={() => invoke("control", { roomId: room.id, action: "interrupt" })}
          chip={direct ? <ModelChip state={state} value={tg} pick={(v) => invoke("chat.target", { roomId: room.id, ...v })} /> : undefined}
          footer={
            <span className="dim">
              {direct ? (project ? t("Edits in {0} need your approval", project.name) : t("Chat only · the AI cannot edit files here")) : t("{0} · one writer at a time · @name to talk to one", t(TEMPLATE[room.template]))}
            </span>
          }
          onSend={async (text) => (await invoke("send", { roomId: room.id, text })) !== null}
        />
      </div>
      {panel > 0 && (
        <>
          <Grip side="right" width={panel} min={280} max={560} def={PANELS.rw} set={setRw} />
          <div className="insp" style={{ width: panel }} onClick={act} dangerouslySetInnerHTML={{ __html: inspectorHtml(state, room, tab) }} />
        </>
      )}
    </div>
  );
}

/** what an approval shows: the command as typed, the diff, or the raw input for anything else */
function askBody(input: any): string {
  const lines = (s: string, p: string) => String(s).split("\n").map((l) => p + l).join("\n");
  if (typeof input?.command === "string") return input.command + (input.cwd ? `\n\nin ${input.cwd}` : "");
  if (typeof input?.diff === "string" && input.diff) return input.diff;
  if (input?.file_path && typeof input.content === "string") return `${input.file_path} (new content)\n\n${input.content}`;
  if (input?.file_path && typeof input.new_string === "string") return `${input.file_path}\n\n${lines(input.old_string ?? "", "- ")}\n${lines(input.new_string, "+ ")}`;
  return JSON.stringify(input, null, 2);
}

/** result card for a plain chat in a project: which files changed (no reviews there) */
function changed(room: Room) {
  const a = room.artifacts.at(-1)!;
  return `<div class="card" style="padding:12px 14px;margin:10px 0 0 44px"><div class="row g8 s13">${ic("diff", 16, T.sub)}<span class="b">${t("Files changed · r{0}", a.revision)}</span><span class="f1"></span><button class="btn sm" data-hot="diff" style="border:0">${t("Open diff")}</button>${a.accepted ? `<span class="pill" style="background:${T.green}29;color:${T.green}">${t("Accepted")}</span>` : `<button class="btn sm g" data-hot="accept" style="border:0">${t("Accept")}</button>`}</div><div class="s12 dim mono" style="margin-top:6px">manifest ${a.hash.slice(0, 8)} · ${t("{0} files tracked", Object.keys(a.files).length)}</div></div>`;
}

// W09 result card: only facts Walt holds (revision, manifest, which reviewer read which hash); no test box until tests are tracked
function deliverable(state: State, room: Room, a: Room["artifacts"][number]) {
  const pd = (id: string) => state.personas.find((p) => p.id === id);
  const box = (k: string, inner: string, sub: string, dashed = false) =>
    `<div class="f1" style="background:#1F1F21;border-radius:12px;padding:12px;${dashed ? "border:1px dashed #48484A" : ""}"><div class="s12 dim">${k}</div><div class="row g8" style="margin-top:6px">${inner}</div><div class="s12 dim" style="margin-top:4px">${sub}</div></div>`;
  const reviews = room.reviewers.map((p) => {
    const v = a.reviews.find((x) => x.persona === p);
    const ok = v?.hash === a.hash;
    return box(t("Source review"), `${av(pd(p)?.avatar ?? "claude", 20)}<span class="s13 b">${esc(pd(p)?.name ?? p)}</span>${ok ? ic("check", 15, T.green) : ""}`, ok ? t("read r{0} · same hash", a.revision) : t(v ? "stale: files changed after review" : "no review"));
  });
  const accept = a.accepted ? box(t("Your acceptance"), `<span class="s13 b">${t("Accepted")}</span>`, t("by you")) : box(t("Your acceptance"), `<span class="s13 b">${t("Waiting for you")}</span>`, t("Not implied by reviews"), true);
  return `<div class="card" style="padding:16px;margin:10px 0 0 44px"><div class="row sb"><span class="row g10">${ic("checkc", 20, a.accepted ? T.green : T.sub)}<span class="s16 b">${esc(room.title)} · ${t("result")}</span><span class="chip mono">r${a.revision}</span></span><span class="s12 dim mono">manifest ${a.hash.slice(0, 6)}</span></div><div class="row g12" style="margin-top:14px">${reviews.join("")}${accept}</div><div class="row g8" style="margin-top:14px">${a.accepted ? "" : `<button class="btn g" data-hot="accept" style="border:0">${ic("check", 15, "#04170B", 2.2)}${t("Accept")}</button>`}<button class="btn" data-hot="diff" style="border:0">${ic("diff", 15, T.text)}${t("Open diff")}</button><button class="btn" data-hot="control:continue" style="border:0">${t("Continue with a new budget")}</button></div></div>`;
}

function inspectorHtml(state: State, room: Room, tab: string) {
  const direct = room.template === "direct";
  const btn = (l: string, a: string) => `<button class="btn" data-hot="${a}" style="border:0">${l}</button>`;
  const files = room.artifacts.map((a) => `<div class="card" style="padding:12px;margin:10px 0">r${a.revision} · ${t(a.accepted ? "Accepted" : "Awaiting acceptance")}<div class="mono s11 dim">${a.hash.slice(0, 16)}</div><div class="s12">${t("{0} reviews · {1} files", a.reviews.length, Object.keys(a.files).length)}</div></div>`).join("") || `<div class="s13 dim">${t("No changes yet.")}</div>`;
  // read-only here: the team is managed in the sidebar (Team · Add, and each member's … menu)
  const can: Record<string, string> = { Builder: "can edit files", Reviewer: "read-only", Talks: "read-only", Member: "when @mentioned" };
  const team = (direct ? [] : [room.builder, ...room.reviewers, ...(room.members || [])])
    .map((id) => {
      const p = state.personas.find((x) => x.id === id);
      if (!p) return "";
      const r = roleIn(room, id);
      return `<div class="row g8 s13" style="margin:8px 0">${av(p.avatar, 22)}<span>${esc(p.name)}</span>${roleTag(p.avatar, t(r))}<span class="f1"></span><span class="s12 dim">${t(can[r])}</span></div>`;
    })
    .join("");
  const body =
    tab === "Context"
      ? `<pre class="s12" style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(room.packet, null, 2) || t("No packet yet"))}</pre>`
      : tab === "Files"
        ? files
        : tab === "Activity"
          ? room.messages.filter((m) => m.author === "Walt").map((m) => `<p class="s12 dim">${esc(m.text)}</p>`).join("") || `<div class="s13 dim">${t("Nothing yet.")}</div>`
          : `<div class="lbl">${t("Who does what")}</div>${team}<div class="lbl">${t("Budget")}</div><div>${t("{0} of {1} turns used", room.used, room.budget)}</div><div class="col g8" style="margin-top:20px">${btn(t("Continue · +2 turns"), "control:continue")}${btn(t("Resume"), "control:resume")}${btn(t("End chat"), "control:end")}</div>`;
  const tabs = (direct ? ["Files", "Activity"] : ["Task", "Files", "Context", "Activity"]).map((x) => `<span class="tab ${tab === x ? "on" : ""}" data-hot="tab:${x}">${t(x)}</span>`).join("");
  return `<div class="tabs">${tabs}</div><div style="padding:18px;overflow:auto">${body}</div>`;
}

type Pick = { engine: Engine; model: string; role: "Builder" | "Reviewer" | "Member"; effort?: Effort };
/** step 2 of a new project (and "New team chat"): tick the models that join, give each a role, then start */
function Joins({ state, invoke, projectId, first, back, done }: { state: State; invoke: Invoke; projectId: string; first: boolean; back: () => void; done: (id: string) => void }) {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [talk, setTalk] = useState(false);
  const [older, setOlder] = useState(false);
  const [busyNow, setBusy] = useState(false);
  const [tplName, setTplName] = useState("");
  const project = state.projects.find((p) => p.id === projectId);
  const key = (p: { engine: Engine; model: string }) => p.engine + ":" + p.model;
  const toggle = (engine: Engine, model: string) => {
    const k = key({ engine, model });
    if (picks.some((p) => key(p) === k)) {
      const rest = picks.filter((p) => key(p) !== k);
      // keep one builder: promote the first one left
      if (!rest.some((p) => p.role === "Builder") && rest.length) rest[0] = { ...rest[0], role: "Builder" };
      setPicks(rest);
    } else setPicks([...picks, { engine, model, role: picks.some((p) => p.role === "Builder") ? "Reviewer" : "Builder" }]);
  };
  const set = (i: number, v: Partial<Pick>) =>
    setPicks(picks.map((p, j) => (j === i ? { ...p, ...v } : v.role === "Builder" && p.role === "Builder" ? { ...p, role: "Reviewer" } : p)));
  const reviewers = picks.filter((p) => p.role === "Reviewer").length;
  const why =
    !picks.length ? t("Pick at least one model.") :
    picks.length === 1 ? t("One model: this starts a plain chat in the project.") :
    talk ? (picks.length > 4 ? t("A roundtable takes up to 4 models.") : "") :
    !reviewers ? t("Make at least one model a reviewer, or switch to Roundtable.") :
    reviewers > 3 ? t("Up to 3 reviewers.") : "";
  const ok = picks.length > 0 && (picks.length === 1 || !why);
  const start = async () => {
    setBusy(true);
    try {
      if (picks.length === 1) {
        const r = await invoke("chat.new", projectId);
        if (r && (await invoke("chat.target", { roomId: r.id, engine: picks[0].engine, model: picks[0].model, ...(picks[0].effort && { effort: picks[0].effort }) }))) done(r.id);
        return;
      }
      const ids: (Pick & { id: string })[] = [];
      for (const p of picks) {
        const per = await invoke("persona.for", { engine: p.engine, model: p.model, ...(p.effort && { effort: p.effort }) });
        if (!per) return;
        ids.push({ ...p, id: per.id });
      }
      const builder = ids.find((p) => p.role === "Builder") ?? ids[0];
      const others = ids.filter((p) => p !== builder);
      const revs = talk ? others : others.filter((p) => p.role === "Reviewer");
      const template = talk ? "roundtable" : revs.length >= 2 ? "triad" : "build_review";
      const r = await invoke("room", { projectId, title: first ? "Main" : "Team chat", template, builder: builder.id, reviewers: revs.map((p) => p.id) });
      if (!r) return;
      for (const m of talk ? [] : others.filter((p) => p.role === "Member")) await invoke("member", { roomId: r.id, persona: m.id, role: "Member" });
      done(r.id);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="col" style={{ flex: 1, minHeight: 0, padding: "28px 40px 0", overflow: "auto" }}>
      <div className="s24 b">{t("Who joins {0}?", project?.name ?? t("this project"))}</div>
      <div className="s13 dim" style={{ marginTop: 6 }}>{t("Only models your signed-in accounts can use are listed. You can add more later with Add model in any team chat.")}</div>
      {!!state.teams?.length && (
        <div className="row g8" style={{ marginTop: 14, flexWrap: "wrap" }}>
          <span className="s12 dim">{t("Start from a template")}:</span>
          {state.teams.map((tm) => (
            <span key={tm.id} className="chip" role="button" style={{ cursor: "pointer", fontSize: 13, padding: "5px 10px" }} onClick={() => (setPicks(tm.picks.map((p) => ({ ...p }))), setTalk(tm.talk))}>
              {tm.name}
            </span>
          ))}
        </div>
      )}
      <div className="row" style={{ gap: 24, marginTop: 20, alignItems: "flex-start" }}>
        <div className="card f1" style={{ padding: 8, minWidth: 0 }}>
          {ENGINES_ON.map((e) => {
            const all = (state.catalog?.[e] ?? []).filter((m) => m.id !== "default");
            const list = older ? all : all.filter((m) => !m.more);
            return (
              <React.Fragment key={e}>
                <div className="mlabel" style={{ padding: "10px 12px 6px" }}>{ENGINE_NAME[e]}</div>
                {!all.length && <div className="s13 dim" style={{ padding: "6px 12px" }}>{personaStatus(e, state.engines).ready ? t("Loading models…") : personaStatus(e, state.engines).label}</div>}
                {list.map((m) => {
                  const i = picks.findIndex((p) => key(p) === key({ engine: e, model: m.id }));
                  return (
                    <div key={m.id} className={`navi ${i >= 0 ? "on" : ""}`} role="checkbox" aria-checked={i >= 0} onClick={() => toggle(e, m.id)} style={{ padding: "8px 12px" }}>
                      <Html h={av(e === "codex" ? "codex" : /sonnet/i.test(m.label) ? "sonnet" : "claude", 28)} />
                      <span className="t b">{m.label}</span>
                      {i >= 0 && !talk && <span className="s12" style={{ color: T.green }}>{t(picks[i].role)}</span>}
                      <span style={{ width: 20, height: 20, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", ...(i >= 0 ? { background: T.green } : { border: "1.5px solid #48484A" }) }}>{i >= 0 && <Icon n="check" s={13} c="#04170B" w={2.6} />}</span>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
          {!older && <div className="navi" style={{ color: T.dim, padding: "8px 12px" }} onClick={() => setOlder(true)}><Icon n="plus" s={15} />{t("More models")}</div>}
        </div>
        <div className="col g12" style={{ width: 460, flex: "none" }}>
          <div className="card" style={{ padding: 16 }}>
            <div className="s14 b">{t("Team")}</div>
            {!picks.length && <div className="s13 dim" style={{ marginTop: 8 }}>{t("Tick models on the left.")}</div>}
            {picks.map((p, i) => {
              const info = state.catalog?.[p.engine]?.find((m) => m.id === p.model);
              return (
                <div key={key(p)} className="row g10" style={{ padding: "10px 0", borderBottom: `1px solid ${T.line2}` }}>
                  <Html h={av(p.engine === "codex" ? "codex" : /sonnet/i.test(info?.label ?? "") ? "sonnet" : "claude", 28)} />
                  <div className="f1" style={{ minWidth: 0 }}><div className="s13 b" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{info?.label ?? p.model}</div><div className="s12 dim">{ENGINE_NAME[p.engine]}</div></div>
                  <Dropdown label={t("Effort for {0}", info?.label ?? "")} value={(p.effort ?? "") as string} width={112} disabled={!info?.efforts.length} onChange={(v) => set(i, { effort: (v || undefined) as Effort | undefined })} options={[{ value: "", label: t("Default") }, ...(info?.efforts ?? []).map((l) => ({ value: l as string, label: cap(l) }))]} />
                  {!talk && <Dropdown label={t("Role for {0}", info?.label ?? "")} value={p.role} width={112} onChange={(v) => set(i, { role: v })} options={(["Builder", "Reviewer", "Member"] as const).map((r) => ({ value: r, label: t(r) }))} />}
                </div>
              );
            })}
            <div className="s12 dim" style={{ marginTop: 10, lineHeight: 1.5 }}>{t(talk ? "Everyone answers in turn and reads the project; nobody edits files." : "One builder edits files after you allow each change; reviewers read the same revision; members answer when @mentioned.")}</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div className="s14 b">{t("How they work together")}</div>
            <div className="seg" style={{ marginTop: 10 }}>
              <span className={talk ? "" : "on"} onClick={() => setTalk(false)}>{t("Build & review")}</span>
              <span className={talk ? "on" : ""} onClick={() => setTalk(true)}>{t("Roundtable")}</span>
            </div>
            <div className="s12 dim" style={{ marginTop: 10 }}>{talk ? t("Roundtable: 4 turns per message.") : reviewers >= 2 ? t("Triad: {0} reviewers in parallel, 6 turns per task.", reviewers) : t("Build & Review: 4 turns per task.")}</div>
            <div className="row g8" style={{ marginTop: 14 }}>
              <input aria-label={t("Template name")} placeholder={t("Save this team as a template…")} value={tplName} maxLength={60} onChange={(e) => setTplName(e.target.value)} style={{ flex: 1, minWidth: 0, padding: "6px 10px", fontSize: 13 }} />
              <button type="button" className="btn sm" style={{ border: 0, opacity: tplName.trim() && picks.length >= 2 ? 1 : 0.4 }} disabled={!tplName.trim() || picks.length < 2} onClick={async () => (await invoke("team.save", { name: tplName, talk, picks })) && setTplName("")}>
                {t("Save template")}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="f1" />
      <div className="row sb" style={{ padding: "18px 0 24px", marginTop: 20, borderTop: `1px solid ${T.line2}` }}>
        <button type="button" className="btn o" onClick={back}>{t(first ? "Skip · plain chat" : "Cancel")}</button>
        <span className="row g12">
          <span className={`s12 ${ok ? "dim" : ""}`} style={ok ? {} : { color: T.amber }}>{why || t("{0} models", picks.length)}</span>
          <button type="button" className="btn g" style={{ border: 0, opacity: ok && !busyNow ? 1 : 0.4 }} disabled={!ok || busyNow} onClick={start}>{t(first ? "Create team chat" : "Start team chat")}</button>
        </span>
      </div>
    </div>
  );
}

function Search({ state, open }: { state: State; open: (id: string) => void }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const hits = needle
    ? state.rooms.flatMap((r) => {
        const m = r.messages.find((m) => m.text.toLowerCase().includes(needle));
        return r.title.toLowerCase().includes(needle) || m ? [{ r, snip: m?.text ?? "" }] : [];
      })
    : [];
  return (
    <div className="panel">
      <h2>{t("Search")}</h2>
      <input autoFocus aria-label={t("Search chats")} placeholder={t("Search chats and messages")} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", maxWidth: 640, marginTop: 12 }} />
      <div className="col g8" style={{ marginTop: 18, maxWidth: 640 }}>
        {hits.map(({ r, snip }) => {
          const i = snip.toLowerCase().indexOf(needle);
          return (
            <div key={r.id} className="card" style={{ padding: "12px 14px", cursor: "pointer" }} onClick={() => open(r.id)}>
              <div className="s14 b">{r.title}</div>
              <div className="s12 dim" style={{ marginTop: 2 }}>{r.projectId ? state.projects.find((p) => p.id === r.projectId)?.name : t("Chat")}</div>
              {snip && <div className="s13 sub" style={{ marginTop: 6 }}>…{snip.slice(Math.max(0, i - 50), i + 90)}…</div>}
            </div>
          );
        })}
        {needle && !hits.length && <div className="dim s13">{t("Nothing found.")}</div>}
      </div>
    </div>
  );
}

const PLANNED: [string, string, string][] = [
  ["Gemini CLI", "Installed on this laptop. Its adapter comes next; sign in with gemini first.", "gemini"],
  ["Groq, xAI Grok and other OpenAI-compatible APIs", "Need an API key (no CLI login). Chat and review only until Walt gives them file tools.", "globe"],
  ["Other ACP agents", "Any command-line agent that speaks ACP can be added as a new AI type.", "term"],
  ["Antigravity", "Desktop IDE; no command-line agent found on this laptop yet.", "sparkle"],
];
/** MCP servers from the user's Claude Code / Codex config, turned on per project */
function Plugins({ state, invoke }: { state: State; invoke: Invoke }) {
  const [list, setList] = useState<{ name: string; engines: Engine[]; projects: string[] }[] | null>(null);
  const load = () => void invoke("mcp.list").then((l) => l && setList(l));
  useEffect(load, [state.revision]);
  return (
    <>
      <h2>{t("Plugins & tools")}</h2>
      <div className="s13 dim" style={{ maxWidth: 760, lineHeight: 1.55 }}>{t("Walt starts every AI without your MCP servers. Turn one on for a project when a task needs it. A change applies from the next message.")}<br />{t("Claude asks you before each tool call. Codex runs MCP tools without asking, so only a Codex builder or chat gets them; Codex reviewers never do.")}</div>
      <div className="col g8" style={{ marginTop: 18, maxWidth: 820 }}>
        {list && !list.length && <div className="s13 dim">{t("No MCP servers found in your Claude Code or Codex config.")}</div>}
        {list?.map((m) => (
          <div key={m.name} className="card" style={{ padding: "12px 16px" }}>
            <div className="row g8">
              <span className="s14 b mono">{m.name}</span>
              {m.engines.map((e) => <span key={e} className="chip">{ENGINE_LABEL[e]}</span>)}
            </div>
            <div className="row g6" style={{ marginTop: 10, flexWrap: "wrap" }}>
              <span className="s12 dim">{t("On in")}:</span>
              {!state.projects.length && <span className="s12 dim">{t("No projects yet")}</span>}
              {state.projects.map((p) => {
                const on = m.projects.includes(p.id);
                return (
                  <span key={p.id} className="chip" role="switch" aria-checked={on} style={{ cursor: "pointer", ...(on ? { background: T.green + "29", color: T.green } : {}) }} onClick={() => void invoke("mcp.set", { projectId: p.id, name: m.name, on: !on }).then(load)}>
                    {on && <Icon n="check" s={12} c={T.green} w={2.4} />}
                    {p.name}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Ctrl N", "New chat"],
  ["Ctrl K", "Search chats"],
  ["Ctrl ,", "Settings"],
  ["Ctrl B", "Show or hide the sidebar"],
  ["Ctrl Alt B", "Show or hide the side panel"],
  ["Enter", "Send"],
  ["Shift Enter", "New line"],
  ["@", "Talk to one model in a team chat"],
  ["/effort, /model", "Change effort or model for one message (add keep for the chat)"],
  ["Esc", "Close a menu or dialog"],
];
function DataPage({ invoke }: { invoke: Invoke }) {
  const [info, setInfo] = useState<{ dir: string; list: { name: string; size: number; at: string }[] } | null>(null);
  const load = () => void invoke("backups").then((v) => v && setInfo(v));
  useEffect(load, []);
  return (
    <>
      <h2>{t("Data & backup")}</h2>
      <div className="s13 dim" style={{ maxWidth: 720, lineHeight: 1.55 }}>{t("Chats, projects and settings live in one database on this laptop. Nothing is uploaded. Project files stay in their own folders.")}</div>
      <div className="card col g12" style={{ padding: 18, marginTop: 18, maxWidth: 720 }}>
        <div className="mono s12 dim" style={{ overflowWrap: "anywhere" }}>{info?.dir}</div>
        <div className="row g8">
          <button type="button" className="btn g" style={{ border: 0 }} onClick={() => void invoke("backup").then(load)}>{t("Back up now")}</button>
          <button type="button" className="btn" style={{ border: 0 }} onClick={() => window.walt.window("data")}>{t("Open data folder")}</button>
        </div>
        <div className="s12 dim">{t("Walt keeps the newest 10 backups in the backups folder. To restore one, quit Walt and copy it over walt.sqlite.")}</div>
        {info?.list.map((b) => (
          <div key={b.name} className="row g8 s13">
            <Icon n="db" s={15} />
            <span className="mono f1">{b.name}</span>
            <span className="s12 dim">{(b.size / 1024).toFixed(0)} KB</span>
          </div>
        ))}
      </div>
    </>
  );
}

type PageProps = { state: State; invoke: Invoke; tab: string; setTab: (t: string) => void };
/** Customize = what the AI can do; Settings (gear at the bottom of the sidebar) = how Walt itself behaves */
const Customize = (p: PageProps) => <Pages {...p} title={t("Customize")} tabs={[["ai", "AI & models", "bolt"], ["personas", "Personas", "users"], ["teams", "Team templates", "branch"], ["plugins", "Plugins & tools", "clip"]]} />;
const Settings = (p: PageProps) => <Pages {...p} title={t("Settings")} tabs={[["general", "General", "gear"], ["permissions", "Permissions", "shield"], ["data", "Data & backup", "db"], ["shortcuts", "Shortcuts", "key"], ["about", "About", "eye"]]} />;
function Pages({ state, invoke, tab, setTab, title, tabs }: PageProps & { title: string; tabs: [string, string, string][] }) {
  const s = state.settings;
  const rows: [string, string, React.ReactNode][] = [
    ["Language", "Interface language. The AI replies in the language you write in.", <div className="seg">{([["en", "English"], ["id", "Indonesia"]] as const).map(([v, l]) => <span key={v} className={s.locale === v ? "on" : ""} onClick={() => invoke("settings", { locale: v })}>{t(l)}</span>)}</div>],
    ["Notifications", "When an AI needs you or finishes while Walt is in the background.", <div className="seg">{([[true, "On"], [false, "Off"]] as const).map(([v, l]) => <span key={l} className={(s.notify !== false) === v ? "on" : ""} onClick={() => invoke("settings", { notify: v })}>{t(l)}</span>)}</div>],
    ["Theme", "", <div className="seg">{([["dark", "Dark"], ["light", "Light"]] as const).map(([v, l]) => <span key={v} className={s.theme === v ? "on" : ""} onClick={() => invoke("settings", { theme: v })}>{t(l)}</span>)}</div>],
    [
      "Default model for new chats",
      "Picking a model in a chat changes this too.",
      <Dropdown
        label="Default model for new chats"
        value={s.lastTarget ? `${s.lastTarget.engine}:${s.lastTarget.model}` : ""}
        width={220}
        onChange={(v) => {
          const i = v.indexOf(":");
          void invoke("settings", { lastTarget: { engine: v.slice(0, i), model: v.slice(i + 1) } });
        }}
        options={[
          ...(s.lastTarget ? [] : [{ value: "", label: t("{0} default", "Claude") }]),
          ...ENGINES_ON.flatMap((e) => (state.catalog?.[e] ?? []).filter((m) => !m.more).map((m) => ({ value: `${e}:${m.id}`, label: m.label === "Default" ? t("{0} default", ENGINE_NAME[e]) : m.label, hint: ENGINE_NAME[e] }))),
        ]}
      />,
    ],
    ["Keep AI ready for", "After that its process sleeps and wakes in a few seconds when needed.", <Dropdown label="Keep AI ready for" value={String(s.idleMinutes)} width={140} onChange={(v) => invoke("settings", { idleMinutes: Number(v) })} options={[5, 10, 15, 30, 60].map((m) => ({ value: String(m), label: t("{0} minutes", m) }))} />],
  ];
  return (
    <div className="row" style={{ flex: 1, minHeight: 0, alignItems: "stretch" }}>
      <div className="col g4" style={{ width: 210, padding: "26px 12px", borderRight: `1px solid ${T.line2}`, flex: "none" }}>
        <div className="s18 b" style={{ padding: "0 10px 12px" }}>{t(title)}</div>
        {tabs.map(([k, l, i]) => (
          <div key={k} role="button" className={`navi ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}><Icon n={i} /><span className="t">{t(l)}</span></div>
        ))}
      </div>
      <div className="panel">
        {tab === "ai" && (
          <>
            <h2>{t("AI & models")}</h2>
            <div className="s13 dim" style={{ marginBottom: 20 }}>{t("Walt uses the apps you are signed in to. The models in each chat's menu come from your account.")}</div>
            <EngineCards state={state} invoke={invoke} />
            <div className="lbl" style={{ marginTop: 30 }}>{t("More AI · planned")}</div>
            <div className="col g8">
              {PLANNED.map(([title, d, i]) => (
                <div key={title} className="card row g12" style={{ padding: "12px 16px", opacity: 0.85 }}>
                  {i === "gemini" ? <Html h={av("gemini", 30)} /> : <Icon n={i} s={20} c={T.sub} />}
                  <div className="f1"><div className="s14 b">{t(title)}</div><div className="s12 dim" style={{ marginTop: 2 }}>{t(d)}</div></div>
                  <span className="pill" style={{ background: "#3A3A3C", color: T.sub }}>{t("Planned")}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "plugins" && <Plugins state={state} invoke={invoke} />}
        {tab === "teams" && (
          <>
            <h2>{t("Team templates")}</h2>
            <div className="col g8" style={{ marginTop: 14, maxWidth: 760 }}>
              {!state.teams?.length && <div className="s13 dim">{t("No team templates yet. Make one in New team chat: pick the models, then Save template.")}</div>}
              {state.teams?.map((tm) => (
                <div key={tm.id} className="card row g12" style={{ padding: "12px 16px" }}>
                  <div className="f1" style={{ minWidth: 0 }}>
                    <div className="s14 b">{tm.name}</div>
                    <div className="s12 dim" style={{ marginTop: 2 }}>{t(tm.talk ? "Roundtable team" : "Build & review team")}</div>
                    <div className="row g6" style={{ marginTop: 8, flexWrap: "wrap" }}>
                      {tm.picks.map((p) => (
                        <span key={p.engine + p.model} className="chip">
                          {label(state, p.engine, p.model)}
                          {!tm.talk && <span className="dim"> · {t(p.role)}</span>}
                          {p.effort && <span className="dim"> · {p.effort}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button type="button" className="btn sm r" style={{ border: 0 }} onClick={() => confirm(t("Delete {0}?", tm.name)) && invoke("team.delete", tm.id)}>{t("Delete")}</button>
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "personas" && (
          <>
            <h2>{t("Personas")}</h2>
            <div style={{ marginTop: 14 }}><PersonaSettings state={state} invoke={invoke} /></div>
          </>
        )}
        {tab === "general" && (
          <>
            <h2>{t("General")}</h2>
            <div className="s13 dim">{t("How Walt behaves on this laptop. What the AI can do lives in Customize.")}</div>
            <div className="card col" style={{ marginTop: 18, maxWidth: 720 }}>
              {rows.map(([title, d, c], i) => (
                <div key={title} className="row g16" style={{ padding: "14px 16px", borderTop: i ? `1px solid ${T.line}` : "none" }}>
                  <div className="f1"><div className="s14">{t(title)}</div>{d && <div className="s12 dim" style={{ marginTop: 2 }}>{t(d)}</div>}</div>
                  {c}
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "permissions" && (
          <>
            <h2>{t("Permissions")}</h2>
            <div className="card col g12 s13" style={{ padding: 18, marginTop: 18, maxWidth: 720, lineHeight: 1.6 }}>
              <div><b>{t("Chats without a project")}</b> · {t("the AI can talk and read, never edit.")}</div>
              <div><b>{t("Chats in a project")}</b> · {t("every file edit and command asks you first, with the full command or diff.")}</div>
              <div><b>{t("Team chats")}</b> · {t("one builder writes at a time; reviewers are read-only.")}</div>
              <div><b>{t("Ce:L island")}</b> · {t("can pause and answer questions; tool approvals always open Walt.")}</div>
              <div className="dim">{t("Waiting never counts as allow. Walt does not use API keys or your passwords.")}</div>
            </div>
            <div className="card row g16" style={{ padding: "14px 16px", marginTop: 14, maxWidth: 720 }}>
              <div className="f1">
                <div className="s14">{t("Let Claude builders run commands")}</div>
                <div className="s12 dim" style={{ marginTop: 2, lineHeight: 1.5 }}>{t("Tests, builds, git. Each command still asks you first, and every process ends when Walt closes. Codex builders always have this. Reviewers never do.")}</div>
              </div>
              <div className="seg">{([[false, "Off"], [true, "On"]] as const).map(([v, l]) => <span key={l} className={!!s.claudeShell === v ? "on" : ""} onClick={() => invoke("settings", { claudeShell: v })}>{t(l)}</span>)}</div>
            </div>
          </>
        )}
        {tab === "data" && <DataPage invoke={invoke} />}
        {tab === "shortcuts" && (
          <>
            <h2>{t("Shortcuts")}</h2>
            <div className="card col" style={{ marginTop: 18, maxWidth: 620 }}>
              {SHORTCUTS.map(([k, d], i) => (
                <div key={k} className="row g16 s13" style={{ padding: "12px 16px", borderTop: i ? `1px solid ${T.line}` : "none" }}>
                  <span className="f1">{t(d)}</span>
                  <span className="mono s12 chip">{k}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "about" && (
          <>
            <h2>{t("About Walt")}</h2>
            <div className="s13 dim" style={{ marginTop: 8, lineHeight: 1.7 }}>
              Version 0.1.0 · child app of Ce:L<br />{t("History and settings stay on this laptop.")}<br />Engines: {ENGINES_ON.map((e) => ENGINE_LABEL[e]).join(", ")}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
