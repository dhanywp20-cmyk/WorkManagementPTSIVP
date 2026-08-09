-- ============================================================================
--  Pemeriksaan kesiapan — jalankan SEBELUM sql/rls-project-progress.sql
-- ============================================================================
--  Policy mencocokkan progress_*.sales_name dengan klaim full_name, dan klaim
--  itu berasal dari users.full_name. Bila ada nama yang tidak punya padanan,
--  barisnya akan lenyap dari semua Sales begitu RLS menyala — tanpa pesan
--  error apa pun. Query ini menemukannya lebih dulu.
--
--  Hanya membaca. Tidak mengubah apa pun.
-- ============================================================================

-- ─── 1. Ringkasan: berapa yang akan terlihat, berapa yang akan hilang ───────
WITH nama_user AS (SELECT DISTINCT full_name FROM users WHERE full_name IS NOT NULL),
gabungan AS (
  SELECT 'progress_projects'  AS tabel, p.name AS baris, p.sales_name FROM progress_projects  p
  UNION ALL
  SELECT 'progress_locations' AS tabel, l.name AS baris, l.sales_name FROM progress_locations l
)
SELECT
  tabel,
  count(*) FILTER (WHERE sales_name IS NULL)                                   AS tanpa_sales,
  count(*) FILTER (WHERE sales_name IS NOT NULL
                     AND sales_name IN (SELECT full_name FROM nama_user))      AS cocok,
  count(*) FILTER (WHERE sales_name IS NOT NULL
                     AND sales_name NOT IN (SELECT full_name FROM nama_user))  AS TIDAK_COCOK
FROM gabungan
GROUP BY tabel;

-- ─── 2. Nama bermasalah — bila kolom TIDAK_COCOK di atas > 0 ────────────────
--  Yang muncul di sini perlu dibetulkan lewat dropdown Sales di Project
--  Progress sebelum RLS dinyalakan, atau diterima hilang dengan sadar.
WITH nama_user AS (SELECT DISTINCT full_name FROM users WHERE full_name IS NOT NULL)
SELECT 'projects' AS asal, name AS baris, sales_name AS nama_tak_dikenal
  FROM progress_projects
 WHERE sales_name IS NOT NULL AND sales_name NOT IN (SELECT full_name FROM nama_user)
UNION ALL
SELECT 'locations', name, sales_name
  FROM progress_locations
 WHERE sales_name IS NOT NULL AND sales_name NOT IN (SELECT full_name FROM nama_user)
ORDER BY nama_tak_dikenal;

-- ─── 3. Nama PIC yang tidak dikenal ─────────────────────────────────────────
--  PIC juga dipakai policy (mode PIC boleh memperbarui progres lokasinya).
WITH nama_user AS (SELECT DISTINCT full_name FROM users WHERE full_name IS NOT NULL)
SELECT name AS lokasi, pic AS pic_tak_dikenal
  FROM progress_locations
 WHERE pic IS NOT NULL AND pic NOT IN (SELECT full_name FROM nama_user)
ORDER BY pic;

-- ─── 4. Siapa saja yang akan punya akses penuh ──────────────────────────────
--  is_progress_admin() = user_role ∈ (admin, superadmin, team).
SELECT role, count(*) AS jumlah_akun,
       CASE WHEN role IN ('admin','superadmin','team') THEN 'lihat SEMUA proyek'
            ELSE 'hanya proyek yang mencatat namanya' END AS akan_melihat
FROM users GROUP BY role ORDER BY role;
