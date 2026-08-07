-- ============================================================================
-- Learning Center — Soal Essay + penilaian manual
-- ============================================================================
--
--  Semua kolom baru nullable atau punya default, jadi AMAN untuk data & fitur
--  ABCD yang sudah berjalan. Tidak ada kolom lama yang dihapus atau diubah
--  tipenya.
--
--  Baris lama otomatis ter-set question_type='abcd', session_type='abcd',
--  grading_status='auto' → perilaku ABCD tidak berubah sama sekali.
--
--  Aman dijalankan BERULANG: penambahan CHECK constraint dibungkus DO block
--  karena PostgreSQL tidak punya "ADD CONSTRAINT IF NOT EXISTS" — versi tanpa
--  pembungkus akan gagal di eksekusi kedua dengan "constraint already exists"
--  dan meninggalkan migrasi setengah jalan.
-- ============================================================================

-- ─── 1. lc_questions: tipe soal + kunci referensi jawaban essay ─────────────
ALTER TABLE lc_questions
  ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'abcd',
  ADD COLUMN IF NOT EXISTS model_answer  TEXT NULL;

DO $$ BEGIN
  ALTER TABLE lc_questions
    ADD CONSTRAINT lc_questions_question_type_check
    CHECK (question_type IN ('abcd', 'essay'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Soal essay tidak memakai pilihan ganda → kolomnya harus boleh kosong.
ALTER TABLE lc_questions ALTER COLUMN correct_answer DROP NOT NULL;
ALTER TABLE lc_questions ALTER COLUMN option_a DROP NOT NULL;
ALTER TABLE lc_questions ALTER COLUMN option_b DROP NOT NULL;
ALTER TABLE lc_questions ALTER COLUMN option_c DROP NOT NULL;
ALTER TABLE lc_questions ALTER COLUMN option_d DROP NOT NULL;


-- ─── 2. lc_quiz_sessions: tipe sesi (essay TIDAK boleh campur ABCD) ─────────
ALTER TABLE lc_quiz_sessions
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'abcd';

DO $$ BEGIN
  ALTER TABLE lc_quiz_sessions
    ADD CONSTRAINT lc_quiz_sessions_session_type_check
    CHECK (session_type IN ('abcd', 'essay'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─── 3. lc_quiz_attempts: status penilaian ──────────────────────────────────
--  'auto'           → ABCD, dinilai sistem saat submit (perilaku lama)
--  'pending_review' → essay sudah dikumpulkan, menunggu admin menilai
--  'graded'         → essay sudah dinilai admin
ALTER TABLE lc_quiz_attempts
  ADD COLUMN IF NOT EXISTS grading_status TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS graded_by UUID NULL REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ NULL;

DO $$ BEGIN
  ALTER TABLE lc_quiz_attempts
    ADD CONSTRAINT lc_quiz_attempts_grading_status_check
    CHECK (grading_status IN ('auto', 'pending_review', 'graded'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Essay yang belum dinilai belum punya skor final → kedua kolom harus nullable.
ALTER TABLE lc_quiz_attempts ALTER COLUMN score DROP NOT NULL;
ALTER TABLE lc_quiz_attempts ALTER COLUMN passed DROP NOT NULL;


-- ─── 4. lc_answers: jawaban essay + nilai manual per soal ───────────────────
ALTER TABLE lc_answers
  ADD COLUMN IF NOT EXISTS essay_text   TEXT NULL,
  ADD COLUMN IF NOT EXISTS manual_score NUMERIC NULL;

DO $$ BEGIN
  ALTER TABLE lc_answers
    ADD CONSTRAINT lc_answers_manual_score_range
    CHECK (manual_score IS NULL OR (manual_score >= 0 AND manual_score <= 100));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─── 5. Index untuk query yang sering dipakai fitur baru ────────────────────
CREATE INDEX IF NOT EXISTS idx_lc_questions_type          ON lc_questions(question_type);
CREATE INDEX IF NOT EXISTS idx_lc_sessions_type           ON lc_quiz_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_lc_attempts_grading_status ON lc_quiz_attempts(grading_status);

-- Dipakai halaman Report & Team untuk menghitung "menunggu dinilai" — parsial
-- supaya index tetap kecil, karena mayoritas baris berstatus 'auto'.
CREATE INDEX IF NOT EXISTS idx_lc_attempts_pending
  ON lc_quiz_attempts(quiz_session_id)
  WHERE grading_status = 'pending_review';


-- ============================================================================
--  Catatan
-- ============================================================================
--  graded_by merujuk users(id) yang bertipe UUID — sudah dicocokkan dengan
--  pola FK tabel lain di proyek ini (mis. reminders.pic_id).
--
--  Statistik di LUAR Learning Center (KPI Team & Analytics Dashboard) juga
--  sudah disesuaikan agar attempt 'pending_review' tidak ikut dihitung; tanpa
--  itu pass rate akan turun semu karena essay yang belum dinilai menambah
--  penyebut tapi tidak pernah bisa masuk pembilang.
-- ============================================================================
