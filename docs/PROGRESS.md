# Progress checkpoint — 2026-11-12

## Completed work

- Read PRD and blueprint architecture, flows, Ce:L contract, roadmap and model handoff instructions.
- Copied blueprint v1.1 and original FigCraft generation sources into D:\WALT.
- Built desktop/main/preload, isolated host, React UI and live setup bindings without editing FigCraft.
- Implemented local persistence, project/room operations, manifests, budgeting, basic collaboration sequencing, a Claude transport and a restricted island API.
- Formatted source and separated transport, storage, domain, host and UI concerns.

## Verification

- `node scripts/build.mjs`: passed.
- `node scripts/test.mjs`: 6 tests passed (root overlap, budgets, environment credentials, Unicode manifests, restart recovery, island authentication/revisions/deduplication/approval denial).
- `tsc --project tsconfig.core.json`: passed.
- `node scripts/smoke-claude.mjs`: real Claude initialization handshake passed. No model prompt sent.
- `node scripts/smoke-provider.mjs`: failed after bounded 45 seconds. Sandbox denied creation of Claude's OAuth refresh lock. No successful generation claimed.
- Original design source hashes match all four original source modules.

## Blockers and next work

1. Electron install failed because registry.npmjs.org DNS is unavailable in the execution sandbox. Existing local React/Zod/esbuild/TypeScript packages were copied solely to enable build and core checks. A clean normal npm install and lockfile are still required.
2. Loopback requests are denied EACCES by this sandbox. API routing tests dispatch directly to the real HTTP request handler. Socket connectivity is unverified.
3. Claude login refresh cannot write outside the workspace in this sandbox. Run real-provider tests from the normal Windows user session.
4. Codex and Gemini are missing. Install/login and implement adapters before declaring P0 complete.
5. Complete every pending row in PARITY.md. In particular, do not enable shell tools before permissions and process containment have passed tests.
6. Run Electron and verify all implemented screens visually against FigCraft. No full UI parity or usable v1 claim yet.

No executable has been produced or app launched. `Install-Walt.cmd` and `Start-Walt.cmd` are prepared for the normal Windows environment. The user's requested complete application is unfinished.
