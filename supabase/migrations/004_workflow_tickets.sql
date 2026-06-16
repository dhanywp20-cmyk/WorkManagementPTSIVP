-- ============================================================
-- MIGRATION 004: Workflow improvements — tickets table
-- Jalankan di Supabase SQL Editor → Run
-- ============================================================

-- 1. Tambah kolom rejection_reason (untuk reject ticket dengan alasan, bukan hapus)
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Tambah kolom reminder_id (FK ke reminders — untuk Project Existing link)
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS reminder_id UUID REFERENCES reminders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_reminder ON tickets(reminder_id) WHERE reminder_id IS NOT NULL;

-- 3. Tambah kolom escalation_notified_at (catat kapan terakhir eskalasi dikirim)
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS escalation_notified_at TIMESTAMPTZ;

-- 4. Tambah kolom priority (Low / Medium / High / Critical)
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium'
  CHECK (priority IN ('Low', 'Medium', 'High', 'Critical'));

-- 5. View helper: tiket yang butuh eskalasi
-- Pending/Call/In Progress/Onsite yang tidak ada aktivitas > 24 jam
CREATE OR REPLACE VIEW stuck_tickets AS
SELECT
  t.id,
  t.project_name,
  t.issue_case,
  t.assign_name,
  t.status,
  t.priority,
  t.created_at,
  t.escalation_notified_at,
  -- Last activity: created_at atau log terakhir
  COALESCE(
    (SELECT MAX(created_at) FROM activity_logs WHERE ticket_id = t.id),
    t.created_at
  ) AS last_activity_at,
  -- Berapa jam sejak aktivitas terakhir
  EXTRACT(EPOCH FROM (NOW() - COALESCE(
    (SELECT MAX(created_at) FROM activity_logs WHERE ticket_id = t.id),
    t.created_at
  ))) / 3600 AS hours_idle
FROM tickets t
WHERE t.status IN ('Pending', 'Call', 'Onsite', 'In Progress',
                   'Waiting sparepart', 'Waiting PO from Sales', 'Submit RMA')
  AND t.status != 'Rejected'
  -- Belum pernah dinaikkan eskalasi dalam 24 jam terakhir
  AND (t.escalation_notified_at IS NULL OR t.escalation_notified_at < NOW() - INTERVAL '24 hours');

COMMENT ON VIEW stuck_tickets IS
  'Tiket aktif yang tidak ada aktivitas > threshold — digunakan oleh cron eskalasi';
