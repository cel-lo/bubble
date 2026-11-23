# Bubble

Private Windows desktop app for cello: Claude Code, Codex and Antigravity in one project chat, signed in with each CLI's own login.

Bubble started as a copy of Walt (`D:\WALT`, commit `bc68621`) with the same functions and a new design: a glass window over a wallpaper, the Bubble logo, and List in place of Search. It does not connect to Ce:L. The design reference is the Figma file "Bubble"; its pipeline lives in `D:\NEWNUSA\design-pipeline\bubble`.

Bubble and Walt can run side by side: Bubble keeps its data in `%APPDATA%\Bubble`, has its own app id (`local.cello.bubble`) and its own Antigravity folder (`~/.gemini/bubble`).

## Run on this laptop

- Development: `Start-Bubble.cmd` (builds, then starts Electron).
- Installer: `Install-Bubble.cmd`, or `npm run package:setup`.
- A test copy that leaves your data alone: set `WALT_DATA` to another folder before `npm start`.

## Commands

```text
npm run build
npm run test
npm run typecheck
npm run package:setup
```

`docs/PROGRESS.md` is the log; everything before 2026-11-24 happened in Walt.
