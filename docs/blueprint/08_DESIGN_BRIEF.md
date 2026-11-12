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

## 7. Status desain (8 November 2026)

Frame pertama sudah ada di `D:\FIGCRAFT\Designs-CeL.figcraft`, halaman "01 · Desktop prototype", zona **WALT** di bawah semua frame Ce:L (mulai y ≈ 12954). Sumber dan cara build ulang: `D:\NEWNUSA\design-pipeline\walt\`.

| Baris | Frame |
|---|---|
| Setup pertama | W01 Welcome + bahasa · W02 Engines (doctor) · W03 New project · W04 Team template + personas |
| Room (alur Triad) | W05 Siap + mention · W06 Codex building · W07 Review round paralel · W08 Needs you + tool approval · W09 Selesai + deliverable |
| Inspector & masalah | W10 Context packet · W11 Task board · W12 Login needed + usage limit · W13 Recovery Center |
| Pengaturan & tema | W14 Pengaturan (UI Bahasa Indonesia) · W15 Room tema terang |
| Island Ce:L | I01 Closed · I02 Peek handoff · I03 Peek keputusan · I04 Peek tool approval · I05 Peek selesai · I06 Peek login · I07 Halaman satu room · I08 Beberapa room · I09 Walt tidak berjalan |

Keputusan yang diambil saat desain:

- Warna identitas memakai token Ce:L: Codex `#7F87FF`, Claude `#E08A68`, Gemini cyan `#22D3EE` (token `cyan` Ce:L), sehingga tidak bentrok dengan biru Codex.
- Avatar engine berupa tile terang (gaya tile Bloks): logo Codex asli, Clawd, dan bintang Gemini empat warna.
- Pesan cello rata kanan dengan bubble hijau gelap (pola WhatsApp-in-island Ce:L); pesan agent rata kiri seperti Bloks.
- Ukuran peek disesuaikan dengan isi: peek keputusan 420×76 dan peek tool approval 420×68 (pola WhatsApp Ce:L). Handoff, selesai, dan login tetap 310×60.
- Halaman Walt di island menjadi titik ke-9 di carousel, dengan header, panah, dan page dots yang sama dengan halaman Ce:L lain.

Belum dibuat: hotspot prototype (klik antar-layar), varian Bahasa Indonesia untuk layar selain Pengaturan, dan layar Settings lain (Engine, Persona, Island, Izin, Data).

## 8. Revisi 8 November 2026

- **Role mengikuti tugas, bukan engine.** Mode default room = *Auto*: Walt membaca tugas dan memilih builder + reviewer dari "Good at" tiap persona; cello melihat pilihan itu sebelum mulai dan bisa menukar siapa pun. Mode *Fixed roles* tetap ada. Hanya builder tugas itu yang boleh mengedit file.
- **Satu engine bisa jadi beberapa persona.** Contoh di desain: Claude Opus (Opus 5.5) dan Claude Sonnet (Sonnet 5.5) di room yang sama, keduanya lewat login Claude Code. Persona = engine + model + keahlian.
- **Avatar:** semua engine memakai tile membulat seperti Clawd. Logo Codex tanpa latar putih, bintang Gemini dari aset cello (`design-pipeline/walt/assets/gemini.png`). Opus dan Sonnet dibedakan huruf kecil O / S di pojok tile.
- Layar baru **W16 · Room · tugas baru, Walt memilih role**; W04 (tim) dan W11 (task board: builder berbeda tiap tugas) diperbarui.

## 9. Kelengkapan desain (8 November 2026)

Ditambahkan supaya FigCraft bisa jadi acuan workflow:

| Kelompok | Frame |
|---|---|
| Settings (English) | S01 General · S02 Engines (status login CLI, doctor) · S03 Personas & templates · S04 Permissions (per role) · S05 Usage & limits (kuota per engine, aksi saat limit) · S06 Island (Ce:L) · S07 Data & backup · S08 About |
| Role & persona | W17 ganti role per tugas · W18 edit persona (engine, model, keahlian, instruksi) · W19 template custom (langkah, budget, kapan berhenti) |
| Alur F3–F10 | W20 pause · W21 end room · W22 agent bangun/tidur · W23 limit habis → pindah review · W24 budget habis · W25 route "Everyone answers" · W26 setelah Accept (commit + tugas berikutnya) |
| Navigasi | W27 Projects · W28 room baru · W29 Ctrl K · W30 search · W31 diff · W32 activity |
| Konsistensi | W33 room Bahasa Indonesia · W34 Projects tema terang · halaman "Walt" di Settings Ce:L v2 · bar ikon halaman di I07 |

Semua frame Walt sekarang punya link prototype (±660 link): alur setup, room, dialog, settings, rail kiri, dan island ↔ jendela Walt ↔ halaman Ce:L. Yang ditunda (v1.5): branch diskusi dan impor pekerjaan lama.
