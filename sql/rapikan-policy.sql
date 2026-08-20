-- ============================================================================
--  RAPIKAN POLICY - buang yang kembar, tutup yang tidak seharusnya terbuka
-- ============================================================================
--
--  Disusun dari keluaran nyata bagian 4 sql/cek-jangkauan-anon.sql: 110 policy
--  berbunyi USING (true) di 44 tabel. Angka itu menyesatkan, karena sebagian
--  besarnya kembar - satu tabel bisa punya lima policy yang mengizinkan hal
--  yang persis sama.
--
--  Tiga bagian, dan HANYA dua yang pertama boleh dijalankan sekarang:
--    1. Membuang policy kembar. Tidak mengubah siapa boleh apa sama sekali.
--    2. audit_trail jadi hanya-tambah. Aman hari ini, tidak butuh token.
--    3. Pengetatan yang BARU BOLEH dijalankan setelah token identitas terbukti
--       sampai ke basis data. Masih berupa komentar.
-- ============================================================================


-- ─── BAGIAN 1. Policy kembar ────────────────────────────────────────────────
--  Di Postgres, policy permissive di-OR-kan: yang paling longgar menang. Role
--  `public` juga sudah mencakup `anon` dan `authenticated`. Jadi bila sebuah
--  tabel sudah punya satu policy FOR ALL TO public USING (true), semua policy
--  lain di tabel itu yang juga tanpa syarat tidak menambah izin apa pun - ia
--  cuma membuat daftar policy sulit dibaca, dan itu berbahaya dengan caranya
--  sendiri: pengetatan yang benar di satu policy diam-diam dibatalkan policy
--  kembar yang terlupa.
--
--  Yang dibuang di bawah SEMUANYA terbukti kembar. Perilaku sesudah blok ini
--  identik dengan sebelumnya - 28 policy hilang, nol izin berubah.

-- activity_logs: "Allow all activity_logs" (ALL, public) sudah mencakup semua.
DROP POLICY IF EXISTS "Enable all for activity_logs"  ON activity_logs;
DROP POLICY IF EXISTS "allow_insert_activity_logs"    ON activity_logs;
DROP POLICY IF EXISTS "allow_select_activity_logs"    ON activity_logs;
DROP POLICY IF EXISTS "anon_all_activity_logs"        ON activity_logs;

-- Tabel berikut sudah punya satu policy FOR ALL TO public; salinan anon-nya
-- tidak menambah apa pun.
DROP POLICY IF EXISTS "anon_all_app_settings"     ON app_settings;
DROP POLICY IF EXISTS "anon_all_form_reviews"     ON form_reviews;
DROP POLICY IF EXISTS "anon_all_movement_logs"    ON movement_logs;
DROP POLICY IF EXISTS "anon_all_overdue_settings" ON overdue_settings;
DROP POLICY IF EXISTS "anon_all_piket_schedules"  ON piket_schedules;
DROP POLICY IF EXISTS "anon_all_reminders"        ON reminders;

-- Tabel berikut sudah punya policy FOR ALL untuk anon + authenticated.
DROP POLICY IF EXISTS "anon_all_team_members" ON team_members;
DROP POLICY IF EXISTS "anon_all_tickets"      ON tickets;
DROP POLICY IF EXISTS "anon_all_users"        ON users;

-- kpi_manual_values: "allow_write_kpi_manual" (ALL, public) sudah mencakup baca.
DROP POLICY IF EXISTS "allow_read_kpi_manual"        ON kpi_manual_values;
DROP POLICY IF EXISTS "anon_all_kpi_manual_values"   ON kpi_manual_values;

-- Learning Center: empat policy per-perintah sudah mencakup seluruh perintah.
DROP POLICY IF EXISTS "Allow delete"              ON lc_materials;
DROP POLICY IF EXISTS "anon_all_lc_materials"     ON lc_materials;
DROP POLICY IF EXISTS "Allow delete"              ON lc_questions;
DROP POLICY IF EXISTS "anon_all_lc_questions"     ON lc_questions;
DROP POLICY IF EXISTS "anon_all_lc_quiz_sessions" ON lc_quiz_sessions;

-- user_supervisor_mappings: "allow_all" (ALL, public) sudah mencakup delapan
-- policy lain di tabel yang sama.
DROP POLICY IF EXISTS "allow_all_delete"                    ON user_supervisor_mappings;
DROP POLICY IF EXISTS "allow_all_insert"                    ON user_supervisor_mappings;
DROP POLICY IF EXISTS "allow_all_read"                      ON user_supervisor_mappings;
DROP POLICY IF EXISTS "allow_all_update"                    ON user_supervisor_mappings;
DROP POLICY IF EXISTS "usm_delete"                          ON user_supervisor_mappings;
DROP POLICY IF EXISTS "usm_insert"                          ON user_supervisor_mappings;
DROP POLICY IF EXISTS "usm_read"                            ON user_supervisor_mappings;
DROP POLICY IF EXISTS "anon_all_user_supervisor_mappings"   ON user_supervisor_mappings;

--  TIDAK dibuang, walau namanya mirip: di tabel-tabel ini policy anon_all
--  memberi perintah yang TIDAK dipunyai policy public-nya (mis. public hanya
--  punya INSERT/SELECT, sementara anon_all juga UPDATE/DELETE). Membuangnya
--  bukan merapikan, melainkan mengubah perilaku - dan itu urusan bagian 3.
--    daily_reports, daily_report_team_entries, division_ivp_mappings,
--    division_supervisor_mappings, lc_answers, lc_quiz_attempts,
--    piket_tamu_detail, project_attachments, tech_notes, tech_note_folders,
--    tech_note_history


-- ─── BAGIAN 2. audit_trail jadi hanya-tambah ────────────────────────────────
--  Ini satu-satunya pengetatan yang aman dijalankan HARI INI, karena tidak
--  bergantung pada token identitas sama sekali.
--
--  Kenapa mendesak: anon_all_audit_trail memberi anon perintah UPDATE dan
--  DELETE. Anon key ikut terkirim ke setiap browser, jadi siapa pun yang
--  membukanya dari DevTools bisa menghapus atau mengubah catatan siapa
--  mengubah apa. Catatan yang bisa ditulis ulang oleh orang yang dicatat
--  bukan lagi bukti - dan justru itulah satu-satunya guna tabel ini.
--
--  Kenapa aman: seluruh platform hanya MENAMBAH ke tabel ini (lib/audit.ts
--  logAudit) dan MEMBACA-nya (AuditTrailPanel, Project Progress, Analytics,
--  route share). Tidak ada satu pun jalur yang mengubah atau menghapus.
--  Route server memakai service_role, yang melewati RLS, jadi tidak terpengaruh.
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_audit_trail" ON audit_trail;
DROP POLICY IF EXISTS audit_trail_tambah     ON audit_trail;
DROP POLICY IF EXISTS audit_trail_baca       ON audit_trail;

CREATE POLICY audit_trail_tambah ON audit_trail
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY audit_trail_baca ON audit_trail
  FOR SELECT TO anon, authenticated USING (true);

--  Membacanya masih terbuka untuk semua yang punya anon key. Menutup itu
--  butuh identitas, dan ada di bagian 3.


-- ─── BAGIAN 3. Menunggu token identitas - JANGAN dijalankan dulu ────────────
--  Semua di bawah memakai jwt_claim() dari sql/rls-project-progress.sql.
--  Syaratnya sama seperti sql/rls-lingkup-project.sql: /api/auth/db-token-check
--  harus menjawab siap:true, dan semua orang sudah logout-login sekali.
--
--  Kalau dijalankan sebelum itu, klaimnya kosong, syaratnya selalu salah, dan
--  layar yang bersangkutan berhenti bekerja untuk SEMUA orang.

-- --- 3a. incentive_scheme_settings - porsi pembagian insentif ---
--  Satu baris JSON yang menentukan siapa dapat berapa persen. Sekarang siapa
--  pun yang punya anon key boleh menulisnya. Membaca tetap terbuka: seluruh
--  layar Incentive memerlukannya untuk menghitung.
-- DROP POLICY IF EXISTS incentive_scheme_tulis ON incentive_scheme_settings;
-- CREATE POLICY incentive_scheme_tulis ON incentive_scheme_settings
--   FOR ALL TO anon, authenticated
--   USING (jwt_claim('user_role') IN ('admin','superadmin'))
--   WITH CHECK (jwt_claim('user_role') IN ('admin','superadmin'));

-- --- 3b. app_settings - manager_user_id, jadwal reminder ---
--  Dibaca banyak layar, ditulis HANYA dari Admin Panel dan pengaturan
--  Ticketing. Karena itu baca dibiarkan terbuka, tulis dikunci ke admin.
-- DROP POLICY IF EXISTS "Allow all app_settings" ON app_settings;
-- CREATE POLICY app_settings_baca ON app_settings
--   FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY app_settings_tulis ON app_settings
--   FOR ALL TO anon, authenticated
--   USING (jwt_claim('user_role') IN ('admin','superadmin'))
--   WITH CHECK (jwt_claim('user_role') IN ('admin','superadmin'));

-- --- 3c. kpi_global_settings - bobot & target KPI ---
-- DROP POLICY IF EXISTS anon_all_kpi_global_settings ON kpi_global_settings;
-- CREATE POLICY kpi_settings_baca ON kpi_global_settings
--   FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY kpi_settings_tulis ON kpi_global_settings
--   FOR ALL TO anon, authenticated
--   USING (jwt_claim('user_role') IN ('admin','superadmin'))
--   WITH CHECK (jwt_claim('user_role') IN ('admin','superadmin'));

-- --- 3d. audit_trail - membaca hanya untuk orang dalam ---
--  Melengkapi bagian 2. Riwayat perubahan menyebut nama orang dan nilai lama
--  sebuah data; itu bukan bacaan untuk siapa saja yang punya anon key.
-- DROP POLICY IF EXISTS audit_trail_baca ON audit_trail;
-- CREATE POLICY audit_trail_baca ON audit_trail
--   FOR SELECT TO anon, authenticated
--   USING (jwt_claim('user_role') IN ('admin','superadmin','team'));

-- --- 3e. notifications - milik masing-masing ---
--  Ada juga di sql/rls-lingkup-project.sql bagian 4; jalankan salah satu saja.
-- DROP POLICY IF EXISTS anon_all_notifications ON notifications;
-- CREATE POLICY nt_own ON notifications
--   FOR ALL TO anon, authenticated
--   USING (user_id = jwt_user_id() OR jwt_claim('user_role') IN ('admin','superadmin'))
--   WITH CHECK (true);


-- ─── Pemeriksaan sesudah bagian 1 & 2 ───────────────────────────────────────
--  Jumlah policy tanpa syarat harus turun dari 110 ke sekitar 82, dan
--  audit_trail harus menyisakan tepat dua policy: INSERT dan SELECT.
SELECT count(*) AS policy_tanpa_syarat
FROM pg_policies
WHERE schemaname = 'public'
  AND COALESCE(qual, 'true') = 'true'
  AND COALESCE(with_check, 'true') = 'true';

SELECT policyname AS policy, cmd AS perintah, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'audit_trail'
ORDER BY policyname;
