-- ============================================================================
-- Learning Center — Penilaian Essay otomatis via AI (Gemini)
-- ============================================================================
--
--  Sebelumnya essay HARUS dinilai manual satu-satu oleh admin. Sekarang saat
--  admin membuka jawaban essay yang belum dinilai, AI otomatis memberi saran
--  skor + alasan singkat berdasar Kunci Referensi (lc_questions.model_answer)
--  — admin tinggal konfirmasi (skor AI dipakai apa adanya) atau koreksi
--  manual (ubah angkanya) sebelum menekan Simpan. Kolom skor final tetap
--  manual_score yang sudah ada — ai_score/ai_feedback murni SARAN, disimpan
--  terpisah supaya tidak pernah menimpa/tertukar dengan keputusan akhir admin.
--
--  Kolom baru nullable — aman untuk data lama, tidak mengubah perilaku
--  quiz ABCD sama sekali.
--
--  Aman dijalankan berulang.
-- ============================================================================

ALTER TABLE lc_answers
  ADD COLUMN IF NOT EXISTS ai_score    NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS ai_feedback TEXT NULL;

DO $$ BEGIN
  ALTER TABLE lc_answers
    ADD CONSTRAINT lc_answers_ai_score_range
    CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 100));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
