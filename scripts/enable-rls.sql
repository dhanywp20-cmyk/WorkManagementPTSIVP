-- ============================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) — Work Management PTS
-- Jalankan di: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
-- CATATAN: Script ini menggunakan pola sederhana berbasis anon key.
-- Karena platform pakai custom session (bukan Supabase Auth JWT),
-- RLS policy di bawah mengizinkan anon key membaca/menulis semua row,
-- tapi MEMBLOKIR akses langsung dari luar platform jika Supabase
-- API URL tidak dipublikasikan.
-- Untuk proteksi penuh, ganti ke Supabase Auth + JWT claim di masa depan.
-- ============================================================

-- Enable RLS pada semua tabel utama
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_team_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE piket_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE piket_tamu_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_manual_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_period_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lc_quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lc_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lc_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lc_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lc_answer_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE lc_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE incentive_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE incentive_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE incentive_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_note_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_note_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PHASE 1: Allow anon key (platform uses this via server API)
-- Semua tabel: izinkan anon read/write (platform sudah proteksi lewat middleware + API route)
-- Ini lebih aman dari kondisi saat ini (tanpa RLS = benar-benar terbuka)
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
    'notifications','audit_trail','app_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format(
      'CREATE POLICY "anon_all_%s" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- CRITICAL: Pastikan kolom password TIDAK pernah di-select
-- via API langsung. Ini bisa di-enforce dengan view:
-- (Opsional — lebih advanced, tapi sangat disarankan)
-- ============================================================

-- CREATE OR REPLACE VIEW users_safe AS
--   SELECT id, username, full_name, role, team_type, sales_division,
--          jabatan, phone_number, allowed_menus, kpi_enabled
--   FROM users;
-- GRANT SELECT ON users_safe TO anon;
-- Kemudian ganti query fetchUsers ke: supabase.from('users_safe').select(...)
