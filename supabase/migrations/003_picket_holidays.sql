-- ============================================================
--  Work Management Platform — Migration 003
--  Picket holiday override mechanism
--  Run this in Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS picket_holidays (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date       TEXT        NOT NULL UNIQUE,  -- format: YYYY-MM-DD
  label      TEXT        NOT NULL DEFAULT 'Libur',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast date lookups
CREATE INDEX IF NOT EXISTS idx_picket_holidays_date ON picket_holidays(date);

-- ── DONE ──────────────────────────────────────────────────────────────────────
-- Setelah run ini:
--   ✅ Admin dapat menandai tanggal sebagai libur di Piket Showroom
--   ✅ Tanggal libur ditampilkan dengan badge LIBUR di jadwal piket
-- ─────────────────────────────────────────────────────────────────────────────
