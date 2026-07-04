-- ============================================================================
-- ROUTING PIPELINE — Request Design Project: gerbang Sales Internal
-- ============================================================================
-- Sama seperti Request Schedule (Fase 2): Sales External wajib direview Sales
-- Internal pemilik divisi (division_ivp_mappings) dulu, BARU notifikasi
-- actionable ke Admin. Sales Internal yang bikin request sendiri (project
-- direct ke user) -> langsung ke Admin seperti alur lama.
--
-- rejection_reason SUDAH ADA di project_requests — dipakai ulang utk Tolak
-- oleh Sales Internal (reuse handleReject/handleRejectConfirm yang sudah ada).
-- ============================================================================

ALTER TABLE project_requests ADD COLUMN IF NOT EXISTS routing_status TEXT;              -- 'internal_review' | 'admin_review' | NULL (lama)
ALTER TABLE project_requests ADD COLUMN IF NOT EXISTS internal_sales_id UUID REFERENCES users(id);
ALTER TABLE project_requests ADD COLUMN IF NOT EXISTS internal_approved_by UUID REFERENCES users(id);
ALTER TABLE project_requests ADD COLUMN IF NOT EXISTS internal_approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_project_requests_internal_sales ON project_requests(internal_sales_id) WHERE internal_sales_id IS NOT NULL;
