-- ============================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) — Work Management PTS
-- Jalankan di: Supabase Dashboard → SQL Editor → New Query
-- Script ini skip tabel yang belum ada secara otomatis (safe to re-run)
-- ============================================================

DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'users','tickets','activity_logs','reminders','project_requests',
    'project_messages','project_attachments','daily_reports','daily_report_team_entries',
    'piket_schedules','piket_tamu_detail','form_reviews',
    'kpi_manual_values','kpi_period_snapshots','kpi_global_settings',
    'lc_quiz_sessions','lc_quiz_attempts','lc_questions','lc_answers',
    'lc_answer_records','lc_materials',
    'incentive_projects','incentive_disbursements','incentive_settings',
    'movement_logs','tech_notes','tech_note_folders','tech_note_history',
    'notifications','audit_trail','app_settings',
    'service_reminders','overdue_settings','team_members',
    'user_supervisor_mappings','division_supervisor_mappings',
    'division_ivp_mappings','guest_mappings'
  ];
  tbl_exists boolean;
  policy_exists boolean;
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- cek apakah tabel ada
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO tbl_exists;

    IF NOT tbl_exists THEN
      RAISE NOTICE 'SKIP: tabel "%" tidak ditemukan', tbl;
      CONTINUE;
    END IF;

    -- aktifkan RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- cek apakah policy sudah ada (aman di-rerun)
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = 'anon_all_' || tbl
    ) INTO policy_exists;

    IF NOT policy_exists THEN
      EXECUTE format(
        'CREATE POLICY "anon_all_%s" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)',
        tbl, tbl
      );
      RAISE NOTICE 'OK: RLS + policy dibuat untuk "%"', tbl;
    ELSE
      RAISE NOTICE 'OK: policy sudah ada untuk "%", skip', tbl;
    END IF;

  END LOOP;
END $$;
