// Walt · completion set: full Settings, role/persona/template editors, the remaining flows from 04_FLOWS
// (pause, end, wake/sleep, quota reassign, budget, routing, after accept), navigation (home, new room,
// command palette, search, diff, activity), Indonesian + light variants. Same kit as screens.mjs.
import { T, ENG, ic, av, stack, role, hexA, dot, sidebar, workflow, composer, msg, mine, handoff, shell, wordmark, roomHeader } from "./kit.mjs";
import { SCREENS as S1, room, settingsRow, select, group, pill, sev, mono, tlDone, changes, W, H } from "./screens.mjs";

const tog = (on = true) => `<span class="tog ${on ? "" : "off"}"></span>`;
const seg = (opts, on) => `<div class="seg">${opts.map((o) => `<span class="${o === on ? "on" : ""}" data-hot="seg:${o}">${o}</span>`).join("")}</div>`;
// a settings row that is one clickable hotspot (prototype)
const hotRow = (name, ...a) => settingsRow(...a).replace('<div class="row g16"', `<div data-hot="${name}" class="row g16"`);
const spin = (c = T.green, s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 14 14" style="display:block;flex:none"><circle cx="7" cy="7" r="5.5" fill="none" stroke="${hexA(c, 0.25)}" stroke-width="2"/><path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/></svg>`;
const meter = (p, c, w = "100%") => `<div style="width:${w};height:6px;border-radius:3px;background:#3A3A3C;overflow:hidden"><div style="width:${Math.round(p * 100)}%;height:100%;border-radius:3px;background:${c}"></div></div>`;
const kbd = (t) => `<span style="display:inline-block;padding:2px 7px;border-radius:5px;background:#3A3A3C;font-size:11.5px;color:${T.sub};font-weight:600">${t}</span>`;
const sys = (icon, t, c = T.dim) => `<div class="ho">${icon}<span style="color:${c}">${t}</span></div>`;
// dim the screen under a dialog
const modal = (base, dialog) => `<div style="position:relative;width:100%;height:100%">${base}<div style="position:absolute;inset:0;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;border-radius:10px">${dialog}</div></div>`;
const dlg = (w, title, sub, body, foot) => `<div class="card" style="width:${w}px;background:#232325;border-color:#3A3A3C;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.6);overflow:hidden">
<div style="padding:20px 22px 0"><div class="row sb"><div class="s18 b">${title}</div><span data-hot="Close dialog">${ic("x", 18, T.dim)}</span></div>${sub ? `<div class="s13 dim" style="margin-top:6px;line-height:1.5">${sub}</div>` : ""}</div>
<div style="padding:16px 22px">${body}</div><div class="row g10" style="padding:14px 22px;border-top:1px solid ${T.line};justify-content:flex-end">${foot}</div></div>`;

// ---------------- Settings (English) ----------------
const NAV = [["gear", "General"], ["bolt", "Engines"], ["users", "Personas & templates"], ["shield", "Permissions"], ["usage", "Usage & limits"], ["island", "Island (Ce:L)"], ["db", "Data & backup"], ["sparkle", "About Walt"]];
const settings = (on, body) => shell({ rail: "settings", side: `<div class="side" style="gap:2px">
<div class="s20 b" style="padding:4px 8px 12px">Settings</div>
${NAV.map(([i, t]) => `<div class="item ${t === on ? "on" : ""}" data-hot="set:${t}" style="padding:7px 8px">${ic(i, 17, t === on ? T.text : T.dim)}<span class="s14">${t}</span></div>`).join("")}
<div style="flex:1"></div><div class="item" style="padding:7px 8px">${ic("lang", 17)}<span class="s13 dim">Bahasa Indonesia available in General</span></div></div>`,
  main: `<div class="col" style="width:760px;margin:0 auto;padding:26px 0;overflow:hidden"><div class="s20 b">${on}</div>${body}</div>`, insp: "" });

const setGeneral = settings("General", group("Appearance", [settingsRow("Language", "Interface language. Agents reply in the language you write in.", seg(["English", "Indonesia", "Follow Windows"], "English")), settingsRow("Theme", "", seg(["Dark", "Light", "System"], "Dark"))]) +
  group("Windows", [settingsRow("Start with Windows", "Walt waits quietly in the tray so the Ce:L island stays connected.", tog()), settingsRow("Close button", "", select("Hide to tray while an agent works"))]) +
  group("Agents", [settingsRow("Keep agents ready for", "After that the process sleeps and wakes in a few seconds when called.", select("15 minutes")), settingsRow("Most agents ready at once", "", select("6")), settingsRow("Get agents ready when I start typing", "", tog())]) +
  group("Shortcuts", [hotRow("shortcut:Command palette", "Command palette", "", kbd("Ctrl K")), hotRow("shortcut:New room", "New room", "", kbd("Ctrl N")), hotRow("shortcut:Search everything", "Search everything", "", kbd("Ctrl F"))]));

const engineRow = (e, state, c, acct, ver, extra) => `<div class="row g16" style="padding:14px 16px;border-top:1px solid ${T.line}">${av(e === "claude" ? "claude" : e, 36)}<div class="f1"><div class="row g8"><span class="s15 b">${ENG[e].engine}</span><span class="pill" style="background:${hexA(c, 0.16)};color:${c}">${state}</span></div><div class="s12 dim" style="margin-top:4px">${acct} · ${ver}</div>${extra || ""}</div>`;
const setEngines = settings("Engines", `<div class="s13 dim" style="margin-top:6px;line-height:1.5">Walt uses each CLI with its own login. No API keys are stored in Walt.</div>
${group("Installed engines", [
  engineRow("codex", "Signed in", T.green, "ChatGPT account", "codex 0.48 · C:\\Users\\cello\\AppData\\Roaming\\npm\\codex.cmd") + `<span class="btn sm">Check again</span></div>`,
  engineRow("claude", "Signed in", T.green, "Claude account · models: Opus 5.5, Sonnet 5.5, Haiku 5.5", "claude 2.3 · C:\\Users\\cello\\.local\\bin\\claude.exe") + `<span class="btn sm">Check again</span></div>`,
  engineRow("gemini", "Login needed", T.amber, "Google account · session expired yesterday", "gemini 0.12 · npm global") + `<span class="btn sm g">${ic("term", 14, "#04170B")}Open terminal to log in</span></div>`])}
${group("Doctor", [settingsRow("Check all engines", "Login, version, and whether each CLI answers. Takes about 10 seconds.", `<span class="btn sm">${ic("refresh", 14, T.text)}Run doctor</span>`), settingsRow("Last check", "Today 09:02 · 2 ready, 1 needs login", "")])}
${group("More engines", [settingsRow(`<span class="dim">Add another CLI</span>`, "Any CLI that speaks ACP can be added later. See the extension guide.", `<span class="btn sm dis">Add engine</span>`)])}`);

const personaRow = (e, tags, used) => `<div class="row g12" data-hot="persona row:${ENG[e].name}" style="padding:11px 16px;border-top:1px solid ${T.line}">${av(e, 32)}<div style="width:170px"><div class="s14 b">${ENG[e].name}</div><div class="s12 dim">${ENG[e].engine} · ${ENG[e].model}</div></div><div class="f1 row g6">${tags.map((t) => `<span class="chip" style="font-size:11.5px;padding:3px 8px">${t}</span>`).join("")}</div><span class="s12 dim" style="width:96px">${used}</span><span class="btn sm">Edit</span></div>`;
const tplRow = (icon, t, d, steps) => `<div class="row g12" style="padding:11px 16px;border-top:1px solid ${T.line}">${ic(icon, 18, T.sub)}<div class="f1"><div class="s14 b">${t}</div><div class="s12 dim">${d}</div></div><span class="s12 dim">${steps}</span><span class="btn sm">${t === "Custom" ? "Edit steps" : "View"}</span></div>`;
const setPersonasBody = `<div class="row sb" style="margin-top:6px"><span class="s13 dim">A persona is an engine + model + what it is good at. Walt picks roles per task from these.</span><span class="btn sm g">${ic("plus", 14, "#04170B")}New persona</span></div>
${group("Personas", [personaRow("codex", ["Code changes", "Tests", "Refactors"], "in 3 rooms"), personaRow("claude", ["Planning", "Hard reviews", "Architecture"], "in 3 rooms"), personaRow("sonnet", ["Quick features", "Docs", "UI copy"], "in 2 rooms"), personaRow("gemini", ["Research", "Second opinion", "Long files"], "in 2 rooms")])}
${group("Team templates", [tplRow("diff", "Build & Review", "1 builder, 1 reviewer", "4 turns"), tplRow("users", "Triad", "1 builder, 2 reviewers in parallel", "6 turns"), tplRow("chat", "Roundtable", "Everyone talks, no file edits", "3 turns"), tplRow("globe", "Research", "Find, write, check", "6 turns"), tplRow("gear", "Custom", "Your own steps", "you set it")])}
${group("Role picking", [settingsRow("New rooms pick roles", "Auto: Walt picks builder and reviewers per task. You always see the pick first.", seg(["Auto", "Fixed"], "Auto"))])}`;
const setPersonas = settings("Personas & templates", setPersonasBody);

const P3 = (v) => { const c = { Allow: T.green, Ask: T.amber, Never: "#FF6961" }[v]; return `<span class="pill" style="background:${hexA(c, 0.16)};color:${c};min-width:64px;justify-content:center">${v}</span>`; };
const permRow = (t, d, a, b, c) => `<div class="row" style="padding:11px 16px;border-top:1px solid ${T.line}"><div class="f1"><div class="s14">${t}</div><div class="s12 dim">${d}</div></div><span style="width:110px">${P3(a)}</span><span style="width:110px">${P3(b)}</span><span style="width:110px">${P3(c)}</span></div>`;
const setPerms = settings("Permissions", `<div class="s13 dim" style="margin-top:6px;line-height:1.5">What a persona may do depends on its role in the task, not on the engine. Waiting never counts as allow.</div>
<div class="lbl" style="margin:22px 0 8px 4px">By role</div><div style="background:#28282A;border-radius:10px;overflow:hidden">
<div class="row s12 dim" style="padding:9px 16px"><span class="f1">Action</span><span style="width:110px">Builder</span><span style="width:110px">Reviewer</span><span style="width:110px">Researcher</span></div>
${permRow("Read project files", "Everything inside the project folder", "Allow", "Allow", "Allow")}${permRow("Edit files", "Only one writer at a time", "Allow", "Never", "Never")}${permRow("Run commands", "Tests, builds, scripts", "Ask", "Never", "Never")}${permRow("Install packages", "npm, pip, winget …", "Ask", "Never", "Never")}${permRow("Use the internet", "Docs, search, downloads", "Ask", "Ask", "Allow")}</div>
${group("Always allowed in BIBI", [settingsRow(`<span class="mono s13">npm test</span>`, "Added from an approval card · Codex · 7 Nov", `<span class="btn sm r">Remove</span>`), settingsRow(`<span class="mono s13">npm run lint</span>`, "Added from an approval card · Claude Sonnet · 6 Nov", `<span class="btn sm r">Remove</span>`)])}
${group("Island", [settingsRow("Approve tools from the island", "Off on purpose: approvals open Walt so you can read the full command.", tog(false))])}`);

const usageCard = (e, rows, reset) => `<div class="card f1" style="padding:16px"><div class="row g10">${av(e, 30)}<div class="f1"><div class="s14 b">${ENG[e].engine}</div><div class="s12 dim">${reset}</div></div></div>
${rows.map(([t, p, c, v]) => `<div style="margin-top:14px"><div class="row sb s12" style="margin-bottom:6px"><span class="sub">${t}</span><span class="dim">${v}</span></div>${meter(p, c)}</div>`).join("")}</div>`;
const bars = [3, 5, 2, 7, 6, 9, 4].map((v, i) => `<div class="col" style="align-items:center;gap:6px;flex:1"><div style="height:110px;display:flex;align-items:flex-end;gap:3px">${[["codex", v], ["claude", v * 0.7], ["sonnet", v * 0.5], ["gemini", v * 0.3]].map(([e, h]) => `<div style="width:9px;height:${h * 10}px;border-radius:3px;background:${ENG[e].color}"></div>`).join("")}</div><span class="s12 dim">${["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"][i]}</span></div>`).join("");
const usageBody = `<div class="s13 dim" style="margin-top:6px">As each CLI reports it. Walt never buys more usage for you.</div>
<div class="row g12" style="margin-top:18px;align-items:stretch">
${usageCard("codex", [["5-hour window", 0.62, ENG.codex.color, "62% used"], ["This week", 0.31, ENG.codex.color, "31% used"]], "Resets 14:00")}
${usageCard("claude", [["Opus 5.5", 0.78, ENG.claude.color, "78% used"], ["Sonnet 5.5", 0.22, ENG.sonnet.color, "22% used"]], "5-hour window · resets 16:20")}
${usageCard("gemini", [["Requests today", 0.14, ENG.gemini.color, "140 of 1,000"], ["Per minute", 0.05, ENG.gemini.color, "3 of 60"]], "Resets at midnight")}</div>
<div class="card" style="padding:16px;margin-top:14px"><div class="row sb"><span class="s14 b">Turns per day · last 7 days</span><span class="row g12 s12 dim">${["codex", "claude", "sonnet", "gemini"].map((e) => `<span class="row g6">${dot(ENG[e].color, 8)}${ENG[e].name}</span>`).join("")}</span></div><div class="row" style="margin-top:14px">${bars}</div></div>
${group("When a limit is hit", [settingsRow("What Walt does", "Moving work only happens when the last run left the files in a safe state.", seg(["Ask me", "Move to another persona", "Wait for reset"], "Ask me")), settingsRow("Warn me at", "", select("80% of a window"))])}`;
const setUsage = settings("Usage & limits", usageBody);

const setIsland = settings("Island (Ce:L)", group("Connection", [settingsRow(`<span class="row g8">${dot(T.green)}Connected to Ce:L</span>`, "Local API 127.0.0.1 · new token every time Walt opens", `<span class="btn sm">Disconnect</span>`), settingsRow("Walt page in the island", "Shows the running room as a page next to Music, Calendar and the rest", tog())]) +
  group("Peeks", [settingsRow("Handoffs", "Codex → Claude Opus: ready for review", tog()), settingsRow("Decisions", "Answer short questions right from the island", tog()), settingsRow("Tool approvals", "Peek only, with Open in Walt. Approving needs the full command.", tog()), settingsRow("Done and failed", "", tog()), settingsRow("Login needed and limits", "", tog())]) +
  group("Closed island", [settingsRow("Engine dots while agents work", "One coloured dot per working persona, ring shows the turn budget", tog()), settingsRow("Pause and resume from the island", "", tog())]));

const setData = settings("Data & backup", group("Storage", [settingsRow("History and settings", "%APPDATA%\\Walt · 182 MB · nothing is sent to a cloud", `<span class="btn sm">${ic("folder", 14, T.text)}Open folder</span>`), settingsRow("Logs", "Last 14 days · used for Report a problem", `<span class="btn sm">Open logs</span>`)]) +
  group("Backup", [settingsRow("Back up every day", "Snapshot of history, decisions and settings. Project files stay in your folders.", tog()), settingsRow("Keep", "", select("7 backups")), settingsRow("Last backup", "Today 03:00 · 41 MB", `<span class="btn sm">Back up now</span>`), settingsRow("Restore", "Pick a backup. Walt restarts and checks every run.", `<span class="btn sm">Restore…</span>`)]) +
  group("Rooms and projects", [settingsRow("Export a room", "Messages, decisions, deliverables as a .zip", `<span class="btn sm">Export…</span>`), settingsRow(`<span style="color:#FF6961">Delete a project's history</span>`, "Cannot be undone. Project files are not touched.", `<span class="btn sm r">Delete…</span>`)]));

const setAbout = settings("About Walt", `<div class="col" style="align-items:center;text-align:center;margin-top:30px">${stack(["codex", "claude", "sonnet", "gemini"], 44)}<div class="s24 b" style="margin-top:16px">Walt</div><div class="s13 dim" style="margin-top:6px">Version 1.0.0 · child app of Ce:L</div><div class="row g10" style="margin-top:16px"><span class="btn sm">${ic("refresh", 14, T.text)}Check for updates</span><span class="btn sm">Report a problem</span></div></div>
${group("Info", [settingsRow("What's new", "Roles are picked per task · two personas can share one engine", `<span class="btn sm">Read</span>`), settingsRow("Third-party notices", "", `<span class="btn sm">View</span>`), settingsRow("Blueprint", "walt/blueprint-v1.1", `<span class="btn sm">Open</span>`)])}`);

// ---------------- Roles, personas, templates ----------------
const w16 = S1["w16-room-roles"].html;
const roleOpt = (e, on, why) => `<div class="row g10" style="padding:8px 10px;border-radius:10px;${on ? `background:${hexA(T.green, 0.1)};box-shadow:inset 0 0 0 1.4px ${T.green}` : "background:#2A2A2C"}">${av(e, 26)}<div class="f1"><div class="s13 b">${ENG[e].name}</div><div class="s12 dim">${why}</div></div>${on ? ic("check", 16, T.green, 2.2) : ""}</div>`;
const swap = modal(w16, dlg(560, "Change roles for T-016", "Walt's pick is marked. Only the builder can edit files.", `
<div class="lbl" style="margin-top:0">Builder · pick one</div><div class="col g6">${roleOpt("sonnet", true, "Walt's pick · small feature, follows existing code")}${roleOpt("codex", false, "Good at code changes and tests")}${roleOpt("claude", false, "Best for hard or risky changes · uses more of the limit")}</div>
<div class="lbl">Reviewers · pick any</div><div class="row g8">${["codex", "claude", "gemini"].map((e, i) => `<span class="chip" data-hot="reviewer:${ENG[e].name}" style="padding:6px 10px;${i < 2 ? `background:${hexA(T.green, 0.14)};color:${T.green}` : ""}">${av(e, 18)}${ENG[e].name}${i < 2 ? ic("check", 13, T.green, 2.2) : ""}</span>`).join("")}</div>
<div class="row g10" style="margin-top:16px">${tog(false)}<span class="s13">Use these roles for similar tasks in this room</span></div>`, `<span class="btn o">Cancel</span><span class="btn g">Save roles</span>`));

const field = (label, ctl) => `<div style="margin-top:14px"><div class="s12 dim" style="margin-bottom:6px">${label}</div>${ctl}</div>`;
const input = (t, mono_ = false) => `<div style="background:#2C2C2E;border:1px solid #3A3A3C;border-radius:9px;padding:9px 12px;font-size:13.5px;${mono_ ? 'font-family:"Cascadia Mono",Consolas,monospace;font-size:12.5px' : ""}">${t}</div>`;
const personaEditor = modal(setPersonas, dlg(600, "Edit persona", "Two personas can use the same engine, for example Claude Opus and Claude Sonnet.", `
<div class="row g12">${av("sonnet", 48)}<div class="f1">${input("Claude Sonnet")}</div></div>
<div class="row g12">${field("Engine", select("Claude Code"))}${field("Model", select("Sonnet 5.5"))}${field("Colour", `<div class="row g6">${["#E8B04B", "#E08A68", "#7F87FF", "#22D3EE", "#30C759"].map((c, i) => `<span style="width:22px;height:22px;border-radius:11px;background:${c};${i ? "" : "box-shadow:0 0 0 2px #232325,0 0 0 4px #fff"}"></span>`).join("")}</div>`)}</div>
${field("Good at · Walt reads this when it picks roles", `<div class="row g6">${["Quick features", "Docs", "UI copy"].map((t) => `<span class="chip">${t}${ic("x", 12, T.dim)}</span>`).join("")}<span class="chip" style="color:${T.blue}">${ic("plus", 12, T.blue)}Add</span></div>`)}
${field("Extra instructions", input("Keep changes small. Follow the patterns already in the code. Write short commit-ready summaries."))}
${field("Can take these roles", `<div class="row g8">${["Builder", "Reviewer", "Researcher"].map((r) => `<span class="chip" style="background:${hexA(T.green, 0.14)};color:${T.green}">${ic("check", 13, T.green, 2.2)}${r}</span>`).join("")}</div>`)}`,
  `<span class="btn r" style="margin-right:auto">Delete</span><span class="btn o">Duplicate</span><span class="btn o">Cancel</span><span class="btn g">Save persona</span>`));

const stepCard = (n, t, who, d, extra = "") => `<div class="card" style="padding:12px 14px;display:flex;gap:12px;align-items:center"><span class="s12 dim">${ic("more", 16)}</span><span style="width:26px;height:26px;border-radius:13px;background:#3A3A3C;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${n}</span><div class="f1"><div class="s14 b">${t}</div><div class="s12 dim" style="margin-top:2px">${d}</div></div>${who}${extra}</div>`;
const templateEditor = modal(setPersonas, dlg(680, "Custom template", "Steps run top to bottom. Roles are filled per task (Auto) or fixed here.", `
${field("Name", input("Build, test, double review"))}
<div class="col g8" style="margin-top:14px">
${stepCard(1, "Plan", select("Role: Planner"), "Writes the steps and the files it expects to touch. No file edits.")}
${stepCard(2, "Build", select("Role: Builder"), "Edits files, runs tests. Gets the plan as context.")}
${stepCard(3, "Review", select("Role: Reviewers"), "In parallel · findings hidden from each other until both finish")}
${stepCard(4, "Fix and re-review", select("Repeat while blocking"), "Only when a review has High or Medium findings")}
<div class="row g8 s13" style="color:${T.blue};padding:4px 2px">${ic("plus", 15, T.blue)}Add step</div></div>
<div class="row g12">${field("Turn budget", select("8 turns"))}${field("Stop when", select("No blocking findings"))}${field("Roles", seg(["Auto", "Fixed"], "Auto"))}</div>`,
  `<span class="btn o">Cancel</span><span class="btn g">Save template</span>`));

// ---------------- Flows ----------------
const tlShort = `${mine("09:12", `Add validation so the return date can't be before the borrow date. Keep the API contract as it is (D-003).`)}
${handoff("cello", "Builder · Codex", "T-014 Borrow date validation · packet P-031")}
${msg("codex", "Builder", "09:19", `<p>Done. <span class="mono s13">validateLoan()</span> rejects a return date before the borrow date. 18 tests pass.</p>`, changes())}`;
const pausedBanner = `<div class="card" style="padding:14px 16px;margin:14px 0 0 44px;border-color:${hexA(T.amber, 0.5)};width:640px"><div class="row g10">${ic("pause", 18, T.amber)}<div class="f1"><div class="s14 b">Paused after Codex's turn</div><div class="s12 dim" style="margin-top:3px">Nothing new starts. Budget stays at 2 of 6. Reviewers will get r1 when you resume.</div></div><span class="btn sm g">Resume</span><span class="btn sm r">End room</span></div></div>`;
const paused = room({ tl: tlShort + pausedBanner, wf: workflow({ stepIdx: 1, status: `<b style="color:${T.amber}">Paused</b> · after turn 2`, turn: "2 of 6", controls: false }).replace(/<\/div>$/,`<span class="btn sm g">${ic("bolt", 14, "#04170B")}Resume</span><span class="btn sm r">End room</span></div>`),
  side: sidebar({ personas: [["codex", "Builder", "warm", "idle"], ["claude", "Reviewer", "warm", "waiting for r1"], ["gemini", "Reviewer", "cold", "asleep"]] }), comp: composer({ ph: "Paused · messages wait until you resume" }) });

const endRoom = modal(paused, dlg(520, "End Main?", "The room stops for good. You can still read it and export it.", `
<div class="col g10 s13">${[["stop", "Running work stops", "Codex is idle · nothing to interrupt"], ["x", "Open questions close", "1 question to Claude Opus is closed with your reason"], ["lock", "Files stay as they are", "Write lease is released once every process is idle"], ["db", "History is kept", "Export or delete it in Data & backup"]].map(([i, t, d]) => `<div class="row g10" style="align-items:flex-start">${ic(i, 17, T.sub)}<div><div class="b">${t}</div><div class="s12 dim" style="margin-top:2px">${d}</div></div></div>`).join("")}</div>
${field("Reason (optional)", input("Moving this work to the Database room"))}`, `<span class="btn o">Cancel</span><span class="btn r">End room</span>`));

const waking = room({ tl: `${tlShort}${handoff("Builder · Codex", "Reviewers · Claude Opus, Claude Sonnet", "ready for review · artifact r1 · turn 2 of 6")}
${sys(spin(ENG.sonnet.color), `<b style="color:${T.text}">Waking Claude Sonnet…</b> resuming its last session · a few seconds`)}
${sys(ic("checkc", 15, T.green), "Claude Opus was ready · review started 09:20")}
${sys(ic("moon", 15, T.faint), "Gemini went to sleep after 15 minutes idle · wakes on its next turn", T.faint)}`,
  wf: workflow({ stepIdx: 1, status: "Reviewing · waking 1 reviewer", turn: "3 of 6" }),
  side: sidebar({ personas: [["codex", "Builder", "warm", "waits for findings"], ["claude", "Reviewer", "busy", "reviewing r1"], ["sonnet", "Reviewer", "wait", "waking…"], ["gemini", "Free", "cold", "asleep · 15 min idle"]] }) });

const opt = (on, icon, t, d) => `<div class="row g10" style="padding:10px 12px;border-radius:10px;${on ? `background:${hexA(T.green, 0.1)};box-shadow:inset 0 0 0 1.4px ${T.green}` : "background:#2A2A2C"}">${icon}<div class="f1"><div class="s13 b">${t}</div><div class="s12 dim">${d}</div></div>${on ? ic("check", 16, T.green, 2.2) : ""}</div>`;
const quota = room({ tl: `${tlShort}${handoff("Builder · Codex", "Reviewers · Claude Opus, Gemini", "ready for review · artifact r1")}
<div class="card" style="padding:16px;margin:12px 0 0 44px;width:640px;border-color:${hexA(T.amber, 0.5)}"><div class="row g10">${av("claude", 30)}<div class="f1"><div class="s14 b">Claude Opus hit its usage limit</div><div class="s12 dim" style="margin-top:2px">Opus 5.5 · resets 16:20 · its review of r1 had not started, so moving it is safe</div></div></div>
<div class="col g8" style="margin-top:12px">${opt(true, av("sonnet", 26), "Give the review to Claude Sonnet", "Same account, different limit · 22% used")}${opt(false, av("gemini", 26), "Give it to Gemini", "Already reviewing r1 · would be the only reviewer")}${opt(false, ic("clock", 22, T.sub), "Wait until 16:20", "The round stays open, Codex waits")}</div>
<div class="row g10" style="margin-top:12px"><span class="btn g">Move review</span><span class="btn o">Open Usage & limits</span></div></div>`,
  wf: workflow({ stepIdx: 1, status: `<b style="color:${T.amber}">Waiting for you</b> · limit reached`, turn: "3 of 6", controls: false }),
  side: sidebar({ personas: [["codex", "Builder", "warm", "waits"], ["claude", "Reviewer", "wait", "limit until 16:20"], ["gemini", "Reviewer", "busy", "reviewing r1"], ["sonnet", "Free", "warm", "can take over"]] }) });

const budget = room({ tl: `${msg("codex", "Builder", "09:52", `<p>r3: fixed the DST case. One Medium finding is left: the error text is English only.</p>`, changes("r3", "20 passed"))}
${handoff("Review round 3", "Builder · Codex", "0 High, 1 Medium · budget used")}
<div class="card" style="padding:16px;margin:12px 0 0 44px;width:640px"><div class="row g10">${ic("clock", 20, T.amber)}<div class="f1"><div class="s14 b">Turn budget used · 6 of 6</div><div class="s12 dim" style="margin-top:2px">Only you can add turns. Nothing runs until you choose.</div></div></div>
<div style="padding:10px 12px;margin-top:12px;border-radius:10px;background:#2A2A2C"><div class="row g8">${sev("Medium")}<span class="s13 b">Error message is not translated</span></div><div class="s12 dim" style="margin-top:4px">src/loan-form.tsx:88 · found by Gemini</div></div>
<div class="row g10" style="margin-top:12px"><span class="btn g">Continue · +2 turns</span><span class="btn">+4 turns</span><span class="btn o">Accept with 1 open finding</span><span class="btn r">Stop</span></div></div>`,
  wf: workflow({ stepIdx: 2, status: `<b style="color:${T.amber}">Budget used</b> · 1 finding left`, turn: "6 of 6", controls: false }) });

const routeMenu = `<div class="card" style="width:380px;margin:0 0 8px 16px;padding:6px;background:#2A2A2C">
<div class="s12 dim" style="padding:6px 8px">Who answers this message</div>
${[["users", "Template flow · Roundtable", "Steps of the room's template", 0], ["chat", "Everyone answers", "One by one, each sees the answers before it", 1], ["eye", "Only mentioned", "Just the @persona you name", 0]].map(([i, t, d, on]) => `<div class="item" data-hot="route:${t}" style="padding:8px;${on ? "background:#3A3A3C" : ""}">${ic(i, 18, on ? T.text : T.sub)}<div class="f1"><div class="s13 b">${t}</div><div class="s12 dim">${d}</div></div>${on ? ic("check", 15, T.green, 2.2) : ""}</div>`).join("")}</div>`;
const route = room({ tl: `${mine("10:02", `What should the landing page headline say? Give me one line each.`)}
${handoff("cello", "Everyone · 4 personas", "one by one · round 1 of 1")}
${msg("claude", "Planner", "10:02", `<p>"Borrow books without the queue."</p>`)}
${msg("sonnet", "Writer", "10:03", `<p>"Your campus library, in your pocket." Building on Opus: shorter and friendlier.</p>`)}
${sys(spin(ENG.gemini.color), "Gemini is answering · Codex is next")}`,
  header: roomHeader({ title: "Landing copy", sub: "BIBI · Roundtable · no file edits", es: ["claude", "sonnet", "gemini", "codex"], inspector: false }), wf: workflow({ mode: "Roundtable", stepIdx: 0, steps: ["Answer", "Summarise"], status: "Everyone answers · 2 of 4 done", turn: "1 of 3" }),
  comp: composer({ route: "Everyone answers", extra: routeMenu }), side: sidebar({ room: "copy", task: "the headline", personas: [["claude", "Planner", "warm", "answered"], ["sonnet", "Writer", "warm", "answered"], ["gemini", "Writer", "busy", "answering"], ["codex", "Writer", "warm", "next"]] }) });

const accepted = room({ tl: `${handoff("Builder · Codex", "Reviewers · Claude Opus, Gemini", "re-review · artifact r2 · turn 5 of 6")}
${msg("claude", "Reviewer", "09:40", `<p>r2 looks right. The UTC comparison fixes the timezone issue.</p>`)}
${msg("gemini", "Reviewer", "09:40", `<p>Agreed, no remaining findings on r2.</p>`)}
${mine("09:41", `Accepted. Thanks all.`)}
<div class="card" style="padding:16px 18px;margin:12px 0 0 44px;width:660px;border-color:${hexA(T.green, 0.5)}"><div class="row g10">${ic("checkc", 20, T.green)}<div class="f1"><div class="s15 b">T-014 accepted</div><div class="s12 dim" style="margin-top:2px">3 files · 2 reviews · 19 tests pass · decision D-005 saved</div></div></div>
<div class="s12 dim" style="margin:14px 0 6px">Suggested commit</div>${input(`fix(loans): reject return dates before the borrow date<br><br>Compare dates in UTC, add DST test, error code LOAN_RETURN_BEFORE_BORROW.`, true)}
<div class="row g10" style="margin-top:12px"><span class="btn g">${ic("branch", 14, "#04170B")}Commit with git</span><span class="btn">${ic("copy", 14, T.text)}Copy message</span><span class="btn o">Skip</span></div>
<div class="row g10" style="margin-top:16px;padding-top:14px;border-top:1px solid ${T.line2}">${ic("arrow", 16, T.sub)}<div class="f1"><div class="s13 b">Next up · T-016 Loan reminder emails</div><div class="s12 dim">Walt picked Claude Sonnet to build, Codex and Claude Opus to review</div></div><span class="btn sm g">Start T-016</span><span class="btn sm">Change roles</span></div></div>`,
  wf: workflow({ stepIdx: 3, done: true, steps: ["Build", "Review", "Fix", "Re-review"], status: `<b style="color:${T.green}">Accepted</b>`, turn: "5 of 6", controls: false }) });

// ---------------- Navigation ----------------
const projCard = (c, name, desc, rooms, es, st, sc, when) => `<div class="card" data-hot="project:${name}" style="padding:16px;width:330px"><div class="row g10"><span style="width:34px;height:34px;border-radius:10px;background:${c};display:block"></span><div class="f1"><div class="s15 b">${name}</div><div class="s12 dim">${desc}</div></div></div>
<div class="row sb" style="margin-top:14px">${stack(es, 24)}<span class="row g6 s12" style="color:${sc}">${dot(sc, 7)}${st}</span></div><div class="row sb s12 dim" style="margin-top:12px;padding-top:10px;border-top:1px solid ${T.line2}"><span>${rooms}</span><span>${when}</span></div></div>`;
const homeMain = (light = false) => `<div class="rh"><div class="f1"><div class="s20 b">Projects</div><div class="s12 dim" style="margin-top:2px">Each project is one folder on this laptop</div></div><span class="btn sm">${ic("search", 14, T.text)}Search ${kbd("Ctrl F")}</span><span class="btn sm g">${ic("plus", 14, "#04170B")}New project</span></div>
<div style="padding:22px;display:flex;gap:16px;flex-wrap:wrap;align-content:flex-start">
${projCard(T.green, "BIBI", "Library loans app · D:\\Projects\\BIBI", "3 rooms · 6 tasks", ["codex", "claude", "sonnet", "gemini"], "Waiting for you · 1", T.amber, "now")}
${projCard("#5B6CFF", "Ce:L", "Dynamic island · D:\\NEWNUSA", "2 rooms · 11 tasks", ["claude", "sonnet", "gemini"], "Claude Opus is reviewing", ENG.claude.color, "12 min")}
${projCard("#A855F7", "Thesis notes", "Writing · D:\\Kuliah\\Skripsi", "1 room · research", ["gemini", "claude"], "Idle", T.faint, "Tue")}
<div class="card" data-hot="New project card" style="padding:16px;width:330px;border-style:dashed;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:150px">${ic("plus", 22, T.dim)}<span class="s13 dim">New project from a folder</span></div></div>
<div style="padding:0 22px"><div class="lbl">Recent activity</div>${[["codex", "BIBI · Main", "Codex finished r2 · 19 tests pass", "09:38"], ["claude", "Ce:L · Island", "Claude Opus asked you: keep the Prayer page?", "09:12"], ["gemini", "Thesis notes · Sources", "Gemini found 4 new papers", "Tue"]].map(([e, r, t, w]) => `<div class="row g10" style="padding:9px 0;border-bottom:1px solid ${T.line2}">${av(e, 24)}<span class="s13 b" style="width:170px">${r}</span><span class="f1 s13 ${light ? "" : "sub"}">${t}</span><span class="s12 dim">${w}</span></div>`).join("")}</div>`;
const home = shell({ rail: "projects", side: "", main: homeMain(), insp: "" });
const homeLight = shell({ light: true, rail: "projects", side: "", main: homeMain(true), insp: "" }).replaceAll("#F5F5F7", "#1C1C1E").replaceAll("#C7C7CC", "#48484A");

const typeCard = (i, t, d, on) => `<div class="card f1" data-hot="type:${t}" style="padding:12px;${on ? `border-color:${T.green};background:#1E2A22` : ""}">${ic(i, 18, on ? T.green : T.sub)}<div class="s13 b" style="margin-top:8px">${t}</div><div class="s12 dim" style="margin-top:3px;line-height:1.4">${d}</div></div>`;
const newRoom = modal(S1["w05-room-idle"].html, dlg(640, "New room in BIBI", "", `
${field("Name", input("Reminders"))}
<div class="row g8" style="margin-top:14px">${typeCard("diff", "Build & Review", "1 builder, 1 reviewer", 0)}${typeCard("users", "Triad", "1 builder, 2 reviewers", 1)}${typeCard("chat", "Roundtable", "Talk, no edits", 0)}${typeCard("globe", "Research", "Find, write, check", 0)}</div>
${field("Personas", `<div class="row g8">${["codex", "claude", "sonnet", "gemini"].map((e) => `<span class="chip" style="padding:6px 10px;background:${hexA(T.green, 0.14)};color:${T.green}">${av(e, 18)}${ENG[e].name}${ic("check", 13, T.green, 2.2)}</span>`).join("")}</div>`)}
<div class="row g12">${field("Roles", seg(["Auto", "Fixed"], "Auto"))}${field("Turn budget", select("6 turns"))}</div>`, `<span class="btn o">Cancel</span><span class="btn g">Create room</span>`));

const palette = modal(S1["w06-room-build"].html, `<div class="card" style="width:620px;background:#232325;border-color:#3A3A3C;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.6);margin-top:-260px;overflow:hidden">
<div class="row g10" style="padding:14px 16px;border-bottom:1px solid ${T.line}">${ic("search", 18, T.sub)}<span class="s15 f1">new<span class="cur"></span></span>${kbd("Esc")}</div>
<div style="padding:6px">${[["plus", "New room", "Ctrl N", 1], ["sparkle", "New task in Main", "", 0], ["users", "New persona", "", 0], ["folder", "New project from a folder", "", 0], ["pause", "Pause Main after this turn", "", 0], ["gear", "Settings · Personas & templates", "", 0]].map(([i, t, k, on]) => `<div class="item" data-hot="cmd:${t}" style="padding:9px 10px;${on ? "background:#3A3A3C" : ""}">${ic(i, 17, on ? T.text : T.sub)}<span class="s14 f1">${t}</span>${k ? kbd(k) : ""}</div>`).join("")}</div>
<div class="row g12 s12 dim" style="padding:9px 16px;border-top:1px solid ${T.line}"><span>${kbd("↑")} ${kbd("↓")} move</span><span>${kbd("Enter")} run</span><span class="f1"></span><span>Rooms, tasks, files and settings</span></div></div>`);

const hit = (icon, where, t, snippet, when) => `<div class="row g12" style="padding:12px 16px;border-top:1px solid ${T.line2};align-items:flex-start">${icon}<div class="f1"><div class="row g8 s12 dim">${where}<span class="f1"></span>${when}</div><div class="s14 b" style="margin-top:3px">${t}</div><div class="s13 sub" style="margin-top:3px;line-height:1.5">${snippet}</div></div></div>`;
const mark = (t) => `<span style="background:${hexA(T.amber, 0.3)};color:#fff;border-radius:3px;padding:0 2px">${t}</span>`;
const search = shell({ rail: "chat", side: sidebar({}), main: `<div class="rh"><div class="row g10 f1" style="background:#2C2C2E;border-radius:10px;padding:8px 12px">${ic("search", 17, T.sub)}<span class="s14 f1">timezone<span class="cur"></span></span><span class="s12 dim">6 results</span></div></div>
<div class="row g8" style="padding:12px 18px">${["All", "Messages", "Files", "Decisions", "Tasks"].map((t, i) => `<span class="chip" data-hot="filter:${t}" style="${i ? "" : `background:${hexA(T.green, 0.16)};color:${T.green}`}">${t}</span>`).join("")}<span class="f1"></span>${select("All projects")}</div>
<div style="margin:0 18px" class="card">${hit(av("claude", 26), "BIBI · Main · Claude Opus", "Review of T-014 r1", `High: ${mark("timezone")} — borrow date is UTC, return date is local`, "09:23")}
${hit(av("gemini", 26), "BIBI · Main · Gemini", "Review of T-014 r1", `Same ${mark("timezone")} issue, plus a missing DST test`, "09:24")}
${hit(ic("file", 24, T.sub), "BIBI · src/borrow.ts:41", "compareLoanDates()", `<span class="mono s12">// compare in UTC so the ${mark("timezone")} of the browser does not matter</span>`, "r2")}
${hit(ic("check", 24, T.green), "BIBI · Decision D-005", "Dates are compared in UTC", `Confirmed by you · avoids ${mark("timezone")} bugs in reminders too`, "09:30")}
${hit(ic("tasks", 24, T.sub), "BIBI · Task T-016", "Loan reminder emails", `Send in the member's ${mark("timezone")}, 2 days before the due date`, "Ready")}</div>`, insp: "" });

const dl = (n, sign, t) => { const c = sign === "+" ? T.green : sign === "-" ? "#FF6961" : T.dim; const bg = sign === "+" ? hexA(T.green, 0.1) : sign === "-" ? hexA(T.red, 0.1) : "transparent"; return `<div class="row mono" style="font-size:12.5px;line-height:22px;background:${bg}"><span style="width:44px;text-align:right;padding-right:10px;color:${T.faint}">${n}</span><span style="width:16px;color:${c}">${sign}</span><span style="white-space:pre;color:${sign === " " ? T.sub : T.text}">${t}</span></div>`; };
const diffView = shell({ rail: "chat", side: `<div class="side"><div class="row g8" style="padding:2px 8px 10px" data-hot="Back to room">${ic("back", 16, T.sub)}<span class="s14 b">T-014 · r2</span></div><div class="sect">3 files changed</div>
${[["src/borrow.ts", "+18 −4", 1], ["src/loan-form.tsx", "+6 −1", 0], ["tests/borrow.test.ts", "+31", 0]].map(([f, d, on]) => `<div class="item ${on ? "on" : ""}" data-hot="file:${f}">${ic("file", 16, T.sub)}<span class="mono s12 f1">${f}</span><span class="s12" style="color:${T.green}">${d}</span></div>`).join("")}
<div class="sect" style="margin-top:8px">Reviews</div><div class="item">${av("claude", 22)}<span class="s13 f1">Claude Opus</span>${pill("Approved", T.green)}</div><div class="item">${av("gemini", 22)}<span class="s13 f1">Gemini</span>${pill("Approved", T.green)}</div></div>`,
  main: `<div class="rh"><div class="f1"><div class="mono s14 b">src/borrow.ts</div><div class="s12 dim">r1 → r2 · Codex · 09:38</div></div>${seg(["Unified", "Split"], "Unified")}<span class="btn sm">${ic("copy", 14, T.text)}Copy path</span><span class="btn sm">Open in editor</span></div>
<div style="padding:12px 0;overflow:hidden">${dl(38, " ", "export function validateLoan(loan: Loan) {")}${dl(39, "-", "  if (loan.returnDate < loan.borrowDate) {")}${dl(39, "+", "  const borrow = toUtcDay(loan.borrowDate);")}${dl(40, "+", "  const ret = toUtcDay(loan.returnDate);")}${dl(41, "+", "  if (ret < borrow) {")}${dl(42, " ", "    return fail(\"LOAN_RETURN_BEFORE_BORROW\");")}${dl(43, " ", "  }")}
<div class="card" style="margin:8px 60px;padding:12px 14px"><div class="row g8">${av("claude", 22)}<span class="s13 b">Claude Opus</span><span class="s12 dim">on line 41 · r1</span>${pill("Resolved in r2", T.green)}</div><div class="s13 sub" style="margin-top:6px">Borrow date was UTC and return date local. Comparing UTC days fixes it.</div></div>
${dl(44, " ", "  return ok(loan);")}${dl(45, " ", "}")}${dl(46, "+", "")}${dl(47, "+", "function toUtcDay(d: Date) {")}${dl(48, "+", "  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());")}${dl(49, "+", "}")}</div>
<div class="row g10" style="margin-top:auto;padding:14px 22px;border-top:1px solid ${T.line2}"><span class="s13 dim f1">Accepting applies nothing new: Codex already wrote these files. It marks T-014 done.</span><span class="btn o">Ask for changes</span><span class="btn g">Accept T-014</span></div>`, insp: "" });

const act = (icon, t, d, when, c = T.sub) => `<div class="row g12" style="padding:11px 16px;border-top:1px solid ${T.line2}">${icon}<div class="f1"><div class="s13" style="color:${c}">${t}</div><div class="s12 dim" style="margin-top:2px">${d}</div></div><span class="s12 dim">${when}</span></div>`;
const activity = shell({ rail: "chat", side: sidebar({}), main: `<div class="rh"><div class="f1"><div class="s16 b">Activity</div><div class="s12 dim">Everything Walt did, newest first</div></div>${seg(["All", "Needs you", "Agents", "System"], "All")}</div>
<div class="card" style="margin:16px 18px;overflow:hidden">
${act(ic("warn", 20, T.amber), "Claude Opus asked you: default loan period?", "BIBI · Main · answered from the Ce:L island", "09:25", T.text)}
${act(ic("shield", 20, T.amber), "Codex wants to run npm install date-fns-tz", "BIBI · Main · you allowed once", "09:24", T.text)}
${act(av("gemini", 20), "Gemini finished its review of r1", "3 findings · 1 High", "09:24")}
${act(ic("moon", 20, T.faint), "Gemini went to sleep", "15 minutes idle", "09:02")}
${act(ic("key", 20, "#FF6961"), "Gemini needs you to log in again", "Settings · Engines", "Yesterday", T.text)}
${act(ic("db", 20, T.sub), "Daily backup done", "41 MB", "03:00")}
${act(ic("refresh", 20, T.sub), "Walt recovered after a restart", "1 run needed checking · marked failed by you", "Mon")}</div>`, insp: "" });

// ---------------- Indonesian room (W16 strings) ----------------
const ID = [["Roles for T-016 · picked by Walt", "Peran untuk T-016 · dipilih Walt"], ["From the task, the files it touches, and what each persona is good at", "Dari tugasnya, file yang disentuh, dan keahlian tiap persona"], ["Builds", "Membangun"], ["Reviews", "Meninjau"], ["Not needed", "Tidak perlu"],
  ["Small feature that follows the existing loan code. Fast, and enough for this size.", "Fitur kecil yang mengikuti kode pinjaman yang ada. Cepat, dan cukup untuk ukuran ini."], ["Runs the tests and checks the email job against the API.", "Menjalankan tes dan mengecek job email terhadap API."], ["Looks for date and time zone edge cases, like it did on T-014.", "Mencari kasus tepi tanggal dan zona waktu, seperti di T-014."], ["No research in this task. Joins again when one needs it.", "Tidak ada riset di tugas ini. Ikut lagi saat dibutuhkan."],
  ["Start with these roles", "Mulai dengan peran ini"], ["Pick roles myself", "Pilih peran sendiri"], ["Two Claude personas, one room", "Dua persona Claude, satu room"], ["Swap", "Tukar"], ["Waiting for you", "Menunggu kamu"], ["check the roles", "cek perannya"], ["Next: email members 2 days before the return date. Use the 14-day default period (D-004).", "Berikutnya: kirim email ke anggota 2 hari sebelum tanggal kembali. Pakai periode default 14 hari (D-004)."],
  ["r2 looks right. Nothing left from my side on T-014.", "r2 sudah benar. Tidak ada lagi dari sisiku untuk T-014."], ["Message Main, or @mention someone", "Tulis ke Main, atau @sebut seseorang"], ["Roles · Auto (Walt picks per task)", "Peran · Otomatis (Walt memilih per tugas)"], ["Writes: one at a time", "Menulis: satu per satu"], ["Enter to send · Shift+Enter new line", "Enter kirim · Shift+Enter baris baru"],
  ["Personas · roles for", "Persona · peran untuk"], ["picked by Walt", "dipilih Walt"], ["Rooms · BIBI", "Room · BIBI"], ["Roundtable ended", "Roundtable selesai"], ["Opus: schema looks right", "Opus: skema sudah benar"], ["Codex: running npm test…", "Codex: menjalankan npm test…"], ["Ready", "Siap"], ["Asleep", "Tidur"], ["not on T-016", "tidak di T-016"], ["4 personas · 3 engines signed in", "4 persona · 3 engine sudah login"], ["Builder", "Builder"], ["Reviewer", "Reviewer"], ["Free", "Bebas"]];
let roomId = S1["w16-room-roles"].html; for (const [a, b] of ID) roomId = roomId.split(a).join(b);

const isl = (name, w, h, r, e, html) => ({ name, kind: "island", w, h, r, e, html });
export const SCREENS2 = {
  "s01-general": { name: "S01 · Walt · Settings · General", w: W, h: H, html: setGeneral },
  "s02-engines": { name: "S02 · Walt · Settings · Engines", w: W, h: H, html: setEngines },
  "s03-personas": { name: "S03 · Walt · Settings · Personas & templates", w: W, h: H, html: setPersonas },
  "s04-permissions": { name: "S04 · Walt · Settings · Permissions", w: W, h: H, html: setPerms },
  "s05-usage": { name: "S05 · Walt · Settings · Usage & limits", w: W, h: H, html: setUsage },
  "s06-island": { name: "S06 · Walt · Settings · Island (Ce:L)", w: W, h: H, html: setIsland },
  "s07-data": { name: "S07 · Walt · Settings · Data & backup", w: W, h: H, html: setData },
  "s08-about": { name: "S08 · Walt · Settings · About", w: W, h: H, html: setAbout },
  "w17-swap-roles": { name: "W17 · Walt · Change roles for a task", w: W, h: H, html: swap },
  "w18-persona-editor": { name: "W18 · Walt · Edit persona (Claude Sonnet)", w: W, h: H, html: personaEditor },
  "w19-template-editor": { name: "W19 · Walt · Custom template steps", w: W, h: H, html: templateEditor },
  "w20-paused": { name: "W20 · Walt · Room · paused after turn", w: W, h: H, html: paused },
  "w21-end-room": { name: "W21 · Walt · End room", w: W, h: H, html: endRoom },
  "w22-waking": { name: "W22 · Walt · Room · waking and sleeping agents", w: W, h: H, html: waking },
  "w23-quota-move": { name: "W23 · Walt · Room · limit hit, move the review", w: W, h: H, html: quota },
  "w24-budget": { name: "W24 · Walt · Room · turn budget used", w: W, h: H, html: budget },
  "w25-route": { name: "W25 · Walt · Room · who answers (route menu)", w: W, h: H, html: route },
  "w26-accepted": { name: "W26 · Walt · Room · accepted, commit + next task", w: W, h: H, html: accepted },
  "w27-home": { name: "W27 · Walt · Projects (home)", w: W, h: H, html: home },
  "w28-new-room": { name: "W28 · Walt · New room", w: W, h: H, html: newRoom },
  "w29-palette": { name: "W29 · Walt · Command palette (Ctrl K)", w: W, h: H, html: palette },
  "w30-search": { name: "W30 · Walt · Search", w: W, h: H, html: search },
  "w31-diff": { name: "W31 · Walt · Diff viewer", w: W, h: H, html: diffView },
  "w32-activity": { name: "W32 · Walt · Activity", w: W, h: H, html: activity },
  "w33-room-id": { name: "W33 · Walt · Room · peran per tugas (Bahasa Indonesia)", w: W, h: H, html: roomId },
  "w34-home-light": { name: "W34 · Walt · Projects (light)", w: W, h: H, html: homeLight },
};
export const ROWS2 = [
  ["Walt · Settings lengkap (English) · General, Engines, Personas & templates, Permissions, Usage & limits, Island, Data & backup, About", ["s01-general", "s02-engines", "s03-personas", "s04-permissions", "s05-usage", "s06-island", "s07-data", "s08-about"]],
  ["Walt · Role & persona · ganti role, edit persona, template custom", ["w17-swap-roles", "w18-persona-editor", "w19-template-editor"]],
  ["Walt · Alur lain · pause, end room, bangun/tidur, limit habis, budget habis, route, setelah accept", ["w20-paused", "w21-end-room", "w22-waking", "w23-quota-move", "w24-budget", "w25-route", "w26-accepted"]],
  ["Walt · Navigasi · projects, room baru, Ctrl K, search, diff, activity", ["w27-home", "w28-new-room", "w29-palette", "w30-search", "w31-diff", "w32-activity"]],
  ["Walt · Konsistensi · room Bahasa Indonesia, projects tema terang", ["w33-room-id", "w34-home-light"]],
];
