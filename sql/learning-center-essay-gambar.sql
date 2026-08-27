-- ═══════════════════════════════════════════════════════════════════════════
-- Learning Center: soal Essay yang jawabannya berupa GAMBAR.
--
-- Untuk soal seperti "rancang solusi AV sederhana untuk ruang rapat 6x8 m" -
-- yang jawabannya paling wajar digambar tangan di kertas, difoto, lalu
-- diunggah. Mengetiknya sebagai teks justru memaksa peserta menerjemahkan
-- gambar jadi kalimat, dan yang dinilai berubah dari kemampuan merancang jadi
-- kemampuan menarasikan.
--
-- ── HEMAT EGRESS ───────────────────────────────────────────────────────────
--
-- Tiap jawaban menyimpan DUA tautan, bukan satu:
--
--   answer_image_url  gambar penuh - dibuka hanya saat penilai mengkliknya.
--   answer_thumb_url  gambar kecil - yang tampil di daftar penilaian.
--
-- Daftar penilaian memuat puluhan jawaban sekaligus. Menampilkan gambar penuh
-- di sana berarti mengunduh puluhan berkas ratusan-kilobyte hanya untuk
-- ditampilkan sebesar perangko - dan itu terulang tiap kali halamannya dibuka.
-- Thumbnail 320px berukuran sekitar 15 KB; gambar penuh 1600px sekitar 250 KB.
-- Pada satu sesi berisi 30 jawaban, selisihnya 7 MB lawan 450 KB SETIAP kali
-- daftar dibuka. Itulah bedanya kuota egress habis di pertengahan bulan atau
-- tidak.
--
-- Kompresi dilakukan DI PERAMBAN sebelum diunggah (lib/image-compress.ts),
-- jadi berkas mentah 3-8 MB dari kamera ponsel tidak pernah menyentuh jaringan
-- sama sekali.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. lc_questions: bentuk jawaban yang diminta ──────────────────────────
ALTER TABLE lc_questions
  ADD COLUMN IF NOT EXISTS answer_format TEXT NOT NULL DEFAULT 'text';

ALTER TABLE lc_questions DROP CONSTRAINT IF EXISTS lc_questions_answer_format_check;
ALTER TABLE lc_questions
  ADD CONSTRAINT lc_questions_answer_format_check
  CHECK (answer_format IN ('text', 'image'));

COMMENT ON COLUMN lc_questions.answer_format IS
  'Bentuk jawaban soal essay: text = diketik, image = unggah foto. Diabaikan untuk soal abcd.';

-- ─── 2. lc_answers: tautan gambar jawaban ──────────────────────────────────
ALTER TABLE lc_answers
  ADD COLUMN IF NOT EXISTS answer_image_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS answer_thumb_url TEXT NULL;

COMMENT ON COLUMN lc_answers.answer_image_url IS
  'Gambar jawaban ukuran penuh (maks 1600px). Dibuka hanya saat penilai mengklik.';
COMMENT ON COLUMN lc_answers.answer_thumb_url IS
  'Pratinjau 320px untuk daftar penilaian. Dipisah demi menekan egress - lihat catatan di berkas ini.';

-- ─── 3. Periksa hasilnya ───────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'lc_questions' AND column_name = 'answer_format')    AS kolom_format,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'lc_answers' AND column_name = 'answer_image_url')   AS kolom_gambar,
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'lc_answers' AND column_name = 'answer_thumb_url')   AS kolom_thumb,
  (SELECT COUNT(*) FROM lc_questions WHERE question_type = 'essay')          AS soal_essay;

-- ═══════════════════════════════════════════════════════════════════════════
-- BUCKET STORAGE
--
-- Jawaban bergambar disimpan di bucket `learning-answers`. Buat lewat
-- Dashboard → Storage → New bucket bila belum ada:
--
--   Name    : learning-answers
--   Public  : YA
--
-- Public dipilih dengan sadar, mengikuti bucket lain di platform ini
-- (project-files, review-photos). Alasannya: tautan bertanda tangan harus
-- diperbarui berkala, dan tiap pembaruan itu sendiri satu permintaan ke
-- Supabase - persis yang sedang kita hemat. Yang tersimpan di sini adalah
-- coretan rancangan pada kertas, bukan data pribadi maupun nominal.
--
-- Nama berkasnya memuat uuid acak, jadi tidak bisa ditebak dari luar.
-- ═══════════════════════════════════════════════════════════════════════════
