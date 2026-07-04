-- ============================================================================
-- ROUTING PIPELINE — Fase 2 (Request Schedule): gerbang Sales Internal
-- ============================================================================
-- Saat Sales External request jadwal, request diarahkan dulu ke Sales Internal
-- pemilik divisi itu (division_ivp_mappings, Fase 1) untuk di-review, BARU
-- notifikasi actionable ke Admin/Manager. Kalau requester sendiri Sales
-- Internal (atau tidak ada mapping utk divisinya), langsung ke Admin seperti
-- alur lama (tidak ada perubahan perilaku).
-- ============================================================================

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS routing_status TEXT;              -- 'internal_review' | 'admin_review' | NULL (lama)
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS internal_sales_id UUID REFERENCES users(id);
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS internal_approved_by UUID REFERENCES users(id);
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS internal_approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reminders_internal_sales ON reminders(internal_sales_id) WHERE internal_sales_id IS NOT NULL;

-- ── Backfill is_internal_sales untuk akun yang SUDAH ADA ────────────────────
-- Kolom is_internal_sales baru (default FALSE utk semua). Tanpa backfill ini,
-- akun IVP/MVI (Sales Internal) & Marketing yang sudah ada akan salah dianggap
-- "External" sampai admin sempat centang manual satu-satu di Admin Panel.
-- Marketing & Sales Internal (IVP/MVI) request untuk kebutuhan mereka SENDIRI
-- (project direct ke user, bukan lewat Sales External) -- HARUS langsung ke
-- Admin, TIDAK lewat gerbang review internal.
UPDATE users SET is_internal_sales = TRUE
WHERE role = 'guest'
  AND (sales_division IN ('IVP', 'MVI') OR team_type = 'Marketing')
  AND is_internal_sales IS DISTINCT FROM TRUE;

-- ── Tolak request saat tahap review Sales Internal ──────────────────────────
-- Sales Internal bisa Tolak (bukan cuma Approve) request yang masuk ke dia,
-- dengan alasan wajib diisi (pola sama dgn reject Request Design Project).
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
