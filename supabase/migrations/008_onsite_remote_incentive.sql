-- Onsite/Remote mode for Konfigurasi / Konfigurasi & Training / Training reminders
-- Affects incentive distribution: Installer 20% when remote

-- 1. Add mode fields to reminders (set when completing)
ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS mode_penyelesaian VARCHAR(10),  -- 'onsite' | 'remote'
  ADD COLUMN IF NOT EXISTS installer_name    TEXT,
  ADD COLUMN IF NOT EXISTS installer_daerah  TEXT;

-- 2. Add mode + installer fields to incentive_projects (synced from reminders)
ALTER TABLE incentive_projects
  ADD COLUMN IF NOT EXISTS mode_penyelesaian       VARCHAR(10),
  ADD COLUMN IF NOT EXISTS installer_name          TEXT,
  ADD COLUMN IF NOT EXISTS installer_daerah        TEXT,
  ADD COLUMN IF NOT EXISTS installer_incentive_pct  NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installer_incentive_nominal NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS atasan_name             TEXT;
