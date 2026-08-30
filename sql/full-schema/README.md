# Full Schema Dump — WorkManagementPTSIVP

Dump lengkap skema database production (di-generate dari live Supabase project via
`pg_get_functiondef()`, `pg_get_constraintdef()`, `pg_get_triggerdef()`, `pg_policies`, dll
pada 2026-08-30). Tujuannya: kalau platform ini mau di-deploy ulang dari nol — server baru,
project Supabase baru, company/customer baru — 5 berkas ini cukup untuk membangun kembali
seluruh database dari kosong.

**Ini BUKAN mekanisme migration harian.** Untuk perubahan skema sehari-hari selama development,
tetap pakai `supabase/migrations/` (lihat catatan di bagian bawah). Folder ini adalah snapshot
"instal dari nol", bukan riwayat perubahan incremental.

## Urutan apply (WAJIB diikuti persis)

Jalankan di SQL Editor Supabase (atau `psql`) pada project **baru yang masih kosong**, satu
per satu, dalam urutan ini:

1. `01_tables.sql` — extension (`pgcrypto`, `uuid-ossp`) + seluruh `CREATE TABLE` (~60 tabel).
   Tidak ada FK/constraint tambahan di sini, jadi urutan antar-tabel tidak masalah.
2. `02_constraints.sql` — semua `PRIMARY KEY`, `UNIQUE`, `FOREIGN KEY`, `CHECK` via
   `ALTER TABLE ... ADD CONSTRAINT`. Butuh semua tabel di #1 sudah ada.
3. `03_indexes.sql` — index tambahan (di luar yang otomatis dibuat oleh PK/UNIQUE di #2).
4. `05_functions_triggers.sql` — semua function (`SECURITY DEFINER` termasuk) dan trigger.
   **Harus sebelum #5** karena banyak RLS policy memanggil function-function ini
   (`jwt_claim()`, `lingkup_semua()`, `boleh_lihat_baris()`, `is_progress_admin()`, dst) —
   kalau RLS diaktifkan duluan sebelum function ada, `CREATE POLICY` akan gagal.

   > ⚠️ Sebelum apply berkas ini: baca blok komentar "KEAMANAN" di baris atas berkas.
   > Ada 2 placeholder yang WAJIB diganti dengan nilai asli project Anda:
   > `<GANTI_SERVICE_ROLE_KEY>`, `<GANTI_PROJECT_REF>`, dan `<GANTI_FONNTE_TOKEN>`.
   > Nilai asli sengaja tidak disimpan di sini — lihat penjelasan di bawah.

5. `04_rls.sql` — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + seluruh `CREATE POLICY`.
   Dijalankan **terakhir**, setelah function di #4 tersedia.

Ringkasnya, urutan file di disk (01→02→03→04→05) **bukan** urutan apply — urutan apply yang
benar adalah **01 → 02 → 03 → 05 → 04**. Nama file tetap `04_rls` / `05_functions_triggers`
mengikuti urutan dependency logis (tabel → relasi → index → hak akses), bukan urutan eksekusi.

## Kenapa ada placeholder `<GANTI_...>` alih-alih nilai asli

Saat generate dump ini, ditemukan 2 secret production yang ditulis hardcoded langsung di
source function (bukan best-practice — lihat rekomendasi di bawah):

- Supabase `service_role` JWT key, dipakai di `check_pending_tickets()` untuk memanggil
  Edge Function `daily-reminder`.
- Token API Fonnte (WhatsApp gateway), dipakai di `handle_ticket_assignment()` untuk kirim
  notifikasi WA otomatis.

Kedua nilai itu **sengaja diganti dengan placeholder** sebelum berkas ini di-commit ke git,
supaya secret production tidak ikut ter-publish ke repository (termasuk ke history git kalau
suatu saat repo ini dibuka lebih luas, misalnya saat dijual/diserahkan ke company lain).

**Tindakan yang disarankan untuk project production yang sedang berjalan sekarang:**

1. Rotate kedua secret tersebut di Supabase Dashboard (Project Settings → API — generate ulang
   `service_role` key) dan di dashboard Fonnte (generate ulang token), **karena keduanya sudah
   pernah bisa dibaca siapa pun yang punya akses baca ke source function** (lewat
   `pg_get_functiondef()` atau `\df+` di psql) — bukan cuma soal file ini.
2. Setelah rotate, pertimbangkan migrasi kedua secret itu ke pola yang sudah dipakai dengan
   benar oleh function lain di database ini, `update_reminder_cron()`, yaitu menyimpan secret
   di tabel `rahasia_integrasi` dan dibaca via query, bukan ditulis literal di body function.
   Ini membuat rotate secret ke depannya tidak perlu edit function lagi.

Untuk deploy ke server/company **baru**, isi placeholder di `05_functions_triggers.sql` dengan
nilai asli milik project baru tersebut (project ref, service_role key, token Fonnte akun baru)
sebelum menjalankan file itu — atau, lebih baik, terapkan dulu rekomendasi #2 di atas sehingga
tidak ada secret yang perlu ditulis ke file SQL sama sekali.

## Yang sengaja TIDAK termasuk dalam dump ini

- **Data** — ini murni DDL (struktur), tidak ada `INSERT`. Tidak ada data dummy dan tidak ada
  data production yang ikut ter-copy.
- **Storage buckets** dan konfigurasi Auth provider — dikelola lewat Supabase Dashboard /
  Management API, bukan lewat SQL biasa. Perlu disiapkan manual saat setup project baru.
- **Environment variables** aplikasi (`.env` Next.js, Vercel project settings) — lihat panduan
  deployment terpisah untuk daftar variabel yang dibutuhkan.

## Hubungan dengan `supabase/migrations/`

`supabase/migrations/` berisi riwayat perubahan skema incremental yang sudah pernah diterapkan
ke database ini seiring waktu (development sehari-hari). Dump di folder `sql/full-schema/` ini
adalah **snapshot hasil akhir dari seluruh migration tersebut**, diambil langsung dari struktur
live database — bukan pengganti folder migrations. Ke depan, kalau ada perubahan skema (tabel
baru, kolom baru, function/RLS baru), tetap tulis sebagai migration baru di
`supabase/migrations/` seperti biasa; dump di folder ini perlu di-generate ulang secara berkala
(atau menjelang rilis penting / sebelum handover ke company baru) supaya tetap jadi cerminan
akurat dari skema saat itu — file ini tidak otomatis update sendiri ketika migration baru
ditambahkan.
