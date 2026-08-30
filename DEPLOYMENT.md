# Panduan Deploy & Backup — WorkManagementPTSIVP

Dokumen ini menjawab: *bagaimana kerja backup/deploy antara laptop saya, GitHub, Supabase, dan
Vercel — dan bagaimana cara deploy platform ini ke company/customer baru.*

## 1. Kenapa tidak ada "save ke laptop" otomatis dari sesi cloud ini

Sesi Claude Code yang mengerjakan ini berjalan di **container cloud sementara**, bukan di laptop
Anda. Container itu tidak punya akses ke disk laptop Anda sama sekali — jadi tidak ada cara
untuk "menyimpan langsung ke laptop" dari sini. Yang sudah dilakukan, dan yang memang jadi
mekanisme backup sebenarnya di alur kerja ini:

- Semua perubahan sudah **di-commit ke git** dan **di-push ke GitHub** (`origin/main` dan
  `origin/claude/hello-jflrx4`), jadi sudah aman tersimpan di GitHub — bukan cuma di container
  ini yang sifatnya sementara.
- Untuk mendapat salinan terbaru di laptop Anda: buka terminal di folder project di laptop,
  lalu jalankan
  ```bash
  git checkout main
  git pull origin main
  ```
  Setelah itu semua file (termasuk `sql/full-schema/` yang baru) ada di laptop Anda seperti
  file lokal biasa.

## 2. Alur kerja 3 layanan: GitHub → Vercel → Supabase

Tiga layanan ini punya peran yang beda dan **tidak saling auto-sync otomatis** kecuali lewat
git push:

| Layanan | Menyimpan apa | Auto-update kapan |
|---|---|---|
| **GitHub** | Source code (semua file `.ts`/`.tsx`, dan sekarang juga dump SQL di `sql/full-schema/`) | Setiap `git push` |
| **Vercel** | Build hasil deploy dari source code GitHub | Otomatis setiap ada push baru ke branch yang di-watch (biasanya `main`) — lihat Project Settings → Git di Vercel |
| **Supabase** | Data + skema database (tabel, function, RLS) | **TIDAK otomatis.** Perubahan skema harus dijalankan manual lewat SQL Editor Supabase atau `supabase db push`, terpisah dari git push |

Poin penting: **push ke GitHub tidak otomatis mengubah struktur database di Supabase.** Kalau
saya menambah kolom/tabel baru lewat kode, saya juga akan menulis file migration baru di
`supabase/migrations/` (saat ini sudah ada 13 file di sana) — tapi file migration itu baru
benar-benar berlaku di database production setelah dijalankan (manual, atau lewat
`supabase db push` kalau Supabase CLI sudah terhubung ke project). Ini yang dimaksud soal
"auto save struktur tabel setiap ada perubahan" — jawabannya: setiap perubahan skema akan saya
tulis sebagai migration file dan dicatat di git, tapi eksekusi ke database production tetap
langkah terpisah yang perlu dikonfirmasi (bukan dijalankan diam-diam ke data production Anda).

Kenapa Vercel sempat tidak ke-deploy (dari screenshot sebelumnya, "terakhir deploy 2 jam lalu"):
paling umum karena branch yang di-watch Vercel di Project Settings berbeda dari branch yang
di-push (`claude/hello-jflrx4` vs `main`). Sekarang karena kita sudah fast-forward `main` di
setiap commit, deploy Vercel yang men-track `main` akan otomatis ke-trigger tiap kali ada push
ke `main` — seperti yang barusan terjadi untuk commit ini.

## 3. Deploy platform ini ke server/company BARU (jual/handover)

Langkah garis besar kalau platform ini akan di-setup ulang untuk customer/company lain, dengan
project Supabase dan deployment Vercel yang benar-benar terpisah dari yang sekarang:

### a) Supabase — project baru
1. Buat project Supabase baru (dashboard atau `create_project` lewat MCP).
2. Jalankan 5 file di `sql/full-schema/` **sesuai urutan di `sql/full-schema/README.md`**
   (bukan urutan angka nama file — urutannya 01 → 02 → 03 → 05 → 04).
3. Sebelum menjalankan `05_functions_triggers.sql`, isi 3 placeholder (`<GANTI_SERVICE_ROLE_KEY>`,
   `<GANTI_PROJECT_REF>`, `<GANTI_FONNTE_TOKEN>`) dengan nilai milik project/akun Fonnte baru —
   detail lengkap ada di README tersebut.
4. Setup Storage bucket dan konfigurasi Auth (kalau dipakai) manual lewat Dashboard — ini di
   luar dump SQL karena bukan bagian dari skema `public`.
5. Catat: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` dari project baru ini — dipakai di langkah c.

### b) GitHub — repo baru (opsional, kalau company baru butuh source terpisah)
- Fork atau clone repo ini ke akun/organisasi GitHub milik company baru.
- Kalau cuma beda konfigurasi (bukan beda source code), repo yang sama bisa dipakai untuk
  banyak deployment Vercel sekaligus (lihat bagian c) — tidak wajib bikin repo baru per customer.

### c) Vercel — project baru, environment variables
1. Import repo (yang lama atau hasil fork) sebagai Vercel project baru.
2. Di Project Settings → Environment Variables, isi semua variabel yang dipakai kode ini:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (project Supabase utama)
   - `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
   - `NEXT_PUBLIC_SUPABASE_SERVICES_URL`, `NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY`,
     `SUPABASE_SERVICES_SERVICE_ROLE_KEY` (kalau company baru juga pakai project Supabase kedua
     untuk "services" — cek `lib/supabase.ts` untuk detail kapan ini dibutuhkan)
   - `SUPABASE_SECRET_KEY`, `REQUIRE_SERVICE_ROLE` (kalau dipakai di setup Anda)
   - `CRON_SECRET` (dicocokkan dengan cron job di `vercel.json`)
   - `FONNTE_TOKEN` (WA gateway, akun Fonnte milik company baru — jangan pakai token lama)
   - `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `ICEBERG_TOKEN` — isi kalau fitur terkait dipakai
3. Deploy. Vercel akan build otomatis dari branch `main` repo tersebut.
4. Verifikasi cron job di `vercel.json` (`/api/cron/escalate`, `/api/cron/digest`) aktif di
   project Vercel baru — cron Vercel perlu plan yang mendukung, cek Vercel Dashboard.

### d) Jangan pernah bagikan/copy secret dari deployment lama
Setiap deployment baru (company baru) harus punya `SUPABASE_SERVICE_ROLE_KEY`, `FONNTE_TOKEN`,
dll miliknya sendiri — jangan reuse dari project production yang sekarang berjalan. Ini supaya
kalau salah satu company berhenti pakai platform ini, akses mereka bisa dicabut tanpa
mempengaruhi company lain.

## 4. Ringkasan status saat ini

- Kode: sudah di `main` dan `claude/hello-jflrx4` di GitHub, sinkron.
- Skema database: sudah di-dump lengkap ke `sql/full-schema/` (lihat README di folder itu).
- Bug UUID di Process Batch 2027: sudah diperbaiki dan di-push (lihat commit
  `a1f5d59` — perbaikan ada di `insertSplits()`/`resolveUserId()` pada `calc.ts`, defense-in-depth
  supaya user_id yang bukan UUID valid tidak lagi ditulis ke kolom UUID dan menyebabkan crash).
- Export Excel: disederhanakan jadi **1 file** (`exportSummaryIncentive`), gaya Summary Report,
  dengan catatan proyeksi Tahap 2/3 dan filter tahun, hanya menampilkan project yang punya
  tahapan aktif (Generate Tahapan sudah dijalankan). Export Pengajuan terpisah yang lama sudah
  dihapus sepenuhnya sesuai instruksi.
- **Perlu tindakan dari Anda**: rotate service_role key Supabase dan token Fonnte yang sempat
  hardcoded di database function (lihat detail di `sql/full-schema/README.md` bagian
  "Kenapa ada placeholder"). Ini bukan bug yang saya buat — ini ditemukan saat introspeksi
  skema, dan sebaiknya dirotate karena sempat bisa dibaca lewat source function di database.
