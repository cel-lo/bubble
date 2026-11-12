import { Setup } from "./setup";
import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import type {
  State,
  Room,
  Persona,
  Template,
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
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const names: Record<string, string> = {
  codex: "Codex",
  claude: "Claude Opus",
  sonnet: "Claude Sonnet",
  gemini: "Gemini",
};
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
      .then(setState)
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
    side = sidebar({
      room: room.id,
      task: room.title,
      rooms: state.rooms
        .filter((r) => r.projectId === room.projectId)
        .map((r) => [
          r.id,
          esc(r.title),
          [r.builder, ...r.reviewers],
          esc(r.state),
          "",
        ]),
      personas: (Object.keys(names) as Persona[]).map((p) => [
        p,
        p === room.builder
          ? "Builder"
          : room.reviewers.includes(p)
            ? "Reviewer"
            : "Free",
        room.state === "running" && p === room.builder ? "busy" : "cold",
        esc(room.state),
      ]),
    });
    side = side
      .replace(/Rooms · BIBI/g, "Rooms · " + esc(project?.name))
      .replace(
        /4 personas · 3 engines signed in/g,
        `${state.engines.filter((e) => e.auth === "ok").length} engines signed in`,
      );
    body =
      roomHeader({
        title: esc(room.title),
        sub: esc(project?.name + " · " + project?.root),
        es: [room.builder, ...room.reviewers],
      }) +
      workflow({
        mode: room.template,
        stepIdx: room.step === "review" ? 1 : 0,
        status: esc(room.step),
        turn: `${room.used} of ${room.budget}`,
        controls: ["running", "awaiting_user"].includes(room.state),
      } as any) +
      `<div class="tl"><div class="tli">${room.messages.map((m) => (m.author === "cello" ? mine(new Date(m.at).toLocaleTimeString(), esc(m.text)) : names[m.author] ? msg(m.author, m.author === room.builder ? "Builder" : "Reviewer", new Date(m.at).toLocaleTimeString(), esc(m.text) || "…") : `<div class="card s13" style="margin:12px 0;padding:12px;color:${m.kind === "error" ? T.red : T.sub}">${esc(m.text)}</div>`)).join("")}${state.asks
        .filter((a) => a.roomId === room.id)
        .map(
          (a) =>
            `<div class="card" style="padding:16px"><div class="s15 b">${esc(a.title)}</div><pre style="white-space:pre-wrap;margin:12px 0">${esc(JSON.stringify(a.input, null, 2))}</pre>${btn("Allow once", "allow:" + a.id, "g")} ${btn("Deny", "deny:" + a.id, "r")}</div>`,
        )
        .join("")}</div></div>` +
      composer({ ph: text.send, route: room.template });
    inspector = `<div class="insp"><div class="tabs">${["Task", "Files", "Context", "Decisions", "Activity"].map((t) => `<span class="tab ${tab === t ? "on" : ""}" data-hot="tab:${t}">${t}</span>`).join("")}</div><div style="padding:18px;overflow:auto"><div class="s16 b">${esc(room.title)}</div><div class="lbl">${esc(room.state)}</div>${
      tab === "Context"
        ? `<pre class="s12" style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(room.packet, null, 2) || "No packet yet")}</pre>`
        : tab === "Files"
          ? room.artifacts
              .map(
                (a) =>
                  `<div class="card" style="padding:12px;margin:10px 0">r${a.revision} · ${a.accepted ? "Accepted" : "Awaiting acceptance"}<div class="mono s11 dim">${a.hash.slice(0, 16)}</div><div class="s12">${a.reviews.length} reviews</div>${btn("Accept", "accept")}</div>`,
              )
              .join("")
          : tab === "Decisions"
            ? '<div class="s13 dim">No confirmed decisions.</div>'
            : tab === "Activity"
              ? room.messages
                  .filter((m) => m.author === "Walt")
                  .map((m) => `<p class="s12 dim">${esc(m.text)}</p>`)
                  .join("")
              : `<div class="lbl">Owner and reviewers</div>${[room.builder, ...room.reviewers].map((p) => `<div class="row g8 s13" style="margin:12px 0">${av(p, 24)}${names[p]}</div>`).join("")}<div class="lbl">Budget</div><div>${room.used} / ${room.budget}</div><div class="col g8" style="margin-top:20px">${btn("Continue · +2 turns", "control:continue")}${btn("Resume", "control:resume")}${btn("End room", "control:end")}</div>`
    }</div></div>`;
  } else if (page === "projects") {
    body = `<div style="padding:32px 40px"><div class="row sb">${wordmark(24)}${btn(text.newProject, "new-project", "g")}</div><h2 style="margin:32px 0 20px">${text.projects}</h2><div class="row g16" style="flex-wrap:wrap">${state.projects.map((p) => `<div class="card" style="padding:24px;width:300px" data-hot="project:${p.id}"><div class="s18 b">${esc(p.name)}</div><div class="s12 dim" style="margin:10px 0">${esc(p.root)}</div><div class="s13 sub">${esc(p.goal)}</div></div>`).join("") || `<div class="dim">${text.empty}</div>`}</div></div>`;
  } else if (page === "new-project" || page === "new-room") {
    body = `<div id="form-slot" style="padding:48px;max-width:800px;width:100%;margin:auto"></div>`;
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
    else if (page === "Personas & templates")
      body += Object.keys(names)
        .map(
          (p) =>
            `<div class="card row g12" style="padding:18px;margin-top:12px">${av(p, 32)}${names[p]}</div>`,
        )
        .join("");
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
    } else if (action === "new-project") setPage("new-project");
    else if (action === "project switcher") setPage("projects");
    else if (action.startsWith("project:")) {
      const id = action.slice(8);
      setProjectId(id);
      const r = state.rooms.find((r) => r.projectId === id);
      if (r) {
        setSelected(r.id);
        setPage("room");
      } else setPage("new-room");
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
    else if (action === "send") {
      const value =
        document.querySelector<HTMLTextAreaElement>("#message")?.value;
      if (value?.trim()) {
        const result = await invoke("send", { roomId: selected, text: value });
        if (result !== null) setDraft("");
      }
    }
  };
  if (page === "new-project" || page === "new-room")
    return (
      <>
        <Setup
          page={page}
          projectId={projectId}
          invoke={invoke}
          onProject={(id) => {
            setProjectId(id);
            setPage("new-room");
          }}
          onRoom={(id) => {
            setSelected(id);
            setPage("room");
          }}
          back={() => setPage("projects")}
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
        onSend={async (value) => {
          if (value.trim()) {
            await invoke("send", { roomId: selected, text: value });
            setDraft("");
          }
        }}
      />
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
}: {
  html: string;
  onClick: React.MouseEventHandler;
  draft: string;
  setDraft: (s: string) => void;
  onSend: (s: string) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
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
      input.oninput = () => setDraft(input.value);
      input.onkeydown = (e) => {
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
