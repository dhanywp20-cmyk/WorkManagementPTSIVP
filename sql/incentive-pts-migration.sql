-- ============================================================================
-- INCENTIVE PTS + USER HIERARCHY — Database Migration
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 0. ALTER TABLE users — tambah atasan_id untuk hierarchy mapping
--    Self-referential: setiap user punya max 1 atasan langsung (Direktur → GM → Manager → Supervisor → Staff)
ALTER TABLE users ADD COLUMN IF NOT EXISTS atasan_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_atasan_id ON users(atasan_id);

-- Query contoh: ambil chain atasan untuk user tertentu (recursive CTE)
-- WITH RECURSIVE chain AS (
--   SELECT id, full_name, jabatan, atasan_id, 0 AS depth FROM users WHERE id = '<user_id>'
--   UNION ALL
--   SELECT u.id, u.full_name, u.jabatan, u.atasan_id, c.depth+1
--   FROM users u JOIN chain c ON u.id = c.atasan_id
--   WHERE c.depth < 10
-- )
-- SELECT * FROM chain ORDER BY depth;

-- 1. ALTER TABLE reminders — tambah kolom incentive
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS requires_controller_automation BOOLEAN DEFAULT FALSE;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS controller_automation_brand TEXT; -- 'cue' | 'extron' | 'wyrestorm' | NULL
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS pic_type TEXT DEFAULT 'standard'; -- 'standard' | 'manager_pic'
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS pic_id UUID REFERENCES users(id);
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS domain_owner TEXT; -- 'led' | 'middleware' | NULL
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS execution_mode TEXT; -- 'onsite' | 'remote'
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS bast_date DATE;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS incentive_value NUMERIC DEFAULT 0;

-- 2. CREATE TABLE incentive_tranches
CREATE TABLE IF NOT EXISTS incentive_tranches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  tranche_number INT NOT NULL CHECK (tranche_number IN (1,2,3)),
  percentage NUMERIC NOT NULL, -- 50, 35, 15
  payment_year INT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending' | 'processed' | 'paid'
  processed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CREATE TABLE incentive_splits
CREATE TABLE IF NOT EXISTS incentive_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  tranche_id UUID REFERENCES incentive_tranches(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'pic' | 'support' | 'installer' | 'manager'
  user_id UUID REFERENCES users(id),
  user_name TEXT,
  percentage NUMERIC NOT NULL,
  amount NUMERIC,
  source_ticket_id UUID, -- diisi kalau split berasal dari late ticket
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CREATE TABLE ticket_support_assignment
CREATE TABLE IF NOT EXISTS ticket_support_assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID, -- references tickets di service DB, nullable karena beda DB
  project_id UUID REFERENCES reminders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  user_name TEXT,
  domain TEXT NOT NULL, -- 'led' | 'middleware'
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT now()
);

-- 5. CREATE TABLE late_ticket_links
CREATE TABLE IF NOT EXISTS late_ticket_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  late_ticket_id UUID, -- references tickets di service DB
  parent_project_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  attached_tranche_number INT NOT NULL,
  attached_at TIMESTAMPTZ DEFAULT now(),
  note TEXT,
  ticket_value NUMERIC DEFAULT 0,
  is_sunset BOOLEAN DEFAULT FALSE -- true = siklus independen (sunset rule)
);

-- 6. Indexes untuk performa query
CREATE INDEX IF NOT EXISTS idx_incentive_tranches_project ON incentive_tranches(project_id);
CREATE INDEX IF NOT EXISTS idx_incentive_tranches_year ON incentive_tranches(payment_year, status);
CREATE INDEX IF NOT EXISTS idx_incentive_splits_project ON incentive_splits(project_id);
CREATE INDEX IF NOT EXISTS idx_incentive_splits_tranche ON incentive_splits(tranche_id);
CREATE INDEX IF NOT EXISTS idx_ticket_support_project ON ticket_support_assignment(project_id);
CREATE INDEX IF NOT EXISTS idx_late_ticket_parent ON late_ticket_links(parent_project_id);

-- 7. Enable RLS (Row Level Security) — bisa disesuaikan
ALTER TABLE incentive_tranches ENABLE ROW LEVEL SECURITY;
ALTER TABLE incentive_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_support_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE late_ticket_links ENABLE ROW LEVEL SECURITY;

-- Policy: allow all for authenticated (anon key)
CREATE POLICY "Allow all for anon" ON incentive_tranches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON incentive_splits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON ticket_support_assignment FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON late_ticket_links FOR ALL USING (true) WITH CHECK (true);
