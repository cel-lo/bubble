# Walt — Sumber dan Traceability

Tanggal pengambilan snapshot: 7 November 2026. Link kode dipin ke commit, bukan main yang berubah. Static inspection tidak sama dengan runtime validation. Sumber online dapat berubah atau tidak lagi tersedia; manifest menjaga identitas byte yang diambil.

## Repositori

- Bloks: https://github.com/hamedgitty/bloks/tree/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7
- Semaphore: https://github.com/illianaa/semaphore/tree/e0880c3d5edaddec1fa1b3898fe15759b49d9c2e

## Rujukan file

| ID | Sumber | Alasan dipakai |
|---|---|---|
| B1 | [bloks/docs/ARCHITECTURE.md](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/docs/ARCHITECTURE.md) | Arsitektur host/UI, persistence, rooms, serta inventory keluarga fitur. |
| B2 | [bloks/server/contracts.ts](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/server/contracts.ts) | Canonical runtime event dan kontrak provider. |
| B3 | [bloks/server/drivers/codex.ts](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/server/drivers/codex.ts) | Codex app-server, session, approval, steering. |
| B4 | [bloks/server/drivers/claude.ts](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/server/drivers/claude.ts) | Claude Code subprocess, stream-json, resume, lifecycle. |
| B5 | [bloks/server/session-import.ts](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/server/session-import.ts) | Import preview/digest, source read-only, fork/replay. |
| B6 | [bloks/server/branch.ts](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/server/branch.ts) | Branch percakapan dan shared file boundary. |
| B7 | [bloks/server/checkpoints.ts](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/server/checkpoints.ts) | Content snapshot, attribution, conditional undo. |
| B8 | [bloks/server/rehearsals.ts](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/server/rehearsals.ts) | Isolated attempt, compare, apply baseline preconditions. |
| B9 | [bloks/src/styles.css](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/src/styles.css) | Semantic visual tokens. Lihat juga screenshot upstream di references/. |
| B10 | [bloks/LICENSE](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/LICENSE) | FSL-1.1-MIT; baca teks dan LICENSING.md pada snapshot yang sama. |
| B11 | [bloks/server/room-route.ts](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/server/room-route.ts) | Everyone/lead/auto routing; validasi pilihan roster dan fallback. |
| B12 | [bloks/server/agent-chain.ts](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/server/agent-chain.ts) | Chain budget dan task budget yang bounded. |
| B13 | [bloks/server/context.ts](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/server/context.ts) | Context assembly. Lihat juga turn-context.ts dan memory-journal.ts. |
| B14 | [bloks/src/components/RoomView.tsx](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/src/components/RoomView.tsx) | Komposisi room UI. Lihat AppRail, Sidebar, Composer, dan Artifacts. |
| B15 | [bloks/package.json](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/package.json) | Versi 3.2.7, tooling dan packaging scripts. |
| B16 | [bloks/docs/GENERATIVE_UI.md](https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/docs/GENERATIVE_UI.md) | Contract rich UI upstream; tidak berarti semua card sudah diuji. |
| S1 | [semaphore/README.md](https://github.com/illianaa/semaphore/blob/e0880c3d5edaddec1fa1b3898fe15759b49d9c2e/README.md) | Fitur pengguna, macOS native binding, asks dan deliverables. |
| S2 | [semaphore/DESIGN.md](https://github.com/illianaa/semaphore/blob/e0880c3d5edaddec1fa1b3898fe15759b49d9c2e/DESIGN.md) | Room ownership, delivery, recovery; beberapa narasi historis perlu dibaca bersama source terkini. |
| S3 | [semaphore/docs/LIVE-CONTRACT.md](https://github.com/illianaa/semaphore/blob/e0880c3d5edaddec1fa1b3898fe15759b49d9c2e/docs/LIVE-CONTRACT.md) | Pending turn, acknowledgment, uncertain, idempotency. |
| S4 | [semaphore/lib/core.mjs](https://github.com/illianaa/semaphore/blob/e0880c3d5edaddec1fa1b3898fe15759b49d9c2e/lib/core.mjs) | Implementasi state machine dan penerimaan reply. |
| S5 | [semaphore/lib/asks.mjs](https://github.com/illianaa/semaphore/blob/e0880c3d5edaddec1fa1b3898fe15759b49d9c2e/lib/asks.mjs) | Jenis ask, limits, dan pemisahan dari native authorization. |
| S6 | [semaphore/docs/artifacts.md](https://github.com/illianaa/semaphore/blob/e0880c3d5edaddec1fa1b3898fe15759b49d9c2e/docs/artifacts.md) | Manifest/revision/hash, review scope, immutable preview dan batas verifikasi native. |
| S7 | [semaphore/web/styles.css](https://github.com/illianaa/semaphore/blob/e0880c3d5edaddec1fa1b3898fe15759b49d9c2e/web/styles.css) | Visual theme dan cascade akhir. Lihat juga web/index.html. |
| S8 | [semaphore/LICENSE](https://github.com/illianaa/semaphore/blob/e0880c3d5edaddec1fa1b3898fe15759b49d9c2e/LICENSE) | MIT dan notice upstream. |
| S9 | [semaphore/lib/artifacts.mjs](https://github.com/illianaa/semaphore/blob/e0880c3d5edaddec1fa1b3898fe15759b49d9c2e/lib/artifacts.mjs) | Implementasi selected manifest dan review validity. |
| S10 | [semaphore/lib/preview.mjs](https://github.com/illianaa/semaphore/blob/e0880c3d5edaddec1fa1b3898fe15759b49d9c2e/lib/preview.mjs) | Preview boundary dan selected assets. |
| S11 | [semaphore/docs/ux-implementation.md](https://github.com/illianaa/semaphore/blob/e0880c3d5edaddec1fa1b3898fe15759b49d9c2e/docs/ux-implementation.md) | Bukti dan batas native integration, bukan benchmark independen. |
| S12 | [semaphore/docs/human-attention.md](https://github.com/illianaa/semaphore/blob/e0880c3d5edaddec1fa1b3898fe15759b49d9c2e/docs/human-attention.md) | Proposal historis Needs you dan bagian implementasi lanjut; cek lib/asks untuk perilaku. |
| S13 | [semaphore/package.json](https://github.com/illianaa/semaphore/blob/e0880c3d5edaddec1fa1b3898fe15759b49d9c2e/package.json) | Versi 0.15.0 dan runtime/tooling. |

## Dokumentasi resmi integrasi

- O1 — Codex app-server: https://developers.openai.com/codex/app-server/ (dapat redirect ke dokumentasi ChatGPT Learn).
- O2 — Codex authentication: https://developers.openai.com/codex/auth
- O3 — Claude programmatic usage: https://code.claude.com/docs/en/headless
- O4 — Claude SDK permissions: https://code.claude.com/docs/en/agent-sdk/permissions
- O5 — Claude SDK streaming input: https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode
- O6 — Claude plan/SDK usage: https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
- O7 — ChatGPT/API billing: https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform
- O8 — ChatGPT files: https://help.openai.com/en/articles/20001052-using-library-to-manage-files-in-chatgpt
- O9 — ChatGPT export: https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data
- O10 — Claude export: https://support.claude.com/en/articles/9450526-export-your-claude-data

O1–O5 adalah acuan adapter. Gunakan schema/version terpasang saat implementasi. O6–O10 menjelaskan bahwa auth, billing, file asli, dan export mempunyai batas terpisah; jangan menganggap satu login memindahkan semua history/account data.

## Batas penelitian

File yang disimpan tersedia dalam source-manifest penelitian; paket ini hanya menyertakan indeks dan checksum, bukan seluruh source upstream. Keluarga fitur luas pada inventory sebagian hanya ditemukan di dokumentasi. Tidak ada klaim audit security, uji semua fitur, benchmark, maupun keberhasilan semua integrasi di mesin cello.

## Gambar referensi

- Light screenshot: https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/docs/screenshots/hero.png
- Dark screenshot: https://github.com/hamedgitty/bloks/blob/27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7/docs/screenshots/hero-dark.png
Dua gambar disertakan untuk referensi desain internal. Copyright dan lisensi upstream berada di references/; tidak diklaim sebagai rancangan Walt.
