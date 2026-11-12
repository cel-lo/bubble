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
