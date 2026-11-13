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
    {"engine": "claude", "auth": "ok",       "quota": {"windows": [{"mins": 300, "percent": 50, "resetsAt": 1794604200}, {"mins": 10080, "percent": 26, "resetsAt": 1794657600}], "limited": false, "at": "2026-11-14T01:56:35Z"}},
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

## 10. Implementasi (2026-11-13)

Yang dibangun dan berbeda dari rancangan di atas:

- `needsYou` memuat tool approval (`kind: tool_approval`, plus `who`, `detail` = perintah/file) dan keputusan dari baris `DECISION:` di balasan AI (`askId: decision:<roomId>`, `options`). Opsi dikirim sebagai teks polos (`plain()` di domain/command), dan Walt menerima jawaban dalam bentuk itu.
- `POST /island/v1/asks/:id/answer` dengan `{option}` hanya untuk keputusan; pesannya tercatat dengan `meta.via = "island"` (A59). Tool approval tetap `403 not_allowed_from_island` (A60).
- Interrupt: `POST /island/v1/rooms/:id/interrupt` (bukan `/runs/:id`).
- `POST /island/v1/open` menerima `{roomId}` opsional; Walt muncul dan membuka chat itu.
- `expectedRevision` wajib tetapi tidak dibandingkan: teks streaming menaikkan revisi beberapa kali per detik, jadi setiap aksi memeriksa targetnya sendiri. `commandId` tetap idempotent.
- `activeRooms` = chat yang running, menunggu kamu, paused, recovery, atau punya keputusan terbuka; tiap room membawa `engines`, `owner.process`, `waiting`.
- Walt menulis `launch.json` (`exe`, `args`) di folder datanya setiap start. File ini tidak dihapus saat quit, sehingga Ce:L bisa menjalankan `Start Walt` dengan `--background` (Walt menunggu di tray).
- Ce:L: `cel-svc/src/walt.rs` (link + SSE lewat HTTP/1.0 di TcpStream), `cel-pages/src/walt.rs` (I01, I03, I04, I07, I08, I09), `cel-app/src/walt_page.rs` (peek dari perubahan snapshot, klik). `WALT_DATA` juga dibaca Ce:L untuk tes.
