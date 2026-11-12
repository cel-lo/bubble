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

## Found while testing (next work, in order)

1. Setup screens rebind design HTML imperatively; after Back the New project screen re-renders the design's sample data (BIBI, D:\Projects\BIBI, "Git repository found"). Fake data in the real UI — fix first.
2. First launch goes straight to Projects; W01 Welcome and W02 Doctor are not shown. Doctor is never run, so the sidebar says "0 engines signed in".
3. Room view vs W06–W09: template shown as raw id (`build_review`), workflow strip stays on Build after review, persona status reads "Asleep · …" while a process is warm or busy, agent Markdown is not rendered, no deliverable card / Accept, Codex and Gemini listed although not installed.
4. Whole state (all messages) is rewritten as one JSON row every 200 ms while streaming. Move messages to their own table before histories grow.
5. Resume after idle eviction (`--resume <session id>`), fix + re-review loop, decision asks, roles per task, Job Objects for tool child processes.
6. Codex (`npm install -g @openai/codex`, then `codex login`) and Gemini (`npm install -g @google/gemini-cli`, then `gemini`) must be installed and signed in by cello; then build their adapters to finish P0.
