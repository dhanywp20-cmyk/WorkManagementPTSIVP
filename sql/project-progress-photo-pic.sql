-- ============================================================================
-- Project Progress — foto evidence per komponen
-- ============================================================================
--
--  Tiap komponen boleh punya SATU foto bukti (opsional) — mis. bukti terpasang
--  saat Done, atau bukti kendala saat Stuck. File disimpan di bucket Storage
--  'project-files' (bucket yang sudah dipakai Request Design Project) dengan
--  prefix 'project-progress/', jadi tidak perlu bucket baru.
--
--  Kolom ini hanya menyimpan URL publik hasil getPublicUrl.
--
--  Jalankan SETELAH sql/project-progress.sql dan
--  sql/project-progress-component-states.sql. Aman dijalankan berulang.
-- ============================================================================

ALTER TABLE progress_components ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Thumbnail terpisah — INI YANG DIRENDER di daftar komponen.
--
--  Alasan: thumbnail di kartu lokasi hanya berukuran ~28px, tapi <img> selalu
--  mengunduh berkas UTUH. Satu proyek dengan 5 lokasi x 6 komponen berfoto =
--  30 unduhan foto penuh (~250KB) = ~7MB hanya untuk menggambar 30 kotak kecil.
--  Di paket gratis Supabase (egress 5GB/bulan) itu boros sekali.
--
--  Foto penuh hanya diambil saat thumbnail diklik. Transformasi gambar bawaan
--  Supabase TIDAK dipakai karena fitur itu berbayar; thumbnail dibuat di
--  browser sebelum upload sehingga tetap gratis.
ALTER TABLE progress_components ADD COLUMN IF NOT EXISTS photo_thumb_url TEXT;

-- ============================================================================
--  Catatan hak akses PIC
-- ============================================================================
--  Mulai rilis ini, anggota Team PTS yang namanya di-tag sebagai PIC sebuah
--  lokasi boleh mengubah PROGRES lokasi itu (status komponen, catatan, dan
--  foto evidence) — TIDAK boleh menambah/menghapus lokasi, mengubah data
--  proyek, atau menyunting rekap isu. Itu tetap milik admin/superadmin.
--
--  Pembatasan ini ada di lapisan UI (lihat canEditProjectProgress dan
--  isPicOfLocation di app/project-progress/_components/shared.ts), sama seperti
--  modul lain di Work Management yang memakai anon key. Tidak ada perubahan
--  skema yang diperlukan untuk itu — pencocokan memakai progress_locations.pic
--  terhadap users.full_name.
-- ============================================================================
