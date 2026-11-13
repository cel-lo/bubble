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
- Not changed on purpose: Claude builders still have no shell (COMPATIBILITY.md: no Bash until process-tree containment is proven), so a Claude builder cannot run tests; a Codex builder can, with approval.

## Containment, decisions, team templates, MCP per project — 2026-11-13

- Job Object (packages/adapters/job.ts): every claude.exe / codex.exe goes into one Windows job with KILL_ON_JOB_CLOSE, held by a small PowerShell helper (Add-Type, no native module) that reads PIDs on stdin. When Walt's host goes away, even by crashing, the job closes and ends the CLIs and everything they started. Verified: unit test (process + its later child both end); Codex still runs commands inside the job (node -v); a Codex ping kept running was gone after force-killing Walt; no helper or codex left behind.
- Decision asks: the builder may end with "DECISION: question" and 2-4 "- option" lines; Walt stops before review (step "awaiting decision") and shows the options as buttons under the message. A choice goes back to the builder as a plain message (build, then review), or as an @mention to whoever asked. Unit test.
- Team templates: "Save template" in Who joins; templates show as one-click chips there; Customize · Team templates lists and deletes them. Same name replaces. Unit test.
- Plugins & tools: MCP servers from ~/.claude.json (user scope) and ~/.codex/config.toml, turned on per project (Project.mcp). Claude gets a --mcp-config file with only those servers (env stays off the command line) and asks before each tool call; Codex keeps every other server off. Codex runs MCP tools without an approval request, so read-only Codex sessions (reviewers) never get MCP. Verified with figcraft: Claude asked for mcp__figcraft__list_commands and answered after approval; Codex answered without asking (documented on the page). Unit test.
- Recovery: a chat cut off by a crash used to lock its project for good (no way out). It now shows "The last run stopped before it finished" with "I checked, continue", which unlocks the chat and project without replaying anything. Unit test + checked in the app.
- 23 unit tests.

## Found while testing (next work, in order)

1. Decide: give Claude builders a shell (Bash, each command still asks first). Process containment, the condition in COMPATIBILITY.md, now exists.
2. Walt picking roles per task (Auto mode from the blueprint).
3. Installer and code signing (Smart App Control).
4. Ce:L island side of the control API; Gemini adapter once cello signs in; API-key engines (Groq and others).
5. Click-through links for the V01–V14 FigCraft frames.
