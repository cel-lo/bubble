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
