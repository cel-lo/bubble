# Walt — Arsitektur dan Implementasi

Versi 1.1. Dokumen ini adalah kontrak rancangan. Nama tipe, endpoint, dan flag CLI di bawah adalah usulan; **implementer wajib memverifikasi flag dan schema CLI yang terpasang pada spike P0** sebelum menguncinya di `docs/COMPATIBILITY.md`.

## 1. Stack

| Lapisan | Pilihan | Alasan dan batas |
|---|---|---|
| Desktop | Electron + TypeScript | Folder picker, tray, packaging Windows, lifecycle proses anak |
| UI | React + Vite + CSS tokens | Pola komponen Bloks, token visual Ce:L |
| i18n | Katalog string `en` / `id` (mis. i18next) | Tidak ada string UI hardcoded |
| Host | Node/TypeScript, proses utility terpisah dari renderer | Orkestrasi, adapter, file, DB |
| Host API | HTTP loopback + SSE (Fastify) | Dipakai main window **dan Ce:L**; inilah alasan API dipertahankan |
| Data | SQLite WAL, migrasi berversi (better-sqlite3, rebuild ABI Electron) | Transaksi state, outbox, idempotency |
| Files | Node fs + SHA-256 + blob content-addressed | Snapshot, manifest, conditional restore |
| Codex | `codex app-server` (JSON-RPC stdio) | Thread, turn, event, approval, interrupt |
| Claude | `claude` headless, `stream-json` input + output | Memakai login langganan dari CLI |
| Gemini | Gemini CLI mode ACP (stdio) | Session, prompt, permission request, cancel |
| Validasi | Zod | Semua input, event provider, tool |
| Test | Vitest + Playwright | Unit, integrasi, alur UI |
| Package | electron-builder (NSIS + portable) | Pemakaian pribadi, tidak dipublish |

Catatan: per 8 November 2026 ketiga CLI belum terpasang di PATH laptop ini (Node v24 dan Git sudah ada). Pemasangan dan login masuk ke P0.

## 2. Topologi proses

```
┌──────────────────── Walt.exe (Electron) ────────────────────┐
│  Main window (React)            Tray icon                    │
│        │ IPC lewat preload (allowlist)                       │
│  ┌─────▼──────────────── Walt Host (Node) ────────────────┐  │
│  │ Scheduler · Policy · Write lease · Budget               │  │
│  │ Context builder · Asks · Artifacts · Recovery           │  │
│  │ Agent Supervisor (warm / sleep)                          │  │
│  │ SQLite (WAL) + blob store                                │  │
│  │ Control API 127.0.0.1:<port acak> + SSE  ◄───────────────┼──┼── Ce:L (island)
│  └───┬────────────────────┬────────────────────┬───────────┘  │
└──────┼────────────────────┼────────────────────┼──────────────┘
  codex app-server     claude stream-json     gemini ACP
       └────────────── project folder / worktree ─────────────┘
```

- Renderer tidak pernah memegang akses shell, filesystem bebas, atau token.
- Satu instance Walt (single-instance lock). Membuka `Walt.exe` kedua hanya memfokuskan jendela yang ada dan meneruskan deep link.
- Host adalah satu-satunya pemilik proses CLI. Walt tidak menempel ke sesi CLI yang sedang dipakai cello di terminal lain.

## 3. Struktur source

| Path | Tanggung jawab |
|---|---|
| `apps/desktop/` | Electron main, preload, tray, deep link `walt://`, single-instance |
| `apps/ui/` | Views, composer, room, inspector, tokens, katalog i18n |
| `packages/domain/` | Entity, state machine, event, invariant |
| `packages/host/` | API, scheduler, outbox, recovery |
| `packages/supervisor/` | Lifecycle proses agent (spawn, warm, sleep, kill tree) |
| `packages/adapters/codex/` | JSON-RPC transport + normalizer |
| `packages/adapters/claude/` | stream-json transport + normalizer |
| `packages/adapters/acp/` | Klien ACP generik; Gemini adalah konfigurasi pertamanya |
| `packages/storage/` | Schema, migrasi, repository |
| `packages/files/` | Root, manifest, snapshot, restore |
| `packages/context/` | Packet, ringkasan, provenance |
| `packages/tools/` | Walt MCP server (handoff, ask, artifact, review) |
| `packages/control-api/` | Kontrak publik untuk Ce:L (schema versi terpisah) |
| `tests/fixtures/` | Fake provider, repo contoh |

Adapter ACP sengaja generik: agent lain yang mendukung ACP dapat ditambahkan sebagai konfigurasi, bukan adapter baru.

## 4. Autentikasi: login lewat CLI

Walt **tidak** meminta, menyimpan, atau meneruskan API key maupun password.

| Engine | Login sekali oleh cello | Yang dicek Doctor |
|---|---|---|
| Codex | `codex login` (akun ChatGPT) | Binary + versi, status login, model tersedia |
| Claude | `claude` → login akun Claude | Binary + versi, status login |
| Gemini | `gemini` → login akun Google | Binary + versi, status login/kuota |

Aturan:

1. Walt menjalankan CLI dengan environment terkontrol. **Variabel API key dihapus dari environment child** (mis. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`) agar CLI tidak diam-diam berpindah dari langganan ke API berbayar. Mode yang dipakai ditampilkan di Doctor.
2. Token refresh diurus CLI. Bila CLI melaporkan auth gagal, run berhenti dengan status `auth_required`, Doctor berubah merah, dan island memunculkan peek "Login needed". Tombolnya membuka terminal berisi perintah login. Walt tidak pernah mengetik kredensial.
3. Kuota langganan (jendela pemakaian Claude, batas Codex, batas harian Gemini) dibaca dari event/error CLI bila tersedia; jika tidak, ditampilkan `unknown`. Error kuota memetakan run ke `quota_exhausted` dan tidak memicu failover diam-diam.
4. Login lewat CLI resmi dipakai untuk penggunaan pribadi cello. Jika Walt kelak dibagikan, jalur auth harus ditinjau ulang terhadap ketentuan masing-masing provider.

## 5. Agent Supervisor: warm / sleep

Tujuan: tidak ada lag di sisi agent, dan tidak ada beban saat Walt tidak dipakai.

| State proses | Arti | Transisi |
|---|---|---|
| `cold` | Tidak ada proses; session ID tersimpan | Dispatch pertama → `starting` |
| `starting` | Spawn + handshake (initialize / ACP init) | Sukses → `warm`; gagal → `error` |
| `warm` | Proses hidup, idle, siap menerima giliran | Dispatch → `busy`; idle > T → `sleeping` |
| `busy` | Sedang menjalankan satu run | Run terminal → `warm` |
| `sleeping` | Graceful shutdown berjalan | Proses keluar → `cold` |
| `error` | Crash/handshake gagal | Diagnostik; retry hanya bila aman |

Kebijakan:

- **Satu proses per persona per room aktif.** Proses dipertahankan antar-giliran; tidak spawn ulang tiap giliran.
- **Prewarm**: saat cello membuka room atau mulai mengetik di composer, persona yang kemungkinan dipanggil (mention, owner berikut di template) dipanaskan di latar belakang.
- **Idle timeout** default 15 menit (setting 5–60 menit, atau "never while Walt open"). Proses ditutup dengan graceful shutdown; session ID dipakai untuk resume.
- **Resume gagal** → sesi baru + replay konteks dari packet, ditandai jelas di timeline ("New session, context replayed"). Riwayat tidak dihapus.
- **Batas proses hangat** default 6 (setting). Bila penuh, proses idle paling lama ditidurkan dulu.
- Tidak ada proses agent saat Walt idle tanpa room aktif. Host + tray saja.
- Proses dilacak dengan PID + job object Windows agar seluruh child tree dapat dihentikan; tidak pernah membunuh proses hanya berdasarkan nama.
- Sleep/hibernate Windows: saat resume dari sleep, supervisor melakukan health check ke setiap proses `warm`; yang mati ditandai `cold` (bukan error) bila tidak sedang menjalankan run.

Streaming delta di-batch 100–250 ms ke UI dan SSE agar tiga stream bersamaan tidak membebani renderer maupun Ce:L.

## 6. Kontrak adapter

```ts
// Kontrak milik Walt, bukan signature vendor.
interface AgentAdapter {
  probe(): Promise<AdapterReport>;            // versi, auth, model, capability
  start(input: StartInput): Promise<ProcessHandle>;  // spawn + handshake
  openSession(input: SessionInput): Promise<SessionHandle>; // baru atau resume
  run(input: RunInput): AsyncIterable<WaltEvent>;
  steer(input: GuidanceInput): Promise<DeliveryResult>;
  interrupt(runId: string): Promise<InterruptResult>;
  resolveApproval(input: ApprovalDecision): Promise<void>;
  stop(handle: ProcessHandle, mode: 'graceful' | 'force'): Promise<void>;
}
type Capability =
  | 'stream' | 'resume' | 'fork' | 'steer' | 'interrupt'
  | 'approvalCallback' | 'readOnlyEnforced' | 'localFiles'
  | 'images' | 'mcp' | 'usageReporting' | 'quotaReporting' | 'webSearch';
```

`sessionKey = workspaceId + projectId + roomId + branchId + personaId`. Satu sesi hanya punya satu run aktif.

### 6.1 Codex
Spawn `codex app-server` lewat stdio dengan argv array (`shell:false`). Initialize sesuai schema versi terpasang, buat/resume thread milik Walt, start turn, normalisasi item delta, petakan approval request, dukung interrupt dan steer bila tersedia. Simpan thread ID/turn ID terpisah dari ID internal.

### 6.2 Claude
Spawn `claude` mode headless dengan input dan output `stream-json` agar satu proses melayani banyak giliran. Parse JSON per baris secara incremental, bukan regex ANSI. Persist session ID untuk resume. Permission: gunakan mekanisme permission-prompt yang disediakan CLI (mis. permission prompt tool via MCP milik Walt) sehingga setiap izin lewat broker Walt. Jangan pakai mode bypass permission untuk menutupi callback yang belum dibuat.

### 6.3 Gemini (ACP)
Spawn Gemini CLI dalam mode ACP. Alur: `initialize` → `session/new` (atau load bila didukung) → `session/prompt` → terima `session/update` → jawab `session/request_permission` lewat broker Walt → `session/cancel` untuk interrupt.

- `readOnlyEnforced` untuk Gemini dicapai dengan **Walt menolak semua permission request bertipe tulis/eksekusi** saat persona berperan reviewer. Sandbox kontainer Gemini di Windows (Docker/Podman) tidak diwajibkan dan tidak diasumsikan ada.
- Pencarian web bawaan Gemini dicatat sebagai capability `webSearch`; hasilnya diberi provenance dan tidak menjadi instruksi.
- Bila mode ACP tidak tersedia pada versi terpasang, fallback ke mode non-interaktif `stream-json` sebagai adapter terpisah, dengan capability yang lebih sempit ditampilkan jujur.

### 6.4 Matriks capability (diisi pada P0)

| Capability | Codex | Claude | Gemini |
|---|---|---|---|
| stream | ? | ? | ? |
| resume | ? | ? | ? |
| steer | ? | ? | ? |
| interrupt | ? | ? | ? |
| approvalCallback | ? | ? | ? |
| readOnlyEnforced | ? | ? | via Walt deny |
| quotaReporting | ? | ? | ? |

Tanda `?` sengaja: tidak ada klaim sebelum diuji.

## 7. Event model dan persistence

```ts
type EventEnvelope = {
  eventId: string; schemaVersion: number;
  workspaceId: string; projectId: string; roomId: string; branchId: string;
  runId?: string; personaId?: string; engine?: 'codex' | 'claude' | 'gemini';
  providerSessionId?: string; providerTurnId?: string;
  seq: number; causationId?: string; correlationId: string;
  createdAt: string; type: string; payload: unknown;
};
```

Event domain: `message.accepted`, `run.queued`, `run.dispatching`, `run.acknowledged`, `output.delta`, `tool.started`, `tool.completed`, `approval.opened`, `approval.resolved`, `ask.opened`, `ask.resolved`, `guidance.received`, `handoff.proposed`, `handoff.accepted`, `run.completed`, `run.failed`, `run.interrupted`, `run.uncertain`, `artifact.registered`, `artifact.reviewed`, `artifact.stale`, `decision.confirmed`, `agent.process` (cold/warm/busy/sleeping/error), `engine.auth` (ok/required), `engine.quota`.

Transisi state penting dan outbox ditulis atomik sebelum dispatch. Final text dan event terminal di-flush sebelum owner berikut dipilih. Delta yang belum persist saat crash ditandai partial.

## 8. Skema data minimum

Sama dengan v1.0, dengan perubahan:

| Tabel | Perubahan v1.1 |
|---|---|
| `engines` | **Baru**: engine, binaryPath, version, authState, authMode, lastProbeAt, capabilitiesJSON |
| `personas` | Ganti nama dari `agents`: role, engine, model, effort, permissionProfile, avatarKey, locale |
| `agent_processes` | **Baru**: sessionKey, pid, jobId, state, startedAt, lastActiveAt |
| `rooms` | + `template` (direct/build_review/triad/roundtable/challenge/manual) |
| `review_rounds` | **Baru**: versionId, reviewerIds, state; temuan disembunyikan antar-reviewer sampai round tertutup |
| `settings` | + locale (`en`/`id`/system), idleTimeout, maxWarm, startWithWindows |
| `control_clients` | **Baru**: clientName (mis. `cel`), tokenHash, scopes, lastSeen |

Tabel lain tetap: workspaces, projects, room_members, branches, messages, commands, runs, sessions, events, outbox, asks, tasks, task_dependencies, decisions, context_packets, artifacts, artifact_versions, reviews, file_snapshots, write_leases, imports, usage_records. Foreign key aktif; semua query di-scope workspace/project.

## 9. State machines

**Room**: `idle → running → awaiting_user | paused | idle | ending | recovery_required`; `ending → ended`.

**Run**: `queued → preparing → dispatching → acknowledged → running → completed | failed | interrupted`; `awaiting_approval` di tengah; `uncertain` bila transport hilang tanpa bukti terminal. Tambahan alasan gagal: `auth_required`, `quota_exhausted`, `engine_missing`.

**Task**: `planned → ready → running → in_review → done`, plus `blocked`, `changes_requested`, `cancelled`. Done butuh evidence.

**Review round (Triad)**: `open → collecting (n/2) → closed → merged_findings`. Reviewer yang gagal/timeout membuat round `closed_partial`, ditampilkan apa adanya.

## 10. Invariant

1. Satu scheduler deterministik memutuskan owner berikut; LLM hanya mengusulkan.
2. Satu sesi = satu run aktif.
3. Satu write lease efektif per canonical root (termasuk alias path, junction, parent/child).
4. Lease tidak dilepas karena TTL bila proses mungkin masih menulis.
5. Balasan diterima hanya bila run, author, generation, revisi, dan ack packet cocok.
6. Retry identik mengembalikan hasil lama; retry ID dengan isi berbeda ditolak.
7. Agent tidak bisa menaikkan budget, mengonfirmasi decision, atau menyetujui izin agent lain.
8. Blocking ask menahan dispatch dependen; dismiss ≠ approve.
9. Review berlaku untuk revisi/hash persis.
10. Restart tidak menjalankan ulang mutasi yang outcome-nya uncertain.
11. Prompt, lease, dan root UI bukan OS sandbox.
12. Tidak ada failover di tengah run mutatif yang outcome-nya belum diketahui.
13. **Baru**: Tool approval tidak bisa diselesaikan lewat Control API scope `island`.
14. **Baru**: Reviewer paralel dalam satu round tidak menerima temuan reviewer lain sebelum round ditutup.
15. **Baru**: Child process tidak pernah mewarisi variabel API key dari environment Walt.

## 11. Handoff packet

```json
{
  "schemaVersion": 2,
  "taskId": "T-014",
  "taskRevision": 3,
  "from": {"persona": "builder", "engine": "codex"},
  "to": [{"persona": "reviewer-a", "engine": "claude"}, {"persona": "reviewer-b", "engine": "gemini"}],
  "mode": "triad",
  "goal": "Implement borrow date validation",
  "constraints": ["Do not change the chosen API contract"],
  "decisionRefs": ["D-003"],
  "fileRefs": [{"path": "src/borrow.ts", "sha256": "<actual-hash>"}],
  "acceptance": ["Return date cannot precede borrow date"],
  "expectedOutput": ["findings with severity and evidence"],
  "humanInstructionsThroughSeq": 42,
  "replyLocale": "id",
  "budget": {"maxProviderTurns": 6, "remainingProviderTurns": 4}
}
```

Packet ditulis dalam bahasa Inggris; `replyLocale` mengatur bahasa jawaban yang tampil ke cello. Host menghitung hash packet dan memvalidasi file reference.

## 12. Human control

| Aksi | Dari jendela Walt | Dari island (Ce:L) |
|---|---|---|
| Queue next | Ya | Tidak (butuh teks panjang) |
| Send guidance now | Ya | Tidak |
| Pause after turn | Ya | Ya |
| Interrupt now | Ya | Ya |
| Resume / Continue (budget baru) | Ya | Continue: tidak (harus sadar budget); Resume dari pause: ya |
| Jawab ask Decision/Info | Ya | Ya (opsi pilihan; teks bebas pendek) |
| Tool approval | Ya | **Tidak** — hanya "Open in Walt" |
| End room | Ya | Tidak |

## 13. Files, deliverable, preview, context, tools

Sama dengan v1.0 bagian 12–15 (canonical path, manifest SHA-256, snapshot sebelum/sesudah giliran, conditional restore, preview HTML terisolasi, urutan context packet, tool internal `get_project_brief`, `list_tasks`, `propose_task`, `propose_handoff`, `read_room`, `propose_decision`, `open_ask`, `register_artifact`, `record_review`). Tool Walt diekspos ke ketiga engine lewat **satu Walt MCP server** dengan credential run-scoped.

## 14. API host

Internal (main window), sama dengan v1.0: `/v1/projects`, `/v1/rooms`, `/v1/rooms/:id/commands`, `/v1/rooms/:id/snapshot`, `/v1/events`, `/v1/runs/:id/interrupt`, `/v1/asks/:id/answer`, `/v1/artifacts/:id/reviews`, `/v1/imports/*`, `/v1/backups`, `/v1/diagnostics`.

Publik untuk Ce:L: lihat `05_CEL_INTEGRATION.md`. Kedua API berbagi host, tetapi token dan scope berbeda.

## 15. Windows engineering

- `spawn(executable, argv, {shell:false})`. Shim `.cmd` dari npm di-resolve ke entry JS lalu dijalankan dengan Node yang sesuai, bukan lewat shell.
- Path spasi, Unicode, beda drive, dan backslash diuji.
- Job object per proses agent untuk cleanup child tree.
- Tray: close jendela = sembunyikan ke tray bila ada run aktif atau Ce:L tersambung; Quit = tanya bila ada run aktif.
- Start with Windows: opsional, default **on** (agar island Ce:L selalu bisa tersambung); Walt mulai tersembunyi di tray.
- Protokol `walt://` didaftarkan saat install untuk deep link dari Ce:L.

## 16. Recovery, backup, observability

Startup: migrasi → integrity check → run belum selesai → rekonsiliasi proses/lease → Recovery Center. Backup memakai SQLite online backup. Log memuat correlation ID dan tidak memuat token. Error provider dipetakan ke: auth, quota, model unavailable, timeout, permission denied, provider failure, uncertain delivery.
