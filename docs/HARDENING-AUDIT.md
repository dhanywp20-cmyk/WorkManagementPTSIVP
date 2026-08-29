# HARDENING AUDIT — catatan kerja

Log berjalan untuk audit yang diminta lewat `PLATFORM_HARDENING___WORK_MANAGEMENT.md`
(diunggah 30 Agu 2026). Diperbarui tiap sesi kerja berikutnya menyambung dari
titik terakhir di sini — **baca bagian "Lanjutkan dari sini" dulu** sebelum
memulai putaran baru, supaya tidak mengulang pemeriksaan yang sudah selesai.

Prinsip kerja: audit read-only dulu, baru perbaikan sekecil mungkin per
temuan, tiap perbaikan diuji nyata (bukan hanya baca kode), commit satu per
satu. Tidak menyentuh Learning Center kecuali bug/security nyata. Tidak
membuat migration tanpa alasan konkret. Prioritas: correctness > security >
consistency > performance > visual.

---

## Ringkasan (sebelum log ini dimulai)

Sesi-sesi sebelumnya (lihat riwayat commit) SUDAH menutup sebagian besar P0/P1
klasik: 40+ tabel dikunci RLS dan diverifikasi anon=0 baca, service_role
dipastikan hanya server-side, banyak "identity by name" diganti resolve-by-ID
(`resolveUserId`, `samakanNamaProyek`), unique constraint
`incentive_tranches(project_id, tranche_number)` sudah terpasang
(`sql/incentive-skema-versi.sql`, sudah dijalankan user). Jangan re-audit area
ini dari nol - cek dulu `git log` dan `sql/` sebelum mengira sesuatu belum
ditangani.

Sesi malam ini (sebelum loop otomatis dimulai) juga menutup 3 bug P2 nyata di
modul Incentive PTS - lihat commit terkait "Kolom Support kosong",
"Excel Summary: kolom Nominal/PIC/Support tertimpa", "BAST bisa dibetulkan".

---

## P0/P1 — diperiksa malam ini, BERSIH (dengan bukti)

- **Service-role tidak pernah bocor ke client bundle.** Digrep seluruh
  `getAdminClient|SUPABASE_SERVICE_ROLE|SERVICES_ANON_KEY` lintas `app/`,
  `lib/`, `components/`; setiap pemakai adalah route handler server atau
  modul `-server.ts` yang doc-comment-nya eksplisit melarang impor dari
  komponen client. Tidak ada `'use client'` sungguhan yang mengimpornya.
- **`/api/integrasi/rahasia`** (satu-satunya pintu ke token integrasi):
  GET/POST/DELETE semua lewat `pastikanAdmin()` lebih dulu; nilai rahasia
  TIDAK PERNAH dikirim balik ke browser, hanya penanda 4-huruf terakhir.
- **`/api/project-progress/share/[token]`** (endpoint publik tanpa auth,
  disengaja): token divalidasi regex sebelum ke query, kolom yang
  dikembalikan eksplisit (bukan `*`), `share_token`/`created_by` sengaja
  dikosongkan di response, `share_enabled=false` → 404. Desainnya rapi.
  **Satu open question** - lihat bagian di bawah.
- **`incentive_tranches(project_id, tranche_number)`** sudah punya
  `UNIQUE INDEX` (bukan cuma penjagaan di layar) - dicek langsung di
  `sql/incentive-skema-versi.sql` baris ~52-55, dan task terkait sudah
  ditandai selesai/dijalankan user.
- **P2 (business logic duplikat) di modul Incentive**: digrep pola
  `percentage * pool`/`percentage/100` di luar `calc.ts`/`incentive-scheme.ts`/
  `exportPengajuan.ts`. Dua titik ketemu di `app/incentive-pts/page.tsx`
  (baris ~1584, ~1710) - keduanya preview tampilan "pool × persen tahap"
  murni (bukan pembagian per-peran), dan salah satunya sudah memakai
  `petaPorsiBerlaku()` (fungsi kanonik) untuk porsi installer. Bukan bug.

## Open question — BUKAN diputuskan sendiri, perlu konfirmasi Dhany

**`/api/project-progress/share/[token]` mengirim `audit_trail` (termasuk
`user_name` staf internal) ke halaman publik tanpa login.** Ini mungkin
memang disengaja (klien eksternal ingin tahu progres & siapa yang menangani),
atau mungkin kebocoran nama staf internal yang tidak dimaksudkan untuk dilihat
klien. Tidak diubah sendiri malam ini karena ini murni soal maksud bisnis,
bukan soal benar/salah teknis - salah tebak di sini bisa menghapus fitur
transparansi yang memang diinginkan, atau membiarkan kebocoran privasi kalau
memang tidak diinginkan. **Tanyakan ke Dhany**: apakah nama staf di kolom
"Riwayat" pada halaman share publik memang boleh dilihat klien?

## P6 — dicatat, SENGAJA belum disentuh

`app/reminder-schedule/page.tsx:491` — `reminders.select('*').limit(500)`,
tabel terluas & tersibuk di platform, dimuat di awal load halaman. Ini
kandidat nyata untuk pengurangan egress (P6), tapi file ini >4000 baris dan
query itu dikonsumsi banyak fitur sekaligus (pencarian, filter kategori,
pengelompokan batch, dll) - memangkas kolom tanpa memetakan SETIAP
pemakainya berisiko menghapus data yang diam-diam dipakai satu fitur kecil,
melanggar "jangan menghapus fitur". P6 prioritasnya di bawah P0-P3 menurut
brief, jadi sengaja tidak diburu-buru malam ini. Kalau mau digarap, harus
lewat pemetaan kolom-ke-pemakai yang teliti dulu, bukan tebakan.

---

## P1 — cakupan skrip RLS diperiksa (bukan status LIVE di produksi)

Ditelusuri `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` di seluruh `sql/`
(bukan cuma pemanggilan `nyalakan_rls()` - beberapa berkas RLS memakai
`ALTER TABLE` langsung dengan spasi rata kolom, jadi grep pertama sempat
melewatkannya, lalu diperbaiki dengan pola lebih longgar). 42 tabel punya
skrip yang menyalakan RLS, termasuk keempat tabel `progress_*`
(`sql/rls-project-progress.sql` baris 93-96) - jadi item #1 di daftar
lanjutan versi sebelumnya (di bawah ini, dicoret) sudah terjawab dari sisi
BERKASNYA ADA.

**Yang BELUM bisa diverifikasi dari sini**: apakah skrip-skrip itu SUDAH
benar-benar dijalankan di Supabase produksi, atau baru tertulis. Sesi ini
tidak punya akses langsung ke basis data (konektor Supabase terhubung tapi
tidak diaktifkan untuk chat ini). `sql/rls-project-progress.sql` sendiri
punya peringatan besar di kepala berkasnya bahwa menjalankannya SEBELUM
syarat token JWT terpenuhi akan mengunci modul itu dari semua orang - jadi
ini BUKAN sesuatu yang aman ditebak status "sudah jalan atau belum" dari
membaca kode saja. **Kalau mau dipastikan**: jalankan
`sql/periksa-menyeluruh.sql` di Supabase SQL Editor (murni baca, sudah ada
di repo) dan lihat bagian C (RLS) - itu menjawab tabel mana yang RLS-nya
betul-betul menyala di database yang sesungguhnya.

## Lanjutkan dari sini

Belum diperiksa malam ini (urutan berikutnya yang disarankan):
1. ~~P1: RLS untuk tabel progress_*/ticket_support_assignment/dll~~ - berkas
   skripnya ada untuk semua, lihat bagian di atas. Status LIVE-nya di
   produksi tetap perlu diverifikasi lewat `periksa-menyeluruh.sql`
   (baca-saja) atau ditanyakan ke Dhany, bukan diasumsikan dari kode.
2. P0 lanjutan: cek tabel lain untuk pola sama seperti insentif dulu -
   apakah ada UNIQUE constraint yang seharusnya ada tapi cuma dijaga di
   layar. Sudah digrep komentar "Penjagaan di layar" / "cuma menahan satu
   peramban" di seluruh app/ - NIHIL selain kasus insentif yang sudah
   ditutup. Kalau mau lebih dalam, cari pola serupa dengan kata kunci lain
   (mis. "dua kali", "double", "race") - belum dicoba.
3. P3 UI Consistency: audit duplikat Button/Modal/Table/Badge - belum
   dimulai sama sekali malam ini.
4. P4 Table standard: konsisten-kan currency/date format, empty/error
   state - belum dimulai.

Jangan mulai P5+ sebelum P0-P4 di atas selesai diperiksa, sesuai urutan
prioritas di brief.
