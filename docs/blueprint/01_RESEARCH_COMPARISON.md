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
