-- ============================================================
--  Work Management Platform — Migration 001
--  Platform Improvements: Notifications, Audit Trail, Unit Movement
--  Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. NOTIFICATIONS TABLE ────────────────────────────────────────────────────
--  Drop-and-recreate (existing table had different schema)
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      TEXT        NOT NULL,
  type         VARCHAR(50) NOT NULL DEFAULT 'system',
  title        TEXT        NOT NULL,
  body         TEXT,
  action_url   VARCHAR(255),
  ref_id       TEXT,
  created_by   TEXT,
  is_read      BOOLEAN     DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread  ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);


-- ── 2. AUDIT TRAIL TABLE (named audit_trail — bukan activity_logs) ────────────
--  activity_logs sudah dipakai Ticketing untuk log tiket, jadi pakai nama baru.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_trail (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      TEXT,
  user_name    TEXT,
  action       VARCHAR(50) NOT NULL,
  module       VARCHAR(100) NOT NULL,
  target_id    TEXT,
  target_name  TEXT,
  old_value    TEXT,
  new_value    TEXT,
  notes        TEXT,
  ip_address   VARCHAR(50),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_module  ON audit_trail(module);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created ON audit_trail(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action  ON audit_trail(action);


-- ── 3. UNIT MOVEMENT — New Columns ────────────────────────────────────────────
ALTER TABLE movement_logs
  ADD COLUMN IF NOT EXISTS kondisi_barang        VARCHAR(50),
  ADD COLUMN IF NOT EXISTS expected_return_date  DATE,
  ADD COLUMN IF NOT EXISTS return_confirmed      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS checkout_reference_id UUID;


-- ── 4. SOFT DELETE — Add is_deleted flag to key tables ────────────────────────
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by  TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by  TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;

ALTER TABLE project_requests
  ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by  TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;

ALTER TABLE movement_logs
  ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by  TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;


-- ── DONE ──────────────────────────────────────────────────────────────────────
-- Setelah run ini:
--   ✅ Tabel notifications (in-app notification bell)
--   ✅ Tabel audit_trail (audit log semua aksi penting)
--   ✅ movement_logs: kondisi_barang + expected_return_date
--   ✅ Soft delete pada tickets, reminders, project_requests, movement_logs
-- ─────────────────────────────────────────────────────────────────────────────
