import { Setup, type SetupStep, personaStatus } from "./onboarding";
import { md, esc } from "./markdown";
import { PersonaSettings, personaItem, personaMsg, metaChip, complete as completeFor, type Suggestion } from "./personas";
import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import type {
  State,
  Room,
  Persona,
  Template,
  PersonaDef,
} from "../../packages/domain/model";
import {
  shell,
  sidebar,
  roomHeader,
  workflow,
  composer,
  mine,
  msg,
  av,
  ic,
  T,
  wordmark,
} from "./generated/kit.mjs";
declare global {
  interface Window {
    walt: {
      call: (method: string, input?: unknown) => Promise<any>;
      folder: () => Promise<string | null>;
      window: (action: string) => void;
      subscribe: (fn: (s: State) => void) => () => void;
    };
  }
}
const TEMPLATE: Record<string, string> = { direct: "Direct", build_review: "Build & Review", triad: "Triad", roundtable: "Roundtable" };
const STATE: Record<string, string> = { idle: "Idle", running: "Running", paused: "Paused", awaiting_user: "Waiting for you", ended: "Ended", recovery_required: "Needs checking" };
const STEP: Record<string, string> = { ready: "Nothing running", paused: "Paused", "needs attention": "Needs attention" };
const pillHtml = (t: string, c: string) => `<span class="pill" style="background:${c}29;color:${c}">${t}</span>`;
// W09 deliverable card: only facts Walt holds (revision, manifest, which reviewer read which hash); no test box until tests are tracked
function deliverable(room: Room, a: Room["artifacts"][number]) {
  const box = (k: string, inner: string, sub: string, dashed = false) =>
    `<div class="f1" style="background:#1F1F21;border-radius:12px;padding:12px;${dashed ? "border:1px dashed #48484A" : ""}"><div class="s12 dim">${k}</div><div class="row g8" style="margin-top:6px">${inner}</div><div class="s12 dim" style="margin-top:4px">${sub}</div></div>`;
  const reviews = room.reviewers.map((p) => {
    const v = a.reviews.find((x) => x.persona === p);
    const ok = v?.hash === a.hash;
    return box("Source review", `${pav(p, 20)}<span class="s13 b">${nm(p)}</span>${ok ? ic("check", 15, T.green) : ""}`, ok ? `read r${a.revision} · same hash` : v ? "stale: files changed after review" : "no review");
  });
  const accept = a.accepted
    ? box("Your acceptance", '<span class="s13 b">Accepted</span>', "by you")
    : box("Your acceptance", '<span class="s13 b">Waiting for you</span>', "Not implied by reviews", true);
  return `<div class="card" style="padding:16px;margin:10px 0 0 44px"><div class="row sb"><span class="row g10">${ic("checkc", 20, a.accepted ? T.green : T.sub)}<span class="s16 b">${esc(room.title)} · result</span><span class="chip mono">r${a.revision}</span>${pillHtml(a.accepted ? "Accepted" : "Ready", a.accepted ? T.green : T.blue)}</span><span class="s12 dim mono">manifest ${a.hash.slice(0, 6)}</span></div><div class="row g12" style="margin-top:14px">${reviews.join("")}${accept}</div><div class="row g8" style="margin-top:14px">${a.accepted ? "" : `<button class="btn g" data-hot="accept" style="border:0">${ic("check", 15, "#04170B", 2.2)}Accept</button>`}<button class="btn" data-hot="control:continue" style="border:0">Continue with a new budget</button></div></div>`;
}
// personas of the current state; set at the top of every render
let PS: PersonaDef[] = [];
const pd = (id: string) => PS.find((p) => p.id === id);
const nm = (id: string) => esc(pd(id)?.name ?? id);
const pav = (id: string, size: number) => av(pd(id)?.avatar ?? "claude", size);
const copy = {
  en: {
    projects: "Projects",
    newProject: "New project",
    name: "Name",
    folder: "Project folder",
    goal: "Goal",
    constraints: "Constraints",
    create: "Create project",
    browse: "Browse",
    room: "New room",
    send: "Message Main, or @mention someone",
    ready: "Ready",
    save: "Save",
    general: "General",
    engines: "Engines",
    empty: "Create a project from a local folder to begin.",
    settings: "Settings",
  },
  id: {
    projects: "Proyek",
    newProject: "Proyek baru",
    name: "Nama",
    folder: "Folder proyek",
    goal: "Tujuan",
    constraints: "Batasan",
    create: "Buat proyek",
    browse: "Pilih folder",
    room: "Room baru",
    send: "Kirim pesan, atau @mention persona",
    ready: "Siap",
    save: "Simpan",
    general: "Umum",
    engines: "Engine",
    empty: "Buat proyek dari folder lokal untuk mulai.",
    settings: "Pengaturan",
  },
};
function App() {
  const [state, setState] = useState<State>();
  const [page, setPage] = useState("projects");
  const [selected, setSelected] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Task");
  const [step, setStep] = useState<SetupStep>("welcome");
  const setup = (s: SetupStep) => {
    setStep(s);
    setPage("setup");
  };
  const draftRef = useRef("");
  const draft = draftRef.current;
  const setDraft = (v: string) => {
    draftRef.current = v;
    const input = document.querySelector("#message");
    if (input && (input as HTMLTextAreaElement).value !== v)
      (input as HTMLTextAreaElement).value = v;
  };
  const [form, setForm] = useState({
    name: "",
    root: "",
    goal: "",
    constraints: "",
  });
  const [team, setTeam] = useState({
    title: "Main",
    template: "build_review" as Template,
    builder: "sonnet" as Persona,
    reviewers: ["claude"] as Persona[],
  });
  const invoke = async (method: string, input?: unknown) => {
    try {
      setError("");
      return await window.walt.call(method, input);
    } catch (e) {
      setError(String(e));
      return null;
    }
  };
  useEffect(() => {
    window.walt
      .call("snapshot")
      .then((s: State) => {
        setState(s);
        if (!s.projects.length) setPage("setup");
        // the sidebar and Team screen need real engine status; doctor takes a few seconds
        void window.walt.call("doctor").catch(() => {});
      })
      .catch((e) => setError(String(e)));
    const unsub = window.walt.subscribe(setState);
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        setPage("projects");
      }
      if (e.key === "Escape") setError("");
    };
    window.addEventListener("keydown", key);
    return () => {
      unsub();
      window.removeEventListener("keydown", key);
    };
  }, []);
  if (!state)
    return (
      <div
        style={{
          padding: 40,
          color: "#F5F5F7",
          background: "#1C1C1E",
          height: "100%",
        }}
      >
        Walt · {error || "Starting host…"}
      </div>
    );
  PS = state.personas;
  const text = copy[state.settings.locale];
  const room = state.rooms.find((r) => r.id === selected);
  const project = state.projects.find(
    (p) => p.id === (room?.projectId || projectId),
  );
  const btn = (label: string, action: string, cls = "") =>
    `<button class="btn ${cls}" data-hot="${action}" style="border:0">${label}</button>`;
  const settingsSide = `<div class="side"><div class="sect">${text.settings}</div>${["General", "Engines", "Personas & templates", "Permissions", "Usage & limits", "Island (Ce:L)", "Data & backup", "About Walt"].map((t) => `<div class="item ${page === t ? "on" : ""}" data-hot="set:${t}">${t}</div>`).join("")}</div>`;
  let body = "";
  let side = "";
  let inspector = "";
  let rail = "projects";
  if (page === "room" && room) {
    rail = "chat";
    const procs = state.procs || [];
    const asking = state.asks.filter((a) => a.roomId === room.id);
    const roleOf = (p: Persona) => (p === room.builder ? "Builder" : room.reviewers.includes(p) ? "Reviewer" : room.members?.includes(p) ? "Member" : "Free");
    const personaRow = (p: Persona) => {
      const s = personaStatus(pd(p)?.engine ?? "", state.engines);
      const live = procs.find((x) => x.room === room.id && x.persona === p);
      if (!s.ready) return [p, roleOf(p), "cold", s.label.toLowerCase()];
      if (asking.some((a) => a.persona === p)) return [p, roleOf(p), "wait", "needs your approval"];
      // the room step says who works; the process list alone lags while the model is still thinking
      const working = room.state === "running" && ((room.step === "build" && p === room.builder) || (room.step === "review" && room.reviewers.includes(p)));
      if (working || live?.busy) return [p, roleOf(p), "busy", room.step === "review" ? "reviewing" : "building"];
      if (live) return [p, roleOf(p), "warm", "process ready"];
      return [p, roleOf(p), "cold", roleOf(p) === "Free" ? "not in this room" : "wakes on its turn"];
    };
    const ready = PS.filter((p) => personaStatus(p.engine, state.engines).ready).length;
    // room personas first, then the rest
    const order = [...PS].sort((a, b) => Number(roleOf(a.id) === "Free") - Number(roleOf(b.id) === "Free"));
    const items = order.map((p) => { const [, r, st, d] = personaRow(p.id); return personaItem(p, r, st, d); }).join("");
    side = sidebar({
      room: room.id,
      task: esc(room.title),
      rooms: state.rooms
        .filter((r) => r.projectId === room.projectId)
        .map((r) => [r.id, esc(r.title), [r.builder, ...r.reviewers], STATE[r.state] || esc(r.state), ""]),
      personas: [],
    })
      .replace(/Rooms · BIBI/g, "Rooms · " + esc(project?.name))
      .replace('<div style="flex:1"></div>', items + '<div style="flex:1"></div>')
      .replace(/4 personas · 3 engines signed in/g, `${ready} of ${PS.length} personas ready`);
    const reviewing = room.template !== "roundtable" && room.template !== "direct";
    const last = room.artifacts.at(-1);
    const finished = room.step === "awaiting acceptance" || !!last?.accepted;
    const status =
      room.state === "awaiting_user"
        ? `<b style="color:${T.amber}">Waiting for you</b>`
        : room.step === "build"
          ? `<b>${nm(room.builder)}</b> is building`
          : room.step === "review"
            ? `Reviewing · ${room.reviewers.length} reviewer${room.reviewers.length > 1 ? "s" : ""}`
            : finished
              ? `<b style="color:${T.green}">${last?.accepted ? "Accepted" : "Finished"}</b>${last?.accepted ? "" : " · ready for your acceptance"}`
              : STEP[room.step] || esc(room.step);
    body =
      roomHeader({
        title: esc(room.title),
        sub: esc(project?.name + " · " + project?.root),
        es: [room.builder, ...room.reviewers, ...(room.members || [])].map((p) => pd(p)?.avatar ?? "claude"),
      }) +
      workflow({
        mode: TEMPLATE[room.template],
        steps: reviewing ? ["Build", "Review"] : room.template === "roundtable" ? ["Answer"] : ["Build"],
        stepIdx: room.step === "review" ? 1 : room.step === "build" ? 0 : -1,
        done: finished,
        status,
        turn: `${room.used} of ${room.budget}`,
        controls: ["running", "awaiting_user"].includes(room.state),
      } as any) +
      `<div class="tl"><div class="tli">${room.messages
        .map((m) =>
          m.author === "cello"
            ? mine(new Date(m.at).toLocaleTimeString(), esc(m.text)) + (m.meta ? metaChip(m.meta, nm, m.kind === "setting") : "")
            : pd(m.author)
              ? personaMsg(pd(m.author)!, roleOf(m.author), new Date(m.at).toLocaleTimeString(), md(m.text) || "…")
              : `<div class="card s13" style="margin:12px 0;padding:12px;color:${m.kind === "error" ? T.red : T.sub}">${esc(m.text)}</div>`,
        )
        .join("")}${asking
        .map(
          (a) =>
            `<div class="card" style="padding:14px;margin:10px 0 0 44px;border-color:${T.amber}80"><div class="row g8">${ic("warn", 17, T.amber)}<span class="s14 b">${nm(a.persona)} wants to use ${esc(a.title)}</span></div><pre class="mono" style="margin:10px 0;background:#141416;border-radius:10px;padding:10px 12px;font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(a.input, null, 2))}</pre><div class="row g8">${btn("Allow once", "allow:" + a.id, "g")}${btn("Deny", "deny:" + a.id)}</div></div>`,
        )
        .join("")}${last && !["running", "awaiting_user"].includes(room.state) ? deliverable(room, last) : ""}</div></div>` +
      composer({ ph: text.send, route: TEMPLATE[room.template] });
    inspector = `<div class="insp"><div class="tabs">${["Task", "Files", "Context", "Decisions", "Activity"].map((t) => `<span class="tab ${tab === t ? "on" : ""}" data-hot="tab:${t}">${t}</span>`).join("")}</div><div style="padding:18px;overflow:auto"><div class="s16 b">${esc(room.title)}</div><div class="lbl">${STATE[room.state] || esc(room.state)}</div>${
      tab === "Context"
        ? `<pre class="s12" style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(room.packet, null, 2) || "No packet yet")}</pre>`
        : tab === "Files"
          ? room.artifacts
              .map(
                (a) =>
                  `<div class="card" style="padding:12px;margin:10px 0">r${a.revision} · ${a.accepted ? "Accepted" : "Awaiting acceptance"}<div class="mono s11 dim">${a.hash.slice(0, 16)}</div><div class="s12">${a.reviews.length} reviews</div></div>`,
              )
              .join("") || '<div class="s13 dim">No artifact yet.</div>'
          : tab === "Decisions"
            ? '<div class="s13 dim">No confirmed decisions.</div>'
            : tab === "Activity"
              ? room.messages
                  .filter((m) => m.author === "Walt")
                  .map((m) => `<p class="s12 dim">${esc(m.text)}</p>`)
                  .join("") || '<div class="s13 dim">Nothing yet.</div>'
              : `<div class="lbl">Team</div>${order.map((p) => { const r = roleOf(p.id); const act = r === "Builder" ? "" : r === "Free" ? `<span class="chip" data-hot="member:${esc(p.id)}:Reviewer">+ Reviewer</span><span class="chip" data-hot="member:${esc(p.id)}:Member">+ Member</span>` : `<span class="chip" data-hot="member:${esc(p.id)}:Remove">Remove</span>`; return `<div class="row g8 s13" style="margin:10px 0">${pav(p.id, 24)}<span class="f1">${esc(p.name)}<span class="s12 dim"> · ${r}</span></span>${act}</div>`; }).join("")}<div class="s12 dim" style="margin-top:4px">Members answer only when you @mention them.${room.tune && Object.keys(room.tune).length ? " Room settings: " + Object.entries(room.tune).map(([k, t]) => `${k === "*" ? "everyone" : nm(k)} ${[t.effort && "effort " + t.effort, t.model && "model " + esc(t.model)].filter(Boolean).join(", ")}`).join("; ") + "." : ""}</div><div class="lbl">Budget</div><div>${room.used} of ${room.budget} turns used</div><div class="col g8" style="margin-top:20px">${btn("Continue · +2 turns", "control:continue")}${btn("Resume", "control:resume")}${btn("End room", "control:end")}</div>`
    }</div></div>`;
  } else if (page === "projects") {
    body = `<div style="padding:32px 40px"><div class="row sb">${wordmark(24)}${btn(text.newProject, "new-project", "g")}</div><h2 style="margin:32px 0 20px">${text.projects}</h2><div class="row g16" style="flex-wrap:wrap">${state.projects.map((p) => `<div class="card" style="padding:24px;width:300px" data-hot="project:${p.id}"><div class="s18 b">${esc(p.name)}</div><div class="s12 dim" style="margin:10px 0">${esc(p.root)}</div><div class="s13 sub">${esc(p.goal)}</div></div>`).join("") || `<div class="dim">${text.empty}</div>`}</div></div>`;
  } else if (page === "tasks") {
    body = `<div style="padding:32px"><h2>Tasks</h2>${state.rooms.map((r) => `<div class="card row sb" data-hot="open:${r.id}" style="padding:18px;margin-top:16px"><span>${esc(r.title)}</span><span class="dim">${esc(r.step)}</span></div>`).join("")}</div>`;
  } else {
    rail = "settings";
    side = settingsSide;
    body = `<div style="padding:32px 40px;overflow:auto"><h2 style="margin-bottom:26px">${esc(page)}</h2>`;
    if (page === "Engines") {
      body +=
        btn("Refresh doctor", "doctor", "g") +
        state.engines
          .map(
            (e) =>
              `<div class="card" style="padding:20px;margin-top:16px"><div class="row g12">${av(e.engine, 32)}<span class="s16 b">${esc(e.engine)}</span><span class="chip">${e.installed ? (e.auth === "ok" ? "Ready" : e.auth === "required" ? "Login needed" : "Unknown") : "Not installed"}</span></div><div class="dim s13" style="margin-top:10px">${esc(e.version)} · ${esc(e.detail)}</div></div>`,
          )
          .join("");
    } else if (page === "General") body += '<div id="settings-slot"></div>';
    else if (page === "Island (Ce:L)")
      body +=
        '<div class="lbl">Connection</div><div class="card" style="padding:20px"><div class="s15 b">Local control service</div><p class="dim s13" style="margin-top:8px">127.0.0.1 · walt-control/1 · token rotated on launch</p><p class="dim s13" style="margin-top:8px">Ce:L reads %APPDATA%\\Walt\\control.json. Tool approvals open in Walt.</p></div>';
    else if (page === "Usage & limits")
      body +=
        '<div class="card" style="padding:20px">Usage and quota: unknown<p class="dim s13" style="margin-top:8px">No provider usage report has been received.</p></div>';
    else if (page === "Permissions")
      body +=
        '<div class="card" style="padding:20px">Builder: writes and shell commands require approval.<br><br>Reviewer: Read, Glob and Grep only.<br><br>Approvals are available in the Walt window.</div>';
    else if (page === "Personas & templates") body += '<div id="personas-slot"></div>';
    else if (page === "About Walt")
      body +=
        '<div class="s24 b">Walt 0.1.0</div><p class="dim" style="margin-top:12px">One project. Your AI team. You lead.</p>';
    else
      body +=
        '<div class="dim">SQLite history is stored locally. Backup and restore are pending implementation.</div>';
    body += "</div>";
  }
  const html = shell({
    rail,
    side,
    main: body,
    insp: inspector,
    project: esc(project?.name || "Walt"),
    light: state.settings.theme === "light",
  });
  const click = async (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-hot],.btn,.wctl span",
    );
    if (!target) return;
    let action = target.dataset.hot || "";
    if (target.closest(".wctl")) {
      window.walt.window(
        ["minimize", "maximize", "close"][
          Array.from(target.parentElement!.children).indexOf(target)
        ],
      );
      return;
    }
    if (!action && target.textContent?.includes("Pause"))
      action = "control:pause";
    if (!action && target.textContent?.trim() === "Stop")
      action = "control:interrupt";
    if (action.startsWith("rail:")) {
      const p = action.slice(5);
      setPage(
        (
          {
            chat: "room",
            settings: "General",
            usage: "Usage & limits",
            memory: "room",
          } as any
        )[p] || p,
      );
    } else if (action.startsWith("set:")) {
      setPage(action.slice(4));
      if (action === "set:Engines") await invoke("doctor");
    } else if (action === "new-project") setup("project");
    else if (action === "project switcher") setPage("projects");
    else if (action.startsWith("project:")) {
      const id = action.slice(8);
      setProjectId(id);
      const r = state.rooms.find((r) => r.projectId === id);
      if (r) {
        setSelected(r.id);
        setPage("room");
      } else setup("team");
    } else if (action.startsWith("room:")) {
      const r = state.rooms.find(
        (r) =>
          r.title === target.textContent?.trim() || r.title === action.slice(5),
      );
      if (r) setSelected(r.id);
    } else if (action.startsWith("open:")) {
      setSelected(action.slice(5));
      setPage("room");
    } else if (action.startsWith("tab:")) setTab(action.slice(4));
    else if (action === "doctor") await invoke("doctor");
    else if (action.startsWith("control:"))
      await invoke("control", { roomId: selected, action: action.slice(8) });
    else if (action.startsWith("allow:") || action.startsWith("deny:"))
      await invoke("approval", {
        id: action.split(":")[1],
        allow: action.startsWith("allow:"),
      });
    else if (action === "accept") await invoke("accept", selected);
    else if (action.startsWith("member:")) {
      const [, persona, role] = action.split(":");
      await invoke("member", { roomId: selected, persona, role });
    }
    else if (action === "send") {
      const value =
        document.querySelector<HTMLTextAreaElement>("#message")?.value;
      if (value?.trim()) {
        const result = await invoke("send", { roomId: selected, text: value });
        if (result !== null) setDraft("");
      }
    }
  };
  if (page === "setup")
    return (
      <>
        <Setup
          state={state}
          step={step}
          setStep={setStep}
          projectId={projectId}
          invoke={invoke}
          onProject={(id) => {
            setProjectId(id);
            setStep("team");
          }}
          onRoom={(id) => {
            setSelected(id);
            setPage("room");
          }}
          onCancel={() => setPage("projects")}
        />
        {error && (
          <div
            role="alert"
            className="card"
            style={{
              position: "absolute",
              bottom: 20,
              left: 30,
              padding: 16,
              color: T.red,
            }}
          >
            {error}
          </div>
        )}
      </>
    );
  return (
    <>
      <Design
        html={html}
        onClick={click}
        draft={draft}
        setDraft={setDraft}
        complete={(before) => (page === "room" && room ? completeFor(before, state, room) : [])}
        onSend={async (value) => {
          if (value.trim()) {
            await invoke("send", { roomId: selected, text: value });
            setDraft("");
          }
        }}
      />
      {page === "Personas & templates" && (
        <div style={{ position: "absolute", top: 110, left: 364, right: 40, bottom: 20, overflow: "auto" }}>
          <PersonaSettings state={state} invoke={invoke} />
        </div>
      )}
      {page === "General" && (
        <div
          style={{ position: "absolute", top: 150, left: 365, width: 600 }}
          className="col g20"
        >
          <label className="row sb">
            Language
            <select
              value={state.settings.locale}
              onChange={(e) =>
                invoke("settings", {
                  ...state.settings,
                  locale: e.target.value,
                })
              }
            >
              <option value="en">English</option>
              <option value="id">Indonesia</option>
            </select>
          </label>
          <label className="row sb">
            Appearance
            <select
              value={state.settings.theme}
              onChange={(e) =>
                invoke("settings", { ...state.settings, theme: e.target.value })
              }
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
          <label className="row sb">
            Idle timeout (minutes)
            <input
              type="number"
              min={5}
              max={60}
              defaultValue={state.settings.idleMinutes}
              onBlur={(e) =>
                invoke("settings", {
                  ...state.settings,
                  idleMinutes: Number(e.target.value),
                })
              }
            />
          </label>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="card"
          style={{
            position: "absolute",
            bottom: 24,
            left: 350,
            right: 40,
            padding: 16,
            color: T.red,
          }}
          onClick={() => setError("")}
        >
          {error}
        </div>
      )}
    </>
  );
}
function Design({
  html,
  onClick,
  draft,
  setDraft,
  onSend,
  complete,
}: {
  html: string;
  onClick: React.MouseEventHandler;
  draft: string;
  setDraft: (s: string) => void;
  onSend: (s: string) => void;
  complete: (before: string) => Suggestion[];
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  // handlers live in DOM listeners made once per html; read the latest completer through a ref
  const completeRef = React.useRef(complete);
  completeRef.current = complete;
  const oldInput = document.activeElement as HTMLTextAreaElement | null;
  const hadFocus = oldInput?.id === 'message';
  const caret = hadFocus ? oldInput.selectionStart : 0;
  useEffect(() => {
    const root = ref.current!;
    const slot = root.querySelector('[data-hot="composer"]');
    if (slot) {
      const input = document.createElement("textarea");
      input.id = "message";
      input.placeholder = slot.textContent || "";
      input.value = draft;
      input.rows = 1;
      // @persona and /command menu above the composer
      let list: Suggestion[] = [];
      let at = 0;
      const box = document.createElement("div");
      box.id = "suggest";
      box.className = "card";
      box.setAttribute("role", "listbox");
      box.style.cssText = "position:fixed;z-index:20;padding:6px;background:#2A2A2C;min-width:340px;display:none";
      document.body.append(box);
      const paint = () => {
        if (!list.length) {
          box.style.display = "none";
          return;
        }
        const r = (input.closest(".cbox") || input).getBoundingClientRect();
        box.style.display = "block";
        box.style.left = r.left + 16 + "px";
        box.style.bottom = window.innerHeight - r.top + 8 + "px";
        box.innerHTML = list
          .map((x, i) => `<div class="item g12" data-i="${i}" role="option" aria-selected="${i === at}" style="padding:6px 10px;cursor:pointer;${i === at ? "background:#3A3A3C" : ""}"><span class="s13 b">${esc(x.label)}</span><span class="f1"></span><span class="s12 dim">${esc(x.hint)}</span></div>`)
          .join("");
      };
      const show = () => {
        list = completeRef.current(input.value.slice(0, input.selectionStart ?? input.value.length));
        at = 0;
        paint();
      };
      const pick = (i: number) => {
        const x = list[i];
        if (x?.insert) {
          const pos = input.selectionStart ?? input.value.length;
          const start = pos - x.replace;
          input.value = input.value.slice(0, start) + x.insert + input.value.slice(pos);
          input.setSelectionRange(start + x.insert.length, start + x.insert.length);
          setDraft(input.value);
          input.focus();
          return show();
        }
        list = [];
        paint();
      };
      box.onmousedown = (e) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
        if (el) {
          e.preventDefault();
          pick(Number(el.dataset.i));
        }
      };
      input.oninput = () => {
        setDraft(input.value);
        show();
      };
      input.onblur = () => setTimeout(() => { list = []; paint(); }, 150);
      input.onkeydown = (e) => {
        if (list.length && ["ArrowDown", "ArrowUp", "Tab", "Enter", "Escape"].includes(e.key) && !e.shiftKey) {
          e.preventDefault();
          if (e.key === "ArrowDown") at = (at + 1) % list.length;
          else if (e.key === "ArrowUp") at = (at - 1 + list.length) % list.length;
          else if (e.key === "Escape") list = [];
          else return pick(at);
          return paint();
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSend(input.value);
        }
      };
      slot.replaceWith(input);
      if (hadFocus) {
        input.focus();
        input.setSelectionRange(caret, caret);
      }
    }
    root.querySelectorAll<HTMLElement>("[data-hot]").forEach((el) => {
      el.tabIndex = 0;
      el.onkeydown = (e) => {
        if (e.key === "Enter") el.click();
      };
    });
    return () => document.getElementById("suggest")?.remove();
  }, [html]);
  return (
    <div
      ref={ref}
      style={{ height: "100%" }}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
createRoot(document.getElementById("root")!).render(<App />);
