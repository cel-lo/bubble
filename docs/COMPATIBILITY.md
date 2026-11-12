# Compatibility evidence — 2026-11-13

Measured on cello's laptop (normal Windows user session), not in a sandbox.

| Component | Observed | Evidence / limitation |
|---|---|---|
| Node | 26.13.0 | Build, tests, smoke scripts |
| npm | 11.20.0 | Registry reachable. npm 11 blocks install scripts by default: `allowScripts` in package.json approves electron, esbuild, electron-winstaller |
| Electron | 39.8.10 | Runs Walt. Its own `install.js` extracted only `locales/` under Node 26 although the cached zip tests clean; workaround below |
| node:sqlite in Electron utility process | Works | `walt.sqlite` + `-wal`/`-shm` created on first launch |
| Claude Code | 2.1.322 at `%USERPROFILE%\.local\bin\claude.exe` | Flags used by the adapter all exist in `claude --help` |
| Claude auth | claude.ai subscription login from the CLI | No credentials copied or stored by Walt |
| Claude model output | Verified | `smoke:provider` → `WALT_OK` |
| Claude permission callback | Verified, allow and deny | `smoke:tools`: Write routed through Walt's broker; allowed write lands, denied write does not |
| Claude warm turns | Verified | Second turn on the same PID, 3.3 s including the model |
| Claude read-only reviewer | Verified | Write tools not offered; nothing written, nothing asked |
| Claude resume after sleep | Not implemented | Session id is captured but `--resume` is not passed after eviction |
| Process exit with Walt | Verified for a forced kill | Both Walt Claude processes exited when Electron was killed (stdin closed). Job Objects still needed for tool child processes |
| Ce:L control API | Verified over real loopback | hello/state/feed 200, no token 401, browser Origin 403 |
| Codex | Not installed | Adapter pending |
| Gemini | Not installed | ACP adapter pending |

Electron binary workaround (only when `node_modules/electron/dist/electron.exe` is missing after install):

```bash
cd node_modules/electron && rm -rf dist && unzip -q "$LOCALAPPDATA/electron/Cache/<hash>/electron-v39.8.10-win32-x64.zip" -d dist && printf electron.exe > path.txt
```

Builder tools expose Read/Glob/Grep/Write/Edit only. Shell execution stays disabled until Windows process-tree containment is proven. Reviewer tools expose only Read/Glob/Grep. Do not silently enable Bash or bypass flags.
