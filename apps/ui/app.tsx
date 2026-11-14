// Walt main window: Claude-style sidebar (New chat, Search, Customize, Projects with their chats, Chats), the chat view
// with a model picker like the Claude / ChatGPT apps, and the Customize pages. Message bodies, approval and result
// cards still use the design-kit HTML helpers; everything interactive is React.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { State, Room, Persona, PersonaDef, Engine, Effort } from "../../packages/domain/model";
import { ENGINES_ON, enginesOn, isApi } from "../../packages/domain/model";
import { decision } from "../../packages/domain/command";
import { T, ic, av, stack, role as roleTag, wordmark, workflow, mine } from "./generated/kit.mjs";
import { md, esc, pics } from "./markdown";
import { Welcome, Engines, NewProject, EngineCards, personaStatus, ENGINE_NAME, ENGINE_LABEL, Html, usageColor, worst, isLimited, registerProviders } from "./onboarding";
/** short engine names: sidebar usage meter, the composer's plugin list */
const SHORT: Record<string, string> = { codex: "GPT", claude: "Claude", antigravity: "Antigravity" };
/** files the composer puts into the message as text (up to 200 KB each) */
const TEXT_EXT = ["txt", "md", "csv", "tsv", "json", "jsonl", "xml", "yaml", "yml", "toml", "ini", "log", "html", "css", "js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "rs", "go", "java", "kt", "c", "h", "cpp", "hpp", "cs", "php", "rb", "swift", "sql", "sh", "ps1", "bat", "lua", "dart", "vue", "svelte"];
/** the avatar tile for a model: Claude Sonnet has its own, an API provider gets a letter tile */
const avatarOf = (e: string, label = "") => (e === "claude" ? (/sonnet/i.test(label) ? "sonnet" : "claude") : e);
type SkillGroup = { engine: Engine; plugin: string; skills: { name: string; description: string }[] };
import { PersonaSettings, personaMsg, metaChip, complete, type Suggestion } from "./personas";
import { Menu, Dropdown, type Item } from "./menu";
import { t, setLocale } from "./i18n";

declare global {
  interface Window {
    walt: {
      call: (method: string, input?: unknown) => Promise<any>;
      folder: () => Promise<string | null>;
      window: (action: string) => void;
      login: (on?: boolean) => Promise<boolean>;
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
  const [palette, setPalette] = useState(false);
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
  // deep links from inside a page (the composer's "Manage plugins")
  useEffect(() => {
    const open = (e: Event) => setView((e as CustomEvent<View>).detail);
    addEventListener("walt:open", open);
    return () => removeEventListener("walt:open", open);
  }, []);
  useEffect(() => {
    // Ctrl+B toggles the sidebar, Ctrl+Alt+B the side panel (like an editor)
    const key = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === "k" && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setPalette((o) => !o);
        return;
      }
      const go: Record<string, View> = { n: { kind: "home" }, ",": { kind: "settings", tab: "general" } };
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
  registerProviders(state?.settings.providers);
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
      {palette && (
        <Palette
          state={state}
          close={() => setPalette(false)}
          go={setView}
          run={(a) => {
            if (a === "sidebar") setP({ left: !panels.left });
            if (a === "panel") setP({ right: !panels.right });
            if (a === "theme") void invoke("settings", { theme: state.settings.theme === "light" ? "dark" : "light" });
            if (a === "lang") void invoke("settings", { locale: state.settings.locale === "id" ? "en" : "id" });
          }}
        />
      )}
      {error && (
        <div role="alert" className="card" onClick={() => setError("")} style={{ position: "fixed", bottom: 24, left: 300, right: 40, padding: "12px 16px", color: "#FF6961", zIndex: 70, cursor: "pointer" }}>
          {error}
        </div>
      )}
    </div>
  );
}

/** Ctrl K: type to find a chat, a project, a page or an action; Enter runs it */
function Palette({ state, close, go, run }: { state: State; close: () => void; go: (v: View) => void; run: (a: string) => void }) {
  const [q, setQ] = useState("");
  const [act, setAct] = useState(0);
  type Item = { label: string; hint: string; icon: string; on: () => void };
  const page = (kind: "settings" | "customize", tab: string): (() => void) => () => go({ kind, tab } as View);
  const all: Item[] = [
    { label: t("New chat"), hint: "Ctrl N", icon: "plus", on: () => go({ kind: "home" }) },
    { label: t("New project"), hint: "", icon: "folder", on: () => go({ kind: "project-new" }) },
    { label: t("Search chats"), hint: "", icon: "search", on: () => go({ kind: "search" }) },
    ...state.rooms
      .filter((r) => r.state !== "ended")
      .map((r) => {
        const p = state.projects.find((x) => x.id === r.projectId);
        return { label: r.title, hint: p ? p.name : t("Chat"), icon: r.template === "direct" ? "chat" : "users", on: () => go({ kind: "chat", id: r.id }) };
      }),
    ...state.projects.map((p) => ({ label: p.name, hint: t("New team chat"), icon: "folder", on: () => go({ kind: "join", projectId: p.id, first: false }) })),
    ...([["general", "General"], ["permissions", "Permissions"], ["island", "Island (Ce:L)"], ["data", "Data & backup"], ["shortcuts", "Shortcuts"], ["about", "About"]] as const).map(([k, l]) => ({ label: t(l), hint: t("Settings"), icon: "gear", on: page("settings", k) })),
    ...([["ai", "AI & models"], ["personas", "Personas"], ["teams", "Team templates"], ["plugins", "Plugins & tools"], ["instructions", "Instructions"]] as const).map(([k, l]) => ({ label: t(l), hint: t("Customize"), icon: "sparkle", on: page("customize", k) })),
    { label: t("Show or hide the sidebar"), hint: "Ctrl B", icon: "sidebar", on: () => run("sidebar") },
    { label: t("Show or hide the side panel"), hint: "Ctrl Alt B", icon: "panel", on: () => run("panel") },
    { label: t(state.settings.theme === "light" ? "Dark theme" : "Light theme"), hint: "", icon: state.settings.theme === "light" ? "moon" : "sun", on: () => run("theme") },
    { label: state.settings.locale === "id" ? "English" : "Bahasa Indonesia", hint: t("Language"), icon: "lang", on: () => run("lang") },
  ];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = all.filter((i) => words.every((w) => (i.label + " " + i.hint).toLowerCase().includes(w))).slice(0, 12);
  const pick = (i?: Item) => {
    if (!i) return;
    close();
    i.on();
  };
  return (
    <div className="scrim" style={{ alignItems: "flex-start", paddingTop: "12vh" }} onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="card col" role="dialog" aria-label={t("Command palette")} style={{ width: "min(620px, 90vw)", padding: 0, overflow: "hidden" }}>
        <div className="row g10" style={{ padding: "12px 16px", borderBottom: `1px solid ${T.line}` }}>
          <Icon n="search" s={17} />
          <input
            autoFocus
            value={q}
            placeholder={t("Type a chat, a page or an action")}
            aria-label={t("Command palette")}
            style={{ flex: 1, border: 0, background: "transparent", padding: "4px 0", fontSize: 15 }}
            onChange={(e) => (setQ(e.target.value), setAct(0))}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "ArrowDown") (e.preventDefault(), setAct((a) => Math.min(a + 1, list.length - 1)));
              else if (e.key === "ArrowUp") (e.preventDefault(), setAct((a) => Math.max(a - 1, 0)));
              else if (e.key === "Enter") (e.preventDefault(), pick(list[act]));
            }}
          />
          <span className="chip mono" style={{ fontSize: 11 }}>Esc</span>
        </div>
        <div className="col" role="listbox" style={{ padding: 6, maxHeight: "50vh", overflow: "auto" }}>
          {!list.length && <div className="s13 dim" style={{ padding: 12 }}>{t("Nothing matches.")}</div>}
          {list.map((i, n) => (
            <div key={i.label + i.hint + n} role="option" aria-selected={n === act} className={`navi ${n === act ? "on" : ""}`} onMouseEnter={() => setAct(n)} onClick={() => pick(i)}>
              <Icon n={i.icon} s={16} />
              <span className="t f1">{i.label}</span>
              <span className="s12 dim">{i.hint}</span>
            </div>
          ))}
        </div>
      </div>
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
  const ready = enginesOn(state).filter((e) => personaStatus(e, state.engines).ready);
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
        {ready.some((e) => state.usage?.[e]) ? (
          <span className="f1 row g10" role="button" title={t("Plan usage · open AI & models")} style={{ cursor: "pointer" }} onClick={() => go({ kind: "customize", tab: "ai" })}>
            {ready.map((e) => {
              const q = state.usage?.[e];
              return q && <span key={e} style={{ color: usageColor(worst(q), isLimited(q)) }}>{SHORT[e]} {worst(q)}%</span>;
            })}
          </span>
        ) : (
          <span className="f1">{ready.length ? t("{0} ready", ready.map((e) => ENGINE_NAME[e]).join(" + ")) : t("No AI ready · open Customize")}</span>
        )}
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
          {enginesOn(state).map((e) => {
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
                      <Html h={av(avatarOf(e, m.label), 22)} />
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
  for (const e of enginesOn(state)) {
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
  const [pics, setPics] = useState<{ name: string; markdown: string }[]>([]);
  const [docs, setDocs] = useState<{ name: string; text: string }[]>([]);
  const [plus, setPlus] = useState<{ at: DOMRect; skills: SkillGroup[]; tools: ToolsView } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // a picture from the clipboard, a drop or the file picker: saved by Walt, shown as a thumbnail until sent;
  // a text or code file goes into the message itself
  const addFiles = async (files: Iterable<File>) => {
    for (const f of files) {
      const dot = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (TEXT_EXT.includes(dot) || f.type.startsWith("text/")) {
        if (f.size <= 200_000) {
          const text = await f.text();
          setDocs((d) => [...d, { name: f.name, text }]);
        }
        continue;
      }
      const ext = (f.type.split("/")[1] || "").replace("jpeg", "jpg");
      if (!f.type.startsWith("image/") || !["png", "jpg", "webp", "gif"].includes(ext)) continue;
      if (f.size > 15_000_000) continue;
      const data = await new Promise<string>((ok) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result).split(",")[1] ?? "");
        r.readAsDataURL(f);
      });
      const saved = await window.walt.call("image.save", { data, ext }).catch(() => null);
      if (saved) setPics((p) => [...p, saved]);
    }
  };
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
    if ((!text.trim() && !pics.length && !docs.length) || sending) return;
    setSending(true);
    try {
      const fence = (s: string) => "`".repeat(Math.max(3, ...(s.match(/`+/g) ?? []).map((x) => x.length + 1)));
      const body = [
        text.trim() || (pics.length ? t("(picture)") : t("(file)")),
        ...docs.map((d) => `**${d.name}**\n${fence(d.text)}\n${d.text}\n${fence(d.text)}`),
        ...pics.map((p) => p.markdown),
      ].join("\n\n");
      if (await onSend(body)) {
        setText("");
        setList([]);
        setPics([]);
        setDocs([]);
      }
    } finally {
      setSending(false);
    }
  };
  const can = (!!text.trim() || !!pics.length || !!docs.length) && !sending;
  // put text at the caret (or in front, for a skill), then let the @ / menu react to it
  const insert = (s: string, front = false) => {
    const el = ref.current!;
    const pos = front ? 0 : el.selectionStart;
    const v = front ? s + text.replace(/^Use the \S+ skill: /, "") : text.slice(0, pos) + s + text.slice(pos);
    setText(v);
    requestAnimationFrame(() => {
      const end = front ? v.length : pos + s.length;
      el.focus();
      el.setSelectionRange(end, end);
      refresh(v, end);
    });
  };
  const openPlus = async (at: DOMRect) => {
    const [skills, tools] = await Promise.all([window.walt.call("skills.list").catch(() => []), window.walt.call("tools.list").catch(() => null)]);
    if (tools) setPlus({ at, skills, tools });
  };
  const manage = (tab: string) => dispatchEvent(new CustomEvent("walt:open", { detail: { kind: "customize", tab } }));
  // in a chat: the plugins of the engines in it; on the start screen: all of them
  const engines = room ? new Set([room.builder, ...room.reviewers, ...(room.members || [])].map((id) => state.personas.find((p) => p.id === id)?.engine)) : undefined;
  const plusItems = (v: NonNullable<typeof plus>): Item[] => {
    const toggle = (key: string, on: boolean) => () => void window.walt.call("tools.set", { key, on });
    const groups = v.skills.filter((g) => !engines || engines.has(g.engine));
    return [
      { label: t("Add files or photos"), icon: "clip", hint: "Ctrl+U", onSelect: () => fileRef.current?.click() },
      { label: t("Slash commands"), icon: "slash", onSelect: () => insert("/") },
      {
        label: t("Connectors"),
        icon: "grid",
        submenu: [
          { label: t("claude.ai connectors"), checked: v.tools.switches.connectors, hint: "Claude", onSelect: toggle("connectors", !v.tools.switches.connectors) },
          { label: t("ChatGPT apps"), checked: v.tools.switches.apps, hint: "GPT", onSelect: toggle("apps", !v.tools.switches.apps) },
          ...(v.tools.mcp.length ? [{ kind: "sep" as const }, { kind: "label" as const, label: t("MCP servers") }] : []),
          ...v.tools.mcp.map((m) => ({ label: m.name, checked: m.on, onSelect: toggle("mcp:" + m.name, !m.on) })),
          { kind: "sep" },
          { label: t("Manage connectors"), icon: "gear", onSelect: () => manage("plugins") },
        ],
      },
      {
        label: t("Plugins"),
        icon: "plug",
        submenu: [
          ...(groups.length ? [] : [{ label: t("No skills on for this chat"), disabled: true }]),
          // AI first, then its plugins, then their skills; an engine whose host reports skills shows up here by itself
          ...[...new Set(groups.map((g) => g.engine))].map((e) => ({
            label: ENGINE_NAME[e] ?? e,
            submenu: groups
              .filter((g) => g.engine === e)
              .map((g) => ({
                label: g.plugin,
                submenu: g.skills.map((s) => ({ label: s.name, detail: s.description || undefined, onSelect: () => insert(`Use the ${s.name} skill: `, true) })),
              })),
          })),
          { kind: "sep" },
          { label: t("Manage plugins"), icon: "gear", onSelect: () => manage("plugins") },
        ],
      },
    ];
  };
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
      {!!docs.length && (
        <div className="row g8" style={{ maxWidth: 760, margin: "0 auto 8px", width: "100%", flexWrap: "wrap" }}>
          {docs.map((d, i) => (
            <span key={d.name + i} className="chip row g6">
              <Icon n="file" s={14} />
              {d.name}
              <span role="button" aria-label={t("Remove {0}", d.name)} style={{ cursor: "pointer", display: "flex" }} onClick={() => setDocs((x) => x.filter((y) => y !== d))}><Icon n="x" s={11} w={2.4} /></span>
            </span>
          ))}
        </div>
      )}
      {!!pics.length && (
        <div className="row g8" style={{ maxWidth: 760, margin: "0 auto 8px", width: "100%", flexWrap: "wrap" }}>
          {pics.map((p) => (
            <div key={p.name} style={{ position: "relative" }}>
              <img src={`walt-img://img/${p.name}`} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, display: "block" }} />
              <span role="button" aria-label={t("Remove picture")} onClick={() => setPics((x) => x.filter((y) => y !== p))} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, background: T.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon n="x" s={11} w={2.4} /></span>
            </div>
          ))}
        </div>
      )}
      <div
        className="cbox"
        style={{ maxWidth: 760 }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void addFiles(e.dataTransfer.files);
        }}
      >
        <span className={`tbb ${plus ? "on" : ""}`} role="button" aria-label={t("Add files, skills and connectors")} aria-haspopup="menu" title={t("Add files, skills and connectors")} onClick={(e) => (plus ? setPlus(null) : void openPlus(e.currentTarget.getBoundingClientRect()))} style={{ alignSelf: "center" }}><Icon n="plus" s={18} /></span>
        {plus && <Menu at={plus.at} side="above" width={250} items={plusItems(plus)} onClose={() => setPlus(null)} />}
        <input ref={fileRef} type="file" accept={["image/png,image/jpeg,image/webp,image/gif", ...TEXT_EXT.map((x) => "." + x)].join(",")} multiple hidden onChange={(e) => { void addFiles(e.target.files ?? []); e.target.value = ""; }} />
        <textarea
          onPaste={(e) => {
            const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
            if (files.length) {
              e.preventDefault();
              void addFiles(files);
            }
          }}
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
            if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === "u") {
              e.preventDefault();
              fileRef.current?.click();
              return;
            }
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
  const ready = enginesOn(state).filter((e) => personaStatus(e, state.engines).ready);
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

/** a usage limit: who hit it, when it resets, and who can take over (only on the last message, when idle) */
function limitCardFor(state: State, room: Room) {
  return (m: Room["messages"][number], live: boolean) => {
    const who = state.personas.find((p) => p.id === m.meta?.to);
    const name = room.template === "direct" && who ? label(state, who.engine, room.tune?.[who.id]?.model ?? who.model) : (who?.name ?? m.meta?.to ?? "");
    const others: [string, string][] =
      room.template === "direct"
        ? enginesOn(state).filter((e) => e !== who?.engine && (state.engines.find((x) => x.engine === e)?.auth ?? "ok") === "ok").map((e) => [`${e}:${state.catalog?.[e]?.find((x) => x.isDefault)?.id ?? "default"}`, t("Continue with {0}", ENGINE_NAME[e])])
        : m.meta?.to === room.builder
          ? [room.builder, ...room.reviewers, ...(room.members || [])].filter((p) => p !== m.meta?.to).map((p) => [p, t("Hand it to {0}", state.personas.find((x) => x.id === p)?.name ?? p)])
          : [[m.meta?.to ?? "", t("Continue without {0}'s review", name)]];
    const reset = m.meta?.reset ? t("It resets {0}.", m.meta.reset) : t("Walt cannot tell when it resets.");
    const buttons = live && others.length ? `<div class="row g8" style="margin-top:12px;flex-wrap:wrap">${others.map(([v, l]) => `<button class="btn" data-hot="handoff:${esc(v)}" style="border:0">${esc(l)}</button>`).join("")}</div>` : "";
    return `<div class="card" style="padding:14px;margin:12px 0 0 44px;border-color:${T.amber}80"><div class="row g8">${ic("clock", 17, T.amber)}<span class="s14 b">${esc(t("{0} reached its usage limit", name))}</span></div><div class="s13 sub" style="margin-top:6px;line-height:1.5">${esc(reset)} ${esc(t("Your message was not lost: another model can take over and Walt sends it again."))}</div><div class="s12 dim mono" style="margin-top:6px;overflow-wrap:anywhere">${esc(m.text.slice(0, 200))}</div>${buttons}</div>`;
  };
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
  const limitCard = limitCardFor(state, room);
  const asking = lastAi && !busy(room) && lastAi === room.messages.at(-1) ? decision(lastAi.text) : undefined;
  const choices = asking
    ? `<div class="row g8" style="margin:4px 0 0 44px;flex-wrap:wrap"><span class="s12 dim">${esc(t("Your choice"))}:</span>${asking.options.map((o, i) => `<button class="btn sm" data-hot="decide:${i}" style="border:0">${esc(o)}</button>`).join("")}</div>`
    : "";
  const html =
    room.messages
      .map((m) =>
        m.author === "cello"
          ? mine(new Date(m.at).toLocaleTimeString(), pics(esc(m.text))) + (m.meta?.to || m.meta?.effort || m.kind === "setting" ? metaChip(m.meta ?? {}, (id) => esc(nameOf(id)), m.kind === "setting") : "")
          : pd(m.author)
            ? personaMsg(pd(m.author)!, t(roleOf(m.author)), new Date(m.at).toLocaleTimeString(), md(m.text) || (busy(room) && m === last ? '<span class="dim">Thinking…</span>' : "…"), nameOf(m.author, m.meta)) + (m === lastAi ? choices : "")
            : m.kind === "limit"
              ? limitCard(m, m === room.messages.at(-1) && !busy(room))
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
    else if (h.startsWith("diff:")) setDiff(await invoke("diff", { roomId: room.id, revision: Number(h.slice(5)) }));
    else if (h.startsWith("handoff:")) await invoke("limit.handoff", { roomId: room.id, to: h.slice(8) });
    else if (h.startsWith("img:")) window.walt.window("image:" + h.slice(4));
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
  return `<div class="card" style="padding:16px;margin:10px 0 0 44px"><div class="row sb"><span class="row g10">${ic("checkc", 20, a.accepted ? T.green : T.sub)}<span class="s16 b">${esc(room.title)} · ${t("result")}</span><span class="chip mono">r${a.revision}</span></span><span class="s12 dim mono">manifest ${a.hash.slice(0, 6)}</span></div><div class="row g12" style="margin-top:14px">${reviews.join("")}${accept}</div><div class="row g8" style="margin-top:14px">${a.accepted ? "" : `<button class="btn g" data-hot="accept" style="border:0">${ic("check", 15, "#04170B", 2.2)}${t("Accept")}</button>`}<button class="btn" data-hot="diff" style="border:0">${ic("diff", 15, T.text)}${t("Open diff")}</button></div></div>`;
}

/** every DECISION an AI asked in this project's chats (or this chat), and what you answered */
function decisions(state: State, room: Room) {
  const rooms = room.projectId ? state.rooms.filter((r) => r.projectId === room.projectId) : [room];
  return rooms.flatMap((r) =>
    r.messages.flatMap((m, i) => {
      const d = state.personas.some((p) => p.id === m.author) ? decision(m.text) : undefined;
      if (!d) return [];
      const reply = r.messages.slice(i + 1).find((x) => x.author === "cello" && x.kind !== "setting");
      return [{ chat: r.title, who: ((p) => (r.template === "direct" && p ? label(state, p.engine, m.meta?.model) : p?.name ?? m.author))(state.personas.find((p) => p.id === m.author)), question: d.question, options: d.options, answer: reply?.text.replace(/^@\S+\s+/, "").trim(), at: m.at }];
    }),
  ).sort((a, b) => b.at.localeCompare(a.at));
}
function decisionsHtml(state: State, room: Room) {
  const list = decisions(state, room);
  if (!list.length) return `<div class="s13 dim">${t("No decisions yet. When an AI asks you to choose, the question and your answer are kept here.")}</div>`;
  return list
    .map(
      (d) => `<div class="card" style="padding:12px;margin:0 0 10px"><div class="s13 b">${esc(d.question)}</div><div class="s12 dim" style="margin-top:3px">${esc(d.who)} · ${esc(d.chat)} · ${new Date(d.at).toLocaleDateString()}</div><div class="s13" style="margin-top:8px">${d.answer ? `${t("You chose")}: <b>${esc(d.answer.slice(0, 120))}</b>` : `<span style="color:${T.amber}">${t("Waiting for your answer")}</span>`}</div></div>`,
    )
    .join("");
}

function inspectorHtml(state: State, room: Room, tab: string) {
  const direct = room.template === "direct";
  const btn = (l: string, a: string) => `<button class="btn" data-hot="${a}" style="border:0">${l}</button>`;
  const files = [...room.artifacts].reverse().map((a) => `<div class="card" style="padding:12px;margin:10px 0"><div class="row sb"><span>r${a.revision} · ${t(a.accepted ? "Accepted" : "Awaiting acceptance")}</span><button class="btn sm" data-hot="diff:${a.revision}" style="border:0">${t("Open diff")}</button></div><div class="mono s11 dim">${a.hash.slice(0, 16)}</div><div class="s12">${t("{0} reviews · {1} files", a.reviews.length, Object.keys(a.files).length)}</div></div>`).join("") || `<div class="s13 dim">${t("No changes yet.")}</div>`;
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
        : tab === "Decisions"
          ? decisionsHtml(state, room)
          : tab === "Activity"
          ? room.messages.filter((m) => m.author === "Walt").map((m) => `<p class="s12 dim">${esc(m.text)}</p>`).join("") || `<div class="s13 dim">${t("Nothing yet.")}</div>`
          : `<div class="lbl">${t("Who does what")}</div>${team}<div class="lbl">${t("This task")}</div><div>${t("{0} of {1} AI turns", room.used, room.budget)}</div><div class="s12 dim" style="margin-top:4px;line-height:1.5">${t("Caps the automatic build, review and fix loop so the AIs cannot go round forever. Every new message starts again from 0.")}</div><div class="col g8" style="margin-top:20px">${room.state === "paused" ? btn(t("Resume"), "control:resume") : ""}${btn(t("End chat"), "control:end")}</div>`;
  const tabs = (direct ? ["Files", "Decisions", "Activity"] : ["Task", "Files", "Decisions", "Context", "Activity"]).map((x) => `<span class="tab ${tab === x ? "on" : ""}" data-hot="tab:${x}">${t(x)}</span>`).join("");
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
          {enginesOn(state).map((e) => {
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
                      <Html h={av(avatarOf(e, m.label), 28)} />
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
                  <Html h={av(avatarOf(p.engine, info?.label), 28)} />
                  <div className="f1" style={{ minWidth: 0 }}><div className="s13 b" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{info?.label ?? p.model}</div><div className="s12 dim">{ENGINE_NAME[p.engine]}</div></div>
                  <Dropdown label={t("Effort for {0}", info?.label ?? "")} value={(p.effort ?? "") as string} width={112} disabled={!info?.efforts.length} onChange={(v) => set(i, { effort: (v || undefined) as Effort | undefined })} options={[{ value: "", label: t("Default") }, ...(info?.efforts ?? []).map((l) => ({ value: l as string, label: cap(l) }))]} />
                  {!talk && <Dropdown label={t("Role for {0}", info?.label ?? "")} value={p.role} width={112} onChange={(v) => set(i, { role: v })} options={(isApi(p.engine) ? (["Reviewer", "Member"] as const) : (["Builder", "Reviewer", "Member"] as const)).map((r) => ({ value: r, label: t(r) }))} />}
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

/** ready-made API addresses; "Other" is any OpenAI-compatible one */
const PRESETS: { name: string; baseUrl: string; where: string }[] = [
  { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", where: "console.groq.com → API Keys" },
  { name: "9Router", baseUrl: "http://localhost:20128/v1", where: "9Router dashboard (localhost:20128/dashboard) → API key" },
  { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", where: "openrouter.ai → Keys" },
  { name: "", baseUrl: "", where: "" },
];
/** Customize · AI & models · API providers: paste a key once, the API's models join every model menu */
function ApiProviders({ state, invoke }: { state: State; invoke: Invoke }) {
  const providers = state.settings.providers ?? [];
  const [form, setForm] = useState<{ preset: number; name: string; baseUrl: string; key: string } | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const preset = (i: number) => setForm({ preset: i, name: PRESETS[i].name, baseUrl: PRESETS[i].baseUrl, key: form?.key ?? "" });
  const add = async () => {
    if (!form) return;
    setBusy("add");
    const p = await invoke("provider.save", { name: form.name, baseUrl: form.baseUrl });
    if (p && form.key.trim()) await invoke("provider.key", { id: p.id, key: form.key });
    setBusy("");
    if (p) setForm(null);
  };
  const saveKey = async (id: string) => {
    setBusy(id);
    const ok = await invoke("provider.key", { id, key: keys[id] ?? "" });
    setBusy("");
    if (ok) setKeys((k) => ({ ...k, [id]: "" }));
  };
  const keyInput = (value: string, onChange: (v: string) => void, saved?: boolean) => (
    <input type="password" autoComplete="off" spellCheck={false} aria-label={t("API key")} placeholder={t(saved ? "Key saved · paste a new one to replace it" : "Paste the API key")} value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
  );
  return (
    <>
      <div className="row sb" style={{ marginTop: 30 }}>
        <div className="lbl" style={{ margin: 0 }}>{t("API providers")}</div>
        {!form && <button type="button" className="btn sm" style={{ border: 0 }} onClick={() => preset(0)}><Icon n="plus" s={14} />{t("Add an API")}</button>}
      </div>
      <div className="s12 dim" style={{ margin: "6px 0 12px", lineHeight: 1.5, maxWidth: 760 }}>{t("Groq, 9Router, OpenRouter or any OpenAI-compatible API. Paste its key once: Walt keeps it encrypted on this laptop and never shows it again. API models chat, answer and review; only Claude and Codex edit files.")}</div>
      {form && (
        <div className="card col g12" style={{ padding: 18, borderColor: T.green, maxWidth: 760, marginBottom: 12 }}>
          <div className="seg" style={{ alignSelf: "flex-start" }}>{PRESETS.map((p, i) => <span key={i} className={form.preset === i ? "on" : ""} onClick={() => preset(i)}>{p.name || t("Other")}</span>)}</div>
          <div className="row g12">
            <label style={{ width: 200 }}><div className="s12 dim" style={{ marginBottom: 4 }}>{t("Name")}</div><input aria-label={t("Name")} style={{ width: "100%" }} maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="f1"><div className="s12 dim" style={{ marginBottom: 4 }}>{t("Base URL")}</div><input aria-label={t("Base URL")} style={{ width: "100%" }} placeholder="https://…/v1" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} /></label>
          </div>
          <label><div className="s12 dim" style={{ marginBottom: 4 }}>{t("API key")}{PRESETS[form.preset].where && <span> · {t("get it at {0}", PRESETS[form.preset].where)}</span>}</div><div className="row">{keyInput(form.key, (key) => setForm({ ...form, key }))}</div></label>
          <div className="row g8" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn" style={{ border: 0 }} onClick={() => setForm(null)}>{t("Cancel")}</button>
            <button type="button" className="btn g" style={{ border: 0 }} disabled={!form.name.trim() || !form.baseUrl.trim() || busy === "add"} onClick={add}>{t(busy === "add" ? "Checking…" : "Add and check")}</button>
          </div>
        </div>
      )}
      <div className="col g8" style={{ maxWidth: 760 }}>
        {providers.map((p) => {
          const e = `api:${p.id}`;
          const r = state.engines.find((x) => x.engine === e);
          const s = personaStatus(e, state.engines);
          const models = state.catalog?.[e as Engine] ?? [];
          return (
            <div key={p.id} className="card col g10" style={{ padding: "14px 16px" }}>
              <div className="row g12">
                <Html h={av(e, 34)} />
                <div className="f1" style={{ minWidth: 0 }}>
                  <div className="s14 b">{p.name}</div>
                  <div className="s12 dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.baseUrl}{r?.detail ? ` · ${r.auth === "ok" ? t("{0} models", models.length) : r.detail}` : ""}</div>
                </div>
                <span className="pill" style={{ background: s.color + "29", color: s.color }}>{busy === p.id ? t("Checking…") : s.label}</span>
              </div>
              {!!models.length && (
                <div className="row g10">
                  <span className="s13 dim f1">{t("Model for new chats")}</span>
                  <Dropdown label={t("Model for new chats")} width={260} value={models.find((m) => m.isDefault)?.id ?? ""} onChange={(model) => void invoke("provider.save", { ...p, model })} options={models.map((m) => ({ value: m.id, label: m.label, hint: m.id !== m.label ? m.id.split("/")[0] : undefined }))} />
                </div>
              )}
              <div className="row g8">
                {keyInput(keys[p.id] ?? "", (v) => setKeys((k) => ({ ...k, [p.id]: v })), r?.keyed)}
                <button type="button" className="btn sm" style={{ border: 0 }} disabled={!(keys[p.id] ?? "").trim() || busy === p.id} onClick={() => void saveKey(p.id)}>{t("Save key")}</button>
                <button type="button" className="btn sm" style={{ border: 0 }} disabled={busy === p.id} onClick={async () => { setBusy(p.id); await invoke("provider.check", p.id); setBusy(""); }}>{t("Check again")}</button>
                <button type="button" className="btn sm r" style={{ border: 0 }} onClick={() => confirm(t("Remove {0} and its saved key?", p.name)) && void invoke("provider.remove", p.id)}>{t("Remove")}</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

const PLANNED: [string, string, string][] = [
  ["Other ACP agents", "Any command-line agent that speaks ACP can be added as a new AI type.", "term"],
];
/** Customize · Instructions: what every AI should know about you and how to answer (like ChatGPT's custom instructions) */
function Instructions({ state, invoke }: { state: State; invoke: Invoke }) {
  const saved = state.settings.instructions ?? "";
  const [text, setText] = useState(saved);
  const [done, setDone] = useState(false);
  useEffect(() => setText(saved), [saved]);
  return (
    <>
      <h2>{t("Instructions")}</h2>
      <div className="s13 dim" style={{ maxWidth: 760, lineHeight: 1.55 }}>
        {t("Every AI in Walt gets this, in every chat: who you are, what you work on, how you like answers. It works like custom instructions in ChatGPT. To bring your ChatGPT memory along, copy it from ChatGPT · Settings · Personalization · Memory and paste the parts you want here.")}
      </div>
      <textarea
        value={text}
        maxLength={4000}
        rows={12}
        aria-label={t("Instructions")}
        placeholder={t("For example: I'm cello, a student in Indonesia. Answer in Indonesian unless I write in English. Keep answers short, and show code before explaining it.")}
        onChange={(e) => (setText(e.target.value), setDone(false))}
        style={{ width: "100%", maxWidth: 760, marginTop: 18, resize: "vertical", lineHeight: 1.5 }}
      />
      <div className="row g10" style={{ marginTop: 10, maxWidth: 760 }}>
        <span className="s12 dim f1">{text.length} / 4000 · {t("Applies from the next message.")}</span>
        {done && <span className="s12" style={{ color: T.green }}>{t("Saved")}</span>}
        <button type="button" className="btn g" style={{ border: 0 }} disabled={text === saved} onClick={() => void invoke("settings", { instructions: text }).then((r) => r !== null && setDone(true))}>{t("Save")}</button>
      </div>
    </>
  );
}

type ToolsView = {
  switches: Record<"images" | "web" | "apps" | "connectors" | "codexPlugins" | "claudePlugins" | "browser" | "computer", boolean>;
  claude: { id: string; name: string; version: string; on: boolean }[];
  codex: { id: string; name: string; on: boolean }[];
  mcp: { name: string; engines: Engine[]; on: boolean }[];
};
/** Plugins & tools: what the AI may use besides the project files, found in your Claude Code and Codex setup */
function Plugins({ state, invoke }: { state: State; invoke: Invoke }) {
  const [v, setV] = useState<ToolsView | null>(null);
  useEffect(() => void invoke("tools.list").then((l) => l && setV(l)), [state.revision]);
  const set = (key: string, on: boolean) => void invoke("tools.set", { key, on }).then((l) => l && setV(l));
  const toggle = (on: boolean, key: string, label: string) => (
    <span className="seg" role="switch" aria-checked={on} aria-label={label}>
      {([[true, "On"], [false, "Off"]] as const).map(([b, l]) => <span key={l} className={on === b ? "on" : ""} onClick={() => on !== b && set(key, b)}>{t(l)}</span>)}
    </span>
  );
  const row = (title: string, d: string, c: React.ReactNode, i: number, tag?: string) => (
    <div key={title + i} className="row g16" style={{ padding: "12px 16px", borderTop: i ? `1px solid ${T.line}` : "none" }}>
      <div className="f1" style={{ minWidth: 0 }}>
        <div className="s14 row g8">{title}{tag && <span className="chip" style={{ fontSize: 11 }}>{tag}</span>}</div>
        {d && <div className="s12 dim" style={{ marginTop: 2, lineHeight: 1.5 }}>{d}</div>}
      </div>
      {c}
    </div>
  );
  if (!v) return <h2>{t("Plugins & tools")}</h2>;
  const s = v.switches;
  const built: [keyof ToolsView["switches"], string, string, string][] = [
    ["images", "Image generation", "GPT makes pictures in the chat; click one to open it.", "ChatGPT"],
    ["web", "Web search", "Look things up on the web. Claude asks you before it opens a page.", "Both"],
    ["apps", "ChatGPT apps & connectors", "The apps you connected in ChatGPT (Gmail, Drive, GitHub…).", "ChatGPT"],
    ["connectors", "Claude app connectors", "Gmail, Google Calendar, Claude Docs and the other connectors of your claude.ai account. If one says it needs sign-in, run claude once and use /mcp.", "Claude"],
    ["codexPlugins", "Codex plugins & skills", "Documents, PDF, spreadsheets, slides and the other plugins in your Codex.", "ChatGPT"],
    ["claudePlugins", "Claude Code plugins & skills", "The plugins you installed in Claude Code, with their skills.", "Claude"],
    ["browser", "Browser", "Codex opens and clicks web pages itself. Off unless you need it.", "ChatGPT"],
    ["computer", "Computer use", "Codex controls apps on your screen. Off unless you need it.", "ChatGPT"],
  ];
  return (
    <>
      <h2>{t("Plugins & tools")}</h2>
      <div className="s13 dim" style={{ maxWidth: 760, lineHeight: 1.55 }}>
        {t("Walt connects the plugins, apps and MCP servers you already set up in Claude Code and ChatGPT · Codex. Changes apply from the next message. Reviewers never get these: they only read the project.")}
      </div>
      <div className="s12 b dim" style={{ margin: "20px 0 8px", letterSpacing: ".04em" }}>{t("BUILT IN")}</div>
      <div className="card col" style={{ maxWidth: 820 }}>{built.map(([k, title, d, tag], i) => row(t(title), t(d), toggle(s[k], k, t(title)), i, tag === "Both" ? t("Claude + ChatGPT") : tag))}</div>
      <div className="s12 b dim" style={{ margin: "20px 0 8px", letterSpacing: ".04em" }}>{t("CLAUDE CODE PLUGINS")}</div>
      <div className="card col" style={{ maxWidth: 820, opacity: s.claudePlugins ? 1 : 0.5 }}>
        {!v.claude.length && <div className="s13 dim" style={{ padding: 14 }}>{t("No plugins installed in Claude Code.")}</div>}
        {v.claude.map((p, i) => row(p.name, `${p.id}${p.version ? " · " + p.version : ""}`, toggle(p.on, "claude:" + p.id, p.name), i))}
      </div>
      <div className="s12 b dim" style={{ margin: "20px 0 8px", letterSpacing: ".04em" }}>{t("CODEX PLUGINS")}</div>
      <div className="card col" style={{ maxWidth: 820, opacity: s.codexPlugins ? 1 : 0.5 }}>
        {!v.codex.length && <div className="s13 dim" style={{ padding: 14 }}>{t("No plugins switched on in Codex.")}</div>}
        {v.codex.map((p, i) => row(p.name, p.id, toggle(p.on, "codex:" + p.id, p.name), i))}
      </div>
      <div className="s12 b dim" style={{ margin: "20px 0 8px", letterSpacing: ".04em" }}>{t("MCP SERVERS")}</div>
      <div className="card col" style={{ maxWidth: 820 }}>
        {!v.mcp.length && <div className="s13 dim" style={{ padding: 14 }}>{t("No MCP servers found in your Claude Code or Codex config.")}</div>}
        {v.mcp.map((m, i) => row(m.name, m.engines.map((e) => ENGINE_LABEL[e]).join(" · "), toggle(m.on, "mcp:" + m.name, m.name), i))}
      </div>
      <div className="s12 dim" style={{ maxWidth: 760, lineHeight: 1.55, margin: "12px 0 30px" }}>
        {t("Claude asks you before each MCP tool and web page. Codex runs MCP and app tools without asking: switch off a server you do not want it to use on its own.")}
      </div>
    </>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Ctrl N", "New chat"],
  ["Ctrl K", "Command palette: chats, pages, actions"],
  ["Ctrl ,", "Settings"],
  ["Ctrl B", "Show or hide the sidebar"],
  ["Ctrl Alt B", "Show or hide the side panel"],
  ["Enter", "Send"],
  ["Shift Enter", "New line"],
  ["Ctrl U", "Add files or photos to the message"],
  ["@", "Talk to one model in a team chat"],
  ["/effort, /model", "Change effort or model for one message (add keep for the chat)"],
  ["Esc", "Close a menu or dialog"],
];
/** Ce:L's dynamic island follows Walt over a local API (127.0.0.1, a new token each start) */
function IslandPage({ state, invoke }: { state: State; invoke: Invoke }) {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    const look = () => void invoke("island").then((v) => v && setOn(v.connected));
    look();
    const t = setInterval(look, 3000);
    return () => clearInterval(t);
  }, []);
  const answers = state.settings.islandAnswers !== false;
  const row = (title: string, d: string, c: React.ReactNode, i: number) => (
    <div className="row g16" style={{ padding: "14px 16px", borderTop: i ? `1px solid ${T.line}` : "none" }}>
      <div className="f1"><div className="s14">{title}</div>{d && <div className="s12 dim" style={{ marginTop: 2, lineHeight: 1.5 }}>{d}</div>}</div>
      {c}
    </div>
  );
  return (
    <>
      <h2>{t("Island (Ce:L)")}</h2>
      <div className="s13 dim" style={{ maxWidth: 720, lineHeight: 1.55 }}>{t("Ce:L shows what Walt is doing at the top of the screen: who is working, questions for you, and when a chat is done.")}</div>
      <div className="card col" style={{ marginTop: 18, maxWidth: 720 }}>
        {row(
          on ? t("Connected to Ce:L") : t("Ce:L is not connected"),
          t("Over a local API on 127.0.0.1, with a new token each time Walt starts."),
          <span style={{ width: 9, height: 9, borderRadius: 5, background: on ? T.green : T.faint, flex: "none" }} />,
          0,
        )}
        {row(
          t("Answer decisions from the island"),
          t("When an AI asks you to choose, the options show on the island and one click answers."),
          <div className="seg">{([[true, "On"], [false, "Off"]] as const).map(([v, l]) => <span key={l} className={answers === v ? "on" : ""} onClick={() => invoke("settings", { islandAnswers: v })}>{t(l)}</span>)}</div>,
          1,
        )}
        {row(t("Tool approvals from the island"), t("Always opened in Walt, so you read the full command or diff first."), <span className="row g6 s13 dim"><Icon n="lock" s={14} />{t("Never")}</span>, 2)}
      </div>
    </>
  );
}

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
const Customize = (p: PageProps) => <Pages {...p} title={t("Customize")} tabs={[["ai", "AI & models", "bolt"], ["personas", "Personas", "users"], ["teams", "Team templates", "branch"], ["plugins", "Plugins & tools", "clip"], ["instructions", "Instructions", "file"]]} />;
const Settings = (p: PageProps) => <Pages {...p} title={t("Settings")} tabs={[["general", "General", "gear"], ["permissions", "Permissions", "shield"], ["island", "Island (Ce:L)", "island"], ["data", "Data & backup", "db"], ["shortcuts", "Shortcuts", "key"], ["about", "About", "eye"]]} />;
function Pages({ state, invoke, tab, setTab, title, tabs }: PageProps & { title: string; tabs: [string, string, string][] }) {
  const s = state.settings;
  const [login, setLogin] = useState<boolean | null>(null);
  useEffect(() => void window.walt.login().then(setLogin).catch(() => setLogin(null)), []);
  const rows: [string, string, React.ReactNode][] = [
    ["Language", "Interface language. The AI replies in the language you write in.", <div className="seg">{([["en", "English"], ["id", "Indonesia"]] as const).map(([v, l]) => <span key={v} className={s.locale === v ? "on" : ""} onClick={() => invoke("settings", { locale: v })}>{t(l)}</span>)}</div>],
    ["Notifications", "When an AI needs you or finishes while Walt is in the background.", <div className="seg">{([[true, "On"], [false, "Off"]] as const).map(([v, l]) => <span key={l} className={(s.notify !== false) === v ? "on" : ""} onClick={() => invoke("settings", { notify: v })}>{t(l)}</span>)}</div>],
    ["Start with Windows", "Walt waits in the tray, so the Ce:L island is connected from the start.", <div className="seg">{([[true, "On"], [false, "Off"]] as const).map(([v, l]) => <span key={l} className={login === v ? "on" : ""} onClick={() => void window.walt.login(v).then(setLogin)}>{t(l)}</span>)}</div>],
    [
      "Close button",
      "Hiding keeps Walt and the island running; quitting stops every AI.",
      <Dropdown
        label="Close button"
        value={s.closeAction ?? "tray"}
        width={220}
        onChange={(v) => void invoke("settings", { closeAction: v })}
        options={[
          { value: "tray", label: t("Hide to the tray") },
          { value: "quit", label: t("Quit Walt") },
        ]}
      />,
    ],
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
          ...enginesOn(state).flatMap((e) => (state.catalog?.[e] ?? []).filter((m) => !m.more).map((m) => ({ value: `${e}:${m.id}`, label: m.label === "Default" ? t("{0} default", ENGINE_NAME[e]) : m.label, hint: ENGINE_NAME[e] }))),
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
            <ApiProviders state={state} invoke={invoke} />
            <div className="lbl" style={{ marginTop: 30 }}>{t("More AI · planned")}</div>
            <div className="col g8">
              {PLANNED.map(([title, d, i]) => (
                <div key={title} className="card row g12" style={{ padding: "12px 16px", opacity: 0.85 }}>
                  <Icon n={i} s={20} c={T.sub} />
                  <div className="f1"><div className="s14 b">{t(title)}</div><div className="s12 dim" style={{ marginTop: 2 }}>{t(d)}</div></div>
                  <span className="pill" style={{ background: "#3A3A3C", color: T.sub }}>{t("Planned")}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "plugins" && <Plugins state={state} invoke={invoke} />}
        {tab === "instructions" && <Instructions state={state} invoke={invoke} />}
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
              <div className="dim">{t("Waiting never counts as allow. Walt never sees your passwords; API keys you add in AI & models stay encrypted on this laptop.")}</div>
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
        {tab === "island" && <IslandPage state={state} invoke={invoke} />}
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
