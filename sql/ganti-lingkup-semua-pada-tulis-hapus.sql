-- =====================================================================
-- AKAR MASALAH: lingkup_semua() DIPAKAI SEBAGAI SYARAT MENULIS & MENGHAPUS
-- =====================================================================
--
-- GEJALA
--
-- Sepanjang audit modul demi modul (Ticketing, Reminder Schedule, Design
-- Project, Project Progress, Daily Report, Unit Movement Log, Tech Notes,
-- Form Review, Learning Center, KPI Team) pola yang sama muncul terus:
--
--     CREATE POLICY x_tulis ON <tabel> FOR ALL USING (lingkup_semua());
--
-- padahal:
--
--     CREATE FUNCTION lingkup_semua() RETURNS boolean AS
--       SELECT jwt_claim('user_role') IN ('admin', 'superadmin', 'team');
--
-- Artinya SETIAP akun dengan role 'team' - mayoritas staf biasa, bukan
-- hanya yang diberi toggle "Full Access" di Admin Panel - boleh MENULIS
-- dan MENGHAPUS baris di tabel-tabel itu lewat REST dengan anon key,
-- melewati layar sepenuhnya. Layarnya sendiri hampir selalu sudah benar
-- (tombolnya digate hasFullAccess/isAdmin); yang bocor kebijakan di
-- baliknya.
--
-- Ini melanggar aturan yang dipakai di seluruh platform ini:
--
--     Aktor yang berkepentingan dengan sebuah baris boleh MENGEDIT
--     bagiannya sendiri. MENGHAPUS hanya admin/superadmin atau akun
--     Full Access - tanpa kecuali.
--
-- CARA MEMPERBAIKI YANG DIPAKAI DI SINI
--
-- Bukan mengganti lingkup_semua() secara membabi buta, tapi menilai tiap
-- kebijakan menurut siapa yang benar-benar memakainya di layar:
--
--   (A) Tabel konfigurasi yang hanya ditulis Admin Panel  -> admin_atau_full_access()
--   (B) Data milik pribadi                                -> milik-sendiri OR admin
--   (C) INSERT yang kelewat longgar                       -> disamakan dgn gate layarnya
--   (D) Kebijakan FOR ALL yang mencampur tulis & hapus    -> DIPECAH: tulis boleh
--                                                            aktor, hapus admin saja
--   (E) Hak yang butuh jabatan (Supervisor PTS)           -> helper baca users
--
-- Kebijakan SELECT SENGAJA TIDAK DISENTUH. Membaca luas memang disengaja
-- di platform ini (satu tim melihat pekerjaan satu sama lain); yang tidak
-- pernah disengaja adalah menulis & menghapus luas.
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
-- =====================================================================


-- =====================================================================
-- (A) TABEL KONFIGURASI - HANYA DITULIS DARI ADMIN PANEL
-- =====================================================================
--
-- Ketiga tabel pemetaan di bawah hanya punya satu penulis di seluruh kode:
-- app/dashboard/_components/modal-user.tsx (layar "Kelola User" di Admin
-- Panel, yang tombolnya sendiri digate role admin/superadmin).

DROP POLICY IF EXISTS division_ivp_mappings_tulis ON public.division_ivp_mappings;
CREATE POLICY division_ivp_mappings_tulis ON public.division_ivp_mappings
  FOR ALL TO anon, authenticated
  USING (public.admin_atau_full_access())
  WITH CHECK (public.admin_atau_full_access());

DROP POLICY IF EXISTS division_supervisor_mappings_tulis ON public.division_supervisor_mappings;
CREATE POLICY division_supervisor_mappings_tulis ON public.division_supervisor_mappings
  FOR ALL TO anon, authenticated
  USING (public.admin_atau_full_access())
  WITH CHECK (public.admin_atau_full_access());

DROP POLICY IF EXISTS user_supervisor_mappings_tulis ON public.user_supervisor_mappings;
CREATE POLICY user_supervisor_mappings_tulis ON public.user_supervisor_mappings
  FOR ALL TO anon, authenticated
  USING (public.admin_atau_full_access())
  WITH CHECK (public.admin_atau_full_access());

-- team_members: data induk, TIDAK ADA penulis dari klien sama sekali
-- (hanya dibaca modal-notifikasi.tsx).
DROP POLICY IF EXISTS tm_tulis ON public.team_members;
CREATE POLICY tm_tulis ON public.team_members
  FOR ALL TO anon, authenticated
  USING (public.admin_atau_full_access())
  WITH CHECK (public.admin_atau_full_access());

-- overdue_settings: tombol jam-overdue tiket digate canManageTickets di
-- app/ticketing/page.tsx (admin, atau Manager PTS - yang di basis data ini
-- memang diberi Full Access lewat Admin Panel, bukan dipaku di kode).
DROP POLICY IF EXISTS os_tulis ON public.overdue_settings;
CREATE POLICY os_tulis ON public.overdue_settings
  FOR ALL TO anon, authenticated
  USING (public.admin_atau_full_access())
  WITH CHECK (public.admin_atau_full_access());

-- picket_holidays: toggleHoliday() digate isAdmin = hasFullAccess() -
-- cocok persis dengan admin_atau_full_access().
DROP POLICY IF EXISTS ph_tulis ON public.picket_holidays;
CREATE POLICY ph_tulis ON public.picket_holidays
  FOR ALL TO anon, authenticated
  USING (public.admin_atau_full_access())
  WITH CHECK (public.admin_atau_full_access());


-- =====================================================================
-- (B) DATA PRIBADI - MILIK SENDIRI ATAU ADMIN
-- =====================================================================
--
-- users_ubah sebelumnya: (id = sub) OR lingkup_semua() - jadi anggota team
-- mana pun bisa mengubah baris user SIAPA SAJA. Trigger
-- guard_users_privileged_columns memang sudah membekukan kolom hak akses
-- (role, access_level, allowed_menus, incentive_*, piket_akses) untuk anon,
-- jadi tidak ada jalur menaikkan hak akses lewat sini - tapi nama, jabatan,
-- atasan_id, divisi, nomor telepon dan kpi_enabled orang lain TIDAK
-- terlindungi. full_name khususnya berbahaya: banyak kebijakan RLS lain
-- mencocokkan jwt_full_name(), jadi mengubah nama orang lain ikut menggeser
-- baris apa yang bisa mereka lihat & sunting.
--
-- Semua jalur sah aman setelah dipersempit: profil sendiri lewat
-- modal-profil.tsx (pakai id sendiri), pengelolaan user lain lewat Admin
-- Panel (admin), dan kolom hak akses lewat /api/admin/users yang memakai
-- service-role sehingga tidak tunduk RLS.
DROP POLICY IF EXISTS users_ubah ON public.users;
CREATE POLICY users_ubah ON public.users
  FOR UPDATE TO anon, authenticated
  USING (id::text = jwt_claim('sub') OR public.admin_atau_full_access())
  WITH CHECK (id::text = jwt_claim('sub') OR public.admin_atau_full_access());

-- notifications: WITH CHECK sengaja DIBIARKAN terbuka - sistem memang
-- membuat notifikasi UNTUK orang lain (mis. approve Tech Note memberi tahu
-- penulisnya). Yang dipersempit hanya baca/ubah/hapus, supaya kotak masuk
-- orang lain tidak bisa dibaca atau dikosongkan anggota team lain.
DROP POLICY IF EXISTS nt_own ON public.notifications;
CREATE POLICY nt_own ON public.notifications
  FOR ALL TO anon, authenticated
  USING (user_id = jwt_claim('sub') OR public.admin_atau_full_access())
  WITH CHECK (true);


-- =====================================================================
-- (C) INSERT YANG KELEWAT LONGGAR
-- =====================================================================

-- Folder Tech Note: tombol "+ Folder" digate canManage
-- (admin/superadmin/Supervisor/Full Access) di app/tech-note/page.tsx.
DROP POLICY IF EXISTS tnf_tambah ON public.tech_note_folders;
CREATE POLICY tnf_tambah ON public.tech_note_folders
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.admin_atau_full_access() OR jwt_claim('user_role') = 'supervisor');

-- incentive_projects: TIDAK ADA penulis dari klien - kode yang dulu menulis
-- ke sini sudah dihapus (lihat komentar panjang di reminder-schedule/
-- page.tsx). Disamakan dengan model akses modul Incentive supaya konsisten
-- kalau kelak dipakai lagi, bukan dibiarkan "semua team".
DROP POLICY IF EXISTS ip_tambah ON public.incentive_projects;
CREATE POLICY ip_tambah ON public.incentive_projects
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.akses_insentif_input());

-- Lokasi Project Progress: pl_update & pl_delete sudah dibetulkan lebih
-- dulu, tapi pl_insert tertinggal memakai is_progress_admin() (yang
-- definisinya sama persis dengan lingkup_semua()). Disamakan dengan
-- pl_update.
DROP POLICY IF EXISTS pl_insert ON public.progress_locations;
CREATE POLICY pl_insert ON public.progress_locations
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.admin_atau_full_access()
    OR sales_name = jwt_full_name()
    OR pic = jwt_full_name()
  );


-- =====================================================================
-- (D) KEBIJAKAN "FOR ALL" DIPECAH: TULIS BOLEH AKTOR, HAPUS ADMIN SAJA
-- =====================================================================

-- PIKET SHOWROOM. Di sini lingkup_semua() untuk MENGISI justru BENAR:
-- lib/piket-akses.ts (bisaIsiKegiatan -> adalahPTS) memang memberi hak isi
-- ke seluruh tim PTS - merekalah yang bertugas piket dan mencatat tamunya;
-- Sales & resepsionis hanya membaca. Yang salah hanya karena kebijakannya
-- FOR ALL, sehingga HAPUS ikut terbuka - padahal tombol hapus di layar
-- digate isAdmin.
DROP POLICY IF EXISTS ps_tulis ON public.piket_schedules;

CREATE POLICY ps_tambah ON public.piket_schedules
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.lingkup_semua());

CREATE POLICY ps_ubah ON public.piket_schedules
  FOR UPDATE TO anon, authenticated
  USING (public.lingkup_semua())
  WITH CHECK (public.lingkup_semua());

CREATE POLICY ps_hapus ON public.piket_schedules
  FOR DELETE TO anon, authenticated
  USING (public.admin_atau_full_access());

-- progress_actions: tidak ada penulis dari klien, tapi polanya disamakan
-- dengan progress_issues (pi_insert/pi_update/pi_delete) supaya konsisten.
DROP POLICY IF EXISTS pa_write ON public.progress_actions;

CREATE POLICY pa_insert ON public.progress_actions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.admin_atau_full_access()
    OR EXISTS (SELECT 1 FROM public.progress_issues i
                WHERE i.id = progress_actions.issue_id AND i.pic = jwt_full_name())
  );

CREATE POLICY pa_update ON public.progress_actions
  FOR UPDATE TO anon, authenticated
  USING (
    public.admin_atau_full_access()
    OR EXISTS (SELECT 1 FROM public.progress_issues i
                WHERE i.id = progress_actions.issue_id AND i.pic = jwt_full_name())
  )
  WITH CHECK (
    public.admin_atau_full_access()
    OR EXISTS (SELECT 1 FROM public.progress_issues i
                WHERE i.id = progress_actions.issue_id AND i.pic = jwt_full_name())
  );

CREATE POLICY pa_delete ON public.progress_actions
  FOR DELETE TO anon, authenticated
  USING (public.admin_atau_full_access());


-- =====================================================================
-- (E) HAK YANG BERGANTUNG JABATAN: KPI MANUAL
-- =====================================================================
--
-- Layar KPI membuka tombol edit nilai manual untuk scope 'admin' DAN
-- 'pts_sup' - yaitu role 'team' + team_type "Team PTS *" + jabatan
-- 'Supervisor' (lihat DashboardKPI.tsx, resolve scope). JWT hanya membawa
-- sub/username/user_role/full_name/access_level - tidak ada jabatan atau
-- team_type - jadi syarat ini harus dibaca dari tabel users.
--
-- SECURITY DEFINER seperti akses_insentif(): yang dikembalikan cuma satu
-- boolean, tidak ada data user yang bocor lewat sini.
--
-- CATATAN ARAH KE DEPAN: jabatan yang dipaku di dalam fungsi ini tetap
-- bentuk hardcode. Jawaban jangka panjang yang sesuai prinsip platform ini
-- adalah memberi Supervisor PTS toggle "Full Access" (atau kolom hak
-- tersendiri) lewat Admin Panel, lalu menyederhanakan fungsi ini jadi
-- admin_atau_full_access() saja. Dibiarkan dulu supaya Supervisor PTS yang
-- ada sekarang tidak kehilangan haknya diam-diam.
CREATE OR REPLACE FUNCTION public.boleh_atur_kpi()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.admin_atau_full_access()
      OR EXISTS (
           SELECT 1 FROM public.users u
            WHERE u.id::text = jwt_claim('sub')
              AND u.role = 'team'
              AND u.jabatan = 'Supervisor'
              AND u.team_type LIKE 'Team PTS%'
         );
$$;

DROP POLICY IF EXISTS kmv_tulis ON public.kpi_manual_values;

CREATE POLICY kmv_tambah ON public.kpi_manual_values
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.boleh_atur_kpi());

CREATE POLICY kmv_ubah ON public.kpi_manual_values
  FOR UPDATE TO anon, authenticated
  USING (public.boleh_atur_kpi())
  WITH CHECK (public.boleh_atur_kpi());

CREATE POLICY kmv_hapus ON public.kpi_manual_values
  FOR DELETE TO anon, authenticated
  USING (public.admin_atau_full_access());


-- =====================================================================
-- YANG SENGAJA DIBIARKAN MEMAKAI lingkup_semua()
-- =====================================================================
--
-- 1. SELURUH kebijakan SELECT. Membaca luas memang disengaja.
--
-- 2. piket_schedules ps_tambah / ps_ubah. Mengisi kegiatan piket memang hak
--    seluruh tim PTS (lib/piket-akses.ts). Hanya hapusnya yang dikunci.
--
-- 3. piket_tamu_detail ptd_tulis (FOR ALL). Alur simpan Fill Detail
--    menghapus-lalu-menyisipkan ulang baris tamu
--    (FillDetailModal.tsx: delete .eq('piket_id') lalu insert). DELETE di
--    sini bagian dari MENYIMPAN, bukan aksi "Hapus" yang dilihat pengguna.
--    Menguncinya ke admin akan membuat tombol Simpan gagal DIAM-DIAM (RLS
--    menolak tanpa galat, 0 baris) - persis pola bug yang berulang kali
--    diperbaiki di platform ini. Dibiarkan apa adanya dengan sadar.
--
-- 4. daily_reports dr_tambah (INSERT). Menyisipkan laporan harian atas nama
--    tim memang alurnya (ada tabel daily_report_team_entries terpisah);
--    yang penting UPDATE-nya sudah dipersempit lebih dulu ke pemilik.
--
-- =====================================================================
-- VERIFIKASI (JWT tersimulasi, begin/rollback - data asli tidak tersentuh)
-- =====================================================================
--
-- Sebagai anggota team biasa (role 'team', access_level 'guest'):
--   piket UPDATE ................. 1 baris  (harus BOLEH - dia yang piket)
--   piket DELETE ................. 0 baris  (ditolak)
--   users ubah ORANG LAIN ........ 0 baris  (ditolak)
--   users ubah DIRI SENDIRI ...... 1 baris  (harus BOLEH)
--   team_members DELETE .......... 0 baris  (ditolak)
--   picket_holidays DELETE ....... 0 baris  (ditolak)
--   division_sup_map DELETE ...... 0 baris  (ditolak)
--   notifikasi orang lain DELETE . 0 baris  (ditolak)
--
-- Sebagai Manager PTS dengan access_level 'full':
--   ubah user lain ............... 1 baris  (BOLEH)
--   hapus piket .................. 1 baris  (BOLEH)
--   hapus team_member ............ 1 baris  (BOLEH)
--   boleh_atur_kpi() ............. true
--
-- Sebagai Supervisor PTS (role team, access_level 'guest'):
--   boleh_atur_kpi() ............. true     (tidak kehilangan haknya)
-- =====================================================================
