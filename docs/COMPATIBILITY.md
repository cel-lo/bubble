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
| Codex CLI | 0.167.2, ChatGPT login | Walt runs the native `codex.exe` behind npm's `codex.cmd` with `app-server` (JSON-RPC over stdio). Protocol from `codex app-server generate-ts` |
| Codex models / effort | `model/list`: gpt-6.1-sol (default), gpt-6-sol, gpt-6.1-terra, gpt-6-astra, gpt-5.6-*; effort low … max, plus ultra on most | Effort and model are sent per `turn/start` |
| Codex approvals | Verified (`smoke:codex`, UI) | `approvalPolicy: untrusted`; `item/commandExecution/requestApproval` and `item/fileChange/requestApproval` go to Walt's broker with the command or diff; declined edits leave no file; extra-permission, user-input, elicitation and tool-call requests are refused |
| Codex read-only reviewer | Verified | `sandbox: read-only`; Walt also declines every approval without asking |
| Codex isolation | Verified | Walt starts it with `--disable apps plugins browser_use in_app_browser computer_use image_generation hooks multi_agent`, each `[mcp_servers.<name>]` from `~/.codex/config.toml` set `enabled=false`, and each `~/.codex/skills/*/SKILL.md` disabled via `skills.config`. Codex's built-in system skills and `~/.codex/AGENTS.md` still load |
| Codex resume | Verified | `thread/resume` with the saved thread id; a restarted process remembers the earlier turn |
| Gemini CLI | 0.68.0, not signed in yet | ACP adapter pending (`gemini --acp`) |

Electron binary workaround (only when `node_modules/electron/dist/electron.exe` is missing after install):

```bash
cd node_modules/electron && rm -rf dist && unzip -q "$LOCALAPPDATA/electron/Cache/<hash>/electron-v39.8.10-win32-x64.zip" -d dist && printf electron.exe > path.txt
```

Builder tools expose Read/Glob/Grep/Write/Edit only. Shell execution stays disabled until Windows process-tree containment is proven (a Job Object now holds every CLI, see PROGRESS.md; enabling Bash is the owner's call). Reviewer tools expose only Read/Glob/Grep. Do not silently enable Bash or bypass flags.
