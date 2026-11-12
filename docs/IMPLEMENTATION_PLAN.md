# Implementation plan

Follow blueprint v1.1. Current PRD and FigCraft designs take precedence over earlier visual descriptions.

1. P0: verify installed CLI protocols; install Electron and missing CLIs; verify real stream, permissions, cancellation, warm turns, SQLite runtime and desktop packaging. Record each capability separately. This gate remains open.
2. P1: finish live bindings for original frames, startup/onboarding, durable session identifiers, full locale catalogs, process supervision and real output streaming.
3. P2: complete Codex and ACP adapters, tool broker, structured findings, fix/re-review loop, dependency scheduler, durable write leases, immutable snapshots, explicit recovery, and full control contract. Test a real three-engine task.
4. Match each rendered view against its FigCraft reference at 1440×900. No redesign. Keep fixture/example data confined to test fixtures and design references.
5. Package and smoke-test the Windows app with the normal user account; connect the actual Ce:L application after its client has implemented the control contract.

Use narrow modules for storage, process transport, domain rules and UI. Avoid provider-specific protocol details in UI. Do not implement deferred features to compensate for an unpassed core gate.
