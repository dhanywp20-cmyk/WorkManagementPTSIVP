-- ============================================================
--  Work Management Platform — Migration 004
--  Normalize kpi_period_snapshots.members_json → kpi_snapshot_members
--  Run this in Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS kpi_snapshot_members (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id          UUID    NOT NULL REFERENCES kpi_period_snapshots(id) ON DELETE CASCADE,
  member_id            TEXT    NOT NULL,
  name                 TEXT    NOT NULL,
  jabatan              TEXT,
  team_type            TEXT,
  tickets_handled      INTEGER DEFAULT 0,
  tickets_solved       INTEGER DEFAULT 0,
  tickets_overdue      INTEGER DEFAULT 0,
  lc_attempts          INTEGER DEFAULT 0,
  lc_avg_score         NUMERIC(5,2) DEFAULT 0,
  lc_passed            INTEGER DEFAULT 0,
  form_review_total    INTEGER DEFAULT 0,
  form_review_low      INTEGER DEFAULT 0,
  tech_notes_approved  INTEGER DEFAULT 0,
  tick_score           NUMERIC(5,4) DEFAULT 0,
  bast_score           NUMERIC(5,4) DEFAULT 0,
  lc_score             NUMERIC(5,4) DEFAULT 0,
  rnd_score            NUMERIC(5,4) DEFAULT 0,
  final_kpi            INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ksm_snapshot_id ON kpi_snapshot_members(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_ksm_member_id   ON kpi_snapshot_members(member_id);

-- Migrate existing data from members_json column (run once)
-- This reads the JSON array and inserts a row per member per snapshot
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
  COALESCE((m->>'ticketsHandled')::int,  0),
  COALESCE((m->>'ticketsSolved')::int,   0),
  COALESCE((m->>'ticketsOverdue')::int,  0),
  COALESCE((m->>'lcAttempts')::int,      0),
  COALESCE((m->>'lcAvgScore')::numeric,  0),
  COALESCE((m->>'lcPassed')::int,        0),
  COALESCE((m->>'formReviewTotal')::int, 0),
  COALESCE((m->>'formReviewLowRating')::int, 0),
  COALESCE((m->>'techNotesApproved')::int, 0),
  COALESCE((m->>'tickScore')::numeric,   0),
  COALESCE((m->>'bastScore')::numeric,   0),
  COALESCE((m->>'lcScore')::numeric,     0),
  COALESCE((m->>'rndScore')::numeric,    0),
  COALESCE((m->>'finalKPI')::int,        0)
FROM kpi_period_snapshots s,
     jsonb_array_elements(s.members_json::jsonb) AS m
ON CONFLICT DO NOTHING;

-- ── DONE ──────────────────────────────────────────────────────────────────────
-- Setelah run ini:
--   ✅ kpi_snapshot_members table — relational per-member KPI data
--   ✅ Data existing di-migrate dari members_json ke table baru
--   ✅ Query per-member sekarang O(1) via index
--   ✅ Update nama tidak perlu REPLACE() lagi
-- ─────────────────────────────────────────────────────────────────────────────
