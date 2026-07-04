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
