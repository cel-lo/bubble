# Walt

Private Windows desktop app for cello. Source, copied blueprint and design sources are in `D:\WALT`.

**Status: development implementation, not a completed v1. The P0 gate has not passed.**

The Electron entry, separate Node host and React UI build successfully. The real Claude CLI completed its stream-json initialization handshake. Six core tests passed. A model-response smoke was blocked by the execution sandbox preventing Claude from creating its OAuth refresh lock. No successful model output, file editing, parallel review, packaged executable, or complete visual parity is claimed.

## Run on this laptop

1. Run `Install-Walt.cmd` from Windows with internet access. It installs dependencies, builds the source and creates an unpacked desktop app in `release\win-unpacked`.
2. Open `release\win-unpacked\Walt.exe`, or use `Start-Walt.cmd` for development.
3. Open Settings → Engines → Refresh doctor. Claude uses the existing native CLI login.
4. Create a project and room. Currently only Claude Opus and Claude Sonnet have an implemented adapter. Start with Sonnet as Builder and Opus as Reviewer.

The installation script has been prepared but could not complete here: npm registry DNS resolution is unavailable in the execution sandbox. Electron is not installed and no `Walt.exe` has been produced yet. `npm run package:portable` creates a portable executable once dependencies and smoke tests pass.

## Commands

```text
npm run build
npm run test
npm run typecheck:core
npm run typecheck
npm run smoke:claude
npm run smoke:provider
npm run package
node scripts/island-client.mjs
```

`typecheck:core` covers domain, host, adapters, storage, API, UI and tests. Full typechecking also requires the Electron package and its official types. Tests currently use Node's test runner so they can run with the available offline dependencies; Vitest/Playwright migration and full UI tests remain pending.

## Structure

- `apps/desktop`: Electron window, preload, tray and utility-process host.
- `apps/ui`: React UI; original setup layouts bound to inputs.
- `packages/domain`: records, budget and root overlap rules.
- `packages/host`: project/room service and artifact manifests.
- `packages/adapters`: CLI probing, credential filtering and Claude transport.
- `packages/storage`: SQLite WAL state, events and command history.
- `packages/control-api`: authenticated loopback API and SSE for Ce:L.
- `design`: unchanged source used to generate the FigCraft frames, including all 51 original screens.
- `docs/blueprint`: supplied blueprint v1.1, preserved.

Runtime data belongs in `%APPDATA%\Walt`, per the PRD. Project folders stay where selected. Source and build output remain in `D:\WALT`.

Read `docs/PROGRESS.md`, `docs/COMPATIBILITY.md` and `docs/PARITY.md` before continuing development. The original FigCraft document has not been edited. Full implementation-to-frame visual verification is outstanding.
