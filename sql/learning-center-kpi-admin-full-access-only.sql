-- =====================================================================
-- Learning Center & KPI Team - tulis/hapus dipersempit ke Admin/Full Access
-- =====================================================================
--
-- GEJALA
--
-- Lanjutan audit "menu mana yang belum sesuai" setelah Ticketing, Reminder
-- Schedule, Design Project, Project Progress, Daily Report, Unit Movement
-- Log, Tech Notes dan Form Review. Learning Center dan KPI Team belum
-- diperiksa - keduanya ternyata masih memakai `lingkup_semua()`:
--
--     SELECT jwt_claim('user_role') IN ('admin', 'superadmin', 'team');
--
-- yaitu SEMUA akun dengan role 'team' (mayoritas staf biasa), bukan hanya
-- yang diberi toggle "Full Access" di Admin Panel. Persis pola yang sudah
-- ditemukan berulang kali di modul-modul lain sebelum ini.
--
-- Di layar (React), tombol Edit/Hapus materi, soal, dan sesi quiz sudah
-- benar - hanya tampil untuk `isAdmin = hasFullAccess(currentUser)`
-- (app/learning-center/page.tsx). Begitu juga tombol "Pengaturan KPI" dan
-- "Mulai KPI" di app/kpi-team/ hanya tampil untuk scope non-team. TAPI RLS
-- di baliknya tidak seketat itu: siapa pun dengan role 'team' bisa
-- menghapus/mengubah materi, soal ujian, sesi quiz, pengaturan bobot KPI
-- global, atau riwayat snapshot KPI tim langsung lewat panggilan Supabase
-- (REST/anon key), melewati UI sepenuhnya.
--
-- `lc_answers`/`lc_quiz_attempts` (jawaban & skor quiz milik pribadi) juga
-- kena efek sampingnya: cabang admin di kebijakannya memakai
-- `lingkup_semua()`, jadi anggota team mana pun bisa mengubah/menghapus
-- jawaban ATAU skor quiz milik anggota LAIN, bukan cuma miliknya sendiri.
--
-- `kpi_snapshot_members` malah tidak dibatasi sama sekali (`with_check:
-- true` polos) - siapa pun yang login bisa menyisipkan baris anggota
-- snapshot KPI.
--
-- PERBAIKAN
--
-- Materi/Soal/Sesi Quiz dan pengaturan KPI adalah konten yang dikelola
-- admin, bukan milik perorangan - jadi tidak perlu pemisahan owner-edit
-- seperti modul lain, cukup dipersempit ke admin_atau_full_access() saja,
-- sesuai dengan apa yang UI sudah tampilkan. Jawaban/attempt quiz tetap
-- self-scoped ke pemiliknya sebagai jalur utama; hanya cabang admin-nya
-- yang dipersempit.
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
-- =====================================================================

DROP POLICY IF EXISTS lcm_tulis ON public.lc_materials;
CREATE POLICY lcm_tulis ON public.lc_materials
  FOR ALL TO anon, authenticated
  USING (public.admin_atau_full_access())
  WITH CHECK (public.admin_atau_full_access());

DROP POLICY IF EXISTS lcq_tulis ON public.lc_questions;
CREATE POLICY lcq_tulis ON public.lc_questions
  FOR ALL TO anon, authenticated
  USING (public.admin_atau_full_access())
  WITH CHECK (public.admin_atau_full_access());

DROP POLICY IF EXISTS lcs_tulis ON public.lc_quiz_sessions;
CREATE POLICY lcs_tulis ON public.lc_quiz_sessions
  FOR ALL TO anon, authenticated
  USING (public.admin_atau_full_access())
  WITH CHECK (public.admin_atau_full_access());

DROP POLICY IF EXISTS lcj_milik ON public.lc_answers;
CREATE POLICY lcj_milik ON public.lc_answers
  FOR ALL TO anon, authenticated
  USING (user_id::text = jwt_claim('sub') OR public.admin_atau_full_access())
  WITH CHECK (user_id::text = jwt_claim('sub') OR public.admin_atau_full_access());

DROP POLICY IF EXISTS lca_milik ON public.lc_quiz_attempts;
CREATE POLICY lca_milik ON public.lc_quiz_attempts
  FOR ALL TO anon, authenticated
  USING (user_id::text = jwt_claim('sub') OR public.admin_atau_full_access())
  WITH CHECK (user_id::text = jwt_claim('sub') OR public.admin_atau_full_access());

DROP POLICY IF EXISTS kgs_tulis ON public.kpi_global_settings;
CREATE POLICY kgs_tulis ON public.kpi_global_settings
  FOR ALL TO anon, authenticated
  USING (public.admin_atau_full_access())
  WITH CHECK (public.admin_atau_full_access());

DROP POLICY IF EXISTS kps_tulis ON public.kpi_period_snapshots;
CREATE POLICY kps_tulis ON public.kpi_period_snapshots
  FOR ALL TO anon, authenticated
  USING (public.admin_atau_full_access())
  WITH CHECK (public.admin_atau_full_access());

-- Sebelumnya with_check: true (INSERT tanpa syarat sama sekali). Dipersempit
-- mengikuti induknya (kpi_period_snapshots).
DROP POLICY IF EXISTS ksm_insert ON public.kpi_snapshot_members;
CREATE POLICY ksm_insert ON public.kpi_snapshot_members
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.admin_atau_full_access());

-- =====================================================================
-- CATATAN: `lingkup_semua()` MASIH dipakai di sekitar 18 berkas/20+ tabel
-- lain (daily_reports lama, piket_schedules, team_members, users UPDATE,
-- dst) di luar dua modul ini. Itu kemungkinan akar masalah yang lebih luas
-- dan LAYAK DIAUDIT TERPISAH - lihat ringkasan yang disampaikan ke user
-- sebelum berkas ini ditulis. Belum diubah di migrasi ini karena di luar
-- lingkup "Learning Center & KPI Team" yang diminta.
-- =====================================================================
