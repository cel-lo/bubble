// Walt screens. Each entry: { name (FigCraft frame name), w, h, kind?: "island", r/e (island radius/ears), html }.
import { T, ENG, ic, av, stack, role, hexA, mention, wordmark, dot, sidebar, roomHeader, workflow, composer, msg, mine, handoff, shell, titlebar, rail } from "./kit.mjs";

const W = 1440, H = 900;
const spin = (c = T.green, s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 14 14" style="display:block;flex:none"><circle cx="7" cy="7" r="5.5" fill="none" stroke="${hexA(c, 0.25)}" stroke-width="2"/><path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/></svg>`;
const sev = (s) => { const c = { High: T.red, Medium: T.amber, Low: T.blue }[s]; return `<span class="role" style="background:${hexA(c, 0.16)};color:${c}">${s}</span>`; };
const pill = (t, c) => `<span class="pill" style="background:${hexA(c, 0.16)};color:${c}">${t}</span>`;
const mono = (t) => `<span class="mono s13">${t}</span>`;
const tabs = (on) => `<div class="tabs">${["Task", "Files", "Context", "Decisions", "Activity"].map((t) => `<span class="tab ${t === on ? "on" : ""}" data-hot="tab:${t}">${t}</span>`).join("")}</div>`;
const insp = (on, body) => `<div class="insp">${tabs(on)}<div class="col" style="padding:16px 18px;overflow:hidden">${body}</div></div>`;
const budget = (used, max = 6) => `<div class="row g4">${Array.from({ length: max }, (_, i) => `<span style="flex:1;height:6px;border-radius:3px;background:${i < used ? T.green : "#3A3A3C"};display:block"></span>`).join("")}</div>`;

// ---------- inspector bodies ----------
const inspTask = () => insp("Task", `
<div class="row g8"><span class="chip mono">T-014</span>${pill("Running", T.green)}</div>
<div class="s16 b" style="margin-top:10px">Borrow date validation</div>
<div class="s13 dim" style="margin-top:4px;line-height:1.5">Reject loans whose return date is earlier than the borrow date, without changing the API contract.</div>
<div class="lbl">Acceptance</div>
${[["Return date cannot precede borrow date", 1], ["Same-day return is allowed", 1], ["Error message shown in the loan form", 0]].map(([t, ok]) => `<div class="row g8 s13" style="padding:4px 0">${ic(ok ? "checkc" : "clock", 16, ok ? T.green : T.dim)}<span class="${ok ? "" : "dim"}">${t}</span></div>`).join("")}
<div class="lbl">Owner and reviewers</div>
<div class="row g8 s13" style="padding:3px 0">${av("codex", 22)}<span>Codex</span>${role("codex", "Builder")}<span class="f1"></span><span class="dim s12">can edit files</span></div>
<div class="row g8 s13" style="padding:3px 0">${av("claude", 22)}<span>Claude Opus</span>${role("claude", "Reviewer")}<span class="f1"></span><span class="dim s12">read-only</span></div>
<div class="row g8 s13" style="padding:3px 0">${av("gemini", 22)}<span>Gemini</span>${role("gemini", "Reviewer")}<span class="f1"></span><span class="dim s12">read-only · by Walt</span></div>
<div class="lbl">Files in packet</div>
<div class="kv"><span class="mono s12">src/borrow.ts</span><span class="dim mono s12">r3 · 7c1e9a</span></div>
<div class="kv"><span class="mono s12">tests/borrow.test.ts</span><span class="dim mono s12">r1 · 02bd44</span></div>
<div class="lbl">Decisions</div>
<div class="row g8 s13">${ic("lock", 15, T.green)}<span><b>D-003</b> Keep the loan API contract</span></div>
<div class="lbl">Budget</div>${budget(1)}
<div class="row sb s12 dim" style="margin-top:6px"><span>1 of 6 turns used</span><span>Only you can add more</span></div>`);

const diffLine = (sign, t) => { const c = sign === "+" ? T.green : sign === "-" ? "#FF6961" : T.dim; const bg = sign === "+" ? hexA(T.green, 0.1) : sign === "-" ? hexA(T.red, 0.1) : "transparent";
  return `<div class="mono" style="font-size:11.5px;line-height:1.75;padding:0 8px;background:${bg};color:${sign ? c : T.sub};white-space:pre">${sign || " "} ${t}</div>`; };
const inspFiles = () => insp("Files", `
<div class="row sb"><span class="s14 b">Artifact · r1</span>${pill("Ready for review", T.blue)}</div>
<div class="s12 dim mono" style="margin-top:4px">manifest 9f02c1 · by Codex · 09:19</div>
<div class="lbl">Changed files</div>
${[["src/borrow.ts", "+18", "−3", "M"], ["tests/borrow.test.ts", "+22", "−0", "A"], ["src/forms/loan.tsx", "+4", "−1", "M"]].map(([f, a, d, k]) => `<div class="kv"><span class="row g8"><span class="chip mono" style="padding:1px 6px">${k}</span><span class="mono s12">${f}</span></span><span class="s12"><span style="color:${T.green}">${a}</span> <span style="color:#FF6961">${d}</span></span></div>`).join("")}
<div class="lbl">src/borrow.ts</div>
<div class="card" style="padding:8px 0;overflow:hidden">
${diffLine("", "export function validateLoan(l: Loan) {")}${diffLine("-", "  if (!l.returnDate) return ok();")}${diffLine("+", "  if (!l.returnDate) return ok();")}${diffLine("+", "  if (isBefore(l.returnDate, l.borrowDate))")}${diffLine("+", "    return fail('RETURN_BEFORE_BORROW');")}${diffLine("", "  return ok();")}${diffLine("", "}")}
</div>
<div class="lbl">Evidence</div>
<div class="row g8 s13">${ic("checkc", 16, T.green)}<span>${mono("npm test")} · 18 passed · exit 0</span></div>
<div class="row g8 s13" style="margin-top:6px">${ic("clock", 16, T.dim)}<span class="dim">Source review: 1 of 2 reviewers done</span></div>`);

const ctxRow = (n, t, tok, note) => `<div style="padding:9px 0;border-bottom:1px solid ${T.line2}"><div class="row sb s13"><span class="row g8"><span class="faint mono s12">${n}</span><span class="b">${t}</span></span><span class="dim s12">${tok}</span></div>${note ? `<div class="s12 dim" style="margin:3px 0 0 22px">${note}</div>` : ""}</div>`;
const inspContext = () => insp("Context", `
<div class="row sb"><span class="s14 b">Packet P-034</span><span class="chip mono">hash 4be1…a90</span></div>
<div class="row g8 s13" style="margin-top:8px"><span class="dim">Sent to</span>${av("gemini", 20)}<span>Gemini</span>${role("gemini", "Reviewer")}<span class="dim">· 09:20</span></div>
<div class="row g8 s12" style="margin-top:8px">${ic("checkc", 15, T.green)}<span class="sub">Context received (acknowledged revision 3)</span></div>
<div class="lbl">What was sent</div>
${ctxRow("1", "Goal and role", "180 tok", "Review r1 of T-014 as an independent reviewer")}
${ctxRow("2", "Confirmed decisions", "90 tok", "D-003 Keep the loan API contract")}
${ctxRow("3", "Task and acceptance", "210 tok", "3 criteria")}
${ctxRow("4", "Your latest instructions", "120 tok", "Through message #42 · “double-check timezones”")}
${ctxRow("5", "Files", "3.9k tok", "src/borrow.ts r3 · 7c1e9a, tests/borrow.test.ts r1 · 02bd44")}
${ctxRow("6", "Room summary", "640 tok", "Summarised from #12–#38 · original kept")}
${ctxRow("7", "Other reviewer's findings", "—", "Hidden until the review round closes")}
<div class="row sb s12" style="margin-top:12px"><span class="dim">Total ≈ 5.1k tokens (estimate)</span><span style="color:${T.blue}">Open raw packet</span></div>
<div class="s12 faint" style="margin-top:10px;line-height:1.5">Written in English for the agents. Replies come back in your chat language.</div>`);

const decision = (id, t, by, st, how) => `<div class="card" style="padding:12px 14px;margin-bottom:10px"><div class="row sb"><span class="row g8"><span class="chip mono">${id}</span>${st}</span></div><div class="s14 b" style="margin-top:8px">${t}</div><div class="s12 dim" style="margin-top:4px">${by}</div>${how ? `<div class="row g6 s12" style="margin-top:8px;color:${T.sub}">${how}</div>` : ""}</div>`;
const inspDecisions = () => insp("Decisions", `
${decision("D-004", "Default loan period is 14 days", "Proposed by Claude Opus · confirmed by you", pill("Confirmed", T.green), `${ic("island", 15, T.cyan)}Answered from the Ce:L island · 09:31`)}
${decision("D-003", "Keep the loan API contract", "Proposed by Codex · confirmed by you · Tue", pill("Confirmed", T.green))}
${decision("D-002", "Store dates as UTC", "Proposed by Gemini · Mon", pill("Superseded by D-003", T.dim))}
<div class="s12 faint" style="line-height:1.5;margin-top:4px">Agents can only propose. A decision counts once you confirm it.</div>`);

// ---------- timelines ----------
const userAsk = mine("09:12", `Add validation so the return date can't be before the borrow date. Keep the API contract as it is (D-003). ${mention("gemini", "Gemini")} please double-check timezones when you review.`);
const tlBuild = `${userAsk}
${handoff("cello", "Builder · Codex", "T-014 Borrow date validation · 2 files · packet P-031")}
${msg("codex", "Builder", "09:12", `<p>Looking at <span class="mono s13">src/borrow.ts</span> and the loan form. I'll add a guard in <span class="mono s13">validateLoan()</span> and a test for same-day returns, so nothing in the API shape changes.</p><p>Tests are running now<span class="cur"></span></p>`,
  `<div class="row g8"><span class="tool">${ic("file", 14, T.sub)}Read 4 files</span><span class="tool">${ic("diff", 14, T.sub)}Edited src/borrow.ts <span style="color:${T.green}">+18</span> <span style="color:#FF6961">−3</span></span><span class="tool">${spin()}Running npm test</span></div>`)}
<div class="ho">${ic("clock", 14, T.faint)}<span>Next: Claude Opus and Gemini review the same revision in parallel</span></div>`;

const changes = (rev = "r1", tests = "18 passed") => `<div class="card" style="padding:12px 14px;margin-top:8px;width:520px"><div class="row sb"><span class="row g8 s13 b">${ic("diff", 16, T.sub)}3 files changed <span style="color:${T.green}">+44</span> <span style="color:#FF6961">−4</span></span><span class="chip mono">${rev}</span></div>
<div class="row g8 s12" style="margin-top:8px">${ic("checkc", 15, T.green)}<span class="sub">${mono("npm test")} · ${tests} · exit 0</span><span class="f1"></span><span style="color:${T.blue}">View diff</span><span class="faint">·</span><span style="color:${T.blue}">Undo</span></div></div>`;
const tlCodexDone = `${userAsk}
${handoff("cello", "Builder · Codex", "T-014 Borrow date validation · packet P-031")}
${msg("codex", "Builder", "09:19", `<p>Done. <span class="mono s13">validateLoan()</span> now rejects a return date before the borrow date and allows same-day returns. The API shape is unchanged.</p>`, changes())}
${handoff("Builder · Codex", "Reviewers · Claude Opus, Gemini", "ready for review · artifact r1 · turn 2 of 6")}`;
const finding = (s, t, w) => `<div style="padding:8px 0;border-top:1px solid ${T.line2}"><div class="row g8">${sev(s)}<span class="s13 b">${t}</span></div><div class="s12 dim mono" style="margin-top:4px">${w}</div></div>`;
const round = (geminiDone = false) => `<div class="card" style="padding:14px;margin:10px 0 0 44px">
<div class="row sb"><span class="row g8 s13 b">${ic("eye", 16, T.sub)}Review round 1 · artifact r1</span><span class="s12 dim">${geminiDone ? "2 of 2 in · round closed" : "1 of 2 in"}</span></div>
<div class="row g12" style="margin-top:12px;align-items:stretch">
<div class="f1" style="background:#1F1F21;border-radius:12px;padding:12px"><div class="row g8">${av("claude", 22)}<span class="s13 b">Claude Opus</span>${pill("Done", T.green)}</div>
${finding("High", "Return date compared in local time", "src/borrow.ts:41 · isBefore() on local Date")}${finding("Low", "Error code name is inconsistent", "RETURN_BEFORE_BORROW vs LOAN_*")}</div>
<div class="f1" style="background:#1F1F21;border-radius:12px;padding:12px"><div class="row g8">${av("gemini", 22)}<span class="s13 b">Gemini</span>${geminiDone ? pill("Done", T.green) : pill("Reviewing", T.cyan)}</div>
${geminiDone ? `${finding("High", "Timezone: borrow date is UTC, return is local", "src/borrow.ts:41 · same issue as Claude Opus")}${finding("Medium", "Missing test for DST change day", "tests/borrow.test.ts")}`
    : `<div class="row g8 s13 sub" style="margin-top:12px">${spin(T.cyan)}Reading tests/borrow.test.ts</div><div class="s12 dim" style="margin-top:8px">Read 6 files · 2 write requests blocked (read-only)</div>`}</div></div>
<div class="row g6 s12 faint" style="margin-top:10px">${ic("lock", 13, T.faint)}Findings stay hidden from the other reviewer until both are done.</div></div>`;

const tlReview = `${tlCodexDone}${round(false)}`;

const approvalCard = `<div class="card" style="padding:14px;margin:10px 0 0 44px;border-color:${hexA(T.amber, 0.5)}">
<div class="row g8">${ic("warn", 17, T.amber)}<span class="s14 b">Codex wants to run a command</span><span class="f1"></span><span class="s12 dim">turn 4 of 6</span></div>
<div class="mono" style="margin-top:10px;background:#141416;border-radius:10px;padding:10px 12px;font-size:13px">npm install date-fns-tz@3</div>
<div class="row g16 s12 dim" style="margin-top:10px"><span class="row g6">${ic("folder", 14)}D:\\Projects\\BIBI</span><span class="row g6">${ic("globe", 14)}Network: npm registry</span><span class="row g6">${ic("file", 14)}Changes package.json</span></div>
<div class="row g8" style="margin-top:12px"><span class="btn g">Allow once</span><span class="btn">Deny</span><span class="btn o">Always allow npm install in this room</span></div></div>`;
const tlNeeds = `${handoff("Review round 1", "Builder · Codex", "2 High, 1 Medium, 1 Low · merged into 3 findings")}
${msg("codex", "Builder", "09:24", `<p>Both reviewers flagged the timezone issue. I'll compare dates in UTC using date-fns-tz and add a DST test. I need one package for that.</p>`)}
${approvalCard}
${msg("claude", "Reviewer", "09:25", `<p>Separate question for cello: when a loan has no return date, what should the default period be? This blocks T-015 (reminders).</p>`)}`;
const needsTray = `<div style="width:100%;max-width:740px;margin:0 auto 10px" class="card">
<div class="row sb" style="padding:10px 14px 6px"><span class="row g8 s13 b">${dot(T.amber)}Needs you · 2</span><span class="s12 dim">Dependent tasks are paused</span></div>
<div class="row g12" style="padding:10px 14px;border-top:1px solid ${T.line}">${av("claude", 26)}<div class="f1"><div class="row g8"><span class="s13 b">Default loan period?</span>${pill("Decision", T.blue)}${pill("Blocking T-015", T.amber)}</div><div class="s12 dim" style="margin-top:2px">From Claude Opus · 09:25</div></div><span class="btn sm">7 days</span><span class="btn sm g">14 days</span><span class="btn sm o">Type answer</span></div>
<div class="row g12" style="padding:10px 14px;border-top:1px solid ${T.line}">${av("codex", 26)}<div class="f1"><div class="row g8"><span class="s13 b">Run npm install date-fns-tz@3</span>${pill("Tool approval", T.amber)}</div><div class="s12 dim" style="margin-top:2px">From Codex · only from this window, not from the island</div></div><span class="btn sm">Review</span></div></div>`;

const deliverable = `<div class="card" style="padding:16px;margin:10px 0 0 44px">
<div class="row sb"><span class="row g10">${ic("checkc", 20, T.green)}<span class="s16 b">Borrow date validation</span><span class="chip mono">r2</span>${pill("Ready", T.green)}</span><span class="s12 dim mono">manifest c47d02</span></div>
<div class="row g12" style="margin-top:14px">
${[["Source review", "Claude Opus", "claude", "r2 · no open findings"], ["Source review", "Gemini", "gemini", "r2 · no open findings"]].map(([k, n, e, s]) => `<div class="f1" style="background:#1F1F21;border-radius:12px;padding:12px"><div class="s12 dim">${k}</div><div class="row g8" style="margin-top:6px">${av(e, 20)}<span class="s13 b">${n}</span>${ic("check", 15, T.green)}</div><div class="s12 dim" style="margin-top:4px">${s}</div></div>`).join("")}
<div class="f1" style="background:#1F1F21;border-radius:12px;padding:12px"><div class="s12 dim">Tests</div><div class="row g8 s13 b" style="margin-top:6px">${ic("term", 16, T.sub)}19 passed${ic("check", 15, T.green)}</div><div class="s12 dim mono" style="margin-top:4px">npm test · exit 0 · 09:41</div></div>
<div class="f1" style="background:#1F1F21;border-radius:12px;padding:12px;border:1px dashed #48484A"><div class="s12 dim">Your acceptance</div><div class="s13 b" style="margin-top:6px">Waiting for you</div><div class="s12 dim" style="margin-top:4px">Not implied by reviews</div></div></div>
<div class="row g16 s12" style="margin-top:12px"><span class="row g6">${ic("check", 14, T.green)}<span class="sub">2 findings fixed</span></span><span class="row g6">${ic("x", 14, T.dim)}<span class="sub">1 dismissed by you (naming)</span></span><span class="row g6">${ic("clock", 14, T.dim)}<span class="dim">Reviews of r1 are stale</span></span></div>
<div class="row g8" style="margin-top:14px"><span class="btn g">${ic("check", 15, "#04170B", 2.2)}Accept</span><span class="btn">Continue with a new budget</span><span class="btn o">${ic("diff", 15, T.text)}Open diff</span><span class="btn o">${ic("branch", 15, T.text)}Branch</span></div></div>`;
const tlDone = `${msg("codex", "Builder", "09:38", `<p>Fixed: dates are compared in UTC, the error code is now <span class="mono s13">LOAN_RETURN_BEFORE_BORROW</span>, and there is a DST test.</p>`, changes("r2", "19 passed"))}
${handoff("Builder · Codex", "Reviewers · Claude Opus, Gemini", "re-review · artifact r2 · turn 5 of 6")}
${msg("claude", "Reviewer", "09:40", `<p>r2 looks right. The UTC comparison fixes the timezone issue and the DST test covers the edge case.</p>`)}
${msg("gemini", "Reviewer", "09:40", `<p>Agreed, no remaining findings on r2. I checked the form message too.</p>`)}
${deliverable}`;

// ---------- room screens ----------
const room = ({ tl, wf, insp: ins = "", comp = composer({ busy: true }), side = sidebar({}), light = false, header }) =>
  shell({ light, side, main: (header || roomHeader({ inspector: !!ins })) + wf + `<div class="tl"><div class="tli">${tl}</div></div>` + comp, insp: ins });

const mentionMenu = `<div class="card" style="width:340px;margin:0 0 8px 40px;padding:6px;background:#2A2A2C">
<div class="s12 dim" style="padding:6px 8px">Mention · only the mentioned agent answers</div>
${[["codex", "Builder", "Ready", T.blue, 1], ["claude", "Reviewer", "Ready", T.blue, 0], ["gemini", "Reviewer", "Asleep · wakes in a few seconds", T.faint, 0], ["sonnet", "Free", "Asleep · wakes in a few seconds", T.faint, 0]].map(([e, r, s, c, on]) => `<div class="item" style="padding:7px 8px;${on ? "background:#3A3A3C" : ""}">${av(e, 26)}<div class="f1"><div class="row g8"><span class="s13 b">${ENG[e].name}</span>${role(e, r)}</div></div><span class="row g6 s12 dim">${dot(c, 7)}${s}</span></div>`).join("")}
<div class="item" style="padding:7px 8px">${stack(["codex", "claude", "sonnet", "gemini"], 20)}<span class="s13 b">@everyone</span><span class="f1"></span><span class="s12 dim">answers one by one</span></div></div>`;
const idleCenter = `<div class="col" style="align-items:center;text-align:center;padding-top:120px">${stack(["codex", "claude", "sonnet", "gemini"], 52)}
<div class="s20 b" style="margin-top:18px">Main is ready</div>
<div class="s14 dim" style="margin-top:8px;max-width:440px;line-height:1.55">Tell the team what to build. Mention one agent to talk to just them, or let the Triad flow pass the work along.</div>
<div class="row g8" style="margin-top:20px"><span class="chip">${ic("sparkle", 14, T.sub)}Plan the next feature</span><span class="chip">${ic("eye", 14, T.sub)}Review my last commit</span><span class="chip">${ic("users", 14, T.sub)}Roundtable an idea</span></div></div>`;

// ---------- setup screens ----------
const setup = (step, body, footer) => {
  const steps = ["Language", "Engines", "Project", "Team"];
  return `<div class="win">${titlebar("", true)}<div class="bd" style="flex-direction:column;align-items:center;padding:34px 0 0">
<div class="row g20">${steps.map((s, i) => `<div class="row g8 s13 ${i === step ? "b" : i < step ? "sub" : "dim"}"><span style="width:22px;height:22px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;${i < step ? `background:${T.green};color:#04170B` : i === step ? `background:#fff;color:#000` : `background:#2C2C2E;color:${T.dim}`}">${i < step ? "✓" : i + 1}</span>${s}</div>`).join(`<span style="width:40px;height:1px;background:#3A3A3C;display:block"></span>`)}</div>
<div style="width:1040px;flex:1;padding-top:34px" class="col">${body}</div>
<div class="row sb" style="width:1040px;padding:18px 0 28px;border-top:1px solid ${T.line2}">${footer}</div></div></div>`;
};
const capChip = (t, ok = true) => `<span class="chip" style="${ok ? "" : "opacity:.45"}">${ic(ok ? "check" : "x", 13, ok ? T.green : T.dim, 2)}${t}</span>`;
const engineCard = (e, state, color, line, body) => `<div class="card f1" style="padding:18px;display:flex;flex-direction:column;gap:12px">
<div class="row g12">${av(e, 44)}<div class="f1"><div class="s16 b">${ENG[e].name}</div><div class="s12 dim" style="margin-top:2px">${line}</div></div>${pill(state, color)}</div>${body}</div>`;

const settingsRow = (t, d, ctl) => `<div class="row g16" style="padding:12px 16px;border-top:1px solid ${T.line}"><div class="f1"><div class="s14">${t}</div>${d ? `<div class="s12 dim" style="margin-top:2px">${d}</div>` : ""}</div>${ctl}</div>`;
const select = (t) => `<span class="row g8 s13" style="background:#363638;border-radius:8px;padding:5px 10px">${t}${ic("chevd", 14, T.sub)}</span>`;
const group = (title, rows) => `<div class="lbl" style="margin:22px 0 8px 4px">${title}</div><div style="background:#28282A;border-radius:10px;overflow:hidden">${rows.join("").replace('border-top:1px solid ' + T.line, "border-top:none")}</div>`;

// ---------- island content ----------
const EQ = `<div class="row" style="position:absolute;right:16px;top:14px;gap:2px;align-items:center">${[6, 11, 8, 13, 7].map((h) => `<span style="width:2.4px;height:${h}px;border-radius:2px;background:#fff;display:block"></span>`).join("")}</div>`;
const ring = (p, c = "#33e07a", s = 15) => { const C = 2 * Math.PI * 6.15; return `<svg width="${s}" height="${s}" viewBox="0 0 15 15" style="display:block;flex:none"><circle cx="7.5" cy="7.5" r="6.15" fill="none" stroke="${hexA(c, 0.28)}" stroke-width="2.7"/><circle cx="7.5" cy="7.5" r="6.15" fill="none" stroke="${c}" stroke-width="2.7" stroke-dasharray="${(C * p).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 7.5 7.5)" stroke-linecap="round"/></svg>`; };
const head = (title, p = 1 / 6) => `<div class="row" style="position:absolute;left:15px;top:9px;font-size:15px;font-weight:600">${title}</div>
<div class="row g6" style="position:absolute;left:146px;top:10px;font-size:13px">${ring(p)}<span>Thu 15 Oct 2026</span><span class="b">09:14</span></div>${EQ}`;
const arrows = `<div data-hot="Previous page" style="position:absolute;left:13.5px;top:61.5px;width:17px;height:17px;border-radius:9px;background:rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center">${ic("chevl", 11, "#fff", 2.6)}</div>
<div data-hot="Next page" style="position:absolute;left:386.5px;top:61.5px;width:17px;height:17px;border-radius:9px;background:rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center">${ic("chevr", 11, "#fff", 2.6)}</div>`;
const dots = (n = 9, on = 8) => { const items = Array.from({ length: n }, (_, i) => i === on ? `<span style="width:15px;height:3.6px;border-radius:2px;background:#fff;display:block"></span>` : `<span style="width:3.6px;height:3.6px;border-radius:2px;background:rgba(255,255,255,.45);display:block"></span>`);
  return `<div class="row" style="position:absolute;left:0;right:0;top:131px;justify-content:center;gap:4.9px"><div class="row" data-hot="Page dots · hover" style="gap:4.9px;padding:4px 10px">${items.join("")}</div></div>`; };
const iconBtn = (n, c = "#fff", bg = "rgba(255,255,255,.14)") => `<span style="width:28px;height:28px;border-radius:14px;background:${bg};display:flex;align-items:center;justify-content:center">${ic(n, 14, c, 2.2)}</span>`;
const stepBar = (i, labels = ["Build", "Review", "Fix"]) => `<div class="row g6">${labels.map((l, k) => `<div class="f1 col g4"><span style="height:4px;border-radius:2px;display:block;background:${k < i ? T.green : k === i ? T.green : "rgba(255,255,255,.18)"};${k === i ? "opacity:.55" : ""}"></span><span style="font-size:10.5px;color:${k <= i ? "#fff" : "rgba(255,255,255,.45)"}">${l}</span></div>`).join("")}</div>`;
const peekTxt = (t, s) => `<div class="f1 col" style="min-width:0"><div style="font-size:14px;font-weight:600;line-height:1.2">${t}</div><div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:3px">${s}</div></div>`;
const peek = (inner, pad = "0 18px") => `<div class="row g10" style="position:absolute;inset:0;padding:${pad}">${inner}</div>`;
const isl = (name, w, h, r, e, html) => ({ name, kind: "island", w, h, r, e, html });

export const SCREENS = {
  // ----- setup -----
  "w01-welcome": { name: "W01 · Walt · Welcome + language", w: W, h: H, html: setup(0, `
<div class="col" style="align-items:center;text-align:center;padding-top:40px">${wordmark(44)}
<div class="s24 b" style="margin-top:26px">One project. Three agents. You lead.</div>
<div class="s15 dim" style="margin-top:10px;max-width:560px;line-height:1.55">Walt puts Codex, Claude (even two Claude models) and Gemini in one room with you. They hand work to each other, review each other's changes, and you can follow it all from the Ce:L island.</div>
<div class="row g20" style="margin-top:34px">${["codex", "claude", "gemini"].map((e) => `<div class="col g8" style="align-items:center">${av(e, 64)}<span class="s13 sub">${ENG[e].name}</span></div>`).join("")}</div>
<div class="lbl" style="margin-top:44px">Language · Bahasa</div>
<div class="seg" style="padding:3px"><span class="on" style="padding:7px 18px;font-size:14px">English</span><span style="padding:7px 18px;font-size:14px">Bahasa Indonesia</span><span style="padding:7px 18px;font-size:14px">Follow Windows</span></div>
<div class="s12 dim" style="margin-top:10px">You can change this later in Settings.</div></div>`,
    `<span class="s13 dim">No Walt account needed. Everything stays on this laptop.</span><span class="btn g">Continue${ic("arrow", 15, "#04170B", 2.2)}</span>`) },

  "w02-engines": { name: "W02 · Walt · Engines (doctor)", w: W, h: H, html: setup(1, `
<div class="s24 b">Connect your engines</div>
<div class="s14 dim" style="margin-top:6px">Walt runs the official CLIs you are already signed in to. No API keys, and Walt never sees your password.</div>
<div class="row g16" style="margin-top:26px;align-items:stretch">
${engineCard("codex", "Ready", T.green, "codex · signed in with ChatGPT", `<div class="row g6" style="flex-wrap:wrap">${capChip("Stream")}${capChip("Resume")}${capChip("Steer")}${capChip("Approvals")}${capChip("Interrupt")}</div><div class="f1"></div><div class="row sb s12 dim"><span>Checked just now</span><span class="row g6" style="color:${T.blue}">${ic("refresh", 14, T.blue)}Check again</span></div>`)}
${engineCard("claude", "Login needed", T.amber, "claude · not signed in", `<div class="s13 sub" style="line-height:1.5">Sign in once in a terminal. Walt will use the same login afterwards.</div><div class="mono" style="background:#141416;border-radius:10px;padding:10px 12px;font-size:13px">claude  →  /login</div><div class="f1"></div><span class="btn g" style="justify-content:center">${ic("term", 15, "#04170B")}Open terminal to log in</span>`)}
${engineCard("gemini", "Not installed", T.dim, "gemini · not found on PATH", `<div class="s13 sub" style="line-height:1.5">Install the Gemini CLI, then run <span class="mono">gemini</span> and sign in with Google.</div><div class="row sb mono" style="background:#141416;border-radius:10px;padding:10px 12px;font-size:13px">npm install -g @google/gemini-cli${ic("copy", 15, T.dim)}</div><div class="row g6" style="flex-wrap:wrap">${capChip("Stream", false)}${capChip("Read-only (enforced by Walt)", false)}</div><div class="f1"></div><span class="btn" style="justify-content:center">${ic("refresh", 15, T.text)}I installed it</span>`)}
</div>
<div class="row g10 s13" style="margin-top:22px;padding:12px 14px;background:#202022;border-radius:12px">${ic("shield", 17, T.green)}<span class="sub">API key variables are removed before Walt starts an engine, so your subscription is always the one used.</span></div>`,
    `<span class="btn o">${ic("back", 15, T.text)}Back</span><div class="row g12"><span class="s13 dim">1 of 3 ready · you can continue with at least one</span><span class="btn g">Continue${ic("arrow", 15, "#04170B", 2.2)}</span></div>`) },

  "w03-project": { name: "W03 · Walt · New project", w: W, h: H, html: setup(2, `
<div class="row g20" style="align-items:flex-start">
<div class="f1 col g16">
<div class="s24 b">New project</div>
<div><div class="s13 dim" style="margin-bottom:6px">Name</div><div class="card s15" style="padding:11px 14px">BIBI<span class="cur"></span></div></div>
<div><div class="s13 dim" style="margin-bottom:6px">Folder</div>
<div class="card" style="padding:12px 14px;border-color:${T.green}"><div class="row g10">${dot(T.green, 10)}<span class="s14 b">Use an existing folder</span><span class="f1"></span><span class="btn sm">Choose…</span></div><div class="row g8 mono s13 sub" style="margin:8px 0 0 20px">${ic("folder", 15, T.sub)}D:\\Projects\\BIBI</div><div class="row g6 s12" style="margin:8px 0 0 20px;color:${T.green}">${ic("branch", 14, T.green)}Git repository found · file branches can use worktrees</div></div>
<div class="card" style="padding:12px 14px;margin-top:8px"><div class="row g10"><span style="width:10px;height:10px;border-radius:5px;border:1.5px solid ${T.faint};display:block"></span><span class="s14">Let Walt manage a new folder</span></div></div></div>
<div><div class="s13 dim" style="margin-bottom:6px">Goal</div><div class="card s14" style="padding:12px 14px;line-height:1.55;min-height:84px">A small web app for the campus library: members borrow books, see due dates and get reminders before the return date.</div></div>
<div><div class="s13 dim" style="margin-bottom:6px">Constraints</div><div class="row g8" style="flex-wrap:wrap"><span class="chip">${ic("lock", 13, T.sub)}Keep the loan API contract</span><span class="chip">${ic("lock", 13, T.sub)}Ask before adding dependencies</span><span class="chip" style="color:${T.blue}">${ic("plus", 13, T.blue)}Add constraint</span></div></div></div>
<div class="card" style="width:360px;padding:18px;margin-top:52px"><div class="s14 b">What Walt saves</div>
${[["file", "Project brief r1", "goal, constraints, folder"], ["shield", "One writer at a time", "agents never edit this folder together"], ["db", "History on this laptop", "%APPDATA%\\Walt · nothing in the cloud"], ["eye", "Your folder is not moved", "Walt only reads and edits inside it"]].map(([i, t, d]) => `<div class="row g10" style="margin-top:14px;align-items:flex-start">${ic(i, 17, T.sub)}<div><div class="s13 b">${t}</div><div class="s12 dim" style="margin-top:2px">${d}</div></div></div>`).join("")}</div></div>`,
    `<span class="btn o">${ic("back", 15, T.text)}Back</span><span class="btn g">Continue${ic("arrow", 15, "#04170B", 2.2)}</span>`) },

  "w04-team": { name: "W04 · Walt · Team template + personas", w: W, h: H, html: setup(3, `
<div class="s24 b">How should the team work?</div>
<div class="row g12" style="margin-top:20px">
${[["Build & Review", "1 builder, 1 reviewer", "4 turns", 0, "diff"], ["Triad", "1 builder, 2 reviewers in parallel", "6 turns", 1, "users"], ["Roundtable", "Everyone talks, no file edits", "3 turns", 0, "chat"], ["Research", "Find, write, check", "6 turns", 0, "globe"], ["Custom", "Pick your own steps", "you set it", 0, "gear"]].map(([t, d, b, on, i]) => `<div class="card f1" style="padding:14px;${on ? `border-color:${T.green};background:#1E2A22` : ""}">${ic(i, 20, on ? T.green : T.sub)}<div class="s14 b" style="margin-top:10px">${t}</div><div class="s12 dim" style="margin-top:4px;line-height:1.45;min-height:34px">${d}</div><div class="s12" style="margin-top:8px;color:${on ? T.green : T.sub}">${b}</div></div>`).join("")}</div>
<div class="row sb" style="margin-top:22px"><div class="lbl" style="margin:0">Personas in this room</div><span class="chip" style="color:${T.blue}">${ic("plus", 13, T.blue)}Add persona · the same engine can join twice</span></div>
<div class="card" style="overflow:hidden;margin-top:8px">
<div class="row s12 dim" style="padding:9px 16px;border-bottom:1px solid ${T.line}"><span style="width:230px">Persona</span><span style="width:170px">Engine</span><span style="width:150px">Model</span><span class="f1">Good at (Walt uses this to pick roles)</span></div>
${[["codex", ["Code changes", "Tests", "Refactors"]], ["claude", ["Planning", "Hard reviews", "Architecture"]], ["sonnet", ["Quick features", "Docs", "UI copy"]], ["gemini", ["Research", "Second opinion", "Long files"]]].map(([e, tags]) => `<div class="row" style="padding:9px 16px;border-top:1px solid ${T.line2}"><span class="row g10" style="width:230px">${av(e, 30)}<span class="s14 b">${ENG[e].name}</span></span><span style="width:170px">${select(ENG[e].engine)}</span><span style="width:150px">${select(ENG[e].model)}</span><span class="f1 row g6">${tags.map((t) => `<span class="chip" style="font-size:12px;padding:3px 9px">${t}</span>`).join("")}</span></div>`).join("")}</div>
<div class="lbl" style="margin-top:20px">Who builds and who reviews?</div>
<div class="row g12">
<div class="card f1" style="padding:14px 16px;border-color:${T.green};background:#1E2A22"><div class="row sb"><span class="s14 b row g8">${ic("sparkle", 16, T.green)}Auto · Walt picks per task</span>${ic("check", 16, T.green)}</div><div class="s12 dim" style="margin-top:6px;line-height:1.5">Walt reads each task and picks the builder and reviewers from what every persona is good at. You see the pick before it starts and can swap anyone.</div></div>
<div class="card f1" style="padding:14px 16px"><div class="s14 b row g8">${ic("lock", 16, T.sub)}Fixed roles</div><div class="s12 dim" style="margin-top:6px;line-height:1.5">The same builder and reviewers for every task in this room, until you change them.</div></div></div>
<div class="row g8 s12 dim" style="margin-top:12px">${ic("shield", 14)}Only the builder of a task can edit files. Reviewers are read-only, whoever they are.</div>`,
    `<span class="btn o">${ic("back", 15, T.text)}Back</span><div class="row g12"><span class="s13 dim">Budget: 6 turns per exchange · only you can add more</span><span class="btn g">Create room</span></div>`) },

  // ----- room -----
  "w05-room-idle": { name: "W05 · Walt · Room · ready + mention", w: W, h: H, html: room({
    tl: idleCenter, wf: workflow({ stepIdx: -1, status: "Nothing running", turn: "0 of 6", controls: false }),
    side: sidebar({ personas: [["codex", "Builder", "warm", "prewarmed"], ["claude", "Reviewer", "warm", "prewarmed"], ["gemini", "Reviewer", "cold", "wakes on its turn"]] }),
    comp: composer({ text: `Can you check the loan form for ${mention("codex", "")}`, route: "Template flow · Triad", extra: mentionMenu }) }) },

  "w06-room-build": { name: "W06 · Walt · Room · Codex building", w: W, h: H, html: room({ tl: tlBuild, wf: workflow({ status: `<b style="color:${ENG.codex.color}">Codex</b> is building`, turn: "1 of 6" }), insp: inspTask() }) },

  "w07-room-review": { name: "W07 · Walt · Room · Triad review round", w: W, h: H, html: room({ tl: tlReview, wf: workflow({ stepIdx: 1, status: `Reviewing · 1 of 2 done`, turn: "3 of 6" }), insp: inspFiles(),
    side: sidebar({ personas: [["codex", "Builder", "warm", "waits for findings"], ["claude", "Reviewer", "warm", "review sent"], ["gemini", "Reviewer", "busy", "reviewing r1"]] }) }) },

  "w08-room-needs-you": { name: "W08 · Walt · Room · Needs you + tool approval", w: W, h: H, html: room({ tl: tlNeeds, wf: workflow({ stepIdx: 2, status: `<b style="color:${T.amber}">Waiting for you</b> · 2 items`, turn: "4 of 6" }),
    comp: composer({ busy: true, extra: needsTray }), side: sidebar({ personas: [["codex", "Builder", "wait", "needs approval"], ["claude", "Reviewer", "wait", "asked you"], ["gemini", "Reviewer", "warm", "idle"]] }) }) },

  "w09-room-done": { name: "W09 · Walt · Room · Done + deliverable", w: W, h: H, html: room({ tl: tlDone, wf: workflow({ stepIdx: 3, done: true, steps: ["Build", "Review", "Fix", "Re-review"], status: `<b style="color:${T.green}">Finished</b> · ready for your acceptance`, turn: "5 of 6", controls: false }), insp: inspDecisions(),
    side: sidebar({ rooms: [["main", "Main", ["codex", "claude", "gemini"], "Ready for your acceptance", "now"], ["db", "Database", ["codex", "claude"], "Opus: schema looks right", "Fri"], ["copy", "Landing copy", ["claude", "gemini"], "Roundtable ended", "Thu"]], personas: [["codex", "Builder", "warm", "idle"], ["claude", "Reviewer", "warm", "idle"], ["gemini", "Reviewer", "warm", "sleeps in 14 min"]] }) }) },

  "w10-room-context": { name: "W10 · Walt · Inspector · context packet", w: W, h: H, html: room({ tl: tlReview, wf: workflow({ stepIdx: 1, status: `<b style="color:${ENG.gemini.color}">Gemini</b> reviewing`, turn: "3 of 6" }), insp: inspContext() }) },

  "w16-room-roles": { name: "W16 · Walt · Room · new task, Walt picks the roles", w: W, h: H, html: room({
    tl: `${msg("claude", "Reviewer", "09:40", `<p>r2 looks right. Nothing left from my side on T-014.</p>`)}
${mine("09:44", `Next: email members 2 days before the return date. Use the 14-day default period (D-004).`)}
<div class="card" style="padding:16px 18px;margin:12px 0 0 44px;width:640px">
<div class="row sb"><span class="row g8 s15 b">${ic("sparkle", 17, T.green)}Roles for T-016 · picked by Walt</span><span class="pill" style="background:${hexA(T.green, 0.16)};color:${T.green}">Auto</span></div>
<div class="s12 dim" style="margin-top:4px">From the task, the files it touches, and what each persona is good at</div>
${[["Builds", "sonnet", "Small feature that follows the existing loan code. Fast, and enough for this size."], ["Reviews", "codex", "Runs the tests and checks the email job against the API."], ["Reviews", "claude", "Looks for date and time zone edge cases, like it did on T-014."], ["Not needed", "gemini", "No research in this task. Joins again when one needs it."]].map(([r, e, why]) => `<div class="row g12" style="padding:10px 0;border-top:1px solid ${T.line2};margin-top:8px;align-items:flex-start;${r === "Not needed" ? "opacity:.55" : ""}"><span class="s12 dim" style="width:76px;padding-top:8px">${r}</span>${av(e, 30)}<div class="f1"><div class="s14 b" style="color:${ENG[e].color}">${ENG[e].name} <span class="s12 dim" style="font-weight:400">· ${ENG[e].model}</span></div><div class="s12 dim" style="margin-top:3px;line-height:1.45">${why}</div></div><span class="btn sm">${ic("users", 13, T.text)}Swap</span></div>`).join("")}
<div class="row g10" style="margin-top:12px"><span class="btn g">Start with these roles</span><span class="btn o">Pick roles myself</span><span class="f1"></span><span class="s12 dim">Two Claude personas, one room</span></div></div>`,
    wf: workflow({ mode: "Build & Review", stepIdx: -1, steps: ["Build", "Review", "Fix"], status: `<b style="color:${T.amber}">Waiting for you</b> · check the roles`, turn: "0 of 4", controls: false }),
    side: sidebar({ task: "T-016", personas: [["sonnet", "Builder", "warm", "picked by Walt"], ["codex", "Reviewer", "warm", "picked by Walt"], ["claude", "Reviewer", "warm", "picked by Walt"], ["gemini", "Free", "cold", "not on T-016"]] }),
    comp: composer({ route: "Roles · Auto (Walt picks per task)" }) }) },

  "w11-tasks": { name: "W11 · Walt · Task board", w: W, h: H, html: shell({ rail: "tasks", side: sidebar({}), main: `
<div class="rh"><div class="rtile">${ic("tasks", 18, T.sub)}</div><div class="f1"><div class="s16 b">Tasks · BIBI</div><div class="s12 dim" style="margin-top:2px">Roles change per task · Walt picks, you can swap</div></div><span class="btn sm">${ic("plus", 14, T.text)}New task</span></div>
<div class="row g10" style="padding:16px;align-items:flex-start;flex:1;overflow:hidden">
${[["Planned", [["T-017", "Export loans as CSV", "sonnet", ["claude"], ["Walt's pick"]]]],
    ["Ready", [["T-016", "Loan reminder emails", "sonnet", ["codex"], ["depends on T-015"]]]],
    ["Running", [["T-014", "Borrow date validation", "codex", ["claude", "gemini"], ["turn 1 of 6"]]]],
    ["Blocked", [["T-015", "Default loan period", "claude", ["gemini"], ["waiting for your decision"]]]],
    ["Done", [["T-012", "Book search", "gemini", ["codex"], ["tests 31/31"]], ["T-011", "Member login", "claude", ["codex", "sonnet"], ["accepted"]]]]].map(([c, cards]) => `
<div class="col g8 f1"><div class="row sb s13 b" style="padding:0 4px 4px">${c}<span class="dim">${cards.length}</span></div>
${cards.map(([id, t, e, rv, ev]) => `<div class="card" style="padding:12px"><div class="row sb"><span class="mono s12 dim">${id}</span>${e ? av(e, 20) : ""}</div><div class="s13 b" style="margin-top:6px;line-height:1.35">${t}</div><div class="s12" style="margin-top:8px;line-height:1.6"><div class="row g6"><span class="dim" style="width:52px">Builds</span><span style="color:${ENG[e].color}">${ENG[e].name}</span></div><div class="row g6"><span class="dim" style="width:52px">Reviews</span><span>${rv.map((x) => `<span style="color:${ENG[x].color}">${ENG[x].name.replace("Claude ", "")}</span>`).join(", ")}</span></div></div><div class="row g6" style="margin-top:8px;flex-wrap:wrap">${ev.map((x) => `<span class="chip" style="font-size:11px;padding:2px 7px">${x}</span>`).join("")}</div></div>`).join("")}</div>`).join("")}</div>`, insp: "" }) },

  "w12-incident": { name: "W12 · Walt · Room · login needed + usage limit", w: W, h: H, html: room({
    tl: `${handoff("Builder · Codex", "Reviewers · Claude Opus, Gemini", "ready for review · artifact r1")}
${msg("claude", "Reviewer", "10:02", `<p>Starting the review of r1.</p>`)}
<div class="card" style="padding:14px;margin:10px 0 0 44px;border-color:${hexA(T.amber, 0.5)}"><div class="row g10">${ic("clock", 18, T.amber)}<span class="s14 b">Claude Opus reached its usage limit</span><span class="f1"></span><span class="s12 dim">reported by the claude CLI</span></div>
<div class="s13 sub" style="margin:8px 0 0 28px;line-height:1.5">The review stopped before any finding was sent. Your plan resets at 14:00. Nothing was written to your files.</div>
<div class="row g8" style="margin:12px 0 0 28px"><span class="btn">Wait and resume at 14:00</span><span class="btn o">Give this review to another persona</span></div></div>
<div class="card" style="padding:14px;margin:12px 0 0 44px;border-color:${hexA(T.red, 0.5)}"><div class="row g10">${ic("key", 18, "#FF6961")}<span class="s14 b">Gemini needs you to log in again</span><span class="f1"></span><span class="s12 dim">auth_required</span></div>
<div class="s13 sub" style="margin:8px 0 0 28px;line-height:1.5">The Google sign-in of the Gemini CLI expired. Walt never stores your password, so you sign in yourself and Walt picks it up.</div>
<div class="row g8" style="margin:12px 0 0 28px"><span class="btn g">${ic("term", 15, "#04170B")}Open terminal to log in</span><span class="btn dis">Retry (after login)</span></div></div>`,
    wf: workflow({ stepIdx: 1, status: `<b style="color:${T.amber}">Paused</b> · both reviewers can't continue`, turn: "2 of 6", controls: false }),
    side: sidebar({ personas: [["codex", "Builder", "warm", "idle"], ["claude", "Reviewer", "wait", "limit until 14:00"], ["gemini", "Reviewer", "wait", "login needed"]] }) }) },

  "w13-recovery": { name: "W13 · Walt · Recovery Center", w: W, h: H, html: shell({ side: "", main: `
<div class="col" style="width:880px;margin:0 auto;padding:36px 0">
<div class="row g12">${ic("refresh", 26, T.amber)}<div class="s24 b">Recovery</div></div>
<div class="s14 dim" style="margin-top:8px;line-height:1.55">Walt closed unexpectedly yesterday at 21:04. Nothing was re-run on its own. Check the items below and choose what to do.</div>
<div class="card" style="padding:18px;margin-top:24px;border-color:${hexA(T.amber, 0.5)}">
<div class="row g10">${av("codex", 30)}<div class="f1"><div class="row g8"><span class="s15 b">Codex · T-016 Loan reminder emails</span>${pill("Needs checking", T.amber)}</div><div class="s12 dim" style="margin-top:2px">BIBI · Main · was running a command when Walt stopped</div></div></div>
<div class="row g20" style="margin-top:14px">
<div class="f1" style="background:#1F1F21;border-radius:12px;padding:12px"><div class="s12 dim">Last thing Walt saw</div><div class="s13 mono" style="margin-top:6px">Edited src/reminder.ts · 21:03:48</div><div class="s13 mono" style="margin-top:4px">Started npm run migrate · 21:03:55</div></div>
<div class="f1" style="background:#1F1F21;border-radius:12px;padding:12px"><div class="s12 dim">Changed since the snapshot</div><div class="s13 mono" style="margin-top:6px">src/reminder.ts <span style="color:${T.green}">+31</span></div><div class="s13 mono" style="margin-top:4px">db/migrations/007.sql <span style="color:${T.blue}">new</span></div></div></div>
<div class="row g8" style="margin-top:14px"><span class="btn g">${ic("eye", 15, "#04170B")}Inspect changes</span><span class="btn">Mark as failed</span><span class="btn">Retry as read-only check</span><span class="btn dis">Run again</span><span class="s12 dim">Run again unlocks after you inspect: the migration may already have run.</span></div>
<div class="row g8 s12 dim" style="margin-top:12px">${ic("lock", 14)}The write lease on D:\\Projects\\BIBI is held until you decide.</div></div>
<div class="card" style="padding:16px 18px;margin-top:14px"><div class="row g10">${av("claude", 30)}<div class="f1"><div class="row g8"><span class="s15 b">Claude Opus · review of T-014 r2</span>${pill("Saved", T.green)}</div><div class="s12 dim" style="margin-top:2px">The review finished and was saved. The handoff to Codex was not sent yet.</div></div><span class="btn">Send handoff</span></div></div>
<div class="card" style="padding:16px 18px;margin-top:14px"><div class="row g10">${ic("checkc", 22, T.green)}<div class="f1"><div class="s15 b">Everything else is fine</div><div class="s12 dim" style="margin-top:2px">3 rooms, 214 messages and 9 artifacts checked · database OK</div></div></div></div></div>` }) },

  "w14-settings-id": { name: "W14 · Walt · Pengaturan (Bahasa Indonesia)", w: W, h: H, html: shell({ rail: "settings", side: `<div class="side" style="gap:2px">
<div class="s20 b" style="padding:4px 8px 12px">Pengaturan</div>
${[["gear", "Umum", 1], ["bolt", "Engine", 0], ["users", "Persona & template", 0], ["island", "Island Ce:L", 0], ["shield", "Izin", 0], ["db", "Data & backup", 0], ["sparkle", "Tentang Walt", 0]].map(([i, t, on]) => `<div class="item ${on ? "on" : ""}" style="padding:7px 8px">${ic(i, 17, on ? T.text : T.dim)}<span class="s14">${t}</span></div>`).join("")}</div>`, main: `
<div class="col" style="width:720px;margin:0 auto;padding:26px 0;overflow:hidden">
<div class="s20 b">Umum</div>
${group("Tampilan", [settingsRow("Bahasa", "Bahasa antarmuka. Agent membalas sesuai bahasa chat kamu.", `<div class="seg"><span data-hot="seg:English">English</span><span class="on">Indonesia</span><span>Ikuti Windows</span></div>`), settingsRow("Tema", "", `<div class="seg"><span class="on">Gelap</span><span data-hot="seg:Terang">Terang</span><span>Sistem</span></div>`)])}
${group("Saat Windows dan jendela", [settingsRow("Mulai bersama Windows", "Walt berjalan diam di tray supaya island Ce:L selalu tersambung.", '<span class="tog"></span>'), settingsRow("Tombol tutup", "", select("Sembunyikan ke tray jika ada agent bekerja"))])}
${group("Agent", [settingsRow("Biarkan agent tetap siap selama", "Setelah itu prosesnya tidur dan bangun lagi beberapa detik saat dipanggil.", select("15 menit")), settingsRow("Maksimal agent siap", "", select("6")), settingsRow("Siapkan agent saat aku mulai mengetik", "", '<span class="tog"></span>')])}
${group("Island Ce:L", [settingsRow(`<span class="row g8">${dot(T.green)}Tersambung ke Ce:L</span>`, "Lewat API lokal 127.0.0.1 · token baru setiap Walt dibuka", '<span class="btn sm">Putuskan</span>'), settingsRow("Tampilkan peek saat handoff", "", '<span class="tog"></span>'), settingsRow("Jawab keputusan dari island", "", '<span class="tog"></span>'), settingsRow("Izin tool dari island", "Selalu dibuka di jendela Walt supaya perintahnya terbaca lengkap", `<span class="row g6 s13 dim">${ic("lock", 14)}Tidak pernah</span>`)])}
</div>`, insp: "" }) },

  "w15-room-build-light": { name: "W15 · Walt · Room · Codex building (light)", w: W, h: H, html: room({ light: true, tl: tlBuild, wf: workflow({ status: `<b style="color:#4F57E0">Codex</b> is building`, turn: "1 of 6" }), insp: inspTask() }).replaceAll("#F5F5F7", "#1C1C1E").replaceAll("#C7C7CC", "#48484A").replaceAll("#E08A68", "#C2603D").replaceAll("#22D3EE", "#0E9FB8") },

  // ----- island (Ce:L) -----
  "i01-closed": isl("I01 · Island · Walt · closed, agents working", 150, 30, 14, 10, `
<div class="row" style="position:absolute;left:16px;top:0;height:30px;gap:5px">${dot(ENG.codex.color, 8)}${dot(hexA(ENG.claude.color, 0.4), 6)}${dot(hexA(ENG.gemini.color, 0.4), 6)}</div>
<div class="row g6" style="position:absolute;right:15px;top:0;height:30px;font-size:12.5px;font-weight:700">${ring(1 / 6)}<span>1/6</span></div>`),

  "i02-peek-handoff": isl("I02 · Island · Walt · peek handoff", 310, 60, 19, 13, peek(`<div class="row">${av("codex", 30)}<span style="margin:0 4px">${ic("chevr", 14, "rgba(255,255,255,.6)", 2.4)}</span>${stack(["claude", "gemini"], 30)}</div>${peekTxt("Ready for review", "Codex → Opus, Gemini · r1")}`)),

  "i03-peek-ask": isl("I03 · Island · Walt · peek decision (answer here)", 420, 76, 30, 18, peek(`${av("claude", 38)}${peekTxt("Default loan period?", "Claude Opus · BIBI · blocks T-015")}
<span data-hot="Answer 7 days" style="padding:7px 13px;border-radius:999px;background:rgba(255,255,255,.14);font-size:13px;font-weight:600">7 days</span><span data-hot="Answer 14 days" style="padding:7px 13px;border-radius:999px;background:${T.green};color:#04170B;font-size:13px;font-weight:600">14 days</span>${iconBtn("more")}`, "0 16px 0 20px")),

  "i04-peek-approval": isl("I04 · Island · Walt · peek tool approval (opens Walt)", 420, 68, 24, 15, peek(`<span style="width:36px;height:36px;border-radius:18px;background:${hexA(T.amber, 0.2)};display:flex;align-items:center;justify-content:center;flex:none">${ic("warn", 19, T.amber, 2)}</span>
${peekTxt("Codex wants to run a command", `<span class="mono">npm install date-fns-tz@3</span>`)}<span data-hot="Open in Walt" style="padding:7px 13px;border-radius:999px;background:#fff;color:#000;font-size:13px;font-weight:600;white-space:nowrap">Open in Walt</span>`, "0 16px 0 18px")),

  "i05-peek-done": isl("I05 · Island · Walt · peek done", 310, 60, 19, 13, peek(`<span style="width:32px;height:32px;border-radius:16px;background:${T.green};display:flex;align-items:center;justify-content:center;flex:none">${ic("check", 18, "#04170B", 2.6)}</span>${peekTxt("BIBI · Done", "0 findings left · 5 of 6 turns")}${stack(["codex", "claude", "sonnet", "gemini"], 20)}`)),

  "i06-peek-login": isl("I06 · Island · Walt · peek login needed", 310, 60, 19, 13, peek(`${av("gemini", 32)}${peekTxt("Gemini needs a new login", "Open Walt to sign in again")}<span style="width:9px;height:9px;border-radius:5px;background:${T.red};display:block;flex:none"></span>`)),

  "i07-open-room": isl("I07 · Island · Walt · page, one room", 420, 140, 32, 22, `${head("Walt")}${arrows}${dots()}
<div class="row g10" style="position:absolute;left:40px;right:40px;top:40px">${av("codex", 34)}<div class="f1 col"><div class="row g6" style="font-size:14px;font-weight:600">BIBI · Main<span style="font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:999px;background:${hexA(T.blue, 0.3)};color:#B4BAFF">Triad</span></div><div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:2px"><span style="color:${ENG.codex.color};font-weight:600">Codex</span> · running tests</div></div>${iconBtn("pause")}${iconBtn("stop", "#FF6961", "rgba(255,69,58,.2)")}${iconBtn("arrow")}</div>
<div style="position:absolute;left:40px;right:40px;top:86px">${stepBar(0, ["Build · turn 1/6", "Review", "Fix"])}</div>
`),

  "i08-open-rooms": isl("I08 · Island · Walt · page, several rooms", 420, 140, 32, 22, `${head("Walt", 3 / 6)}${arrows}${dots()}
${[[40, "BIBI · Main", "Waiting for you · 2", T.amber, ["codex", "claude", "gemini"], 4 / 6], [80, "Ce:L site · Copy", "Claude Opus is speaking", ENG.claude.color, ["claude", "gemini"], 1 / 3]].map(([y, t, s, c, es, p]) => `<div class="row g10" data-hot="room:${t}" style="position:absolute;left:40px;right:40px;top:${y}px;height:34px;padding:0 10px;border-radius:10px;background:rgba(255,255,255,.08)">${stack(es, 20)}<div class="f1" style="font-size:13px;font-weight:600">${t}</div><span style="font-size:12px;color:${c}">${s}</span>${ring(p, c)}</div>`).join("")}`),

  "i09-open-off": isl("I09 · Island · Walt · page, Walt not running", 420, 140, 32, 22, `${head("Walt", 0)}${arrows}${dots()}
<div class="col" style="position:absolute;left:40px;right:40px;top:38px;align-items:center;text-align:center">${wordmark(20)}<div style="font-size:12.5px;color:rgba(255,255,255,.6);margin-top:6px">Walt is not running</div>
<span data-hot="Start Walt" style="margin-top:10px;padding:6px 16px;border-radius:999px;background:${T.green};color:#04170B;font-size:13px;font-weight:600" class="row g6">${ic("power", 14, "#04170B", 2.2)}Start Walt</span></div>`),
};

export const ROWS = [
  ["Walt · Setup pertama · bahasa → engine (login via CLI) → project → tim", ["w01-welcome", "w02-engines", "w03-project", "w04-team"]],
  ["Walt · Room · alur Triad: siap → build → review paralel → butuh kamu → selesai", ["w05-room-idle", "w06-room-build", "w07-room-review", "w08-room-needs-you", "w09-room-done", "w16-room-roles"]],
  ["Walt · Inspector, task board, masalah, recovery", ["w10-room-context", "w11-tasks", "w12-incident", "w13-recovery"]],
  ["Walt · Pengaturan (contoh UI Bahasa Indonesia) + tema terang", ["w14-settings-id", "w15-room-build-light"]],
  ["Island Ce:L · halaman Walt · closed, peek, dan open page", ["i01-closed", "i02-peek-handoff", "i03-peek-ask", "i04-peek-approval", "i05-peek-done", "i06-peek-login", "i07-open-room", "i08-open-rooms", "i09-open-off"]],
];
export { room, settingsRow, select, group, pill, sev, mono, tlBuild, tlDone, tlReview, setup, diffLine, changes, deliverable, W, H };
