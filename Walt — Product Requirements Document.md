# Walt — Product Requirements Document

Nov 10, 2026 · @CeEl · Proyek anak Ce:L

## Ringkasan

Walt adalah aplikasi desktop Windows tempat cello memimpin satu grup kerja AI: Codex, Claude (Opus dan Sonnet), dan Gemini bekerja di satu proyek lokal, saling menyerahkan tugas, dan saling mereview. Progresnya dipantau dan dikendalikan dari dynamic island **Ce:L**.

**Tagline:** One project. Your AI team. You lead.

- **Bentuk:** aplikasi terpisah (`Walt.exe`), proyek anak Ce:L. Walt tetap jalan tanpa Ce:L, dan Ce:L tetap jalan tanpa Walt.
- **Engine:** Codex CLI, Claude Code, dan Gemini CLI, memakai login langganan dari CLI masing-masing. Tidak ada API key.
- **Pemilik dan pengguna:** cello, untuk pemakaian pribadi di satu laptop. Tidak ada akun Walt, server, atau telemetri.
- **Status per 10 November 2026:** blueprint v1.1 dan 51 frame desain beserta prototype FigCraft sudah selesai. Kode belum dimulai.

## Masalah dan tujuan

Memakai beberapa AI untuk satu proyek berarti cello harus menjadi kurir di antara mereka. Konteks disalin ulang, keputusan dijelaskan berkali-kali, hasil satu AI ditempel ke AI lain, dan tidak ada yang menjamin semuanya melihat versi file yang sama. Pertanyaan penting dan pekerjaan setengah jadi tersebar di tiga aplikasi.

Walt dianggap berhasil kalau sebuah task bisa diserahkan dengan konteks yang benar, dikerjakan, direview oleh AI lain, lalu hasilnya terlihat **tanpa copy-paste antar-AI**. Statusnya cukup dilirik di island.

| Tujuan | Yang harus terlihat |
| --- | --- |
| Satu tim, satu proyek | Semua persona membaca brief, keputusan, dan revisi file yang sama |
| cello tetap memimpin | cello menentukan arah, mengonfirmasi keputusan, menambah budget, dan menghentikan alur |
| Handoff berkualitas | Tujuan, batasan, file + hash, keputusan, dan acceptance ikut dikirim otomatis |
| Review yang jujur | Reviewer read-only; review berlaku hanya untuk revisi yang persis |
| Responsif | Agent di room aktif tetap hangat; tidak ada cold start setiap giliran |
| Rendah perawatan | Login diurus CLI resmi; saat idle tidak ada proses agent |
| Terpantau dari island | Giliran, Needs you, selesai, dan gagal muncul di Ce:L |
| Dua bahasa | UI English dan Bahasa Indonesia |

**Bukan tujuan:**

- akun Walt, billing, server, telemetri, atau hosting publik;
- multiuser;
- API key manual;
- menggabungkan memory antar-provider;
- membaca riwayat chat web secara diam-diam;
- voice, computer use, dan konektor chat (WhatsApp, Slack, dan sejenisnya).

## Konsep inti

Di Walt, **peran** dipisah dari **engine**. Persona adalah engine + model + keahlian. Untuk setiap task, Walt mengusulkan persona mana yang menjadi Builder, Reviewer, atau Researcher, dan cello bisa mengubahnya. Satu engine boleh dipakai lebih dari satu persona; contohnya Claude Code dipakai Claude Opus dan Claude Sonnet.

| Konsep | Arti | Contoh |
| --- | --- | --- |
| Project | Satu folder di laptop + tujuan, batasan, dan keputusan | BIBI, D:\\Projects\\BIBI |
| Room | Percakapan bersama dalam satu project, dengan template tim | Main (Triad), Landing copy (Roundtable) |
| Engine | CLI resmi yang terpasang dan sudah login | Codex CLI, Claude Code, Gemini CLI |
| Persona | Engine + model + keahlian | Claude Sonnet: Claude Code · Sonnet 5.5 · quick features, docs, UI copy |
| Peran | Fungsi persona dalam satu task | Builder, Reviewer, Researcher, Planner, Writer, Free |
| Task | Pekerjaan dengan owner, acceptance, dan dependency | T-014 Borrow date validation |
| Handoff packet | Paket serah tugas: tujuan, batasan, keputusan, file + hash, acceptance, budget | P-031, cello → Builder · Codex |
| Artifact | Hasil kerja terdaftar, dengan manifest dan revisi | T-014 r1, r2 |
| Review | Temuan reviewer untuk satu revisi yang persis; basi kalau file berubah | Review r1 basi setelah r2 |
| Decision | Pilihan yang sudah dikonfirmasi cello; agent hanya boleh mengusulkan | D-004 periode pinjam default 14 hari |
| Ask (Needs you) | Pertanyaan atau permintaan izin untuk cello | "Default loan period?" |
| Budget giliran | Batas jumlah giliran per exchange; hanya cello yang bisa menambah | Triad 6 giliran |
| Write lease | Hanya satu penulis per folder project pada satu waktu | Codex menulis, reviewer read-only |

## Pengguna dan skenario

Penggunanya satu orang: cello. cello sudah berlangganan ChatGPT, Claude, dan Google AI, bekerja di laptop Windows, dan biasanya menjalankan beberapa project sekaligus (coding, desain, skripsi). cello ingin AI-nya bekerja sebagai tim, sementara cello sendiri cukup mengambil keputusan.

| Skenario | Contoh | Template |
| --- | --- | --- |
| Fitur kecil + review | Validasi tanggal pinjam di BIBI | Build & Review |
| Fitur penting, dua pendapat | Perubahan logika pinjaman yang berisiko | Triad |
| Diskusi ide tanpa edit file | Headline landing page, satu kalimat dari tiap persona | Roundtable |
| Riset dan tulisan | Mencari paper untuk skripsi, menulis ringkasan, lalu dicek | Research |
| Pantau dari jauh | cello membuka aplikasi lain; island memberi tahu saat review masuk atau ada pertanyaan | Semua |
| Limit atau login habis | Kuota Claude Opus habis di tengah review, lalu review dipindah ke persona lain | Semua |

## Full flow

Satu putaran kerja di Walt berjalan dari pesan cello sampai cello menerima hasil. Di antaranya, scheduler Walt yang memutuskan siapa bekerja berikutnya; agent hanya boleh mengusulkan. Nomor layar (W.., I..) merujuk ke frame di FigCraft.

&#91;embedded content: alur satu task · build, review paralel, fix, accept\]

Budget habis di tengah loop berarti tidak ada yang berjalan sampai cello memilih: tambah giliran, terima dengan temuan tersisa, atau stop.

1. **Setup pertama (W01–W04).**
   - Pilih bahasa: English, Bahasa Indonesia, atau ikuti Windows.
   - Doctor mengecek ketiga CLI dan menandai masing-masing Ready, Login needed, atau Not installed, lengkap dengan perintah instal atau login. Minimal satu engine harus Ready.
   - Pilih folder project (folder yang sudah ada atau folder yang dikelola Walt), lalu tulis tujuan dan batasan.
   - Pilih template tim, lalu room siap.
2. **Room siap (W05).** Persona yang kemungkinan dipanggil sudah dipanaskan di latar belakang. cello menulis pesan:
   - `@persona` untuk bicara dengan satu persona saja;
   - **Template flow** agar pekerjaan berjalan sesuai langkah template;
   - **Everyone answers** agar semua persona menjawab bergiliran.
3. **Walt memilih peran (W16–W17).** Untuk task baru, Walt mengusulkan peran dari isi task, file yang disentuh, dan keahlian tiap persona. Contohnya Sonnet sebagai Builder untuk fitur kecil. cello bisa langsung mulai atau menukar perannya.
4. **Build (W06).** Builder menerima handoff packet dan write lease, lalu mengedit file dan menjalankan test. Di chat muncul baris `cello → Builder · Codex`; aktivitas tool dilipat menjadi chip. Selesai build, Walt menyimpan artifact r1 lengkap dengan manifest dan hash.
5. **Review paralel (W07, W10).** Pada template Triad, dua reviewer read-only membaca revisi yang sama secara bersamaan. Temuan satu reviewer disembunyikan dari reviewer lain sampai keduanya selesai, supaya mereka tidak saling mengiyakan. Context inspector menunjukkan isi packet yang benar-benar dikirim.
6. **Needs you (W08).**
   - Pertanyaan keputusan bisa dijawab dari jendela Walt atau dari island.
   - Izin tool (perintah shell, install package) hanya bisa disetujui di jendela Walt, dengan perintah lengkap terlihat.
   - Task yang bergantung pada pertanyaan itu ditahan; task lain tetap berjalan.
7. **Fix dan review ulang.** Walt menggabungkan dan menyaring temuan yang sama, lalu builder memperbaiki dan menghasilkan r2. Review r1 otomatis ditandai basi. Kalau budget habis (W24), tidak ada yang jalan lagi sampai cello memilih: tambah giliran, terima dengan temuan tersisa, atau stop.
8. **Selesai (W09, W31, W26).** Deliverable card menampilkan review tiap reviewer, hasil test, dan status acceptance cello. cello bisa membuka diff, lalu **Accept**. Walt menyarankan pesan commit dan task berikutnya.
9. **Kontrol kapan saja (W20–W21).** Pause after turn, Interrupt, Resume, dan End room tersedia di jendela Walt; Pause dan Interrupt juga tersedia dari island.
10. **Saat ada masalah (W12, W23, W13).**
    - Login kedaluwarsa: tombol membuka terminal untuk login ulang.
    - Limit pemakaian habis: tunggu reset, atau pindahkan review ke persona lain. Pemindahan hanya boleh kalau run sebelumnya meninggalkan file dalam kondisi aman.
    - Crash: Recovery Center menandai run yang hasilnya tidak pasti, dan tidak ada yang dijalankan ulang otomatis.
11. **Agent tidur dan bangun (W22).** Persona yang idle 15 menit ditidurkan untuk melepas RAM. Saat giliran tiba, sesinya dibangunkan lagi dalam beberapa detik.

## Mode kolaborasi dan peran

Setiap room punya template yang menentukan langkah dan budget giliran. Budget dihitung setiap kali giliran dikirim ke engine. Agent tidak bisa menambah budget; hanya tombol **Continue** dari cello yang membuka budget baru.

| Template | Peserta | Edit file | Budget default |
| --- | --- | --- | --- |
| Direct (`@mention`) | Persona yang disebut | Sesuai peran | 1 giliran |
| Build & Review | 1 builder, 1 reviewer | Builder saja | 4 giliran |
| Triad | 1 builder, 2 reviewer paralel | Builder saja | 6 giliran |
| Roundtable | Semua persona bergiliran | Tidak | 3 giliran |
| Research | Researcher, writer, checker | Writer saja | 6 giliran |
| Custom | Langkah buatan cello (W19) | Sesuai langkah | Diatur cello |

**Persona bawaan dan keahliannya (S03):**

- **Codex** (Codex CLI): code changes, tests, refactors.
- **Claude Opus** (Claude Code, Opus 5.5): planning, hard reviews, architecture.
- **Claude Sonnet** (Claude Code, Sonnet 5.5): quick features, docs, UI copy.
- **Gemini** (Gemini CLI): research, second opinion, long files.

**Izin mengikuti peran, bukan engine (S04):**

| Tindakan | Builder | Reviewer | Researcher |
| --- | --- | --- | --- |
| Baca file project | Boleh | Boleh | Boleh |
| Edit file (satu penulis) | Boleh | Tidak | Tidak |
| Jalankan perintah | Tanya | Tidak | Tidak |
| Instal package | Tanya | Tidak | Tidak |
| Akses internet | Tanya | Tanya | Boleh |

Menunggu tanpa jawaban tidak pernah dianggap boleh. Izin "Always allow" disimpan per project dan bisa dicabut kapan saja.

## Integrasi island Ce:L

Island Ce:L berfungsi sebagai layar status dan remote untuk Walt, bukan tempat bekerja. Walt menjadi sumber kebenaran; Ce:L membaca feed lokal (`walt-control/1` lewat 127.0.0.1, token baru setiap Walt dibuka) dan hanya mengirim beberapa perintah yang aman.

| Kondisi Walt | Tampilan island | Ukuran | Bisa dilakukan |
| --- | --- | --- | --- |
| Agent bekerja | Closed: titik warna per persona yang bekerja + ring budget (I01) | 150×30 | Hover untuk membuka |
| Handoff | Peek "Ready for review" (I02) | 310×60 | Klik untuk membuka room |
| Pertanyaan keputusan | Peek dengan pilihan jawaban (I03) | 420×76 | Jawab langsung |
| Izin tool | Peek dengan satu tombol "Open in Walt" (I04) | 420×68 | Hanya membuka Walt |
| Selesai | Peek "Done · 0 findings left" (I05) | 310×60 | Klik untuk melihat hasil |
| Login atau limit | Peek "needs a new login" (I06) | 310×60 | Buka Walt |
| Dibuka | Halaman Walt di carousel (I07, I08) | 420×140 | Pause, Stop, buka room, pindah room |
| Walt mati | "Walt is not running" (I09) | 420×140 | Start Walt |

**Aturan keamanan:**

- Tool approval tidak pernah bisa disetujui dari island; Control API menolaknya.
- Island tidak bisa menambah budget, mengakhiri room, atau mengetik pesan panjang.
- Kalau Ce:L ditutup, Walt tidak terpengaruh. Kalau Walt ditutup, halaman Walt di island berubah menjadi "Walt is not running".
- Prioritas peek dari yang tertinggi: tool approval, lalu login, lalu ask blocking, lalu gagal, lalu ask biasa, lalu selesai, lalu handoff.

## Requirement

Versi pertama dianggap usable kalau 16 requirement fungsional dan 7 target non-fungsional di bawah terpenuhi.

| ID | Requirement | Bukti selesai |
| --- | --- | --- |
| PR-01 | Project dari folder yang sudah ada atau dikelola Walt | Root canonical + brief r1 tersimpan |
| PR-02 | Doctor: deteksi tiga CLI, versi, status login | Status aktual, bukan badge palsu |
| PR-03 | Room dengan 4 persona + cello, mention, streaming | Pesan asli tiap engine tampil |
| PR-04 | Persona = engine + model + keahlian; peran dipilih per task | Walt mengusulkan peran, cello bisa menukar |
| PR-05 | Handoff packet terstruktur | Penerima mengakui revisi packet |
| PR-06 | Budget giliran per template | Tidak ada giliran ekstra tanpa Continue |
| PR-07 | Write lease, satu penulis per folder | Reviewer melihat hash keluaran builder |
| PR-08 | Review paralel dan independen (Triad) | Temuan tersembunyi sampai round ditutup |
| PR-09 | Artifact + review berversi | File berubah membuat review lama basi |
| PR-10 | Needs you: ask dan approval | Jawaban ask tidak pernah mengesahkan izin tool |
| PR-11 | Pause, Interrupt, Resume, End room | Status mengikuti bukti dari runtime |
| PR-12 | Recovery setelah crash | Mutasi yang tidak pasti tidak dijalankan ulang |
| PR-13 | Warm/sleep agent | Giliran kedua tanpa spawn ulang; idle melepas proses |
| PR-14 | Control API untuk island Ce:L | Feed + perintah aman; approval dari island ditolak |
| PR-15 | Usage dan limit per engine | Data dari CLI; kalau tidak ada, ditulis "unknown" |
| PR-16 | UI English + Indonesia | Semua string lewat katalog i18n |

| Target non-fungsional | Ukuran |
| --- | --- |
| Tidak lag dari sisi agent | Giliran di room aktif dimulai tanpa cold start |
| Ringan saat idle | Tanpa room aktif hanya ada proses host + tray |
| Island sinkron | Status di island sama dengan di Walt, selisih kurang dari 1 detik di uji lokal |
| UI tetap responsif | Tiga stream bersamaan tetap mulus (delta di-batch 100–250 ms) |
| Data lokal | Semua di %APPDATA%\\Walt; tidak ada yang dikirim selain ke engine |
| Jujur | Tidak ada login, test pass, usage, atau capability palsu |
| Windows-first | Path spasi/Unicode, job object untuk cleanup proses, tray, startup |

## Arsitektur ringkas

Walt Host adalah satu-satunya pemilik proses agent dan sumber kebenaran. Jendela Walt dan island Ce:L hanya klien.

&#91;embedded content: arsitektur proses Walt · host, 3 CLI, island\]

- **Login lewat CLI:** Walt tidak menyimpan API key atau password. Variabel API key dihapus dari environment proses CLI, jadi yang terpakai selalu langganan.
- **Hangat dan tidur:** satu proses per persona di room aktif tetap hidup antar giliran. Persona yang kemungkinan dipanggil dipanaskan saat cello mulai mengetik. Setelah 15 menit idle prosesnya ditidurkan, dan sesinya dibangunkan lagi saat dibutuhkan. Maksimal 6 proses hangat.
- **Data lokal:** riwayat, keputusan, artifact, dan backup harian tersimpan di %APPDATA%\\Walt. Folder project tidak dipindah.
- **Stack:** Electron + React + TypeScript, host Node terpisah, SQLite (WAL), Zod, Vitest + Playwright.

## Desain dan prototype

Ada 51 frame di `D:\FIGCRAFT\Designs-CeL.figcraft`, di zona **WALT** di bawah semua frame Ce:L, dengan 694 link klik dan 11 flow "Walt · …". Gayanya Bloks × Ce:L: rail, sidebar room/persona, dan baris handoff dari Bloks; palet gelap `#1C1C1E`, aksen hijau `#30C759`, dan kontrol gaya Settings dari Ce:L. Sumber build ada di `D:\NEWNUSA\design-pipeline\walt`.

| Kelompok | Frame |
| --- | --- |
| Setup | W01 bahasa · W02 engine · W03 project · W04 tim |
| Room | W05 siap · W06 build · W07 review paralel · W08 Needs you · W09 selesai · W16–W17 peran per task · W25 siapa yang menjawab |
| Kontrol dan batas | W20 pause · W21 end room · W22 bangun/tidur · W23 limit, pindah review · W24 budget habis · W26 diterima + commit |
| Inspector dan navigasi | W10 context packet · W11 task board · W27 projects · W28 room baru · W29 Ctrl K · W30 search · W31 diff · W32 activity |
| Masalah | W12 limit + login · W13 Recovery Center |
| Settings | S01 General · S02 Engines · S03 Personas & templates · S04 Permissions · S05 Usage & limits · S06 Island · S07 Data & backup · S08 About · W18 edit persona · W19 template custom |
| Bahasa dan tema | W14 Pengaturan (ID) · W33 room (ID) · W15 room terang · W34 projects terang |
| Island Ce:L | I01 closed · I02–I06 peek · I07–I09 halaman Walt |

Cara mencoba: buka menu prototype di FigCraft, pilih **Walt · 2 · Room (Triad)**, lalu Present.

## Roadmap, metrik, dan risiko

Walt core = P0 + P1 + P2. Setiap fase punya gate yang harus lulus sebelum fase berikutnya dimulai.

&#91;embedded content: roadmap Walt · 5 fase, 4 gate\]

**Metrik sukses:**

1. Sebuah task dikerjakan satu engine dan direview engine lain pada revisi yang tepat.
2. Tidak ada copy-paste manual antar-agent setelah task dibuat.
3. Tidak ada dispatch ganda atau perubahan file ganda pada retry atau restart yang disimulasikan.
4. Giliran kedua di room aktif dimulai tanpa spawn proses baru.
5. Status di island sama dengan di jendela Walt.
6. Error, kuota, dan login kedaluwarsa dilaporkan jujur tanpa kehilangan riwayat.

| Risiko | Respons |
| --- | --- |
| Flag atau protokol CLI berubah | Versi dipin, test kontrak per adapter |
| Mode ACP Gemini belum stabil | Fallback stream-json dengan kemampuan yang lebih sempit |
| Kebijakan login langganan berubah | Mode auth terlihat di Doctor; jalur API key bisa ditambah nanti |
| Agent saling mengiyakan | Review independen, temuan berbasis bukti, tanpa voting |
| RAM tinggi karena proses hangat | Batas 6 proses hangat + idle timeout |
| Island memberi rasa aman palsu | Tool approval tidak bisa dari island |
| Scope melebar | Fase dengan gate; fitur ditunda dicatat sebagai Deferred |

**Pertanyaan terbuka:**

- [ ] Teknologi Ce:L belum dipilih; kontrak island sengaja netral (HTTP + SSE).
- [ ] Nama flag ketiga CLI belum diverifikasi; dicek di spike P0.
- [ ] Default idle timeout 15 menit dan Start with Windows on: cukup, atau diubah?
- [ ] Kalau Walt kelak dibagikan, login langganan lewat CLI dan logo engine harus ditinjau ulang.
