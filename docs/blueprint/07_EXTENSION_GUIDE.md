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
