-- ============================================================================
-- DIAGNOSTIK — kenapa Top Performers kosong
-- ============================================================================
--  Semua HANYA MEMBACA. Jalankan satu per satu di Supabase SQL Editor lalu
--  kirim hasilnya. Tiga query ini memisahkan tiga kemungkinan penyebab.
-- ============================================================================


-- ── A. Apakah attempt-nya ada? ──────────────────────────────────────────────
--  Kalau jumlah_submitted = 0, berarti memang belum ada data (bukan bug).
SELECT
  COUNT(*)                                        AS total_attempt,
  COUNT(*) FILTER (WHERE is_submitted)            AS jumlah_submitted,
  COUNT(DISTINCT user_id) FILTER (WHERE is_submitted) AS jumlah_peserta
FROM lc_quiz_attempts;


-- ── B. Apakah attempt terhubung ke users, dan apa role-nya? ─────────────────
--  Top Performers mengelompokkan peserta memakai users.role:
--    'team'          -> tab PTS
--    'sales'/'guest' -> tab Sales / Marketing
--
--  Kalau kolom role banyak yang NULL, artinya attempt menunjuk user_id yang
--  tidak ada di tabel users — itulah sebabnya semua tab kosong.
SELECT
  COALESCE(u.role, '(user tidak ditemukan)')      AS role,
  COUNT(DISTINCT a.user_id)                       AS jumlah_user,
  COUNT(*)                                        AS jumlah_attempt
FROM lc_quiz_attempts a
LEFT JOIN users u ON u.id = a.user_id
WHERE a.is_submitted
GROUP BY 1
ORDER BY 3 DESC;


-- ── C. Apakah kolom fitur essay sudah ada? ─────────────────────────────────
--  Kalau kosong, migrasi sql/learning-center-essay.sql belum dijalankan.
--  Ini TIDAK lagi membuat halaman rusak (kodenya sudah tidak menyebut kolom
--  itu di select), tapi fitur essay-nya belum aktif.
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'lc_questions'     AND column_name IN ('question_type','model_answer')) OR
    (table_name = 'lc_quiz_sessions' AND column_name = 'session_type')                     OR
    (table_name = 'lc_quiz_attempts' AND column_name IN ('grading_status','graded_by','graded_at')) OR
    (table_name = 'lc_answers'       AND column_name IN ('essay_text','manual_score'))
  )
ORDER BY table_name, column_name;
