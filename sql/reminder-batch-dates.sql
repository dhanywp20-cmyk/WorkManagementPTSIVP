-- ============================================================================
-- Multi-tanggal — batch_id untuk grup reminder yang dibuat sekaligus
-- ============================================================================
-- Saat 1 submission memilih beberapa hari (mis. tanggal 1, 2, 3), semua baris
-- reminder yang dihasilkan ditandai dengan batch_id yang sama (dibuat di klien
-- via crypto.randomUUID()). Ini dipakai untuk:
--   1) Menggabungkan tampilan di Schedule List jadi 1 baris (bukan N baris
--      identik per tanggal) — supaya tabel tidak penuh.
--   2) Mencegah form_reviews duplikat: saat tiap tanggal di batch yang sama
--      di-Complete, hanya 1 form_review yang dibuat untuk keseluruhan batch,
--      bukan 1 per tanggal.
-- ============================================================================

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS batch_id UUID;
CREATE INDEX IF NOT EXISTS idx_reminders_batch_id ON reminders(batch_id) WHERE batch_id IS NOT NULL;

ALTER TABLE form_reviews ADD COLUMN IF NOT EXISTS batch_id UUID;
CREATE INDEX IF NOT EXISTS idx_form_reviews_batch_id ON form_reviews(batch_id) WHERE batch_id IS NOT NULL;
