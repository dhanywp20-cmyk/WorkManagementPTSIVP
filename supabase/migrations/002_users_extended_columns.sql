-- ============================================================
--  Work Management Platform — Migration 002
--  Add extended columns to users table
--  Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── users: extended profile columns ──────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS kpi_enabled  BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS divisi       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pts_type     VARCHAR(50);

-- ── DONE ──────────────────────────────────────────────────────────────────────
-- Setelah run ini:
--   ✅ users.kpi_enabled  — toggle KPI roster per user (default TRUE)
--   ✅ users.divisi       — PTS / Sales / Marketing
--   ✅ users.pts_type     — PTS IVP / PTS UMP / PTS MLDS
-- ─────────────────────────────────────────────────────────────────────────────
