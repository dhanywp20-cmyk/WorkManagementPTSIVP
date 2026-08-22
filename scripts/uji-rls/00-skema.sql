-- Replika skema secukupnya untuk menguji policy. Hanya kolom yang disentuh
-- policy, plus beberapa kolom pendamping supaya query uji masuk akal.

DO $r$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
DO $r$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $r$;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text, full_name text, role text, sales_division text,
  is_internal_sales boolean, access_level text, team_type text,
  allowed_menus text[], phone_number text, jabatan text
);

CREATE TABLE app_settings (key text PRIMARY KEY, value text);

CREATE TABLE division_ivp_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_division text, ivp_id uuid, brand_type text);
CREATE TABLE division_supervisor_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_division text, supervisor_id uuid);
CREATE TABLE user_supervisor_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, supervisor_id uuid);
CREATE TABLE guest_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_username text, project_name text);

CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_user_id uuid, sales_name text, sales_division text, created_by text,
  assign_user_id uuid, assign_name text, title text);

CREATE TABLE reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_user_id uuid, sales_name text, sales_division text, created_by text,
  assign_user_id uuid, assigned_to text,
  internal_sales_id uuid, internal_sales_id_2 uuid, title text);

-- requester_id sengaja TEXT: itu keadaan nyata di produksi (syarat_tipe()).
CREATE TABLE project_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_user_id uuid, sales_name text, sales_division text,
  requester_id text, assign_user_id uuid, assign_name text,
  internal_sales_id uuid, project_name text);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text, message text);

CREATE TABLE activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, action text);
CREATE TABLE audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text, action text);

CREATE TABLE incentive_scheme_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme jsonb, updated_at timestamptz, updated_by text);
CREATE TABLE incentive_disbursements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), x text);
CREATE TABLE incentive_settings      (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), x text);
CREATE TABLE ticket_support_assignment (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), x text);
CREATE TABLE service_reminders       (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), x text);

CREATE TABLE incentive_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid, project_name text, sales_name text, sales_division text);

CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, team_type text, username text);

CREATE TABLE kpi_global_settings   (id int PRIMARY KEY, settings jsonb, updated_at timestamptz);
CREATE TABLE kpi_manual_values     (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, year int, komplain_count int);
CREATE TABLE kpi_period_snapshots  (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), period_label text, year int, team_type text, created_by text);
CREATE TABLE kpi_snapshot_members  (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), snapshot_id uuid, user_id uuid);

CREATE TABLE lc_materials     (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), materi_name text, created_by uuid);
CREATE TABLE lc_questions     (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), material_id uuid, question text, created_by uuid);
CREATE TABLE lc_quiz_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_name text, created_by uuid, target_user_ids uuid[]);
CREATE TABLE lc_quiz_attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, quiz_session_id uuid, total_questions int, tab_switches int, score numeric);
CREATE TABLE lc_answers       (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attempt_id uuid, user_id uuid, quiz_session_id uuid, question_id uuid, answer text, essay_text text, is_correct boolean);
CREATE TABLE lc_answer_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attempt_id uuid);

CREATE TABLE tech_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text, author_id uuid, author_name text, status text, folder_id uuid);
CREATE TABLE tech_note_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, created_by text, category text);
CREATE TABLE tech_note_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tech_note_id uuid, action text, performed_by text, performed_by_name text);

CREATE TABLE piket_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date, day_of_week int, pic_ivp_name text, edited_by_name text);
CREATE TABLE piket_tamu_detail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piket_id uuid, jenis_kegiatan text, nama_sales text, sales_division text,
  tamu_instansi text, keterangan text);
CREATE TABLE picket_holidays (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tanggal date);

CREATE TABLE daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_date date, username text,
  user_id uuid, user_name text, created_by text);
CREATE TABLE daily_report_team_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date, entered_by text, member_name text, activity text);

CREATE TABLE overdue_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid, due_date date, due_hours int, set_by text);

CREATE TABLE project_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid, sender_id uuid, sender_name text, sender_role text, message text);
CREATE TABLE project_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid, request_id uuid, file_name text, uploaded_by text);

CREATE TABLE form_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_username text, sales_name text, rating int);

CREATE TABLE movement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by text, nama_luar text, nama_pts text);

CREATE TABLE brand_pic_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_type text, brand_name text, pic_user_id uuid, pic_user_name text);
CREATE TABLE product_team_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_type text, team_types text[]);
CREATE TABLE pts_team_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), staff_user_id uuid, supervisor_user_id uuid);
CREATE TABLE incentive_tranches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid, tranche_number int, percentage numeric, payment_year int, status text);
CREATE TABLE late_ticket_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  late_ticket_id uuid, parent_project_id uuid, ticket_value numeric, is_sunset boolean);
CREATE TABLE piket_produk_lain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kegiatan_id uuid, piket_id uuid, nama text, watt numeric);

-- progress_* dipakai fungsi fondasi
CREATE TABLE progress_projects   (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sales_name text);
CREATE TABLE progress_locations  (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, sales_name text);
CREATE TABLE progress_components (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), location_id uuid);
CREATE TABLE progress_issues     (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid);
CREATE TABLE progress_actions    (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), issue_id uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
