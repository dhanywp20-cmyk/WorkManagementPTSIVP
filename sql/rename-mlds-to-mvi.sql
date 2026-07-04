-- ============================================================================
-- Rename tim internal "Team PTS MLDS" → "Team PTS MVI"
-- ============================================================================
-- CATATAN PENTING: "MLDS" sebagai SALES DIVISION (divisi/brand eksternal —
-- lihat SALES_DIVISIONS di kode, dan BRAND_DIVS untuk Brand PIC) TIDAK berubah
-- dan TIDAK disentuh sama sekali oleh migration ini. Yang berganti nama HANYA
-- tim teknis internal PTS (users.team_type & kolom PIC piket showroom).
--
-- Jalankan migration ini SETELAH kode di branch feat/rename-mlds-to-mvi
-- ter-deploy (kode & data harus konsisten — kalau data diganti duluan sebelum
-- kode deploy, tampilan lama masih cari 'Team PTS MLDS' dan akan tampak kosong).
-- ============================================================================

-- 1) Data: akun user yang team_type-nya masih 'Team PTS MLDS'
UPDATE users SET team_type = 'Team PTS MVI' WHERE team_type = 'Team PTS MLDS';

-- 2) Skema: kolom PIC Piket Showroom (piket_schedules)
ALTER TABLE piket_schedules RENAME COLUMN pic_mlds_name TO pic_mvi_name;
ALTER TABLE piket_schedules RENAME COLUMN pic_mlds_id   TO pic_mvi_id;

-- Verifikasi:
SELECT count(*) AS user_team_pts_mvi FROM users WHERE team_type = 'Team PTS MVI';
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='piket_schedules' AND column_name IN ('pic_mvi_name','pic_mvi_id');

-- ── Setelah ini, jalankan ULANG sql/propagate-user-rename.sql ──────────────
-- (CREATE OR REPLACE — aman, hanya memperbarui definisi fungsi agar rename
--  nama user selanjutnya menyasar kolom pic_mvi_name/pic_mvi_id yang baru.)
