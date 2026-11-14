# Progress checkpoint — 2026-11-13

## P0 status: passed for Claude (Opus + Sonnet) and Codex; open for Gemini

Codex adapter (2026-11-13): `packages/adapters/codex.ts`. `npm run smoke:codex` (real Codex: broker allow + deny, warm second turn on the same process, read-only reviewer never reaches the broker, resume). In Electron, room "Codex build" (Codex builder, Opus reviewer): Codex asked for two shell reads and one edit through the UI cards, changed `borrow.js`, Opus reviewed the same revision. Doctor runs the native exe behind `codex.cmd` and reads `codex login status`.
Unverified: once after launch the composer stayed a placeholder (no textarea) until the room was switched; not reproduced since (the composer is React now).

Done on the real laptop session:

- Git repository created; baseline commit of Astra's scaffold.
- `npm install` with Electron 39.8.10 (see COMPATIBILITY.md for the npm 11 / extraction notes).
- `npm run smoke:provider`: Claude answered `WALT_OK`.
- `npm run smoke:tools`: permission broker allow + deny, warm second turn on the same process, read-only reviewer.
- Walt launched in Electron: host + node:sqlite up, control API answers over loopback.
- End-to-end from the UI composer (fixture project in `test-results/fixture-bibi`): Sonnet builder asked for Edit, the approval card showed the full input, Allow once → file edited → artifact r1 registered → Opus reviewed the same hash read-only. Screenshots `test-results/p0-0*.png` (git-ignored).
- `node scripts/cdp.mjs` drives the window over DevTools when Walt runs with `--remote-debugging-port=9555`.

## UI fixes — 2026-11-13

- Setup is now `apps/ui/onboarding.tsx`: W01 Welcome + language, W02 Engines (doctor runs on open), W03 New project, W04 Team. React state, no design sample data. First launch with no projects opens Welcome. `setup.tsx` and the generated `screens.json` are gone.
- Doctor also runs once at startup, so persona status is real.
- Room: template and state labels, Build → Review steps with the real current step, persona status from the room step plus live processes (`procs`, sent by the host, never stored), Markdown for agent messages (`apps/ui/markdown.ts`, escaped first, tested), W09 result card with Accept / Continue.
- `WALT_DATA` env var points Walt at another data folder (used for a fresh first-launch test).
- Verified in Electron with a fresh data folder: Welcome → Engines → Project (Back/forward keeps the form empty) → Team (Triad blocks with only two Claude personas) → room → real Sonnet build + Opus review → Accept. Screenshots `test-results/ui-0*.png`.

## Personas, effort and composer shortcuts — 2026-11-13

- Personas are data (`State.personas`, seeded with Codex, Claude Opus, Claude Sonnet, Gemini): name, engine, model, effort, strengths, avatar. Settings → Personas & templates adds, edits and deletes them (delete is refused while a room uses the persona).
- Rooms take extra personas from the Task tab: + Reviewer, + Member (answers only when @mentioned), Remove.
- Composer shortcuts, read by Walt and never sent to a model (`packages/domain/command.ts`): `@Opus` (id, full name, or unique last word), `/effort low|medium|high|xhigh|max`, `/model <id>`, `keep` to make it the room default. A message with only settings (`@Opus /effort high keep`) changes the room and spends no turn. Precedence: message > room default for that persona > room default for everyone > persona.
- Effort is checked against the engine before anything runs (Gemini has none). Model ids are limited to plain id characters because they reach the CLI as argv.
- Claude adapter passes `--model`, `--effort` and `--resume`; a persona whose model or effort changes restarts its process on the same session, so context is kept. Same resume is used after the idle sleep.
- `@` and `/` menus above the composer (arrow keys, Tab/Enter, Esc).
- Doctor finds npm `.cmd` shims and reads Codex login (`codex login status`) and Gemini login (its oauth file).
- Verified: `npm run smoke:resume` (real Claude: effort low/high accepted; restarted process remembers the codeword), 10 unit tests, and in Electron: new persona GPT 6.1 Sol (Codex, gpt-6.1-sol, effort high), added as Member, @ and /effort menus, `@Opus /effort high keep` sent with Enter.

## One window like Claude / WhatsApp — 2026-11-13

- No separate Projects page. Sidebar: New chat, Search, Customize; Projects (each holds several chats, "+" on the row starts one, "…" has New chat / New team chat); Chats (no project). Rename and delete from each chat's "…" menu. Window title bar has only the window buttons.
- Home works like the Claude app: type, pick a model, the chat is created on send and titled from the first message.
- Plain chats (template direct): one AI, model picked in the composer chip. The menu lists the models the signed-in account actually has (Claude: initialize `models`; Codex: `model/list`), older ones under "More models", effort under "Effort" with only the levels that model takes. Switching models keeps the chat; each reply is labelled with the model that wrote it. Chats without a project run read-only in `<data>/chats/<id>`; in a project, edits ask first.
- Team chats (Build & Review, Triad, Roundtable) are made from a project's "…" menu and keep the workflow strip and Task panel.
- Customize: AI & models (Claude Code, Codex CLI; Gemini, OpenAI-compatible APIs such as Groq/xAI, ACP agents, Antigravity listed as planned), Personas, General, Permissions, About. Gemini is hidden everywhere else until its adapter exists (`ENGINES_ON`).
- No native selects: `apps/ui/menu.tsx` (Menu with submenus and keys, Dropdown). Styles in `apps/ui/walt.css`.
- Messages: links show their text (target in the tooltip, nothing opens), pipe tables render as tables. Approval cards show a shell command or diff as text, not JSON.
- Single-instance lock now taken after the data folder is set, so a test instance (`WALT_DATA`) and the normal one no longer block each other; two windows on the same data folder are still refused.
- Existing data that has projects skips onboarding.
- Memory decision (agreed with cello): Walt is the source of truth. Planned: "Continue in Claude Code / Codex" (resume the CLI session) and "Export context" (WALT.md). Walt never writes CLAUDE.md, AGENTS.md or personal memory.
- Verified in Electron (fresh data folder): onboarding → home → Haiku 5.5 reply → same chat switched to GPT-6-Luna reply → project chat: Codex asked to run a shell command, Allow once, `walt-note.txt` written, "Files changed r1" card → rename → team chat panel. Normal data folder opens straight into the app. 12 unit tests. Screenshots `test-results/ui2-*.png`.
- Dev note: `node scripts/cdp.mjs reload` reloads the UI after `npm run build`; host changes need a restart.

## v2 layout: W06 room look + Claude shell — 2026-11-13

Designed first in FigCraft (V01–V14, below the green divider in the Ce:L file), then built.

- Title bar: sidebar toggle (Ctrl+B), where you are, side-panel toggle (Ctrl+Alt+B, chats only), window buttons.
- Both panels resize by dragging their edge (sidebar 220–420 px, side panel 280–560 px; arrow keys on the focused edge; double-click resets). Open/closed and widths are kept per window in localStorage. A drag also ends when capture is lost or a move arrives with no button held, so a release outside the window cannot leave it stuck.
- Sidebar: project chats show who is in them, the last message and the time (W06 rows). For an open team chat, a Team section lists each member with role, process state (Working / Ready / Asleep) and model; + Add, and each member's … menu (make reviewer / member, remove). Settings is its own gear button at the bottom.
- Add model (chat header or Team · Add): models from the account, grouped by app, More models, search, joins as Reviewer or Member, effort. The host makes or reuses one persona per engine + model + effort (`persona.for`, named after the model, e.g. "Haiku 5.5"); a unique first word works as a mention (`@Haiku`).
- New project: folder, then "Who joins": tick models, give each a role (Builder / Reviewer / Member) and effort, Build & review or Roundtable. One model starts a plain chat; two or more reviewers make a Triad. The same screen is "New team chat" in a project's … menu. The old Team setup screen is gone.
- Every reviewer in a team now reviews a new revision (before: the first one or two by template).
- Fix: a @mentioned reviewer or member used to run with write access and register a result revision; it now answers read-only and no revision is made. Only the builder edits.
- Settings (General, Permissions, About) and Customize (AI & models, Personas) are separate.
- Side panel Task tab: read-only "Who does what"; the team is managed in the sidebar.
- Verified in Electron (test data): team chat layout, Add model → Haiku 5.5 joined as Member and answered `@Haiku`, mention stayed read-only (no new revision), panel resize by mouse (sidebar 288→368, side panel 560→460, saved; a move after release does not resize), sidebar toggle by button and Ctrl+B, Who joins → Triad (Haiku builds, GPT-6-Luna + Sonnet review), Settings page. 13 unit tests. Screenshots `test-results/v2-*.png`.
- Not done from the design: Plugins & tools and Team templates pages in Customize, Default model for new chats setting, light theme check of the new layout.

## Model switch recap, default model, light theme — 2026-11-13

- A model switched in mid-chat now gets the messages it missed (everything after its own last reply, newest kept, about 12k characters) before your new message. Verified: GPT-6-Luna answered "codex ok", then the chat switched to Haiku 5.5 and asked what the previous model said; Haiku answered "codex ok". Unit test for the cut-off.
- Settings · General: Default model for new chats (the same value a chat's model menu sets).
- Light theme checked on the v2 layout: theme class moved to <html> so menus in portals follow it; light overrides for icons drawn in the dark text colour, avatar rings, result boxes, code blocks and inputs. 14 unit tests.

## Fixes from cello's test — 2026-11-13

- A project folder with a file over 20 MB (CompPhys.zip) stopped every turn with "File exceeds snapshot limit". Big files are now tracked by size + modified time instead of content, so a change still shows up. Tested with a 21 MB zip (unit test + a real Haiku turn).
- Add model: the whole popover scrolled, so the Add / Cancel row was cut off on short windows. Now only the model list scrolls, the popover opens upward from the sidebar's Team · Add when there is more room above, Enter adds, and the button reads "Pick a model" until one is chosen. Checked on a 1500×700 window from both buttons; GPT-6-Astra added.
- Thin scrollbars everywhere (no arrow buttons, rounded thumb), light and dark.

## Toward 100% for Claude + GPT — 2026-11-13

- Storage: messages have their own table and only changed ones are written; the state row no longer carries history. Older data moves over on the first save. While a reply streams, the window gets only the new text 5x a second; disk and the full state follow every 2 s. Unit test (legacy load, no rewrite of unchanged messages, order and streamed text after restart, deleted chats leave no rows).
- Fix + re-review loop: reviewers end with VERDICT: APPROVE or VERDICT: CHANGES. On changes, the builder gets the findings and makes a fix round (new revision), then the same reviewers check again, until all approve, the budget is used, or a verdict is missing (Walt says which). Reviewers now get the text of every changed file (60 KB cap) and may use read-only commands, so a Codex reviewer can review. Workflow strip shows Build, Review, Fix. Unit test with fake sessions; real run: Haiku fixed math.js, GPT-6-Luna asked for changes once (before the file text was included), the fix round ran, then the budget stop message; after the change GPT-6-Luna approved r1 from the file text.
- Quit: Walt asks the host to stop every AI process tree (taskkill /T, so commands they started end too) and close the database before exiting, 5 s at most. Verified: quit closed Walt in 0.8 s and its claude.exe ended. Shortcut: a hard crash still leaves no Job Object; tool processes started by a CLI can outlive a crash.
- Bahasa Indonesia: every interface string goes through t() (apps/ui/i18n.ts) with apps/ui/id.ts; missing entries fall back to English. Checked on chat, team panel, Settings, Permissions.
- Continue in Claude Code / Codex (chat … menu): opens a terminal in the chat's folder running claude --resume <id> or codex resume <id>. Session ids are now kept on the chat, so a chat also resumes its CLI memory after Walt restarts. Verified: the terminal ran claude --resume with the chat's id.
- Export context (chat … menu): writes WALT.md into the project (only over a WALT.md Walt wrote) with project, team, latest revision and the last 40 messages; chats without a project copy it to the clipboard instead. 18 unit tests.
- Not changed on purpose (then): Claude builders had no shell yet; see the next round.

## Containment, decisions, team templates, MCP per project — 2026-11-13

- Job Object (packages/adapters/job.ts): every claude.exe / codex.exe goes into one Windows job with KILL_ON_JOB_CLOSE, held by a small PowerShell helper (Add-Type, no native module) that reads PIDs on stdin. When Walt's host goes away, even by crashing, the job closes and ends the CLIs and everything they started. Verified: unit test (process + its later child both end); Codex still runs commands inside the job (node -v); a Codex ping kept running was gone after force-killing Walt; no helper or codex left behind.
- Decision asks: the builder may end with "DECISION: question" and 2-4 "- option" lines; Walt stops before review (step "awaiting decision") and shows the options as buttons under the message. A choice goes back to the builder as a plain message (build, then review), or as an @mention to whoever asked. Unit test.
- Team templates: "Save template" in Who joins; templates show as one-click chips there; Customize · Team templates lists and deletes them. Same name replaces. Unit test.
- Plugins & tools: MCP servers from ~/.claude.json (user scope) and ~/.codex/config.toml, turned on per project (Project.mcp). Claude gets a --mcp-config file with only those servers (env stays off the command line) and asks before each tool call; Codex keeps every other server off. Codex runs MCP tools without an approval request, so read-only Codex sessions (reviewers) never get MCP. Verified with figcraft: Claude asked for mcp__figcraft__list_commands and answered after approval; Codex answered without asking (documented on the page). Unit test.
- Recovery: a chat cut off by a crash used to lock its project for good (no way out). It now shows "The last run stopped before it finished" with "I checked, continue", which unlocks the chat and project without replaying anything. Unit test + checked in the app.
- 23 unit tests.

## Claude shell, Auto roles, review fixes — 2026-11-13

- Claude builders can run commands: Settings · Permissions · "Let Claude builders run commands" (off by default). Walt then names the shell in --tools (Bash, and PowerShell, which is what the Claude CLI offers on Windows without Git Bash); every call still waits for Allow. Reviewers never get it. Verified: a Haiku builder ran node --test after two approvals, inside the Job Object.
- Auto roles (Team panel toggle, per chat): before each build task Walt makes the team member whose Good at best fits the task the builder; the old builder reviews. A Walt note says who and why before the turn starts. Personas made from a model pick now get default Good at (Codex: code/tests/refactors; Opus: planning/reviews/architecture; Sonnet/Haiku: quick features/docs). Verified: "add a test" moved GPT-6-Luna in as builder, then build, review, r1 approved.
- Make builder (team member … menu): swap builder by hand.
- Review fixes found in that run: a first build that changed no files is no longer reviewed; reviewers get the builder's reply (builderReply) and are told they cannot run tests, so they judge the evidence instead of asking for a rejected command.
- 25 unit tests.

## Packaging, prototype links — 2026-11-13

- npm run package (release/win-unpacked/Walt.exe) and npm run package:setup (release/Walt-Setup-0.1.0.exe, per-user NSIS installer, install folder can be changed). Both unsigned: there is no code signing certificate, and the npm electron.exe is not signed either. signAndEditExecutable stays false (no icon edit). Smart App Control read as off on this laptop (CI policy state 0); if it is turned on, unsigned builds may be blocked and the fix is a real certificate. Verified: the packaged Walt.exe opened the test data, found both CLIs, and ran a real Haiku turn with the Job Object helper up. The installer was built, not installed.
- FigCraft: V01–V14 hotspots are linked (design-pipeline/walt/links.mjs) with 5 "Walt v2 · …" flows: main window + panel toggles, new chat + model menu, new project (folder → who joins → first chat), add a model, Settings and Customize. The Designs-CeL.figcraft file is not saved by the script.

## Diff, notifications, Data & backup, shortcuts — 2026-11-13

- Open diff (result card and Files changed card): the latest revision's changed files, read-only. git diff against HEAD when the project uses git; otherwise the new text as added lines (a changed file says it has no git history). Up to 60 files / 400 KB. Unit test with and without git; checked in the app.
- Windows notifications when an AI asks for approval or a chat finishes while Walt is in the background; clicking opens that chat. Settings · General · Notifications (on by default). Needs setAppUserModelId, now set. Checked: minimized window got "Packaged test finished | Haiku 5.5: …".
- Settings · Data & backup: Back up now (SQLite VACUUM INTO <data>/backups, newest 10 kept), Open data folder, how to restore. Unit test; checked in the app.
- Settings · Shortcuts, and new keys: Ctrl N new chat, Ctrl K search, Ctrl , settings.
- The shell-flag test no longer leaks an EPIPE after it ends (it failed the suite now and then).
- 26 unit tests.

## Ce:L island ↔ Walt — 2026-11-13

- Walt side of walt-control/1 finished: decisions as island asks with options, answered from the island (recorded as via island), interrupt, open a given chat, launch.json + --background for Start Walt. Contract notes in blueprint/05_CEL_INTEGRATION.md §10. Unit test covers auth, origin, dedupe, decision answer, approvals refused.
- Ce:L side (D:/NEWNUSA/cel/app, not a git repo; a copy of the crates from before is in the session scratchpad): svc-walt link, Walt page (one chat / several / not running), decision and approval peeks, done peek, engine dots + turn ring in the closed notch. 5 Rust unit tests.
- Checked live with the test Walt: the decision peek showed (I03 look), … opened Walt at that chat, Blue answered from the island reached Walt with via island and Haiku replied; the feed streams over HTTP/1.0. Walt started with --background stays in the tray.
- Not checked on screen: the open Walt page and the closed-notch dots. Nusa sits on top of Ce:L's closed notch, and the island kept showing real WhatsApp peeks, so clicking it was not safe.

## Island fixes, Island settings — 2026-11-13

- Start Walt on the island did nothing: Walt was started before it wrote launch.json, and Start Walt ran it hidden (--background). Now it starts Walt with its window (A58), falls back to the per-user install (%LOCALAPPDATA%/Programs/Walt/Walt.exe), and the page says Starting Walt… or Walt not found.
- Island buttons felt slow: Pause only takes effect after the turn and Stop waits for the AI to stop, and the page showed nothing meanwhile. Now each press shows Pausing after this turn… / Stopping… / Resuming… / Opening in Walt… at once, until the feed shows the change; the snapshot carries pause, so a paused-after-turn chat says Pauses after this turn with the pause button lit.
- Settings · Island (Ce:L): connected or not (live), Answer decisions from the island (on by default; off sends decisions without options and refuses answers), tool approvals from the island: never. Unit test for the switch.

## Logo, startup, usage limits — 2026-11-13

- Logo: design/assets/walt-logo.webp (from cello) → build/icon-*.png and build/icon.ico (tile from 48 px, the creature alone at 16–32 px so it reads in the tray). Used for the window, taskbar, tray, installer and Walt.exe (electron-builder now edits the exe; with no certificate it skips only the signing), and as the wordmark in the app. Checked: the packaged Walt.exe shows it.
- Settings · General: Start with Windows (Windows' own startup list, starts Walt in the tray with --background; checked on → off, nothing left behind) and Close button (Hide to the tray, default, or Quit Walt; checked that Quit ends Walt).
- Antigravity CLI (replaces Gemini, which Google stopped for personal accounts in June 2026): the ACP adapter (packages/adapters/acp.ts) runs `agy acp`: initialize → session/new or session/load → optional session/set_model → session/prompt; agent_message_chunk streams; session/request_permission becomes the Shell / Edit / WebFetch approval card (read-only chats refuse changes); Stop sends session/cancel; Instructions go with the first message. agy is found on PATH or in %LOCALAPPDATA%\agy\bin. The sign-in check opens an ACP session (agy has no status command), brings the model list and closes the session again. Old Gemini personas become Antigravity on start. Run for real with agy 1.5.9 (Starter Quota account): six models (Gemini 3.8 Flash high/medium/low, Claude Sonnet/Opus 4.6, GPT-OSS 120B), a plain chat, and an edit in BIBI that waited for Allow once and became r2. Found there: agy's ACP server writes workspace files without asking even in default mode, and `acp` takes no --settings. So Walt starts it as `agy acp --app-data-dir walt` (its own folder ~/.gemini/walt with toolPermission "strict"; the Google login is shared through Credential Manager; the owner's agy settings and history stay untouched) and answers read/search/think requests itself, so only changes, commands and web fetches reach the owner. agy's write_file carries { Path, Content } and no diff; the card shows it as a new file. Logo: design/assets/antigravity.png.
- API providers (Customize · AI & models): Groq, 9Router (localhost:20128/v1), OpenRouter or any OpenAI-compatible URL. Paste the key once: the desktop app encrypts it with safeStorage (DPAPI) in <data>/keys.json and hands it to the host in memory only; never in walt.sqlite, backups or the window. The key check lists the models (speech/embedding ones left out), which join every model menu, @mention, the + menu and Add model as engine "api:<id>" with a letter avatar. Replies stream (SSE); Walt keeps the conversation and gives a new session the chat so far. API models chat, answer and review but never build (refused in team setup, roles and Auto roles). Engines are now a list (enginesOn): a new provider shows up everywhere without UI changes. Unit tests with a fake local API; checked live: add, Ready, chat, model menu, restart.
- Composer + menu (like the Claude app): Add files or photos (Ctrl+U; pictures as before, text and code files up to 200 KB go into the message as a fenced block), Slash commands, Connectors (claude.ai connectors, ChatGPT apps, each MCP server: on/off, Manage), Plugins (the AI first: each engine in the chat that has skills, then its switched-on plugins, then their skills with the SKILL.md description beside the menu while the cursor is on that skill; picking one starts the message with "Use the <skill> skill: "). Skills come from <plugin>/skills plus the folders the plugin manifest names. Checked live: menus, insert, and Haiku running ponytail-help when asked this way.
- Plan usage meter: Codex sends its 5-hour and weekly limits (`account/rateLimits/read` when a session or the model check starts, `account/rateLimits/updated` after turns), and Claude sends them with each reply (`rate_limit_event`). They are kept in state.usage, drawn as bars on Customize · AI & models with reset times, shown as "Claude 50% GPT 20%" in the sidebar (the window closest to its limit), and passed to the island snapshot as engines[].quota. Parsers unit-tested; both checked live in the app. Claude's figure only appears after a Claude message, because reading it costs a turn.
- Usage limits: a CLI error that says the subscription limit was hit (Claude Code and Codex wordings, usageLimit() in domain/command) becomes a card: who hit it, when it resets, and buttons to carry on: a plain chat continues with the other engine, a team chat hands the builder's job to another member (or drops a limited reviewer from the reviews); your last message is sent again. Unit test with fake sessions; card checked in the app (seeded message). Not seen with a real limit.

## Plugins & tools, pictures — 2026-11-13

- Plugins & tools (Customize): Walt now connects what cello already set up instead of switching it off. On by default: ChatGPT image generation, web search (Codex web_search=live; Claude WebSearch/WebFetch), ChatGPT apps & connectors, Codex plugins and skills, Claude Code plugins (each installed + enabled plugin with --plugin-dir, skills through the Skill tool), every MCP server from ~/.claude.json and ~/.codex/config.toml, in every chat. Off until switched on: Codex browser and computer use. Every item can be switched off on its own. Reviewers keep read-only project tools only. Codex commands that only read files run without asking (skills read their SKILL.md that way).
- Pictures from GPT: imageGeneration items are saved to <data>/images and shown in the reply (walt-img://, served only from that folder); click opens the viewer. Checked: an orange-cat illustration from GPT-6-Luna in a plain chat.
- Attach pictures: paste, drop or the 📎 button in the composer (PNG/JPEG/WebP/GIF up to 15 MB), thumbnails before sending, shown in your bubble; Claude gets them as image blocks, Codex as localImage. Checked: GPT-6-Luna and Haiku both described the attached logo.
- 28 unit tests.

## Palette, decisions, revisions, island settings — 2026-11-13

- Ctrl K: command palette (chats, projects → new team chat, every Settings and Customize page, sidebar / side panel, theme, language). Search stays in the sidebar.
- Decisions tab (side panel): every DECISION an AI asked in the project's chats and what you chose, or that it still waits.
- Files tab: Open diff on every revision, not only the latest (an older one is compared with the revision before it).
- Ce:L (D:/NEWNUSA/cel/app): Settings → Walt page with the peek switches and the connection line; login and handoff peeks; paging through more than two chats. 7 Rust tests on the Walt side.
- Not built on purpose: the task board from the old W11 design. Chats inside a project already play that part.

## Claude skills, claude.ai connectors, instructions — 2026-11-14

- Found: Walt started Claude with --disable-slash-commands, so Claude had no skills at all, plugins or not. Now dropped when plugins are on: all 5 Claude Code plugins' skills are usable (checked: Haiku listed academic-research, ponytail, ui-ux-pro-max, document-skills, superpowers).
- Skills synced from claude.ai (deep-research, docx, google-workspace, import-memory, pdf, pptx, skill-creator, xlsx) load as one generated plugin, rebuilt when claude.ai syncs again; shown as Skills from claude.ai in Plugins & tools. Checked live.
- Claude app connectors (Plugins & tools, on by default): the claude.ai account's connectors. Claude Docs works; Gmail and Calendar need one sign-in in Claude Code (claude, then /mcp).
- Customize · Instructions: what every AI should know about you, sent to Claude (--append-system-prompt) and Codex (developerInstructions). Checked: both started with the test line. ChatGPT memory cannot be read by any API; the page says how to copy it in.
- 29 unit tests.

## Turn budget per task — 2026-11-14

- cello hit "Budget exhausted" in a team chat: the counter never reset between messages, so a chat stopped after one task. Now every message starts a new task with the template's budget (like plain chats already did); the budget only caps the automatic build → review → fix loop. When a fix round does not fit, Walt says to send "fix the review findings". The "Continue · +2 turns" and "Continue with a new budget" buttons are gone (a new message does that). Unit test.

## Side panel icons, context meter, marking pictures — 2026-11-15

Taken from Claude's side panel and GPT's mark-and-ask, only what fits Walt:
- Side panel tabs are icons with tooltips (Task, Files, Decisions, Context, Activity); names show next to them when the panel is 400 px or wider. At the narrowest panel (280 px) the row no longer gets cut off. Plain chats get the Context tab too.
- Context tab: how full each model's context window is, from its latest reply in this chat (Claude: the last top-level reply's input + cache + output tokens of `modelUsage.contextWindow`; Codex: `thread/tokenUsage/updated` last.totalTokens of `modelContextWindow`; Antigravity: ACP `usage_update`). API models show "Not reported". Stored on the room (`room.context[persona]`, with the model used). Past 80% the chat header says "<model> context N%" in amber. The reviewer packet moved under "What the reviewers receive". Checked for real: Haiku 5.5 14% · 139k / 1M, GPT-6-Luna 10% · 26k / 258k, Gemini 3.8 Flash 1% · 9k / 1M.
- Mark and ask: click an attached picture (or "Mark and ask" under a picture in the chat), drag numbered boxes, give each a note. "Add to message" draws the red boxes into a new PNG that replaces the attachment, and puts the numbered notes into the message. walt-img now sends a CORS header so the window can draw the picture onto a canvas. The dialog only closes on a click that starts and ends on the backdrop.
- Not taken: Claude's per-category context breakdown (only Claude reports it), terminal pane (Continue in the CLI covers it), browser preview with element picking (large; later).

## Browser in the side panel — 2026-11-15

- New side panel tab "Browser" (globe), in team and plain chats: address bar (localhost:5173 or just 5173 → http, anything with a dot → https, other text → a web search), back, forward, reload/stop. The page stays loaded while you switch tabs; each chat remembers its last address (localStorage). The panel can grow to 60% of the window on this tab.
- Pick element: highlight under the pointer, click to pick (Esc or Cancel to stop). Walt takes a picture of the page (main process `browser.capture`, only for a webview inside Walt's window) and opens the marker with the element already boxed as 1. Screenshot: the same without picking. "Add to message" puts the marked PNG in the message, headed "On the marked page (<address>):", each note with the picked element (`element div.card > button.buy.primary "Add to cart"`).
- Locked down (apps/desktop/main.ts): every <webview> gets no preload, no Node, contextIsolation and sandbox, its own cookie jar `persist:walt-browser` (a login to your app survives a restart); only http(s) pages (file:, javascript: and others are refused on attach, navigate and redirect); popups and target=_blank load in the same view; downloads are cancelled; every permission (camera, microphone, location, notifications…) is refused.
- Checked for real on a local test page: page loads, pick → screenshot with the button boxed → note → message → Gemini 3.8 Flash answered "You marked the green button … which says 'Add to cart'". A page that sets location to file:///C:/Windows/win.ini stays where it was; `require` and `process` are undefined in the page; window.open loads in the same view. Unit test for the address bar.
- Not done: the AIs cannot drive this browser themselves (they still use their own web tools).

Second pass (cello's feedback, same day):
- Tabs: a tab strip with + and ×; every tab stays loaded; popups and target=_blank links come back from the main process (`walt:browser-tab`, only to the window that owns the page) and open as a new tab next to it. Tabs and their addresses are kept per chat (older single-address storage is read as one tab).
- History for all chats (window storage, last 500 visits, title and time), with search; click to open in the current tab.
- Annotate replaces Pick element: click any number of things on the page, each gets a numbered box and its own comment field (in a shadow root, so the page's CSS and keyboard shortcuts stay out); Done puts one picture with all numbered boxes and one note line per mark straight into the message (marks scrolled out of view are named as such). Screenshot still opens the marker.
- ⋯ menu: New tab, History, Find in page (count, Enter for next), Zoom in/out/actual size, Open in your browser (http(s) only, main process), Developer tools, Clear browsing data (cookies, logins, cache, storage and history; asks first).
- Thin grey scrollbars on every page (insertCSS on dom-ready).
- Left out on purpose: print, device toolbar, import of cookies and passwords, a password manager and autofill (Walt never keeps your passwords), downloads (still blocked).
- Checked for real on the test page: link opened a second tab; two elements annotated with comments → message "1. Make this bigger · element div.card > button.buy.primary "Add to cart" / 2. Use the full product name · element h2#name "Blue mug"" with the picture, nothing left in the page afterwards; History listed both visits; Find "e" 3/4 then Enter 4/4; Zoom 1.1.

## Settings · Browser, links in replies — 2026-11-15

- New Settings page Browser (settings.browser, validated in the host): Search with (Google, DuckDuckGo, Bing); Web links in chats (Walt's Browser or your browser); Annotation pictures (Always include, or Notes only for fewer tokens); Downloads (Off, or Ask where to save: main reads the setting from the state and leaves Electron's Save as dialog); device access shown as always refused; Clear cookies and logins; Clear everything; the History list with search, remove one, clear all.
- Web links in AI replies are clickable now (http(s) only; file paths and other targets stay text). By default they open as a tab in the chat's Browser (into the current tab while it is blank; a hidden side panel opens); or in your own browser.
- Permissions page names Antigravity's strict mode and the Browser's limits; About lists API providers too.
- Checked: the page, two settings saved through the host and back; Haiku replied with a link, clicking it opened example.com in the Browser tab; a blank tab takes the link. Unit tests for the search engine and which links open. Not tried: a real download with the Save as dialog.

## Found while testing (next work, in order)

1. Code signing certificate (only if Smart App Control gets turned on, or to share Walt).
2. Let a chat's AI look at and click in the side panel's Browser (would need a tool bridge per engine).
