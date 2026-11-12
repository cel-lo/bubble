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
