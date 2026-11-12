# Implementation parity

**Core usable requires P0 + P1 + P2. This implementation has not reached that gate.**

| Feature | Status |
|---|---|
| Electron source, separate host, React build | Runs on Electron 39.8.10; node:sqlite works in the utility process |
| Original FigCraft sources | Preserved byte-for-byte; hashes in DESIGN_PROVENANCE.json |
| Onboarding W01–W04 | React views copying the frame layout; real data only (doctor, folder, roles); verified 2026-11-13 in Electron |
| Room layout | Template/state labels, Build→Review steps, live persona status, Markdown, W09 result card + Accept; verified 2026-11-13. No test-evidence box until tests are tracked |
| All 51 screens | Preserved as reference; not all are functional views |
| Project roots / overlap checks | Implemented; junction identity uses realpath |
| SQLite WAL / history / events | Implemented |
| Doctor | Native executable detection; Claude auth verified; other adapters pending |
| Claude turns and permission bridge | Verified 2026-11-13: output, allow/deny via broker, warm second turn, read-only reviewer |
| Codex and Gemini | Not implemented; UI reports unavailable rather than simulating |
| Warm/sleep | Reuse and idle eviction implemented; resume after eviction pending |
| One writer | In-process overlapping-root lease implemented; durable OS containment pending |
| Build & Review / Triad | Build then independent review stage implemented; real integrations unverified |
| Fix and re-review | Pending structured findings and scheduler loop |
| Handoff packets / manifests | Generated and stored; provider acknowledgement protocol pending |
| Immutable artifact blobs / diff / conditional restore | Pending; only SHA-256 manifest stored |
| Tool approval | Window broker verified live (ask.opened → ask.resolved, Claude transcript shows a once-grant) |
| Decision/info asks and dependencies | Pending |
| Budget / pause / interrupt | Implemented; native cancellation completion unverified |
| Queue next / steer | Queue stored; dispatch and steer pending |
| Recovery | Unfinished rooms quarantined; manual reconciliation UI pending |
| Island | hello/state/feed/pause/resume/open implemented; verified over real loopback; approvals denied |
| Full island contract | Run-ID interrupts, decision answers, replay cursor and explicit Windows ACL hardening pending |
| English / Indonesian | Partial catalog; full translation pending |
| Light theme | Original CSS class; visual regression testing pending |
| Usage | Unknown until real provider metrics are implemented |
| Tray | Source implemented; desktop runtime test pending |
| Startup / deep links / backup / search / custom templates | Pending |
| Windows Job Objects | Pending; owned PID tree fallback only; shell tools disabled |
| Packaging / full UI E2E | Electron runs; packaging not tried yet; one real build→approve→review run from the UI passed |

Deferred and Not planned features retain their classifications in the supplied blueprint. Do not describe the above pending features as shipped.
