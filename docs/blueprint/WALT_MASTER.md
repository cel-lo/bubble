# WALT MASTER — Blueprint v1.1

Gabungan semua dokumen v1.1. Dibuat 8 November 2026.

---

<!-- file: 00_START_HERE.md -->

# Walt — Project Blueprint v1.1

Versi 1.1 • 8 November 2026 • Pemilik: cello • Target: laptop Windows, pemakaian pribadi • Proyek anak Ce:L.

Walt adalah aplikasi desktop terpisah tempat cello memimpin satu grup kerja berisi **Codex, Claude, dan Gemini** dalam satu proyek lokal. Progresnya dipantau dan dikendalikan dari dynamic island **Ce:L**. Paket ini berisi rancangan dan spesifikasi; aplikasinya belum dibangun.

## Urutan baca

| File | Isi |
|---|---|
| `02_PRODUCT_PROPOSAL.md` | Apa itu Walt, mode kolaborasi, fitur inti v1 |
| `03_ARCHITECTURE.md` | Stack, proses, login via CLI, warm/sleep, adapter, data, invariant |
| `04_FLOWS.md` | Alur pengguna dan sistem (F1–F14) |
| `05_CEL_INTEGRATION.md` | Kontrak Control API dan pemetaan state island |
| `06_ROADMAP_ACCEPTANCE.md` | Fase P0–P4, backlog W-001–W-022, acceptance A01–A54 |
| `08_DESIGN_BRIEF.md` | Arah visual Bloks × Ce:L dan daftar layar untuk FigCraft |
| `01_RESEARCH_COMPARISON.md` | Riset Bloks vs Semaphore (v1.0) + catatan Gemini |
| `07_EXTENSION_GUIDE.md` | Fitur lanjutan (v1.0) + status Deferred/Not planned |
| `09_MODEL_HANDOFF_PROMPT.md` | Prompt untuk model yang akan membangun |
| `CHANGELOG.md` | Perubahan dari v1.0 |

`WALT_MASTER.md` menggabungkan semua dokumen di atas. Versi lama ada di `../blueprint-v1.0/`.

## Keputusan utama

- Walt adalah aplikasi terpisah (Electron). Ce:L menjadi remote dan layar status lewat API lokal.
- Tiga engine dijalankan lewat CLI resmi dengan login masing-masing. Tidak ada API key.
- Proses agent tetap hangat selama dipakai dan tidur saat idle, supaya tidak lag dan tidak membebani laptop.
- Mode inti: Build & Review dan Triad (dua reviewer paralel).
- Tool approval hanya bisa diberikan dari jendela Walt.
- UI dua bahasa: English dan Indonesia.

## Tahap berikutnya

1. ✅ Flow dan arsitektur (dokumen ini).
2. ⏭ Desain UI/UX di FigCraft (file Ce:L, zona kanan, baris "Walt"), sesuai daftar layar di `08_DESIGN_BRIEF.md`.
3. Spike P0 pembangunan.

## Default yang bisa diubah

| Hal | Default | Bisa diubah di |
|---|---|---|
| Idle timeout agent | 15 menit | Settings → General |
| Start with Windows | On (tersembunyi di tray) | Settings → General |
| Template room baru | Build & Review | Saat membuat room |
| Batas proses hangat | 6 | Settings → Engines |
| Bahasa | Ikuti Windows | Settings → General |

---

<!-- file: 02_PRODUCT_PROPOSAL.md -->

# Walt — Proposal Produk dan PRD

Versi 1.1 • 8 November 2026 • Pemilik: cello. Perubahan dari v1.0 ada di `CHANGELOG.md`.

## 1. Definisi produk

**Walt adalah aplikasi desktop Windows pribadi tempat cello memimpin satu grup kerja berisi Codex, Claude, dan Gemini dalam satu proyek lokal. Percakapan, tugas, handoff, file, review, dan keputusan tersimpan di satu tempat dan bisa dipantau serta dikendalikan dari dynamic island Ce:L.**

Tagline kerja: **One project. Three agents. You lead.**

Walt adalah **proyek anak Ce:L**:

- Walt adalah aplikasi terpisah (`Walt.exe`). Ia berjalan sendiri, punya jendela utama dan tray sendiri.
- Ce:L (aplikasi dynamic island) menjadi **remote control dan layar status**. Ce:L menampilkan progres, memberi notifikasi, menjawab pertanyaan ringan, dan membuka room Walt.
- Walt tetap berfungsi penuh tanpa Ce:L. Ce:L tetap berfungsi tanpa Walt.
- Desain UI Walt dibuat di file FigCraft Ce:L yang sama (`D:\FIGCRAFT\Designs-CeL.figcraft`), mengikuti aturan zona kanvas Ce:L.

## 2. Masalah yang diselesaikan

Memakai tiga AI berarti memindahkan konteks berulang kali, menjelaskan keputusan ulang, menyalin hasil dari satu AI ke AI lain, dan memastikan semuanya melihat versi file yang sama. Percakapan tersebar di tiga aplikasi; keputusan dan pekerjaan yang belum selesai mudah hilang.

Ukuran keberhasilan: tugas bisa diserahkan dengan konteks yang tepat, dikerjakan, direview oleh agent lain, dan hasilnya terlihat **tanpa copy-paste antar-AI**, sementara cello cukup melirik island untuk tahu statusnya.

## 3. Tujuan dan batas

| Tujuan | Perilaku yang harus terlihat |
|---|---|
| Kolaborasi tiga agent | Codex, Claude, Gemini membaca brief, keputusan, dan revisi file yang sama |
| cello tetap koordinator | cello menentukan arah, menyetujui keputusan, menghentikan alur |
| Handoff berkualitas | Tujuan, batasan, file + hash, keputusan, dan acceptance ikut dikirim |
| Responsif | Agent di room aktif tetap hangat; tidak ada cold start setiap giliran |
| Rendah perawatan | Login memakai CLI resmi; idle tidak memakan RAM besar |
| Terpantau dari island | Status, giliran, Needs you, dan selesai/gagal muncul di Ce:L |
| Bukti hasil | Diff, test evidence, review, dan versi deliverable tersedia |
| Dua bahasa | UI English dan Indonesia |

Bukan tujuan: akun Walt, billing, telemetri, hosting publik, multiuser, API key manual, penggabungan memory antar-provider, atau membaca riwayat chat web secara diam-diam.

## 4. Model mental

| Entitas | Arti | Contoh |
|---|---|---|
| Workspace | Lingkungan milik cello | Personal |
| Project | Tujuan + folder kerja + keputusan + index file | Ce:L, BIBI |
| Engine | CLI yang terpasang dan login | Codex, Claude, Gemini |
| Persona | Peran + engine + model + izin | Builder · Codex, Reviewer · Gemini |
| Room | Percakapan bersama dalam satu project | Main, Database |
| Branch | Cabang pembahasan dari pesan tertentu | COD vs QRIS |
| Task | Pekerjaan dengan owner, acceptance, dependency | Buat schema transaksi |
| Run | Satu giliran kerja satu persona | Codex mengerjakan T-014 |
| Handoff | Paket serah tugas dari satu persona ke yang lain | Codex → Claude: review |
| Deliverable | Hasil terdaftar dengan manifest dan revisi | schema.sql r2 |
| Decision | Pilihan yang dikonfirmasi cello | MVP pakai COD |
| Ask | Pertanyaan/permintaan izin ke cello | Pilih masa pinjam |

Persona memisahkan **peran** dari **engine**. Satu engine boleh dipakai beberapa persona. Peran tidak dikunci per provider; template hanya menyarankan.

## 5. Skenario utama

### 5.1 Build & Review (dua agent)
1. cello menulis tujuan di room.
2. Builder menerima handoff packet dan write lease, lalu bekerja.
3. Reviewer membaca revisi file yang sama (read-only) dan mengirim temuan dengan severity dan bukti.
4. Builder memperbaiki bila masih ada budget. Review ulang.
5. Budget habis atau selesai → hasil dan sisa masalah dikembalikan ke cello. Island memberi peek.

### 5.2 Triad (tiga agent)
Seperti 5.1, tetapi **dua reviewer independen berjalan paralel** (keduanya read-only) pada revisi yang sama. Reviewer tidak melihat temuan satu sama lain sebelum keduanya selesai, untuk menghindari saling mengiyakan. Builder menerima temuan gabungan yang sudah dideduplikasi host. Tidak ada voting; temuan dinilai dari bukti.

### 5.3 Roundtable (diskusi tanpa menulis file)
Ketiga agent menjawab bergiliran (atau lead-last). Tidak ada write lease. Hasilnya ringkasan + usulan decision yang harus dikonfirmasi cello.

### 5.4 Research
Satu persona menjadi researcher (template menyarankan Gemini karena context besar dan pencarian web bawaan), satu menulis, satu mereview. Sumber dicatat sebagai provenance.

### 5.5 Mengubah arah saat agent bekerja
Composer: **Queue next** atau **Send now** (steering bila CLI mendukung). Arahan baru menaikkan human revision; hasil yang belum mengakui revisi terbaru ditandai provisional.

### 5.6 Dipantau dari island
cello bekerja di aplikasi lain. Island menampilkan siapa yang sedang bekerja dan giliran ke berapa. Saat ada pertanyaan keputusan, island memunculkan peek; cello menjawab langsung dari island. Saat ada permintaan izin tool, island hanya membuka jendela Walt.

## 6. Mode kolaborasi

| Mode | Peserta | Menulis file | Budget default |
|---|---|---|---|
| Direct | Agent yang di-mention | Sesuai izin persona | 1 giliran |
| Build & Review | 1 builder, 1 reviewer | Builder saja | 4 giliran |
| Triad | 1 builder, 2 reviewer | Builder saja | 6 giliran |
| Roundtable | 2–3 agent | Tidak | 1 putaran (3 giliran) |
| Challenge | 2–3 agent | Tidak | Pendapat independen → 1 putaran kritik |
| Manual handoff | cello memilih penerima | Sesuai izin | 1 giliran per langkah |

Budget dihitung per dispatch ke provider. Agent tidak bisa menaikkan budget; hanya **Continue** dari cello yang membuka budget baru. Auto route (LLM memilih) ditunda.

## 7. Context dan memory

Sumber konteks: project brief, confirmed decisions, task + acceptance, instruksi terbaru cello, file terpilih beserta hash, temuan review relevan, ringkasan room. Context inspector menunjukkan isi packet yang benar-benar dikirim.

Memory: Project facts, Shared notes, Agent notes, About cello. Agent boleh mengusulkan; promosi ke fact/decision harus dikonfirmasi cello.

Bahasa: agent membalas dalam bahasa yang dipakai cello di chat. Handoff packet dan instruksi sistem antar-agent ditulis dalam bahasa Inggris agar konsisten dan hemat token.

## 8. Trust dan akses

- Satu writer per root proyek. Reviewer read-only, ditegakkan oleh Walt (menolak izin tulis dari CLI) dan oleh mode izin CLI bila tersedia. Capability yang ditegakkan ditampilkan jujur per engine.
- Tool approval (shell, tulis file, jaringan) hanya bisa disetujui di jendela Walt, tidak dari island.
- Walt tidak menyimpan password atau API key; login diurus CLI resmi masing-masing.
- Prompt, lease, dan root UI bukan OS sandbox.

## 9. Fitur inti v1

| ID | Requirement | Bukti selesai |
|---|---|---|
| PR-01 | Project setup: folder existing atau managed | Root canonical + brief tersimpan |
| PR-02 | Engine Doctor: deteksi tiga CLI, versi, status login | Status aktual, bukan badge palsu |
| PR-03 | Group chat 3 agent + cello, mention, streaming | Pesan asli tiap engine tampil |
| PR-04 | Handoff packet terstruktur | Penerima mengakui revisi packet |
| PR-05 | Budget terikat | Tidak ada giliran ekstra tanpa Continue |
| PR-06 | Shared files + write lease | Reviewer melihat hash keluaran builder |
| PR-07 | Task board | State terhubung ke run/evidence |
| PR-08 | Kontrol manusia: pause, interrupt, ask | Status mengikuti runtime |
| PR-09 | Deliverable + review berversi | File berubah → review lama stale |
| PR-10 | Recovery | Tidak menjalankan ulang mutasi saat restart |
| PR-11 | Decisions + context inspector | Packet bisa dibuka |
| PR-12 | Diagnostics: auth, kuota, capability | Unsupported tidak disamarkan |
| PR-13 | Warm/sleep lifecycle agent | Giliran kedua tanpa cold start; idle melepas proses |
| PR-14 | Control API untuk Ce:L | Island feed + perintah aman bekerja |
| PR-15 | UI EN/ID | Semua string melalui katalog i18n |

## 10. Kriteria sukses

1. Task dikerjakan satu engine dan direview engine lain pada revisi yang tepat.
2. Tidak ada copy-paste manual antar-agent setelah task dibuat.
3. Tidak ada double dispatch atau double mutation pada retry/restart yang disimulasikan.
4. Giliran kedua di room aktif dimulai tanpa spawn proses baru.
5. Status di island sama dengan status di jendela Walt (selisih < 1 detik pada uji lokal).
6. Error, kuota, dan login kedaluwarsa dilaporkan jujur tanpa kehilangan riwayat.

---

<!-- file: 03_ARCHITECTURE.md -->

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

---

<!-- file: 04_FLOWS.md -->

# Walt — User Flows dan System Flows

Versi 1.1. Flow ini menjadi dasar desain FigCraft dan acceptance test. Setiap flow menulis apa yang dilihat cello di **jendela Walt** dan di **island Ce:L**.

Notasi: `[W]` = jendela Walt, `[I]` = island Ce:L, `[H]` = host (tidak terlihat).

---

## F1. Instalasi dan setup pertama

1. cello memasang Walt. Installer mendaftarkan protokol `walt://` dan opsi Start with Windows (default on).
2. `[W]` Welcome singkat: pilih bahasa (English / Indonesia / ikuti Windows).
3. `[H]` Doctor memeriksa ketiga CLI: binary, versi, status login.
4. `[W]` Layar **Engines** menampilkan tiga kartu (Codex, Claude, Gemini):
   - **Ready** — versi + akun terdeteksi.
   - **Not installed** — tombol "Show install command" (salin perintah; Walt tidak memasang otomatis).
   - **Login needed** — tombol "Open terminal to log in" yang menjalankan perintah login CLI di terminal baru.
   - **Error** — pesan konkret.
5. cello boleh lanjut dengan minimal satu engine Ready. Engine yang tidak siap tetap terlihat dengan alasannya.
6. Lanjut ke F2.

Gagal: tidak ada engine siap → Walt tetap bisa dibuka (arsip, pengaturan), tombol New project menjelaskan bahwa minimal satu engine diperlukan.

## F2. Membuat project dan room

1. `[W]` New project: nama, folder (existing via picker atau managed), tujuan, batasan.
2. `[H]` Canonicalize root, cek overlap dengan project lain, simpan brief r1.
3. `[W]` Pilih template tim:
   - Build & Review (default)
   - Triad
   - Roundtable
   - Research
   - Custom
4. `[W]` Template mengisi persona yang disarankan; cello bisa mengganti engine/model/peran tiap persona. Contoh Triad default: Builder · Codex, Reviewer · Claude, Reviewer · Gemini.
5. `[W]` Room "Main" terbuka. `[H]` Prewarm persona pertama (F9).

## F3. Pesan dan routing

1. cello mengetik di composer. Selector route di bawah composer: **Template flow** / **Everyone answers** / **Only mentioned**.
2. `@` membuka mention menu berisi persona di room (avatar engine + nama peran).
3. Enter → `[H]` pesan disimpan (`message.accepted`) sebelum dispatch apa pun.
4. `[H]` Scheduler menentukan run berikutnya:
   - Mention eksplisit → persona itu (mode Direct).
   - Template flow → langkah berikut template.
   - Everyone → serial sesuai urutan room; persona berikut menerima jawaban committed sebelumnya.
5. `[W]` Workflow strip: owner sekarang, langkah, giliran tersisa, tombol Pause/Stop.
6. `[I]` Closed island menampilkan titik warna engine yang aktif + indikator berjalan.

## F4. Build & Review / Triad (alur inti)

```
cello ──pesan──► Scheduler ──packet+lease──► Builder (Codex)
                                               │ edit file, test
                                               ▼
                                   artifact r1 (manifest+hash)
                                               │
                     ┌─────────────────────────┴─────────────────────────┐
                     ▼                                                   ▼
             Reviewer A (Claude, read-only)                 Reviewer B (Gemini, read-only)
                     │ temuan disembunyikan dari B                       │
                     └──────────────► round closed ◄─────────────────────┘
                                         │ host gabung + dedupe temuan
                          ┌──────────────┴──────────────┐
                    tidak ada temuan blocking      ada temuan
                          │                             ▼
                          ▼                  Builder fix → artifact r2
                       Done → peek            → review ulang (bila budget)
```

1. `[H]` Builder menerima handoff packet + write lease. `[W]` Baris handoff gaya Bloks: `cello → Builder · Codex: <judul task>`.
2. Builder bekerja. `[W]` Pesan streaming; aktivitas tool dilipat ("Edited 3 files · ran tests"). `[I]` Open page Walt: "Codex · building · turn 1/6".
3. Builder selesai → `[H]` snapshot sesudah giliran, artifact r1 terdaftar, lease dilepas setelah proses idle.
4. `[W]` Baris handoff: `Builder · Codex → Reviewers: ready for review (3 files, r1)`.
5. `[H]` Round review dibuka. Dua reviewer berjalan paralel, read-only. Semua permission tulis/eksekusi dari reviewer ditolak otomatis dan dicatat.
6. Masing-masing reviewer mengirim temuan (severity, file, baris, bukti). `[W]` Ditampilkan begitu masuk, tetapi tidak dimasukkan ke konteks reviewer lain sampai round tertutup.
7. `[H]` Round ditutup → temuan digabung & dideduplikasi → jika ada blocking, builder menerima packet fix.
8. Builder memperbaiki → artifact r2 → review r1 ditandai **stale** → review ulang bila budget masih ada.
9. Selesai: `[W]` Deliverable card (revisi, diff, test, status review masing-masing reviewer, tombol Accept). `[I]` Peek: "Done · 0 open findings" (atau "Budget used · 2 findings left").
10. cello menekan **Accept** atau **Continue** (budget baru) di Walt.

Build & Review sama, dengan satu reviewer.

## F5. Needs you (ask)

1. Agent memanggil `open_ask` (Decision / Info / Review) → `[H]` ask tersimpan; jika blocking, task dependen ditahan.
2. `[W]` Tray "Needs you" di atas composer (maks 3 terlihat).
3. `[I]` Peek: avatar engine + pertanyaan singkat + sampai 3 opsi. Hover memperluas ke open page.
4. cello menjawab:
   - di island: klik opsi, atau "Open in Walt" untuk jawaban panjang;
   - di Walt: opsi atau teks bebas.
5. `[H]` Jawaban tersimpan dengan `answeredVia: island | window`; dispatch dependen dilanjutkan.
6. Dismiss ≠ approve: dismiss menyimpan alasan dan task tetap blocked sampai cello memutuskan.

## F6. Tool approval (izin shell / tulis / jaringan)

1. CLI meminta izin → `[H]` run `awaiting_approval`, approval terhubung ke callback native yang persis.
2. `[W]` Card approval: perintah lengkap, cwd, persona, risiko; tombol Allow once / Deny / (Always allow for this persona, bila didukung).
3. `[I]` Peek kuning: "Gemini wants to run a command" + tombol tunggal **Open in Walt**. Tidak ada tombol Allow di island.
4. Reviewer read-only: permintaan tulis langsung ditolak tanpa bertanya; muncul catatan kecil di activity.
5. Timeout tidak berarti allow.

## F7. Mengubah arah saat agent bekerja

1. cello mengetik saat run berjalan. Composer menawarkan **Queue next** (default) dan **Send now** (bila engine mendukung steer).
2. `[H]` Human revision naik. Send now → steer; status delivery ditampilkan (Sent / Delivered / Not supported).
3. Hasil yang belum mengakui revisi terbaru ditandai **provisional**; scheduler menjadwalkan rekonsiliasi atau bertanya ke cello.

## F8. Pause, interrupt, end

| Aksi | Hasil |
|---|---|
| Pause after turn (`[W]`/`[I]`) | Giliran aktif selesai, tidak ada dispatch berikut. Island: ikon pause |
| Interrupt now (`[W]`/`[I]`) | Status "Stopping…" sampai proses terbukti berhenti; perubahan parsial dicatat |
| End room (`[W]`) | Tolak dispatch baru, interrupt yang aktif, tutup ask dengan alasan, lease ditahan sampai aman |
| Resume (`[W]`/`[I]`) | Dari pause; budget tidak di-reset |

## F9. Warm / sleep agent (sistem)

1. Membuka room atau mulai mengetik → `[H]` prewarm persona yang kemungkinan dipanggil.
2. Antar-giliran proses tetap hidup (`warm`).
3. Idle 15 menit → graceful shutdown → `cold`, session ID tersimpan.
4. Dispatch berikut pada persona `cold` → resume sesi (beberapa detik sekali). `[W]` Status kecil "Waking Claude…".
5. Resume gagal → sesi baru + replay konteks, dicatat di timeline.
6. Laptop bangun dari sleep → health check; proses mati tanpa run aktif → `cold` diam-diam.

## F10. Login kedaluwarsa / kuota habis

1. CLI melaporkan auth gagal → run `failed: auth_required` (tidak dicoba ulang otomatis bila run sudah mengubah file).
2. `[W]` Incident card: "Claude needs you to log in again" + Open terminal to log in + Retry (aktif setelah Doctor hijau).
3. `[I]` Peek merah singkat yang sama.
4. Kuota habis → `quota_exhausted`; card menampilkan info reset bila CLI melaporkannya. Pilihan: tunggu, atau cello menugaskan ulang ke persona/engine lain secara eksplisit (hanya bila outcome run sebelumnya aman).

## F11. Crash / restart

1. Walt atau laptop mati saat run berjalan.
2. Startup: `[H]` migrasi → integrity → rekonsiliasi proses dan lease.
3. Run tanpa bukti terminal → `uncertain`. `[W]` Recovery Center: apa yang terakhir terbukti, file yang berubah sejak snapshot, opsi aman (Inspect, Mark as failed, Retry read-only).
4. `[I]` Peek: "Walt recovered · 1 run needs checking".
5. Tidak ada pengiriman ulang otomatis untuk run mutatif.

## F12. Ce:L tersambung / terputus

1. Ce:L start → baca `%APPDATA%\Walt\control.json` → sambung SSE `island/feed`.
2. File tidak ada atau koneksi ditolak → Ce:L menampilkan Walt sebagai "Not running"; klik → `Walt.exe --background`.
3. Walt quit → SSE tertutup → island kembali ke tampilan normal Ce:L (tanpa halaman Walt aktif).
4. Ce:L quit → Walt tidak terpengaruh.
5. Detail kontrak: `05_CEL_INTEGRATION.md`.

## F13. Branch diskusi (v1.5)

1. `[W]` Pada pesan tertentu: Branch → pilih **Discussion only** (default) atau **Isolated files** (git worktree / salinan terukur).
2. Dialog menegaskan "Discussion branches share project files".
3. Branch tidak membawa approval aktif.

## F14. Impor pekerjaan lama (v1.5)

Pilih sumber (file, transcript, sesi lokal Codex/Claude/Gemini) → preview (isi, asal, redaksi, file yang hilang) → commit snapshot read-only dengan provenance. Bukan sinkronisasi live.

---

<!-- file: 05_CEL_INTEGRATION.md -->

# Walt ↔ Ce:L — Kontrak Integrasi Island

Versi kontrak: `walt-control/1`. Dokumen ini netral teknologi karena stack Ce:L belum ditentukan (Ce:L saat ini berupa desain FigCraft). Klien apa pun yang bisa membaca file JSON, HTTP, dan SSE bisa memakainya.

## 1. Prinsip

- Walt adalah sumber kebenaran. Ce:L hanya menampilkan dan mengirim perintah terbatas.
- Island adalah **layar lirik**: status ringkas, pertanyaan singkat, satu klik. Pekerjaan panjang dibuka di jendela Walt.
- Tidak ada tindakan berisiko dari island. Tool approval selalu dibuka di Walt.
- Kedua aplikasi tetap berjalan bila yang lain mati.

## 2. Penemuan dan autentikasi

Walt menulis file `%APPDATA%\Walt\control.json` saat host siap, dan menghapusnya saat quit normal:

```json
{
  "contract": "walt-control/1",
  "port": 51873,
  "token": "<random 256-bit, base64url>",
  "pid": 12345,
  "startedAt": "2026-11-08T09:00:00Z"
}
```

- Port acak, hanya listen di `127.0.0.1`.
- File diberi ACL hanya untuk user Windows saat ini.
- Token dikirim sebagai `Authorization: Bearer <token>`. Token diganti setiap Walt start. Host menyimpan hash, bukan token.
- Token di file ini memiliki scope `island`. Scope `window` (main window) tidak pernah ditulis ke disk.
- Header `Host` harus `127.0.0.1:<port>`; request dengan `Origin` browser ditolak (mencegah halaman web memanggil API).
- File ada tetapi PID mati → Ce:L menganggap Walt tidak berjalan.

## 3. Endpoint

| Method | Route | Scope | Fungsi |
|---|---|---|---|
| GET | `/island/v1/hello` | island | Versi kontrak, nama app, locale Walt |
| GET | `/island/v1/state` | island | Snapshot lengkap untuk render awal |
| GET | `/island/v1/feed?cursor=` | island | SSE; event ringkas sejak cursor |
| POST | `/island/v1/rooms/:id/pause` | island | Pause after turn |
| POST | `/island/v1/rooms/:id/resume` | island | Lanjut dari pause (tanpa budget baru) |
| POST | `/island/v1/runs/:id/interrupt` | island | Minta interrupt |
| POST | `/island/v1/asks/:id/answer` | island | Hanya ask kind `decision` / `info` |
| POST | `/island/v1/open` | island | Fokus jendela Walt ke room/ask/approval tertentu |

Semua POST memakai `commandId` (idempotency) dan `expectedRevision`. Jawaban ask untuk kind `tool_approval` ditolak dengan `403 not_allowed_from_island`.

Alternatif tanpa HTTP untuk membuka Walt: deep link `walt://room/<id>`, `walt://ask/<id>`, `walt://approval/<id>`.

## 4. Snapshot `state`

```json
{
  "revision": 812,
  "walt": {"status": "running", "locale": "id"},
  "engines": [
    {"engine": "codex",  "auth": "ok",       "quota": "unknown"},
    {"engine": "claude", "auth": "ok",       "quota": {"state": "ok"}},
    {"engine": "gemini", "auth": "required", "quota": "unknown"}
  ],
  "activeRooms": [
    {
      "roomId": "r_01", "project": "BIBI", "title": "Main",
      "state": "running", "template": "triad",
      "owner": {"persona": "Builder", "engine": "codex", "process": "busy"},
      "step": "build", "turn": {"used": 1, "max": 6},
      "tasks": {"done": 2, "total": 5},
      "lastLine": "Editing src/borrow.ts"
    }
  ],
  "needsYou": [
    {"askId": "a_09", "kind": "decision", "engine": "claude", "roomId": "r_01",
     "title": "Loan period?", "options": ["7 days", "14 days"], "blocking": true},
    {"askId": "a_10", "kind": "tool_approval", "engine": "gemini", "roomId": "r_01",
     "title": "Wants to run a command", "options": []}
  ]
}
```

`lastLine` adalah ringkasan aktivitas yang dilaporkan runtime (mis. nama tool/file), dibatasi 60 karakter, tanpa isi chain-of-thought.

## 5. Event feed (SSE)

| Event | Kapan | Island bereaksi |
|---|---|---|
| `room.updated` | Owner/step/turn/progres berubah | Update closed/open state |
| `run.started` | Persona mulai bekerja | Closed: titik engine berdenyut |
| `run.finished` | Run terminal (completed/failed/interrupted) | Peek singkat bila failed |
| `handoff` | Owner berpindah | Peek ringan "Codex → Claude" (opsional, setting) |
| `ask.opened` / `ask.resolved` | Needs you berubah | Peek + badge |
| `room.done` | Exchange selesai | Peek hijau "Done · n findings left" |
| `engine.auth` | Login perlu diulang | Peek merah |
| `engine.quota` | Kuota hampir/sudah habis | Peek kuning |
| `recovery` | Ada run uncertain setelah start | Peek kuning |
| `heartbeat` | Tiap 15 detik | Deteksi putus |

Event di-coalesce maksimal 4 per detik. Bila cursor terlalu lama, server mengirim `resync` dan Ce:L memanggil `state` lagi.

## 6. Pemetaan ke state island (ukuran dari NUSA-SPEC)

| Kondisi Walt | Island | Ukuran (dp) | Isi |
|---|---|---|---|
| Tidak ada room aktif | Normal Ce:L | 150×30 | Tidak berubah |
| Room running | Closed + indikator | 150×30 | Titik warna engine aktif (maks 3) + ring progres giliran |
| Handoff / selesai / gagal | Peek | 310×60 | Avatar engine, satu baris status, 3–4 detik |
| Ask decision/info | Peek persisten | 310×60 | Pertanyaan + hingga 3 opsi; hover → open page |
| Tool approval | Peek persisten | 310×60 | Teks + tombol tunggal "Open in Walt" |
| Hover / klik | Open page "Walt" | 420×140 | Room aktif, owner, langkah, giliran x/y, progres task, Pause/Interrupt/Open |
| Beberapa room aktif | Open page | 420×140 | Daftar ringkas, panah halaman untuk berpindah room |
| Walt mati | Halaman Walt di carousel | 420×140 | "Walt is not running" + tombol Start |

Halaman Walt menjadi satu halaman dalam carousel island Ce:L (sejajar Music, Focus, Shelf, dan seterusnya), memakai pola header, panah halaman, dan page dots yang sama.

## 7. Prioritas peek

Bila beberapa event bersaing: tool approval > auth required > ask blocking > failed > ask non-blocking > done > handoff. Peek persisten (ask, approval) tidak ditimpa peek sementara; peek sementara antre.

## 8. Bahasa

`hello` dan `state` menyertakan `locale` Walt. Teks yang dibuat Walt (judul ask, `lastLine`) dikirim apa adanya. Label UI island memakai katalog i18n Ce:L sendiri dengan dua bahasa yang sama (en/id).

## 9. Versi dan kompatibilitas

- Perubahan aditif (field baru) tidak menaikkan versi; klien wajib mengabaikan field tak dikenal.
- Perubahan breaking → `walt-control/2`; Walt melayani versi lama minimal satu rilis.
- Kontrak ini punya test kontrak sendiri di `packages/control-api` dengan klien contoh (mis. skrip Node kecil) agar bisa diuji sebelum Ce:L dibangun.

---

<!-- file: 06_ROADMAP_ACCEPTANCE.md -->

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

---

<!-- file: 08_DESIGN_BRIEF.md -->

# Walt — Design Brief untuk Fase FigCraft

Versi 1.1. Ini **brief**, bukan spesifikasi visual final. Ukuran dan token final ditentukan saat desain di FigCraft, lalu dicatat kembali di dokumen ini. Menggantikan `04_DESIGN_SPEC.md` v1.0 (token Bloks/Inter tidak dipakai lagi).

## 1. Lokasi desain

- File: `D:\FIGCRAFT\Designs-CeL.figcraft` (satu file dengan Ce:L).
- Frame Walt ditaruh di **zona kanan (baru/upgraded)**, dalam baris berlabel "Walt", mengikuti aturan zona kanvas Ce:L. Frame Ce:L yang sudah ada tidak diubah di tempat.
- Dua kelompok frame:
  1. **Walt window**: aplikasi desktop.
  2. **Island · Walt**: halaman dan peek Walt di island Ce:L (ukuran NUSA-SPEC).

## 2. Arah visual: Bloks × Ce:L

| Ambil dari Bloks | Ambil dari Ce:L / Nusa |
|---|---|
| Navigation rail kiri | Palet gelap: konten `#1C1C1E`, sidebar `#151517`, kartu `#28282A`, pemisah `#323234` |
| Sidebar Rooms + Agents dengan preview pesan terakhir + titik unread | Aksen hijau `#30C759`, toggle & segmented gaya Settings Ce:L |
| Header room: judul, daftar peserta, avatar bertumpuk, aksi (add member, folder, threads, more) | Font Segoe UI Variable |
| Baris handoff tanpa bubble: `A → B: pesan singkat` | Radius kartu 10, item terpilih radius 8 |
| Bubble pesan lembut, mention berwarna | Gerak pegas island untuk elemen yang membuka |
| Composer membulat besar, `+`, mic, tombol kirim bulat | Light theme mengikuti tray/menu Windows 11 |
| Selector route di bawah composer ("Everyone answers") | |

Tambahan khusus Walt:

- **Workflow strip** di bawah header: owner sekarang, langkah template, giliran x/y, Pause/Stop.
- **Inspector kanan** (bisa disembunyikan): Task / Files / Context / Decisions / Activity.
- **Needs you tray** di atas composer.
- **Kartu**: handoff, deliverable, changes, review finding, approval, incident.

Dark adalah default; light tersedia. Area chat tetap dominan.

## 3. Identitas engine

| Engine | Avatar | Warna identitas (usulan, dicek kontras saat desain) |
|---|---|---|
| Codex | Logo Codex resmi (awan gradien biru-ungu dengan `>_`) | Periwinkle, sekitar `#7C8CFF` |
| Claude | Maskot Clawd (pixel, oranye) | Terracotta, sekitar `#D97757` |
| Gemini | Bintang Gemini warna-warni | Turunan dari gradien bintang; dipilih agar tidak bentrok dengan biru Codex |
| cello | Avatar pengguna | Netral |

Aturan:

- Persona = avatar engine + **badge peran** (Builder, Reviewer, Researcher, Lead). Nama persona selalu tertulis; warna tidak pernah menjadi satu-satunya pembeda.
- Satu engine di beberapa persona → avatar sama, badge berbeda.
- Logo resmi dipakai untuk pemakaian pribadi. Bila Walt kelak dibagikan, aset merek ditinjau ulang.

## 4. Daftar layar untuk FigCraft

**Walt window**

1. Welcome + pilih bahasa
2. Engines / Doctor (Ready, Not installed, Login needed, Error)
3. New project (folder, tujuan, batasan)
4. Pilih template tim + atur persona
5. Room · idle (kosong, composer)
6. Room · Build running (streaming, workflow strip, island-like status)
7. Room · Triad review (dua reviewer paralel, kartu temuan)
8. Room · Needs you (ask decision) + approval card
9. Room · Done (deliverable card, Accept / Continue)
10. Inspector: Context packet, Files/diff, Decisions
11. Task board
12. Incident: login needed / quota
13. Recovery Center
14. Settings: General (bahasa, startup, idle timeout), Engines, Personas, Island
15. Versi light dari layar 6

**Island · Walt** (ukuran NUSA-SPEC)

16. Closed · running (titik engine + ring giliran) 150×30
17. Peek · handoff 310×60
18. Peek · ask decision (opsi) 310×60
19. Peek · tool approval (Open in Walt) 310×60
20. Peek · done / failed / login needed 310×60
21. Open · Walt page (satu room) 420×140
22. Open · Walt page (beberapa room, carousel) 420×140
23. Open · Walt not running 420×140

## 5. Bahasa dan microcopy

Semua string ada dalam dua bahasa. Contoh pasangan:

| Key | English | Indonesia |
|---|---|---|
| run.queued | Waiting for turn | Menunggu giliran |
| run.preparing | Preparing context | Menyiapkan konteks |
| run.acknowledged | Context received | Konteks diterima |
| run.running | Working | Sedang bekerja |
| run.awaiting_approval | Needs your permission | Perlu izin kamu |
| run.stopping | Stopping… | Menghentikan… |
| run.uncertain | Needs checking | Perlu diperiksa |
| process.waking | Waking {engine}… | Membangunkan {engine}… |
| engine.login_needed | {engine} needs you to log in | {engine} perlu login ulang |
| island.open_in_walt | Open in Walt | Buka di Walt |
| needs_you | Needs you | Butuh kamu |

Teks harus muat di kedua bahasa (bahasa Indonesia biasanya lebih panjang); uji layout dengan string terpanjang.

## 6. Interaksi kunci

Enter kirim, Shift+Enter baris baru, IME aman. Ctrl+K palette, Ctrl+N room baru, Ctrl+F cari. Escape menutup overlay, tidak menghentikan run. Stop selalu terlihat saat run aktif. Draft composer tersimpan per room. Semua kartu bisa difokus keyboard.

---

<!-- file: 01_RESEARCH_COMPARISON.md -->

# Walt — Analisis Bloks dan Semaphore (v1.0, dengan catatan v1.1 di bagian 9)

Tanggal riset: 7 November 2026. Metode: pengambilan snapshot GitHub melalui tree API, pembacaan dokumentasi, inspeksi statis modul terpilih, dan inspeksi screenshot serta CSS. Ada 70 file referensi yang berhasil diambil. Angka ini menyatakan jumlah file yang tersedia untuk penelitian, bukan audit menyeluruh setiap barisnya. Tidak dilakukan instalasi dependency, login provider, atau uji percakapan nyata pada aplikasi upstream.

## 1. Snapshot dan bukti

| Sumber | Snapshot | Versi dari package.json | Bentuk produk |
|---|---|---|---|
| [Bloks](https://github.com/hamedgitty/bloks) | `27494d1e3947ef5efe1ea8bbfdf64e2ba37d71a7` | 3.2.7 | Workspace agent dengan UI React, harness server, Electron |
| [Semaphore](https://github.com/illianaa/semaphore) | `e0880c3d5edaddec1fa1b3898fe15759b49d9c2e` | 0.15.0 | Room lokal yang menghubungkan dua agent dalam aplikasi native |

Snapshot dipin agar model penerima dapat membedakan fakta penelitian dari perubahan upstream setelah tanggal ini. Gunakan `SOURCES.md` untuk tautan file. Label **C** berarti didukung kode yang diinspeksi; **D** berarti didokumentasikan tetapi tidak divalidasi runtime; **W** berarti keputusan atau perluasan khusus Walt. C tidak berarti bebas bug.

## 2. Perbedaan arsitektur yang menentukan

Bloks memisahkan renderer, harness, dan desktop shell. UI mengirim command dan menerima SSE; driver menormalkan output provider menjadi event. Codex memakai app-server JSON-RPC; driver Claude memakai subprocess stream-json. Session cursor menyambungkan giliran. Referensi: B1, B2, B3, B4. **C**

Semaphore menyimpan room journal, binding sesi native, delivery cursor, dan satu pending turn. Handoff memakai inbox dan acknowledgment; kepemilikan giliran memutuskan siapa boleh memberi balasan. Tool activity tetap di aplikasi asal. Referensi: S1–S4. **C/D**

Implikasi untuk Walt: ambil struktur host Bloks sebagai baseline lintas platform, lalu implementasikan kontrak pengiriman dan versi hasil yang ketat. Jangan menempelkan dua aplikasi secara acak atau membuat LLM router bertanggung jawab atas transaksi, izin, dan konsistensi file.

## 3. Inventory keluarga fitur dan keputusan adaptasi

Tabel ini mencakup keluarga fitur utama yang ditemukan di kode, dokumentasi arsitektur, README, dan UI. Ini bukan klaim bahwa semua fitur sudah diuji atau sama matang di setiap OS. `—` berarti tidak ditemukan padanan dalam sumber yang ditinjau, bukan bukti mutlak bahwa fitur tidak ada.

| ID | Keluarga fitur | Bloks | Semaphore | Walt / tahap |
|---|---|---|---|---|
| F01 | Workspace lokal | Multiworkspace, isolasi konfigurasi/memory (D) | Room dan shared folder (C) | Workspace + Project + Room / P1 |
| F02 | Agent/persona | Nama, role, seniority, engine (D) | Dua seat native dan manusia (C) | Persona dapat ditukar, default dua agent / P1 |
| F03 | Grup chat | Room, DM, mention (D) | Percakapan tiga peserta (C) | Grup sebagai pusat kerja / P1 |
| F04 | Routing | Everyone, lead, auto (C) | Speaker berikut dipilih saat handoff (C) | Manual, everyone, lead; auto opsional / P2–P5 |
| F05 | Serah tugas | Pesan antar-agent, chain budget (C) | Turn ownership dan next speaker (C) | Handoff terstruktur dan bounded / P2 |
| F06 | Batas loop | Chain/task budget (C) | Stop after 4/10/20/tanpa batas (D) | Default 4 turn; budget tidak dapat diubah agent / P2 |
| F07 | Pengiriman | Event dan queued messages (D) | Receipt, acknowledgment, uncertain (C) | Ledger pengiriman + replay yang aman / P1–P2 |
| F08 | Kendali manusia | Stop, queued/send-now, take back (D) | Take stick, interjection, pause/end (C/D) | Pause-after-turn, interrupt-now, end / P2 |
| F09 | Pertanyaan/approval | Ask broker dan question cards (C) | Needs you dan jenis ask (C) | Inbox permintaan; blokir sesuai task / P2 |
| F10 | Aktivitas alat | Streaming canonical events (C) | Tetap di native app (D) | Log tool, file, command dalam inspector / P1 |
| F11 | Dokumen bersama | Attachments, preview, file follow (D) | Shared folder atau proyek existing (C) | Linked project root + managed files / P1 |
| F12 | Deliverable registry | Artifact/changes UI (D) | Manifest, hash, revision, ready (C) | Registry wajib untuk hasil final / P2 |
| F13 | Review hasil | Perubahan dan agent review (D) | Source/visual review terikat revision/hash (C) | Review source/visual/test terpisah / P2 |
| F14 | Preview | Panel file/browser (D) | Snapshot HTML immutable dan terisolasi (C) | Preview per revisi; tidak akses control API / P3 |
| F15 | Perubahan file | Snapshot konten, diff, undo bersyarat (C) | Giliran edit lewat instruksi (C/D) | Checkpoint dan conditional restore / P2 |
| F16 | Rehearsal/compare | Clone proyek, bandingkan attempt (C) | — | Cabang file terisolasi; choose/apply / P4 |
| F17 | Branch percakapan | Snapshot hingga pesan terpilih (C) | — | Branch chat + pilihan isolasi file / P3 |
| F18 | Rewind/redo | Rewind chat dan file, redo/carry-on (D) | — | Rewind audit-preserving; file ops terpisah / P3 |
| F19 | Impor sesi | Claude Code/Codex lokal; fork bila cocok (C) | Binding sesi native (C/D) | Impor preview-first + provenance / P3 |
| F20 | Impor setup | Persona/skills/config dari tool lain (D) | Installer skill/command (C/D) | Impor persona/rule tanpa rahasia / P4 |
| F21 | Shared memory | Memory panel dan shared notes (C/D) | Riwayat native + room journal (C) | Brief, keputusan, shared/agent notes / P2 |
| F22 | Recall/compaction | Recall, fresh session, compact notice (D) | Delivery cursor dan context envelope (C) | Context packet berversi dan dapat dilihat / P2 |
| F23 | Goals/job board | Goals, tasks, outcomes (D) | Ask dan deliverables, bukan taskboard lengkap | Task board + evidence-based completion / P2 |
| F24 | Multi-engine | Claude/Codex, ACP, API, Ollama (C/D) | Dua native seat; headless legacy (C/D) | Dua adapter utama; provider registry / P1–P5 |
| F25 | Model/effort | Model catalog dan effort picker (C) | Model dipilih di native chat (D) | Catalog dinamis per adapter / P1 |
| F26 | Backup engine | Failover saat akses/limit bermasalah (C/D) | — | Failover eksplisit, cek dispatch dahulu / P5 |
| F27 | Usage | Token/cost/limit/engine pause (D) | Mengikuti akun native (D) | Actual/estimate/unknown dibedakan / P2 |
| F28 | Session lifecycle | Resume, fork, restart, cut-off (C/D) | Binding, wake, recovery uncertain (C) | Walt-owned session + recovery journal / P1–P2 |
| F29 | Skills/MCP | Registry, versions, tools, CLI plugins (D) | Shared skill instruksi kolaborasi (C/D) | MCP internal dan recipe/template / P2–P5 |
| F30 | Security controls | Policy, approvals, redaction, checkup (C/D) | Localhost/origin/token dan binding (C/D) | Capability policy + evidence audit / P1 |
| F31 | Search/reading position | Unread, last read, quote, mentions (D) | Search room, receipts, transcript (D) | Search dan provenance link / P3 |
| F32 | Team templates | Team file/catalog/library (D) | — | Template builder-reviewer/research / P3 |
| F33 | Rich content | Generative cards/tables/charts (D) | Markdown dan tabel; bukan raw HTML chat (C/D) | Schema card registry, tanpa arbitrary JSX / P4 |
| F34 | Browser | Embedded browser, agent control, takeover (D) | Tool browser dari aplikasi native (D) | Browser panel optional / P5 |
| F35 | Terminal | Terminal panel, split, sessions (D) | Terminal/log native (D) | Readable command log dahulu, PTY kemudian / P1–P4 |
| F36 | Automations | Routine, watcher, webhook, workflow, intent (D) | — | Jadwal lokal dan workflow bounded / P5 |
| F37 | Overview/attention | Brief, waiting items, incident desk (D) | Needs you, status, notification (C/D) | Mission overview dan Attention Center / P2–P4 |
| F38 | Voice/meeting | Voice, group call, meeting notes (D) | — | Voice input/output + notes opsional / P6 |
| F39 | Computer use | VM/cloud/local screen dengan batas OS (D) | Kemampuan native host (D) | Adapter tersendiri; Windows perlu bukti / P6 |
| F40 | Backup/export | Backup, restore, workspace transfer (D) | Journal lokal, retained rooms (C/D) | Snapshot DB konsisten + manifest / P3 |
| F41 | Mobile/remote | iPhone, browser, LAN/cloud/hosted (D) | Companion lokal (D) | Companion lokal; remote opt-in / P6 |
| F42 | People/membership | Owner/admin/member/guest (D) | Satu manusia (C) | Satu pemilik di inti; multiuser ekstensi / P6 |
| F43 | Chat platforms | Slack/Discord/Telegram/WhatsApp/Signal (D) | — | Konektor opsional, bukan dependency / P6 |
| F44 | App connections | MCP, OAuth/connectors, email (D) | Native tools aplikasi asal (D) | MCP dulu; konektor eksternal pilihan / P5–P6 |
| F45 | Location/Home Assistant | Terdokumentasi dalam arsitektur (D) | — | Ekstensi personal opsional / P6 |
| F46 | Branding/theme | Light/dark, avatar pixel, accent (C/D) | Light/dark, green, pixel wordmark (C) | Pola layout Bloks + status strip Semaphore / P1 |
| F47 | Settings/help | Catalog settings, agent menjelaskan UI (D) | Setup & connections, doctor (C/D) | Diagnostics dan deep-link setting / P1–P4 |
| F48 | Engine scout/training export | Analisis outcome, ekspor data (D) | — | Evaluasi lokal opt-in; ekspor terfilter / P6 |
| F49 | Updates/recovery | Packaged update/restart/tray (D) | Runtime identity dan doctor (C/D) | Update manual awal, process recovery / P1–P4 |
| F50 | Native app bridge | Fokus engine sendiri; impor sesi lokal (C) | Inti produk, macOS (C/D) | Eksperimen adapter native terpisah / P6 |
| F51 | SaaS/plan/hosted AI | Produk cloud, plan, hosted engine (D) | Tidak punya hosted service (D) | Tidak dibutuhkan; padanan lokal, bukan paywall |

## 4. Temuan kode yang perlu mengubah rancangan Walt

### 4.1 Bloks bisa membawa sesi lokal lama

`server/session-import.ts` membaca format Claude Code dan Codex lokal secara read-only, memperlihatkan preview/digest, menyaring baris sensitif, dan memakai fork saat engine mendukungnya. Ini lebih kuat daripada sekadar paste ringkasan. Tetapi itu bukan akses ke seluruh chat web ChatGPT/Claude, dan format file lokal bisa berubah. Walt meniru konsep dengan adapter importer terpisah dan tidak menulis sumber aslinya. **C; B5**

### 4.2 Branch chat tidak otomatis mengisolasi file

`server/branch.ts` menyalin percakapan sampai jawaban tertentu dan memberi tanda bahwa file workspace tetap dibagi. Native fork juga tidak identik dengan branch ke pesan arbitrer. Walt harus menampilkan pilihan jelas: branch pembahasan saja atau branch dengan worktree/copy terisolasi. **C; B6**

### 4.3 Undo bersifat kondisional

Bloks menyimpan versi konten dan mengembalikan file hanya jika hash sekarang sesuai hasil turn yang hendak dibatalkan. Ia juga memperhitungkan turn yang overlap. Walt menggunakan write lease pada akar proyek dan conditional restore; perubahan user yang lebih baru tidak ditimpa. **C; B7**

### 4.4 Rehearsal bukan sandbox untuk seluruh dunia

Clone folder melindungi salinan file, tetapi command yang mengirim email atau mengakses layanan luar tetap punya efek nyata. Walt menyatakan isolation scope secara jujur dan menerapkan policy jaringan/tool terpisah bila runtime dapat menegakkannya. **C; B8**

### 4.5 UI ask bukan izin native

Semaphore memisahkan permintaan keputusan dari prompt izin runtime. `lib/asks.mjs` juga menyatakan ask berlabel blocking tidak dengan sendirinya menghentikan dispatch. Walt sengaja meningkatkan ini: blocking ask menghentikan dependent task di scheduler; approval tool tetap harus dikirim ke callback/request provider yang tepat. **C; S5; W**

### 4.6 Review mengikuti bytes, bukan nama file

`lib/artifacts.mjs` dan `docs/artifacts.md` mengikat review pada manifest terpilih dan hash; perubahan CSS/aset juga dapat membuat review lama stale. Preview adalah snapshot, bukan server filesystem bebas. Walt menambahkan test evidence sebagai jenis bukti ketiga di samping source dan visual. **C/D; S6; W**

### 4.7 Receipt berbeda dari pemahaman

Acknowledgment menandakan transport/session menerima konteks yang ditentukan, bukan bahwa model sudah memahami atau mengerjakan dengan benar. Walt memakai label Received dan Context acknowledged, tidak menampilkan klaim palsu tentang pemahaman AI. **C; S3; W**

## 5. Analisis desain

Screenshot Bloks memperlihatkan navigation rail, sidebar room/agent, header peserta, timeline percakapan dengan bubble lembut, mention berwarna, dan composer menetap. Light theme memakai putih/abu netral; dark theme mempertahankan hierarki; identitas agent dibantu avatar pixel berwarna. CSS memakai semantic tokens dan font Inter. **C/D; B9**

Semaphore memakai sidebar percakapan, indikator giliran, status delivery, Needs you, dan panel deliverable. CSS memuat beberapa generasi aturan: jangan menyalin token pertama dan menganggapnya final. Aturan akhir menggunakan Outfit untuk teks dan Jersey 10 untuk wordmark, hijau/amber untuk state, serta theme terang/gelap. Analisis Semaphore di sini berbasis HTML/CSS; tidak ada klaim bahwa UI-nya dirender langsung. **C; S7**

Walt menggabungkan kepadatan layout Bloks dengan status workflow Semaphore. Tambahan khusus: inspector kanan untuk Task / Files / Context / Decisions / Activity. Detail ukuran dan token adalah keputusan Walt dalam desain spec, bukan ukuran yang diukur dari screenshot upstream.

## 6. Strategi adaptasi

| Opsi | Kelebihan | Kekurangan | Putusan |
|---|---|---|---|
| Fork penuh Bloks dan rebrand | Banyak fitur langsung tersedia | Membawa billing/cloud/multiuser serta scope besar | Alternatif jika kemudian mengejar parity cepat |
| Port Semaphore ke Windows | Native continuity lebih dekat visi awal | Wake/binding bergantung host, OS, versi app | Research adapter, bukan fondasi v1 |
| Walt modular, referensi kode terpilih | Domain proyek konsisten, Windows-first, fitur mudah diurutkan | Harus membangun orchestration dan UI | **Baseline yang dipilih** |

Menyalin fitur bukan menjamin semua fitur optimal bila digabung. Bloks mengutamakan agent-centric session; Walt memilih session per agent di room/branch untuk menghindari konteks lintas proyek tercampur. Catatan jangka panjang tetap dapat dibagi melalui memory yang terlihat dan disengaja.

## 7. Catatan penggunaan sumber

Semaphore menggunakan MIT. Bloks memakai FSL-1.1-MIT; teks lisensinya menyebut internal use sebagai permitted purpose. Jangan menulis bahwa keduanya MIT. Jika menyalin kode atau aset, simpan notice/lisensi terkait dalam `THIRD_PARTY_NOTICES`; jangan menyalin merek atau mengesankan Walt dibuat upstream. Paket ini memuat analisis dan spesifikasi Walt, bukan redistribusi seluruh kode kedua repo. Referensi: B10, S8.

## 8. Hal yang belum dibuktikan

- Kualitas, latency, pemakaian RAM, token saving, dan stabilitas real-world kedua aplikasi.
- Parity fitur Windows dengan fitur macOS, khususnya computer use, voice native, dan wake.
- Keberhasilan semua provider/model/plan pada akun cello.
- Akses otomatis ke semua file cloud dan riwayat web; tidak boleh diasumsikan.
- Safety terhadap semua command shell. App-level file lease dan prompt bukan OS sandbox.


## 9. Catatan v1.1: Gemini CLI

Riset v1.0 hanya mencakup Bloks dan Semaphore dengan dua provider. Pada v1.1 Gemini CLI ditambahkan sebagai engine ketiga. Jalur yang dipilih adalah **ACP (Agent Client Protocol)** lewat stdio, karena Gemini CLI menyediakan mode ACP dan protokol ini memisahkan session, prompt, update streaming, permission request, dan cancel. Bloks sudah mencantumkan ACP sebagai jalur multi-engine (F24), sehingga pilihan ini konsisten dengan inventory di atas. **W**

Belum dibuktikan (masuk P0): nama flag ACP pada versi Gemini CLI yang dipasang, dukungan resume/load session, pelaporan kuota, dan perilaku permission request di Windows. Sandbox kontainer Gemini tidak diasumsikan tersedia di Windows; read-only reviewer ditegakkan oleh Walt dengan menolak permission tulis/eksekusi.

---

<!-- file: 07_EXTENSION_GUIDE.md -->

# Walt — Panduan Fitur Lanjutan dan Parity (v1.0, status v1.1 di bagian 14)

Dokumen ini menjelaskan cara membawa keluarga fitur upstream ke Walt setelah core stabil. Ia melengkapi roadmap; fitur tidak dianggap implemented hanya karena modul bernama sama sudah dibuat.

## 1. Format modul ekstensi

Setiap modul mempunyai `id`, `version`, `enabled`, `capabilitiesRequired`, `permissionsRequired`, `settingsSchema`, `eventsProduced`, `dataRetention`, dan health probe. Host menolak modul yang tidak kompatibel, lalu UI memberi alasan. Mematikan modul harus menghentikan future dispatch, menutup resource miliknya, dan mempertahankan arsip user.

Ekstensi tidak boleh membaca secrets semua provider, mengubah event lampau, atau memberi dirinya otoritas sebagai cello. Feature flag dan adapter capability adalah hal berbeda: flag aktif tidak membuktikan runtime mendukung kemampuan.

## 2. Rehearsal dan compare

1. Bekukan manifest baseline proyek; buat worktree/copy terisolasi per attempt.
2. Kirim task dan acceptance yang identik ke dua/tiga agent yang dipilih, dengan batas concurrency.
3. Catat model, effort, waktu, actual/estimated usage, test, diff, dan hasil review masing-masing.
4. Compare menampilkan bukti, bukan otomatis menganggap jawaban terpanjang terbaik.
5. Apply memakai baseline precondition. Konflik disajikan per file; tidak melakukan force overwrite.
6. Attempt lain diarsip/discard setelah user memilih, dengan retention setting.

Izin jaringan/tool eksternal terpisah dari copy folder. Mode rehearsal tidak menjamin email, API call, push, atau database eksternal menjadi simulasi.

## 3. Rich cards dan generative UI

Gunakan registry komponen tetap: table, checklist, metric, chart, options, timeline, file link, diff, task, ask. Model hanya mengeluarkan JSON sesuai schema. Tidak menerima raw JSX, script, inline event handler, atau URL fetch arbitrary sebagai UI control. Action card diterjemahkan menjadi command terotorisasi oleh host, lengkap dengan expected revision dan idempotency ID.

Card yang invalid turun menjadi plain text plus diagnostic. Kegagalan render tidak menghilangkan pesan asli. Clipboard/export mempertahankan isi semantik, bukan seluruh CSS aplikasi.

## 4. Provider tambahan dan failover

ACP, OpenAI-compatible endpoints, dan Ollama memakai registry yang sama. Capability probe memeriksa streaming, tools, file scope, image, usage, effort, dan model list. Model yang hanya bisa menghasilkan teks tidak otomatis memperoleh seluruh tool Codex/Claude.

Failover hanya setelah outcome run sebelumnya jelas aman atau sebelum dispatch. Quota/auth/error routing dibedakan dari test gagal atau jawaban ditolak. User dapat memilih fallback per profile; model swap dicatat sebagai session/context transition. New provider menerima sanitized context packet; tidak menerima provider credential lain.

Ollama/local inference mempunyai setting concurrency, context, dan resource limit sendiri. Jangan menjanjikan performa dari GPU laptop tanpa benchmark model yang benar-benar dipakai. Outcome-based engine scout hanya menyarankan penggantian; ia tidak berpindah sendiri berdasarkan rating yang belum cukup sampelnya.

## 5. Skills, templates, dan MCP

Template tim menyimpan role, provider preference, workflow, budget, dan tools yang dibutuhkan. Saat impor, tampilkan diff sebelum mengubah profile; secrets tidak masuk template. Skills diperlakukan sebagai instruksi yang dapat memengaruhi tool use, dengan versi, asal, riwayat, disable, dan undo.

MCP server milik pengguna didaftarkan eksplisit. Resolve executable tanpa mengeksekusinya saat discovery. Setiap server memiliki scope project/agent, state ready/unavailable, timeout, dan aturan redaction. Jangan auto-install hook/skill dari repo yang sedang dianalisis. Tools Walt untuk handoff/asks/artifacts memiliki credential run-scoped sebagaimana panduan inti.

## 6. Browser dan terminal

Browser panel dapat memakai Electron BrowserView/WebContentsView atau automation browser terpisah. Isolasi profile per project/agent, tampilkan siapa yang mengontrol, dan sediakan Take over / Give back. Login dilakukan user pada browser yang terlihat. Cookie import bukan syarat konektor. Browser takeover tidak otomatis menghentikan tool lama; receipt dan ownership tetap diperlukan.

Terminal interaktif memakai PTY terpisah dari provider structured stream. Render terminal sebagai output, jangan mengeksekusi escape sequence di HTML app. Tampilkan cwd/session owner. Command log tetap tersedia meskipun PTY tidak diaktifkan. Tabs dapat dipin ke task dan project; menutup panel tidak selalu berarti menghentikan proses, sehingga UI harus menanyakan atau menjelaskan konsekuensi yang relevan.

## 7. Automations, watchers, workflows, dan intents

Simpan schedule, timezone IANA (default mengikuti user, untuk cello Asia/Jakarta), prompt/task template, target project, budget, working root, permission profile, dan missed-run policy. Gunakan occurrence ID stabil untuk dedupe. Jika laptop tidur, kebijakan pilihan adalah skip atau catch-up sekali; jangan menumpuk semua run yang terlewat.

Watcher memerlukan polling interval, maximum observations, stop condition, TTL, dan dedup trigger. Webhook memiliki secret/signature, event type allowlist, body limit, replay window, dan event ID. Intent adalah kondisi plus aksi yang tetap melewati scheduler dan policy; bukan instruksi tanpa batas.

Workflow memakai DAG tervalidasi, task dependencies, bounded retries, checkpoint, dan terminal state. Loop eksplisit perlu max iterations/turn/time. Routine yang diimpor mulai paused. Tindakan eksternal menggunakan otorisasi yang sesuai, bukan menganggap jadwal sebagai izin semua tindakan.

## 8. Morning brief dan Attention Center

Brief menyusun active tasks, hasil baru, pending decisions, failed/uncertain runs, dan limit provider dari state yang ada. Jika memakai model untuk merangkum, setiap item menunjuk event/task/artifact asal. Tidak mengarang kegiatan saat tidak ada data.

Attention Center lintas room menyatukan asks, approvals, conflicts, dan incidents. Sortir blocking + severity + umur, dengan filter project. Resolve membuka konteks dan tepat satu action; dismiss menyimpan alasan, bukan menghilangkan dependency secara salah.

## 9. Voice, meeting notes, dan computer use

Voice input/output adalah adapter terpisah untuk microphone, STT, dan TTS. Tampilkan sumber pemrosesan lokal/cloud serta biayanya. Audio tidak disimpan default kecuali user memilih; transcript mengikuti retention. Group voice memilih peserta eksplisit dan menghormati turn budget yang sama.

Meeting notes menyimpan peserta, waktu, transcript yang tersedia, decisions yang masih usulan, dan action items. Jangan menganggap model mendengar bagian audio yang tidak berhasil diproses.

Computer use membutuhkan adapter Windows yang nyata, permission, visible session, takeover, dan capability test. Jangan mengimpor helper macOS lalu mengklaim mengontrol Windows. VM/container/cloud desktop mempunyai root, credential, network scope, dan lifecycle sendiri. Screen preview bukan bukti suatu klik berhasil; verifikasi state sesudah tindakan.

## 10. Companion, konektor, dan remote

Companion lokal menampilkan chat, Needs you, dan hasil; tidak menyalakan model lain hanya karena panel dibuka. Remote/phone adalah opt-in setelah core. Gunakan authentication, TLS atau secure tunnel, scope token, expiry/revoke, dan audit. Jangan bind host core ke `0.0.0.0` sebagai shortcut. Tidak perlu layanan cloud vendor Walt untuk penggunaan laptop lokal.

Konektor Slack/Discord/Telegram/WhatsApp/Signal/email mengikuti kemampuan API resmi masing-masing, bukan janji semua gratis atau mudah. Pisahkan read, draft, dan send. Pesan masuk dari layanan adalah input eksternal berprovenance, tidak boleh menjadi instruksi admin. Dedupe event, cegah bot echo, dan tampilkan tindakan yang akan dilakukan. Semua fitur send harus sesuai instruksi cello.

Home Assistant dan location berbentuk konektor opsional. Tidak mengaktifkan pengambilan lokasi kontinu atau perangkat rumah hanya karena fitur ada pada upstream. Multiuser baru menambah identity/access model bila benar-benar diperlukan; scope sekarang satu pemilik.

## 11. Training export dan personal analytics

Ekspor percakapan/outcome bersifat opt-in, terpilih, tersensor, dan menyertakan provenance serta versi schema. Jangan mengekspor credential/tool payload sensitif. Outcome metrics membedakan user accepted, tests passed, reviewer accepted, abandoned, dan superseded. Tidak memakai jumlah pesan sebagai ukuran produktivitas.

## 12. Native bridge dan session continuity

Core Walt-owned sessions tetap baseline. Bridge native membedakan create-new, attach-selected, copy/fork, dan import-read-only. Binding harus menyebut provider session, project root, owner, transport, dan expected capability. Jangan resume native session yang sedang aktif dari proses lain.

Jika wake tidak dapat dipastikan, durable inbox menyimpan pesan dan status manual delivery; tidak mengirim ulang efek mutatif hanya karena waktu habis. Fitur optional seperti penggantian shared runtime global harus menjadi eksperimen terpisah dengan perubahan yang dapat ditinjau dan rollback, tidak dinyalakan default.

## 13. Parity tracking

Buat `docs/PARITY.md` dengan F01–F51, status Planned/Partial/Implemented/Verified/Not needed, link source, implementation module, test evidence, dan limitations per OS/provider. Implemented berarti ada perilaku nyata; Verified berarti acceptance terkait telah lulus. Tidak ada target jumlah fitur sebagai pengganti keberhasilan workflow utama.


## 14. Status v1.1

Setelah pemangkasan scope v1.1 (lihat `06_ROADMAP_ACCEPTANCE.md`): bagian 2 (rehearsal), 4 (provider tambahan selain tiga engine inti), 6 (browser), dan 7 (automations) berstatus **Deferred**. Bagian 9 (voice, computer use), 10 (konektor chat, remote, multiuser), dan 11 (training export) berstatus **Not planned**. Companion lokal pada bagian 10 kini diwujudkan oleh island Ce:L melalui `05_CEL_INTEGRATION.md`. Bagian 3, 5, 8, 12, dan 13 tetap menjadi panduan.

---

<!-- file: 09_MODEL_HANDOFF_PROMPT.md -->

# Walt — Prompt Handoff ke Model Implementer (v1.1)

Unggah `WALT_MASTER.md`, lalu kirim teks di antara pembatas. Jika context model kecil, kirim file per fase: P0 butuh 00, 03, 06; P1–P2 menambah 02, 04, 05.

---

You are the lead engineer for **Walt**, a personal Windows desktop app owned by me (cello). Build it from the attached blueprint v1.1. Docs are in Indonesian; write code, comments, and internal docs in English. The UI must support English and Indonesian.

## What Walt is

- One group room where **Codex, Claude Code, and Gemini CLI** collaborate on a local project with me as coordinator: handoffs, one writer at a time, parallel read-only reviews, versioned deliverables, decisions, and asks.
- A **separate app** (`Walt.exe`, Electron) that is a child project of **Ce:L**, my dynamic-island app. Ce:L shows Walt status and sends a few safe commands through the local Control API in `05_CEL_INTEGRATION.md`. Ce:L is not built yet, so ship a small example client to test the contract.
- Personal use only. No accounts, billing, telemetry, or public hosting.

## Fixed decisions

1. Electron + React + TypeScript; separate Node host; SQLite (WAL); Zod; Vitest + Playwright; electron-builder.
2. Engines run through their **official CLIs using the CLI's own login** (ChatGPT, Claude, and Google subscriptions). No API keys. Strip API-key env vars from child processes.
   - Codex: `codex app-server` (JSON-RPC over stdio).
   - Claude: `claude` headless with stream-json input and output, one long-lived process per session.
   - Gemini: Gemini CLI in ACP mode, via a generic ACP adapter.
   Verify every flag and schema against the installed versions during P0 and record them in `docs/COMPATIBILITY.md`.
3. An Agent Supervisor keeps agent processes **warm** between turns, prewarms likely personas, puts them to sleep after 15 minutes idle (configurable) and resumes the session later. Kill process trees through Windows job objects, never by process name.
4. Templates: Direct, Build & Review (4 turns), Triad (1 builder + 2 parallel independent reviewers, 6 turns), Roundtable, Challenge, Manual. Budgets belong to me.
5. Tool approvals can only be granted in the Walt window, never from the island.
6. Chat UI concept: Bloks layout merged with the Ce:L visual style (`08_DESIGN_BRIEF.md`). Final visuals come from my FigCraft designs. Until they exist, build functional UI with tokens that can be swapped.

## Non-negotiable invariants

Follow `03_ARCHITECTURE.md` section 10 (invariants 1–15). In particular:
- A deterministic scheduler decides who goes next; LLMs only propose.
- One active run per session and one writer per canonical root.
- A review is valid only for the exact revision hash.
- No automatic replay of mutations whose outcome is uncertain.
- No fake success: no fake login, test pass, usage, or capability.

## How to start

1. Inspect the environment. As of 2026-11-08, Node v24 and Git are installed but none of the three CLIs is on PATH. Tell me the exact install and login commands; I will log in myself.
2. Create `docs/IMPLEMENTATION_PLAN.md`, `docs/PROGRESS.md`, `docs/COMPATIBILITY.md`, and `docs/PARITY.md`.
3. P0 spike: all three engines on Windows with a small fixture. Prove stream, permission, interrupt, and resume, plus the SQLite ABI and a packaging smoke test. Fill in the capability matrix.
4. Vertical slice: cello sends a message → Codex writes a file → artifact hash stored → Claude and Gemini review the same revision in parallel → findings shown → the island example client sees status and can pause.
5. Continue with P1 → P2 against the acceptance criteria in `06_ROADMAP_ACCEPTANCE.md`, including A39–A54.

Make routine, reversible implementation decisions yourself. Ask me only about account access, new costs, or irreversible actions. When a session runs out of context, write a checkpoint in `docs/PROGRESS.md`.

---

## Continuation prompt

Continue Walt from the existing source and status docs. First read `docs/PROGRESS.md`, `docs/COMPATIBILITY.md`, `docs/PARITY.md`, the plan, and the git diff. Work on the next gate that has not passed, test it, and update status and limitations. Keep every Walt invariant and every decision cello has recorded.

---

<!-- file: CHANGELOG.md -->

# Walt Blueprint — Changelog

## v1.1 — 8 November 2026

**Engine dan auth**
- Tambah **Gemini CLI** sebagai engine ketiga melalui adapter ACP generik.
- Persona = peran + engine. Label "OpenAI" diganti menjadi Codex / Claude / Gemini.
- Login lewat CLI resmi (langganan), tanpa API key; variabel API key dihapus dari environment child.
- Claude memakai CLI headless stream-json (bukan Agent SDK) agar memakai login langganan.

**Performa dan lifecycle**
- Agent Supervisor baru: proses hangat antar-giliran, prewarm, sleep setelah idle 15 menit, resume sesi, batas proses hangat.

**Kolaborasi**
- Template **Triad** (1 builder + 2 reviewer paralel independen) dan review round.
- Budget default per template (B&R 4, Triad 6).

**Ce:L**
- Walt resmi menjadi aplikasi terpisah, proyek anak Ce:L.
- Kontrak Control API `walt-control/1` + island feed (`05_CEL_INTEGRATION.md`).
- Pemetaan status ke ukuran island NUSA-SPEC; tool approval dilarang dari island.

**Scope**
- Core = P0–P2; P3 menjadi v1.5; rehearsal, automations, browser → Deferred; voice, computer use, konektor, multiuser → Not planned.

**Desain dan bahasa**
- `04_DESIGN_SPEC.md` diganti `08_DESIGN_BRIEF.md`: Bloks × Ce:L, avatar logo Codex / Clawd / bintang Gemini, desain di file FigCraft Ce:L.
- UI dua bahasa (English / Indonesia); handoff packet antar-agent dalam bahasa Inggris.

**Dokumen**
- `03_IMPLEMENTATION_GUIDE.md` → `03_ARCHITECTURE.md`.
- Baru: `04_FLOWS.md`, `05_CEL_INTEGRATION.md`, `08_DESIGN_BRIEF.md`.
- Prompt handoff pindah ke `09_MODEL_HANDOFF_PROMPT.md` dan ditulis dalam bahasa Inggris.
- `01` dan `07` dipertahankan dari v1.0 dengan catatan v1.1 di akhir.
- Acceptance tambahan A39–A54.

## v1.0 — 7 November 2026
Blueprint awal (dua provider, Bloks + Semaphore). Arsip di `../blueprint-v1.0/`.

---

<!-- file: SOURCES.md -->

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

---

<!-- file: THIRD_PARTY_NOTICES.md -->

# Third-party references

Walt blueprint references Bloks by Hamed Rahimi and Semaphore by their upstream contributors. Included Bloks screenshots are upstream reference assets, not Walt screenshots. Preserve the accompanying FSL-1.1-MIT notice. Semaphore license is included as a reference for any later code adaptation. This package does not include full application source from either project. Walt proposal, design decisions, and handoff instructions are newly written for cello.
