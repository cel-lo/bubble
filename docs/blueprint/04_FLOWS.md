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
