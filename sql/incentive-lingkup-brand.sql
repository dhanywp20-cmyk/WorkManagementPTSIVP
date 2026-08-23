-- ═══════════════════════════════════════════════════════════════════════════
-- Insentif: batasi tiap petugas input hanya pada brand-nya sendiri.
--
-- MASALAH YANG DIPERBAIKI
--
-- allow_incentive_input hanya punya dua keadaan: boleh mengisi nominal, atau
-- tidak. Begitu DUA orang Finance ditunjuk, keduanya melihat SELURUH proyek -
-- termasuk nominal proyek yang bukan urusannya. Nominal insentif itu data
-- kredensial: siapa mendapat berapa.
--
-- Kolom ini menambahkan lingkup: petugas MVI hanya melihat proyek brand MVI,
-- petugas IVP hanya IVP. Proyek "Kedua Brand" (BOTH) terlihat oleh keduanya -
-- memang milik bersama, jadi menyembunyikannya dari salah satu justru membuat
-- proyeknya tidak terinput sama sekali.
--
-- NULL = tanpa batas (melihat semua). Itu keadaan admin, dan juga keadaan
-- petugas lama yang sudah terlanjur diizinkan sebelum kolom ini ada -
-- perilakunya tidak berubah sampai admin benar-benar menetapkan lingkupnya.
-- Bawaan yang menyembunyikan data secara diam-diam jauh lebih berbahaya
-- daripada bawaan yang mempertahankan keadaan sekarang.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS incentive_brand_scope TEXT;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_incentive_brand_scope_check;
ALTER TABLE users
  ADD CONSTRAINT users_incentive_brand_scope_check
  CHECK (incentive_brand_scope IS NULL OR incentive_brand_scope IN ('MVI', 'IVP'));

COMMENT ON COLUMN users.incentive_brand_scope IS
  'Lingkup brand untuk input nominal insentif. MVI / IVP = hanya brand itu (proyek BOTH tetap terlihat). NULL = tanpa batas.';

-- Periksa hasilnya
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'incentive_brand_scope') AS kolom_terpasang,
  (SELECT COUNT(*) FROM users WHERE allow_incentive_input) AS petugas_input,
  (SELECT COUNT(*) FROM users WHERE allow_incentive_input AND incentive_brand_scope IS NULL) AS petugas_tanpa_batas,
  (SELECT COUNT(*) FROM reminders WHERE brand IS NULL) AS proyek_tanpa_brand;
