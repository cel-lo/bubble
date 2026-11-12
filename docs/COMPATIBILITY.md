# Compatibility evidence — 2026-11-12

| Component | Observed | Evidence / limitation |
|---|---|---|
| Node | 26.13.0 | Local build and SQLite tests |
| npm | 11.20.0 | Registry request fails with ENOTFOUND in sandbox |
| Claude Code | 2.1.322 | `claude --version`, local CLI help |
| Claude auth | CLI reports claude.ai login | No credentials copied or stored by Walt |
| Claude transport | stream-json stdin/stdout | Real initialization handshake passed |
| Claude model output | Unverified | 45-second bounded smoke blocked by EPERM creating the CLI OAuth refresh lock |
| Claude permission callback | Implemented, unverified end to end | Native `--permission-prompt-tool stdio`; never bypass permissions |
| Claude warm turns / resume | Unverified / incomplete | Process retained between runs; session persistence/resume not implemented |
| Codex | Not found on PATH | Adapter pending |
| Gemini | Not found on PATH | ACP adapter pending |
| Electron | Not installed | Source bundles; executable and runtime SQLite ABI unverified |
| Ce:L API | In-process request tests pass | Actual loopback socket requests fail EACCES in sandbox |

The local Claude help verifies `--input-format stream-json`, `--output-format stream-json`, `--include-partial-messages`, `--restricted`, `--permission-mode manual`, `--tools`, `--setting-sources`, and `--strict-mcp-config`. The initialization test verifies acceptance of the stdio permission prompt configuration. It does not prove a real tool permission round trip.

Builder tools currently expose Read/Glob/Grep/Write/Edit only. Shell execution remains disabled until permission callbacks and Windows process-tree containment are proven. Reviewer tools expose only Read/Glob/Grep. Do not silently enable Bash or bypass flags.

Reference checked: official Anthropic Python SDK subprocess transport, https://github.com/anthropics/claude-agent-sdk-python/blob/main/src/claude_agent_sdk/_internal/transport/subprocess_cli.py. No provider version/model capability was inferred from design placeholder labels.
