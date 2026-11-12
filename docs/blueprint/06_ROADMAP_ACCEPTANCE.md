# Walt — Roadmap, Backlog, dan Acceptance

Versi 1.1. Scope dipangkas agar Walt menjadi alat yang dipakai sehari-hari, bukan replikasi seluruh fitur upstream. Fitur yang ditunda tetap dicatat di `docs/PARITY.md` dengan status **Deferred** atau **Not planned**.

## 1. Fase

| Fase | Outcome | Isi | Gate |
|---|---|---|---|
| P0 — Spike | Tiga CLI terbukti jalan di Windows | Pasang + login ketiga CLI; probe; stream; interrupt; resume; izin; SQLite ABI + packaging smoke; isi matriks capability | Ketiga engine bergantian membaca/menulis fixture dengan bukti runtime |
| P1 — Host + UI dasar | Satu project, satu room, tiga agent | Doctor, host, DB, room, timeline, composer, mention, supervisor warm/sleep, i18n, Control API (read-only feed) | Fresh launch → 3 agent → stream → restart tanpa kehilangan history; giliran ke-2 tanpa spawn |
| P2 — Kolaborasi | Tujuan utama tercapai | Handoff, write lease, budget, Build & Review, Triad, asks, approval broker, artifacts + review stale, decisions, context inspector, pause/interrupt, recovery, perintah island | Build → 2 review paralel → fix → re-review; budget dipatuhi; stale terdeteksi; island bisa pause & jawab ask |
| P3 — Kontinuitas (v1.5) | Konteks jangka panjang | Branch diskusi, branch file (worktree), impor sesi lokal, search FTS, backup/restore | Impor read-only; branch terisolasi; restore aman |
| P4 — Nyaman | Kenyamanan lanjutan | Templates custom, rich cards, terminal PTY, usage view | Card schema tervalidasi |
| Deferred | Mungkin nanti | Rehearsal/compare, automations, browser panel, ACP agent tambahan, Ollama | Diputuskan ulang setelah P2 dipakai |
| Not planned | Tidak relevan | Voice, computer use, konektor chat, multiuser, hosted/SaaS, training export | — |

**Core usable = P0 + P1 + P2.** Desain FigCraft untuk layar P1–P2 dan halaman island dibuat sebelum P1 dimulai.

## 2. Backlog

| Issue | Scope | Dependency | Acceptance |
|---|---|---|---|
| W-001 | Monorepo scaffold, build, typecheck, Electron smoke | — | Walt.exe membuka host + renderer |
| W-002 | DB, migrasi, event journal, command dedupe | W-001 | Command duplikat tidak menggandakan dispatch |
| W-003 | Root resolver + folder picker | W-001 | Spasi/Unicode/junction/overlap diuji |
| W-004 | Adapter Codex | W-001 | Stream + approval + interrupt nyata |
| W-005 | Adapter Claude (stream-json) | W-001 | Stream + izin via broker + interrupt nyata |
| W-006 | Adapter ACP + konfigurasi Gemini | W-001 | Stream + request_permission + cancel nyata |
| W-007 | Engine Doctor + env scrubbing | W-004–006 | Status aktual; API key env tidak bocor ke child |
| W-008 | Agent Supervisor warm/sleep | W-004–006 | Proses dipakai ulang; idle melepas; job object cleanup |
| W-009 | Event normalizer | W-002, W-004–006 | Event tiga engine konsisten |
| W-010 | Room, persona, composer, timeline, i18n | W-002, W-009 | Mention valid; draft tersimpan; EN/ID |
| W-011 | Write lease + scheduler | W-003, W-009 | Tidak ada dua writer pada root sama |
| W-012 | Context packet + Walt MCP tools | W-010, W-011 | Penerima mengetahui revisi packet + hash file |
| W-013 | Budget + templates (B&R, Triad, Roundtable) | W-012 | Tidak ada giliran melebihi budget |
| W-014 | Review rounds paralel | W-013 | Reviewer tidak melihat temuan lain sebelum round tutup |
| W-015 | Tasks, dependencies, decisions | W-012 | Siklus ditolak; decision butuh konfirmasi |
| W-016 | Asks + approval broker | W-004–006, W-015 | Jawaban ask tidak mengesahkan tool |
| W-017 | Snapshot + conditional undo | W-003, W-011 | Edit user tidak tertimpa |
| W-018 | Artifact + review stale | W-017 | Aset berubah → review stale |
| W-019 | Pause/steer/interrupt/recovery | W-009, W-011, W-013 | Stop sebelum dispatch → tidak ada provider call |
| W-020 | Control API + island feed + contoh klien | W-010, W-016, W-019 | Kontrak `walt-control/1` lulus test |
| W-021 | Integrasi penuh 3 engine | W-012–020 | Triad berjalan end-to-end |
| W-022 | Packaging Windows, tray, startup, `walt://` | W-021 | Instal bersih, cleanup proses, deep link |

Format setiap issue: trigger → perilaku → invariant → test evidence → limitation.

## 3. Acceptance matrix

A01–A38 dari v1.0 tetap berlaku dengan "dua provider" dibaca sebagai "engine yang tersedia". Tambahan v1.1:

| ID | Situasi | Hasil wajib |
|---|---|---|
| A39 | Hanya Gemini belum login | Codex & Claude tetap bisa dipakai; Gemini "Login needed" |
| A40 | Environment Walt berisi `ANTHROPIC_API_KEY` | Child Claude tidak menerimanya; Doctor menunjukkan auth mode langganan |
| A41 | Dua giliran berurutan pada persona sama | Tidak ada spawn proses kedua |
| A42 | Idle melewati timeout | Proses berhenti; giliran berikut resume sesi |
| A43 | Resume sesi gagal | Sesi baru + replay, ditandai di timeline |
| A44 | Gemini reviewer meminta tulis file | Ditolak otomatis; tidak ada perubahan file |
| A45 | Triad: reviewer A selesai duluan | Temuan A tidak masuk konteks reviewer B |
| A46 | Satu reviewer Triad gagal | Round `closed_partial`, ditampilkan jujur |
| A47 | Island menjawab tool approval | `403 not_allowed_from_island`, approval tetap pending |
| A48 | Island pause saat run aktif | Run selesai, tidak ada dispatch berikut; status sama di Walt |
| A49 | Ce:L tersambung lalu Walt quit | Feed tertutup; island kembali normal tanpa error |
| A50 | Request ke Control API dengan header Origin browser | Ditolak |
| A51 | Laptop sleep lalu bangun saat proses warm | Health check; tidak ada run palsu terminal |
| A52 | Ganti bahasa ke Indonesia | Semua UI berubah; packet antar-agent tetap Inggris |
| A53 | Kuota Claude habis di tengah Triad | `quota_exhausted`; tidak ada failover otomatis |
| A54 | Tiga stream bersamaan | UI tetap responsif (diukur di profil renderer) |

## 4. Strategi pengujian

- **Unit**: transisi state, budget, idempotency, path overlap, manifest hash, stale review, review round.
- **Integrasi host**: fake engine deterministik (delay, stream rusak, double receipt, crash, approval race, auth expired, quota).
- **Kontrak adapter**: per engine, versi CLI dipin di `COMPATIBILITY.md`.
- **Kontrak Control API**: klien contoh membaca `control.json`, feed, dan perintah.
- **Real-engine smoke**: satu task kecil Triad dengan ketiga engine nyata, satu deny, satu cancel, satu resume setelah restart. Pakai fixture, bukan proyek penting.
- **UI E2E**: walkthrough di `04_FLOWS.md`, light/dark, EN/ID, keyboard.
- **Packaging**: instal bersih, startup, tray, cleanup proses, deep link.

## 5. Risiko

| Risiko | Respons |
|---|---|
| Flag/protokol CLI berubah | Versi dipin, test kontrak, adapter terisolasi |
| Mode ACP Gemini belum stabil | Fallback stream-json dengan capability lebih sempit |
| Login langganan berubah kebijakan | Auth mode terlihat di Doctor; jalur API key bisa ditambah nanti sebagai opsi |
| Tiga agent saling mengiyakan | Review independen, temuan berbasis bukti |
| RAM tinggi karena proses hangat | Batas proses hangat + idle timeout |
| Island memberi rasa aman palsu | Tool approval tidak bisa dari island |
| Scope melebar | Fase + daftar Deferred/Not planned |

## 6. Definition of Done per fase

Source bisa dibangun; tidak ada fake success; test kritis lulus dengan evidence; error/unsupported/recovery ditangani; README, limitations, matriks versi, dan progress diperbarui; tidak ada rahasia di repo; fitur yang belum selesai tidak disebut implemented.
