-- ============================================================================
--  TUTUP TABEL YANG TERLEWAT - tiga tabel yang RLS-nya belum pernah menyala
-- ============================================================================
--
--  Ditemukan lewat sql/cek-jangkauan-anon.sql: tiga tabel bervonis
--  TERBUKA PENUH, artinya RLS-nya mati dan anon bisa membaca sekaligus menulis
--  seisi tabel. Ini keadaan bawaan Postgres - tabel baru selalu begini, jadi
--  ketiganya terlewat bukan karena ada yang membukanya, melainkan karena tidak
--  ada yang pernah menutupnya.
--
--  Ketiganya perlu perlakuan berbeda, jadi jangan disamaratakan.
-- ============================================================================


-- ─── 1. progress_actions - AMAN dan paling perlu ────────────────────────────
--  Ini tindak lanjut dari rekap isu Project Progress. Empat tabel saudaranya
--  (progress_projects, _locations, _components, _issues) sudah TERSARING sejak
--  sql/rls-project-progress.sql dijalankan; tabel ini dibuat belakangan lewat
--  project-progress-weighted-issues.sql dan tidak ikut terdaftar di sana.
--
--  Jadi modulnya sudah dijaga, kecuali satu pintu ini.
--
--  Aman dijalankan sekarang: fungsi is_progress_admin() dan jwt_full_name()
--  sudah ada di basis data - itulah yang membuat keempat saudaranya TERSARING.
--  Aplikasi juga belum menyentuh tabel ini sama sekali, jadi tidak ada alur
--  yang bisa rusak.
--
--  Aturannya mengikuti progress_issues persis: terlihat kalau isu induknya
--  terlihat, dan hanya admin/team yang boleh menyunting.
ALTER TABLE progress_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pa_select ON progress_actions;
DROP POLICY IF EXISTS pa_write  ON progress_actions;

CREATE POLICY pa_select ON progress_actions
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM progress_issues i
      JOIN progress_projects p ON p.id = i.project_id
      WHERE i.id = progress_actions.issue_id
        AND (
          is_progress_admin()
          OR p.sales_name = jwt_full_name()
          OR EXISTS (
            SELECT 1 FROM progress_locations l
            WHERE l.project_id = p.id AND l.sales_name = jwt_full_name()
          )
        )
    )
  );

CREATE POLICY pa_write ON progress_actions
  FOR ALL TO anon, authenticated
  USING (is_progress_admin()) WITH CHECK (is_progress_admin());


-- ─── 2. kpi_snapshot_members - AMAN ─────────────────────────────────────────
--  Berisi rincian nilai KPI per orang untuk tiap snapshot periode. Aplikasi
--  hanya MENULIS ke tabel ini (app/kpi-team/page.tsx menyimpan snapshot) dan
--  tidak pernah membacanya kembali - rekap yang tampil di layar dibaca dari
--  kpi_period_snapshots.
--
--  Karena itu policy INSERT saja sudah cukup, dan membacanya jadi tertutup
--  dari anon. Polanya sama dengan incentive_splits.
ALTER TABLE kpi_snapshot_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ksm_insert ON kpi_snapshot_members;

CREATE POLICY ksm_insert ON kpi_snapshot_members
  FOR INSERT TO anon, authenticated WITH CHECK (true);


-- ─── 3. picket_holidays - baca terbuka, tulis belum bisa dikunci ────────────
--  Daftar tanggal libur Piket Showroom. Aplikasi membaca (Piket & KPI),
--  menambah, dan menghapus lewat toggleHoliday.
--
--  Jujur soal batasnya: blok di bawah menyalakan RLS lalu memasang policy
--  tanpa syarat. Itu TIDAK menambah perlindungan apa pun - isinya sama saja
--  dengan sekarang. Gunanya cuma satu: tabel ini jadi setara dengan tabel
--  lain, sehingga pengetatan berikutnya tinggal mengganti syarat policy alih
--  alih menyalakan RLS di basis data yang sedang dipakai.
--
--  Kalau menurut Anda tanggal libur memang tidak perlu dijaga, lewati saja
--  bagian ini - tidak ada yang hilang.
ALTER TABLE picket_holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ph_baca  ON picket_holidays;
DROP POLICY IF EXISTS ph_tulis ON picket_holidays;

CREATE POLICY ph_baca ON picket_holidays
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY ph_tulis ON picket_holidays
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

--  Versi yang mengunci penyuntingan ke admin/team. JANGAN dijalankan sebelum
--  memastikan tombol libur di Piket Showroom memang hanya muncul untuk mereka
--  - kalau ternyata anggota biasa juga memakainya, tombol itu berhenti bekerja
--  tanpa pesan galat (RLS menolak dengan diam, bukan dengan error).
-- DROP POLICY IF EXISTS ph_tulis ON picket_holidays;
-- CREATE POLICY ph_tulis ON picket_holidays
--   FOR ALL TO anon, authenticated
--   USING (is_progress_admin()) WITH CHECK (is_progress_admin());


-- ─── PEMBATALAN ─────────────────────────────────────────────────────────────
--  Berlaku seketika, tanpa deploy ulang:
--    ALTER TABLE progress_actions     DISABLE ROW LEVEL SECURITY;
--    ALTER TABLE kpi_snapshot_members DISABLE ROW LEVEL SECURITY;
--    ALTER TABLE picket_holidays      DISABLE ROW LEVEL SECURITY;


-- ─── Pemeriksaan ────────────────────────────────────────────────────────────
SELECT c.relname AS tabel,
       c.relrowsecurity AS rls_aktif,
       COALESCE(string_agg(p.cmd, ', ' ORDER BY p.cmd), '(tidak ada policy)') AS policy
FROM pg_class c
LEFT JOIN pg_policies p
  ON p.schemaname = 'public' AND p.tablename = c.relname
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('progress_actions', 'kpi_snapshot_members', 'picket_holidays')
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;
