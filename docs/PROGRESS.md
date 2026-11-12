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

## Found while testing (next work, in order)

1. Settings pages, Projects home (W27) and Tasks still use the old placeholder layouts; light theme and Indonesian copy not checked.
2. Whole state (all messages) is rewritten as one JSON row every 200 ms while streaming. Move messages to their own table before histories grow.
3. Resume after idle eviction (`--resume <session id>`), fix + re-review loop, decision asks, roles per task, Job Objects for tool child processes.
4. Codex (`npm install -g @openai/codex`, then `codex login`) and Gemini (`npm install -g @google/gemini-cli`, then `gemini`) must be installed and signed in by cello; then build their adapters to finish P0.
