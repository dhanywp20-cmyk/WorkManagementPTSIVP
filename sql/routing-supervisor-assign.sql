-- ============================================================================
-- ROUTING PIPELINE — Fase 3: Admin/Manager → Supervisor tim → Team
-- ============================================================================
-- Melengkapi rantai: setelah Admin/Manager approve, request diarahkan ke
-- Supervisor tim yang sesuai TIPE PRODUK (product_team_map, Fase 1) — bukan
-- admin assign manual bebas pilih siapa saja. Supervisor lalu assign ke
-- anggota timnya ATAU kerjakan sendiri (tim penuh/sibuk — keputusan manual,
-- tidak ada hitungan kapasitas otomatis).
-- ============================================================================

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS assigned_supervisor_id UUID REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_reminders_assigned_supervisor ON reminders(assigned_supervisor_id) WHERE assigned_supervisor_id IS NOT NULL;

-- routing_status sekarang juga dukung 'supervisor_assign' (selain internal_review/admin_review).
