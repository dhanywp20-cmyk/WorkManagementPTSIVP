-- ============================================================================
-- STRUKTUR ORGANISASI — Unified atasan hierarchy
-- Run this in Supabase SQL Editor
-- ============================================================================
-- Satu sumber kebenaran untuk hierarki Direktur → Staff lintas divisi
-- (Sales, Marketing, PTS). Menggantikan mapping yang tersebar di
-- division_supervisor_mappings & pts_team_mappings.
--
-- Pola: adjacency list / org-chart. Setiap user menunjuk ke SATU atasan
-- langsung. 1 atasan boleh punya banyak bawahan (mis. 1 Manager 2 Supervisor)
-- secara otomatis — cukup beberapa user punya atasan_id yang sama.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS atasan_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_atasan_id ON users(atasan_id);

-- ── Backfill dari mapping lama (opsional, jalankan sekali) ──────────────────
-- Dari pts_team_mappings (staff → supervisor):
UPDATE users u
SET atasan_id = m.supervisor_user_id
FROM pts_team_mappings m
WHERE u.id = m.staff_user_id
  AND u.atasan_id IS NULL;

-- ── Telusuri seluruh rantai atasan (Direktur → Staff) untuk satu user ───────
-- WITH RECURSIVE chain AS (
--   SELECT id, full_name, jabatan, atasan_id, 0 AS depth
--   FROM users WHERE id = '<user_id>'
--   UNION ALL
--   SELECT u.id, u.full_name, u.jabatan, u.atasan_id, c.depth + 1
--   FROM users u JOIN chain c ON u.id = c.atasan_id
--   WHERE c.depth < 10
-- )
-- SELECT * FROM chain ORDER BY depth;
