-- ============================================================
--  Work Management Platform — Migration 004
--  Normalize kpi_period_snapshots.members_json → kpi_snapshot_members
--  Run this in Supabase Dashboard → SQL Editor
--
--  Jika sebelumnya sudah pernah run dan dapat error NUMERIC overflow,
--  tabel sudah terbuat tapi kosong — jalankan bagian ALTER TABLE dulu
--  (Step 0), lalu lanjut ke INSERT.
-- ============================================================

-- ── Step 0 (ONLY if table already exists with wrong types) ────────────────────
-- ALTER TABLE kpi_snapshot_members
--   ALTER COLUMN tick_score TYPE SMALLINT USING 0,
--   ALTER COLUMN bast_score TYPE SMALLINT USING 0,
--   ALTER COLUMN lc_score   TYPE SMALLINT USING 0,
--   ALTER COLUMN rnd_score  TYPE SMALLINT USING 0;
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Create table (skip if already exists) ────────────────────────────
CREATE TABLE IF NOT EXISTS kpi_snapshot_members (
  id                   UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id          UUID     NOT NULL REFERENCES kpi_period_snapshots(id) ON DELETE CASCADE,
  member_id            TEXT     NOT NULL,
  name                 TEXT     NOT NULL,
  jabatan              TEXT,
  team_type            TEXT,
  tickets_handled      INTEGER  DEFAULT 0,
  tickets_solved       INTEGER  DEFAULT 0,
  tickets_overdue      INTEGER  DEFAULT 0,
  lc_attempts          INTEGER  DEFAULT 0,
  lc_avg_score         NUMERIC(6,2) DEFAULT 0,  -- float 0–100, e.g. 78.50
  lc_passed            INTEGER  DEFAULT 0,
  form_review_total    INTEGER  DEFAULT 0,
  form_review_low      INTEGER  DEFAULT 0,
  tech_notes_approved  INTEGER  DEFAULT 0,
  tick_score           SMALLINT DEFAULT 0,  -- integer 0–100
  bast_score           SMALLINT DEFAULT 0,
  lc_score             SMALLINT DEFAULT 0,
  rnd_score            SMALLINT DEFAULT 0,
  final_kpi            SMALLINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ksm_snapshot_id ON kpi_snapshot_members(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_ksm_member_id   ON kpi_snapshot_members(member_id);

-- ── Step 2: Migrate existing data from members_json ──────────────────────────
INSERT INTO kpi_snapshot_members (
  snapshot_id, member_id, name, jabatan, team_type,
  tickets_handled, tickets_solved, tickets_overdue,
  lc_attempts, lc_avg_score, lc_passed,
  form_review_total, form_review_low, tech_notes_approved,
  tick_score, bast_score, lc_score, rnd_score, final_kpi
)
SELECT
  s.id,
  m->>'id',
  m->>'name',
  m->>'jabatan',
  m->>'team_type',
  COALESCE((m->>'ticketsHandled')::int,       0),
  COALESCE((m->>'ticketsSolved')::int,        0),
  COALESCE((m->>'ticketsOverdue')::int,       0),
  COALESCE((m->>'lcAttempts')::int,           0),
  COALESCE((m->>'lcAvgScore')::numeric,       0),
  COALESCE((m->>'lcPassed')::int,             0),
  COALESCE((m->>'formReviewTotal')::int,      0),
  COALESCE((m->>'formReviewLowRating')::int,  0),
  COALESCE((m->>'techNotesApproved')::int,    0),
  COALESCE((m->>'tickScore')::int,            0),  -- integer 0–100
  COALESCE((m->>'bastScore')::int,            0),
  COALESCE((m->>'lcScore')::int,              0),
  COALESCE((m->>'rndScore')::int,             0),
  COALESCE((m->>'finalKPI')::int,             0)
FROM kpi_period_snapshots s,
     jsonb_array_elements(s.members_json::jsonb) AS m
ON CONFLICT DO NOTHING;

-- ── DONE ──────────────────────────────────────────────────────────────────────
-- ✅ tick_score / bast_score / lc_score / rnd_score → SMALLINT (0–100)
-- ✅ lc_avg_score → NUMERIC(6,2) (float 0–100)
-- ✅ Data existing di-migrate dari members_json
-- ✅ Query per-member sekarang O(1) via index
-- ─────────────────────────────────────────────────────────────────────────────
