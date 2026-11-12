# Progress checkpoint — 2026-11-13

## P0 status: passed for Claude (Opus + Sonnet); open for Codex and Gemini

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

## Found while testing (next work, in order)

1. Settings pages, Projects home (W27) and Tasks still use the old placeholder layouts; light theme and Indonesian copy not checked.
2. Whole state (all messages) is rewritten as one JSON row every 200 ms while streaming. Move messages to their own table before histories grow.
3. Fix + re-review loop, decision asks, Walt picking roles per task, Job Objects for tool child processes.
4. Codex CLI 0.167.2 is installed and signed in; Gemini CLI 0.68.0 is installed, cello still has to sign in (`gemini`). Build the Codex (app-server) and Gemini (`--acp`) adapters to finish P0; personas on those engines already exist and wait for them.
