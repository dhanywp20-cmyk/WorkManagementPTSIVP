-- ============================================================================
-- Learning Center — PERBAIKAN: jawaban essay ditolak oleh aturan kolom `answer`
-- ============================================================================
--
--  GEJALA
--    Peserta mengetik jawaban essay, tapi jawabannya tidak pernah tersimpan.
--    Admin melihat "Tidak dijawab" walau peserta yakin sudah menjawab.
--    Sejak penanganan error diperbaiki, layar peserta menampilkan:
--
--      new row for relation "lc_answers" violates check constraint
--      "lc_answers_answer_check"
--
--  SEBAB
--    Kolom lc_answers.answer dibuat saat Learning Center masih khusus soal
--    pilihan ganda, jadi aturannya hanya menerima 'A'/'B'/'C'/'D'. Baris
--    jawaban ESSAY tidak punya pilihan ganda — teksnya disimpan di kolom
--    essay_text, dan kolom answer diisi kosong. Kosong itulah yang ditolak.
--
--    sql/learning-center-essay.sql menambahkan essay_text & melonggarkan
--    kolom-kolom di lc_questions, TAPI melewatkan aturan pada lc_answers.answer
--    ini. Itu sebabnya fitur essay tampak "jalan" (soal & sesi bisa dibuat)
--    tapi jawabannya diam-diam selalu gagal disimpan.
--
--  PERBAIKAN
--    Longgarkan aturannya: pilihan ganda tetap wajib A/B/C/D, sementara baris
--    essay boleh mengisinya kosong/NULL. Tidak ada data lama yang berubah —
--    semua baris ABCD yang sudah ada tetap memenuhi aturan baru.
--
--  Jalankan SETELAH sql/learning-center-essay.sql. Aman dijalankan berulang.
-- ============================================================================

-- Baris essay tidak punya pilihan ganda → kolomnya harus boleh kosong.
ALTER TABLE lc_answers ALTER COLUMN answer DROP NOT NULL;

-- Ganti aturan lama (hanya A/B/C/D) dengan versi yang juga menerima kosong/NULL.
-- DROP dulu: PostgreSQL tidak punya "ALTER CONSTRAINT" untuk mengubah isi CHECK.
ALTER TABLE lc_answers DROP CONSTRAINT IF EXISTS lc_answers_answer_check;

ALTER TABLE lc_answers
  ADD CONSTRAINT lc_answers_answer_check
  CHECK (answer IS NULL OR answer = '' OR answer IN ('A', 'B', 'C', 'D'));

-- ── Verifikasi ──────────────────────────────────────────────────────────────
-- Harus mengembalikan definisi aturan yang BARU (mengandung IS NULL / = '').
SELECT conname, pg_get_constraintdef(oid) AS definisi
FROM pg_constraint
WHERE conrelid = 'lc_answers'::regclass
  AND conname = 'lc_answers_answer_check';

-- ============================================================================
--  Catatan
-- ============================================================================
--  Jawaban essay yang SUDAH terlanjur gagal tersimpan sebelum perbaikan ini
--  tidak bisa dipulihkan — datanya memang tidak pernah sampai ke basis data.
--  Peserta perlu mengerjakan ulang sesi essay tersebut.
-- ============================================================================
