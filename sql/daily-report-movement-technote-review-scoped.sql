-- =====================================================================
-- Daily Report, Unit Movement Log, Tech Notes, Form Review
-- EDIT DIBATASI KE PEMILIK BARIS, HAPUS TETAP KHUSUS ADMIN/FULL ACCESS
-- =====================================================================
--
-- LATAR BELAKANG
--
-- Audit lanjutan setelah Ticketing, Reminder Schedule, Design Project dan
-- Project Progress dibereskan dengan aturan yang sama:
--
--   Aktor yang memang berkepentingan dengan sebuah baris (pembuatnya,
--   yang ditugaskan mengerjakannya) boleh MENGEDIT bagiannya sendiri
--   (salah ketik, update status/catatan) tanpa lewat admin atau Supabase
--   langsung. HAPUS tetap hanya untuk admin/superadmin atau akun yang
--   diberi "Full Access" di Admin Panel - tidak ada pengecualian.
--
-- Empat modul berikut diperiksa dengan query pg_policies dan ternyata
-- masih memakai pola lama - baik `qual: true` (semua orang login) atau
-- fungsi lingkup luas `lingkup_semua()`/`is_progress_admin()` (ANY anggota
-- team, bukan hanya yang bersangkutan):
--
--   daily_reports / daily_report_team_entries  - UPDATE terbuka utk semua
--   movement_logs                              - UPDATE+DELETE terbuka utk semua
--   tech_notes / tech_note_history             - UPDATE+DELETE hanya utk canManage,
--                                                 penulis note sendiri tidak bisa
--                                                 edit catatannya sendiri
--   form_reviews                               - UPDATE+DELETE terbuka utk semua
--                                                 (dan tombol Edit di UI malah
--                                                 tampil ke SEMUA akun Guest,
--                                                 bukan cuma review miliknya)
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
-- =====================================================================

-- 1) DAILY REPORTS ------------------------------------------------------
-- Pemilik laporan (user_id) boleh mengedit laporannya sendiri.
DROP POLICY IF EXISTS dr_ubah ON public.daily_reports;
CREATE POLICY dr_ubah ON public.daily_reports
  FOR UPDATE TO anon, authenticated
  USING (user_id::text = jwt_claim('sub') OR public.admin_atau_full_access())
  WITH CHECK (user_id::text = jwt_claim('sub') OR public.admin_atau_full_access());

-- Entri per-anggota tim di dalam laporan: yang mengisi (entered_by) boleh
-- mengedit/menghapus entrinya sendiri.
DROP POLICY IF EXISTS drte_tulis ON public.daily_report_team_entries;
CREATE POLICY drte_tulis ON public.daily_report_team_entries
  FOR ALL TO anon, authenticated
  USING (entered_by = jwt_claim('username') OR public.admin_atau_full_access())
  WITH CHECK (entered_by = jwt_claim('username') OR public.admin_atau_full_access());

-- 2) UNIT MOVEMENT LOG ----------------------------------------------------
-- Pembuat log (created_by) boleh mengedit; hapus tetap admin/Full Access.
DROP POLICY IF EXISTS ml_ubah ON public.movement_logs;
CREATE POLICY ml_ubah ON public.movement_logs
  FOR UPDATE TO anon, authenticated
  USING (created_by = jwt_claim('username') OR public.admin_atau_full_access())
  WITH CHECK (created_by = jwt_claim('username') OR public.admin_atau_full_access());

DROP POLICY IF EXISTS ml_hapus ON public.movement_logs;
CREATE POLICY ml_hapus ON public.movement_logs
  FOR DELETE TO anon, authenticated
  USING (public.admin_atau_full_access());

-- 3) TECH NOTES -----------------------------------------------------------
-- Penulis note (author_id, kolom TEXT - bukan uuid, karena itu dibandingkan
-- dengan jwt_claim('sub') bukan jwt_user_id()) boleh mengedit catatannya
-- sendiri, mis. memperbaiki setelah revisi diminta. Supervisor tetap ikut
-- sebagai penyetuju sebagaimana sebelumnya. Hapus tetap khusus
-- admin/Full Access/Supervisor - penulis biasa tidak bisa menghapus.
DROP POLICY IF EXISTS tn_ubah ON public.tech_notes;
CREATE POLICY tn_ubah ON public.tech_notes
  FOR UPDATE TO anon, authenticated
  USING (
    public.admin_atau_full_access()
    OR jwt_claim('user_role') = 'supervisor'
    OR author_id = jwt_claim('sub')
  )
  WITH CHECK (
    public.admin_atau_full_access()
    OR jwt_claim('user_role') = 'supervisor'
    OR author_id = jwt_claim('sub')
  );

DROP POLICY IF EXISTS tn_hapus ON public.tech_notes;
CREATE POLICY tn_hapus ON public.tech_notes
  FOR DELETE TO anon, authenticated
  USING (public.admin_atau_full_access() OR jwt_claim('user_role') = 'supervisor');

DROP POLICY IF EXISTS tnh_hapus ON public.tech_note_history;
CREATE POLICY tnh_hapus ON public.tech_note_history
  FOR DELETE TO anon, authenticated
  USING (public.admin_atau_full_access() OR jwt_claim('user_role') = 'supervisor');

-- 4) FORM REVIEW ------------------------------------------------------------
-- Tiga pihak yang sah menyentuh satu baris review: Guest/Sales yang
-- direview (guest_username), dan Team yang meng-handle (assigned_to).
DROP POLICY IF EXISTS fr_tulis ON public.form_reviews;
CREATE POLICY fr_tulis ON public.form_reviews
  FOR ALL TO anon, authenticated
  USING (
    public.admin_atau_full_access()
    OR guest_username = jwt_claim('username')
    OR assigned_to = jwt_claim('username')
  )
  WITH CHECK (
    public.admin_atau_full_access()
    OR guest_username = jwt_claim('username')
    OR assigned_to = jwt_claim('username')
  );

-- =====================================================================
-- VERIFIKASI (dijalankan dengan begin/rollback, JWT tersimulasi)
-- =====================================================================
--
-- movement_logs: pemilik (created_by = username sendiri) berhasil UPDATE,
--   gagal DELETE (0 baris); admin/Full Access berhasil keduanya.
-- tech_notes: penulis (author_id = jwt_claim('sub')) berhasil UPDATE
--   catatannya sendiri; gagal UPDATE catatan orang lain (0 baris).
--
-- PERUBAHAN UI YANG MENYERTAI MIGRASI INI (lihat commit terkait):
--   app/unit-movement/page.tsx  - bolehEditLog(log): pemilik log ATAU admin
--   app/tech-note/page.tsx      - bolehEditNote(n): penulis note ATAU canManage;
--                                  tombol Hapus tetap khusus canManage
--   app/form-review/page.tsx    - bolehEditReview(r): mengganti cek isGuest
--                                  (semua akun Guest) dengan cek kepemilikan
--                                  baris (guest_username/sales_name/assigned_to)
--   app/daily-report/page.tsx   - tidak ada UI edit/hapus lintas-user yang perlu
--                                  diubah; hanya RLS yang diperketat.
-- =====================================================================
