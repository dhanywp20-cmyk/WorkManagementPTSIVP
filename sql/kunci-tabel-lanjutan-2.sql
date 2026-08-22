-- ============================================================================
--  KUNCI TABEL LANJUTAN (2) - sisa tabel operasional, disusun dari riset kode
-- ============================================================================
--
--  Melanjutkan sql/kunci-tabel-lanjutan.sql. Setiap tabel di bawah ditelusuri
--  ke kode aplikasi yang benar-benar memakainya (kolom, siapa membaca, siapa
--  menulis, apakah ada penjaga peran) sebelum policy-nya ditulis - bukan
--  ditebak dari nama tabel.
--
--  CATATAN JUJUR SOAL "TULIS = lingkup_semua()"
--  Beberapa tabel di bawah tombol tulisnya di aplikasi sebenarnya hanya
--  tampil untuk hasFullAccess(user) - admin/superadmin, ATAU akun team yang
--  diberi toggle "Full Access" oleh admin (kolom access_level). Klaim token
--  SEKARANG belum membawa access_level (lib/db-token.ts), jadi policy di
--  sini memakai lingkup_semua() (admin/superadmin/team) sebagai pendekatan -
--  sedikit LEBIH LONGGAR daripada tombolnya di layar untuk anggota team
--  tanpa Full Access. Ini bukan lubang baru: aplikasi hari ini juga tidak
--  mencegah anggota tim memanggil endpoint yang sama lewat cara lain, dan
--  celah ini jauh lebih kecil daripada keadaan sebelumnya (TANPA syarat
--  sama sekali, terbuka untuk siapa saja termasuk yang belum login). Begitu
--  access_level ikut ke klaim token, policy ini tinggal diganti memakai
--  fungsi baru - dicatat sebagai tindak lanjut, bukan disamarkan.
-- ============================================================================

BEGIN;

DO $$
DECLARE kurang text;
BEGIN
  SELECT string_agg(f, ', ') INTO kurang
  FROM unnest(ARRAY['jwt_claim','jwt_user_id','jwt_full_name','lingkup_semua',
                    'boleh_lihat_baris','boleh_lihat_project','buang_policy_lama']) AS f
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = f
  );
  IF kurang IS NOT NULL THEN
    RAISE EXCEPTION 'Fondasi belum lengkap - fungsi belum ada: %.', kurang;
  END IF;
END $$;


-- ─── 1. Tabel mati - dikunci total ──────────────────────────────────────────
--  service_reminders: nol referensi di app/** dan lib/**. Hanya disebut di
--  scripts/enable-rls.sql. Dikunci sama seperti incentive_disbursements dkk
--  di sql/kunci-tabel-lanjutan.sql.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='service_reminders') THEN
    ALTER TABLE service_reminders ENABLE ROW LEVEL SECURITY;
    PERFORM buang_policy_lama('service_reminders');
  END IF;
END $$;


-- ─── 2. team_members - dibaca semua, tidak ada jalur tulis nyata ────────────
--  Satu-satunya pemakaian: modal-notifikasi.tsx membaca name/team_type/
--  username untuk pencocokan nama, tanpa syarat. app/ticketing/page.tsx malah
--  mencatat tabel ini "tidak dipakai lagi - data diambil dari users". Tidak
--  ada INSERT/UPDATE/DELETE ditemukan di kode. Tulis tetap dikunci ke
--  lingkup_semua() (bukan ditutup total) untuk jaga-jaga ada jalur lama yang
--  terlewat penelusuran ini - tidak ada kerugian, karena memang tidak ada
--  tombol yang memanggilnya di luar admin/team.
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('team_members');
CREATE POLICY tm_baca  ON team_members FOR SELECT TO anon, authenticated USING (jwt_claim('sub') <> '');
CREATE POLICY tm_tulis ON team_members FOR ALL TO anon, authenticated
  USING (lingkup_semua()) WITH CHECK (lingkup_semua());


-- ─── 3. KPI - kpi_global_settings, kpi_manual_values, kpi_period_snapshots ──
--  Baca terbuka untuk siapa saja yang login: dashboard KPI dibaca juga oleh
--  role 'team' biasa (mode read-only, komponen sendiri yang menyembunyikan
--  tombol edit). Tulis (settings, nilai manual, snapshot) di aplikasi dibatasi
--  scope.kind !== 'team' - yaitu admin ATAU supervisor tim PTS. Didekati
--  lingkup_semua() dengan catatan yang sama seperti header berkas ini.
ALTER TABLE kpi_global_settings ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('kpi_global_settings');
CREATE POLICY kgs_baca  ON kpi_global_settings FOR SELECT TO anon, authenticated USING (jwt_claim('sub') <> '');
CREATE POLICY kgs_tulis ON kpi_global_settings FOR ALL TO anon, authenticated
  USING (lingkup_semua()) WITH CHECK (lingkup_semua());

ALTER TABLE kpi_manual_values ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('kpi_manual_values');
CREATE POLICY kmv_baca  ON kpi_manual_values FOR SELECT TO anon, authenticated USING (jwt_claim('sub') <> '');
CREATE POLICY kmv_tulis ON kpi_manual_values FOR ALL TO anon, authenticated
  USING (lingkup_semua()) WITH CHECK (lingkup_semua());

ALTER TABLE kpi_period_snapshots ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('kpi_period_snapshots');
CREATE POLICY kps_baca  ON kpi_period_snapshots FOR SELECT TO anon, authenticated USING (jwt_claim('sub') <> '');
CREATE POLICY kps_tulis ON kpi_period_snapshots FOR ALL TO anon, authenticated
  USING (lingkup_semua()) WITH CHECK (lingkup_semua());


-- ─── 4. Learning Center - konten (questions/materials/sessions) ────────────
--  Baca terbuka untuk siapa saja yang login - tidak disaring aplikasi sama
--  sekali (semua yang punya akses modul Learning Center melihat seluruh
--  soal/materi/sesi). Tulis hanya lewat panel admin (QuestionsPage,
--  SessionsPage, tombol edit MateriPage), lihat catatan header berkas ini.
ALTER TABLE lc_questions ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('lc_questions');
CREATE POLICY lcq_baca  ON lc_questions FOR SELECT TO anon, authenticated USING (jwt_claim('sub') <> '');
CREATE POLICY lcq_tulis ON lc_questions FOR ALL TO anon, authenticated
  USING (lingkup_semua()) WITH CHECK (lingkup_semua());

ALTER TABLE lc_materials ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('lc_materials');
CREATE POLICY lcm_baca  ON lc_materials FOR SELECT TO anon, authenticated USING (jwt_claim('sub') <> '');
CREATE POLICY lcm_tulis ON lc_materials FOR ALL TO anon, authenticated
  USING (lingkup_semua()) WITH CHECK (lingkup_semua());

ALTER TABLE lc_quiz_sessions ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('lc_quiz_sessions');
CREATE POLICY lcs_baca  ON lc_quiz_sessions FOR SELECT TO anon, authenticated USING (jwt_claim('sub') <> '');
CREATE POLICY lcs_tulis ON lc_quiz_sessions FOR ALL TO anon, authenticated
  USING (lingkup_semua()) WITH CHECK (lingkup_semua());


-- ─── 5. Learning Center - jawaban seseorang atas kuis ───────────────────────
--  lc_quiz_attempts.user_id dan lc_answers.user_id keduanya mengarah ke
--  ORANG yang mengerjakan (jwt_claim('sub')). Dibaca/ditulis pemiliknya
--  sendiri (MyQuizPage.tsx) dan dibaca+diubah admin/team untuk penilaian
--  esai manual (TeamPage.tsx meng-UPDATE lc_quiz_attempts). Kode aplikasi
--  men-UPDATE attempt HANYA berdasar attempt.id, tanpa syarat user_id di
--  query itu sendiri - policy inilah yang sungguh menahan orang lain
--  mengubah attempt yang bukan miliknya, sesuatu yang sebelum ini TIDAK
--  dicegah sama sekali di lapisan mana pun.
--  Perbandingan lewat ::text di kedua sisi (bukan jwt_user_id() yang bertipe
--  uuid) karena tipe kolom user_id di basis data ini belum diverifikasi
--  langsung - notifications.user_id dan project_requests.requester_id
--  ternyata TEXT walau isinya uuid (lihat sql/rls-nyalakan.sql syarat_tipe()),
--  jadi tidak boleh diasumsikan uuid begitu saja. ::text aman utk kedua
--  kemungkinan tipe, dan jwt_claim('sub') sudah berbentuk text.
ALTER TABLE lc_quiz_attempts ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('lc_quiz_attempts');
CREATE POLICY lca_milik ON lc_quiz_attempts FOR ALL TO anon, authenticated
  USING      (user_id::text = jwt_claim('sub') OR lingkup_semua())
  WITH CHECK (user_id::text = jwt_claim('sub') OR lingkup_semua());

ALTER TABLE lc_answers ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('lc_answers');
CREATE POLICY lcj_milik ON lc_answers FOR ALL TO anon, authenticated
  USING      (user_id::text = jwt_claim('sub') OR lingkup_semua())
  WITH CHECK (user_id::text = jwt_claim('sub') OR lingkup_semua());

--  lc_answer_records: nol jalur SELECT/INSERT/UPDATE di seluruh kode
--  aplikasi. Satu-satunya pemakaian adalah hapus berantai (by attempt_id)
--  saat admin menghapus sebuah sesi kuis di SessionsPage.tsx (admin-only).
--  Karena itu HANYA perintah DELETE yang diberi policy - perintah lain
--  otomatis tertolak RLS, dan itu memang mencerminkan tidak ada jalur yang
--  memakainya.
ALTER TABLE lc_answer_records ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('lc_answer_records');
CREATE POLICY lcr_hapus ON lc_answer_records FOR DELETE TO anon, authenticated
  USING (lingkup_semua());


-- ─── 6. Tech Note ────────────────────────────────────────────────────────────
--  tech_notes: admin/team/supervisor melihat semua; yang lain melihat semua
--  yang berstatus 'approved' plus milik sendiri (berapa pun statusnya).
--  Superset yang aman: penulis selalu boleh melihat barisnya sendiri,
--  approved selalu terlihat semua orang, dan lingkup_semua() menutup sisanya.
ALTER TABLE tech_notes ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('tech_notes');
CREATE POLICY tn_baca ON tech_notes FOR SELECT TO anon, authenticated
  USING (
    lingkup_semua()
    OR jwt_claim('user_role') = 'supervisor'
    OR status = 'approved'
    OR author_id::text = jwt_claim('sub')
  );
--  Buat baru: siapa saja yang login boleh mengajukan tech note.
CREATE POLICY tn_buat ON tech_notes FOR INSERT TO anon, authenticated
  WITH CHECK (jwt_claim('sub') <> '');
--  Ubah & hapus: HANYA canManage - bahkan penulis sendiri tidak boleh
--  menyunting sesudah mengajukan (persis kode: tombol edit hanya muncul utk
--  canManage, tanpa pengecualian utk author_id sendiri).
CREATE POLICY tn_ubah ON tech_notes FOR UPDATE TO anon, authenticated
  USING      (lingkup_semua() OR jwt_claim('user_role') = 'supervisor')
  WITH CHECK (lingkup_semua() OR jwt_claim('user_role') = 'supervisor');
CREATE POLICY tn_hapus ON tech_notes FOR DELETE TO anon, authenticated
  USING (lingkup_semua() OR jwt_claim('user_role') = 'supervisor');

--  tech_note_folders: baca terbuka, tambah dikunci ke pengelola. Tidak ada
--  jalur UPDATE/DELETE ditemukan di kode - tidak dibuatkan policy-nya,
--  supaya tetap konsisten: perintah yang tidak dipakai aplikasi tertutup
--  otomatis oleh RLS, bukan dibiarkan tanpa syarat karena "belum ditemukan".
ALTER TABLE tech_note_folders ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('tech_note_folders');
CREATE POLICY tnf_baca  ON tech_note_folders FOR SELECT TO anon, authenticated USING (jwt_claim('sub') <> '');
CREATE POLICY tnf_tambah ON tech_note_folders FOR INSERT TO anon, authenticated
  WITH CHECK (lingkup_semua());

--  tech_note_history: log kejadian per tech note. Tambah oleh siapa saja yang
--  memicu aksi (pengajuan awal termasuk dari non-manager), baca oleh siapa
--  saja yang bisa membuka detail note-nya, hapus hanya sebagai bagian dari
--  canManage menghapus note induknya.
ALTER TABLE tech_note_history ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('tech_note_history');
CREATE POLICY tnh_baca   ON tech_note_history FOR SELECT TO anon, authenticated USING (jwt_claim('sub') <> '');
CREATE POLICY tnh_tambah ON tech_note_history FOR INSERT TO anon, authenticated WITH CHECK (jwt_claim('sub') <> '');
CREATE POLICY tnh_hapus  ON tech_note_history FOR DELETE TO anon, authenticated
  USING (lingkup_semua() OR jwt_claim('user_role') = 'supervisor');


-- ─── 7. incentive_projects - ditulis, tidak pernah dibaca balik ─────────────
--  Dikonfirmasi lewat grep: tidak ada satu pun .select() di app/** untuk
--  tabel ini. Diisi app/reminder-schedule/page.tsx saat reminder ditandai
--  selesai, oleh admin atau role 'team'. Karena tidak ada jalur baca,
--  SELECT sengaja TIDAK diberi policy - itu mencerminkan keadaan sebenarnya,
--  bukan kelalaian.
ALTER TABLE incentive_projects ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('incentive_projects');
CREATE POLICY ip_tambah ON incentive_projects FOR INSERT TO anon, authenticated
  WITH CHECK (lingkup_semua());


-- ─── 8. Piket Showroom ───────────────────────────────────────────────────────
--  piket_schedules: jadwal roster, sengaja terbuka dibaca semua (komentar di
--  kode menegaskan ini). Tulis (kelola jadwal) lewat ScheduleModal, dikunci
--  hasFullAccess -> lingkup_semua().
ALTER TABLE piket_schedules ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('piket_schedules');
CREATE POLICY ps_baca  ON piket_schedules FOR SELECT TO anon, authenticated USING (jwt_claim('sub') <> '');
CREATE POLICY ps_tulis ON piket_schedules FOR ALL TO anon, authenticated
  USING (lingkup_semua()) WITH CHECK (lingkup_semua());

--  piket_tamu_detail: TIDAK sekadar tabel anak. Visibilitasnya berdasar NAMA
--  (nama_sales/sales_division), sama seperti tickets/reminders versi lama -
--  itulah gunanya boleh_lihat_project() yang sudah ada. Tulis (isi detail
--  tamu) di kode TIDAK dijaga peran sama sekali - siapa saja yang membuka
--  modulnya bisa mengisi. Menyamakannya dengan lingkup_semua() akan mematikan
--  fitur "isi detail piket sendiri" bagi guest/sales biasa yang memang
--  dituju fitur ini. Karena itu tulis memakai syarat YANG SAMA dengan baca -
--  mengetatkannya ke lingkup_semua() saja adalah perubahan perilaku
--  tersendiri, sengaja tidak dilakukan di sini.
ALTER TABLE piket_tamu_detail ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('piket_tamu_detail');
CREATE POLICY ptd_baca ON piket_tamu_detail FOR SELECT TO anon, authenticated
  USING (boleh_lihat_project(nama_sales, sales_division) OR lingkup_semua());
CREATE POLICY ptd_tulis ON piket_tamu_detail FOR ALL TO anon, authenticated
  USING      (boleh_lihat_project(nama_sales, sales_division) OR lingkup_semua())
  WITH CHECK (boleh_lihat_project(nama_sales, sales_division) OR lingkup_semua());


-- ─── 9. daily_report_team_entries ───────────────────────────────────────────
--  Fitur admin-only (isAdmin && teamEntries.length): admin mencatat aktivitas
--  atas nama seluruh tim untuk satu tanggal, disimpan+dihapus per entered_by
--  supaya admin lain tidak saling menimpa. Baris tetap bisa diubah pemiliknya
--  sendiri (entered_by = username-nya) atau lingkup_semua() sebagai payung.
ALTER TABLE daily_report_team_entries ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('daily_report_team_entries');
CREATE POLICY drte_baca  ON daily_report_team_entries FOR SELECT TO anon, authenticated USING (jwt_claim('sub') <> '');
CREATE POLICY drte_tulis ON daily_report_team_entries FOR ALL TO anon, authenticated
  USING      (entered_by = jwt_claim('username') OR lingkup_semua())
  WITH CHECK (entered_by = jwt_claim('username') OR lingkup_semua());


-- ─── 10. overdue_settings ────────────────────────────────────────────────────
--  Baca TIDAK admin-only: fetchOverdueSettings() dipanggil tanpa syarat saat
--  halaman Ticketing dibuka siapa pun yang login, dipakai menghitung status
--  overdue di layar. Tulis (set/ubah/hapus deadline) lewat modal admin.
ALTER TABLE overdue_settings ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('overdue_settings');
CREATE POLICY os_baca  ON overdue_settings FOR SELECT TO anon, authenticated USING (jwt_claim('sub') <> '');
CREATE POLICY os_tulis ON overdue_settings FOR ALL TO anon, authenticated
  USING (lingkup_semua()) WITH CHECK (lingkup_semua());


-- ─── 11. project_messages & project_attachments ─────────────────────────────
--  Bukan tabel anak pasif - keduanya mengikuti visibilitas project_requests
--  induknya (pr_select di sql/kunci-tabel-lanjutan.sql), disalin persis di
--  sini lewat EXISTS supaya siapa boleh membaca chat/lampiran SAMA dengan
--  siapa boleh membaca request-nya - bukan lebih longgar ataupun lebih
--  ketat. Hapus dikunci admin/superadmin, sama seperti pr_delete - kode
--  form-require-project/page.tsx menjaga tombol Hapus dengan
--  (isSuperAdmin || isAdmin), TANPA pengecualian utk role 'team' biasa,
--  jadi lingkup_semua() (yang mencakup 'team') sengaja TIDAK dipakai di sini.
CREATE OR REPLACE FUNCTION boleh_lihat_request(req_id uuid)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_requests pr
    WHERE pr.id = req_id
      AND (
        boleh_lihat_baris(pr.sales_user_id, pr.sales_name, pr.sales_division, NULL)
        OR pr.requester_id      = jwt_claim('sub')
        OR pr.assign_user_id    = jwt_user_id()
        OR pr.assign_name       = jwt_full_name()
        OR pr.internal_sales_id = jwt_user_id()
      )
  );
$$;
GRANT EXECUTE ON FUNCTION boleh_lihat_request(uuid) TO anon, authenticated;

ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('project_messages');
CREATE POLICY pm_baca  ON project_messages FOR SELECT TO anon, authenticated
  USING (boleh_lihat_request(request_id));
CREATE POLICY pm_tulis ON project_messages FOR INSERT TO anon, authenticated
  WITH CHECK (boleh_lihat_request(request_id) AND sender_id::text = jwt_claim('sub'));
CREATE POLICY pm_hapus ON project_messages FOR DELETE TO anon, authenticated
  USING (jwt_claim('user_role') IN ('admin','superadmin'));

ALTER TABLE project_attachments ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('project_attachments');
CREATE POLICY pa2_baca  ON project_attachments FOR SELECT TO anon, authenticated
  USING (boleh_lihat_request(request_id));
CREATE POLICY pa2_tulis ON project_attachments FOR INSERT TO anon, authenticated
  WITH CHECK (boleh_lihat_request(request_id));
CREATE POLICY pa2_hapus ON project_attachments FOR DELETE TO anon, authenticated
  USING (jwt_claim('user_role') IN ('admin','superadmin'));


-- ─── Pemeriksaan ─────────────────────────────────────────────────────────────
SELECT c.relname AS tabel, c.relrowsecurity AS rls_aktif,
       COALESCE(string_agg(DISTINCT p.cmd, ', ' ORDER BY p.cmd), '(tidak ada policy)') AS perintah_tersaring
FROM pg_class c
LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN (
    'service_reminders','team_members',
    'kpi_global_settings','kpi_manual_values','kpi_period_snapshots',
    'lc_questions','lc_materials','lc_quiz_sessions',
    'lc_quiz_attempts','lc_answers','lc_answer_records',
    'tech_notes','tech_note_folders','tech_note_history',
    'incentive_projects','piket_schedules','piket_tamu_detail',
    'daily_report_team_entries','overdue_settings',
    'project_messages','project_attachments'
  )
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

COMMIT;


-- ─── PEMBATALAN ─────────────────────────────────────────────────────────────
--  Berlaku seketika, tanpa deploy ulang. Kalau satu modul bermasalah, matikan
--  RLS tabel ITU SAJA:
--
--    ALTER TABLE <nama_tabel> DISABLE ROW LEVEL SECURITY;
