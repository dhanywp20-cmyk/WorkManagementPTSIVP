-- ============================================================================
--  Pemeriksaan RLS — jalankan di SQL Editor Supabase
-- ============================================================================
--  Repo ini hanya memuat 7 tabel dengan "ENABLE ROW LEVEL SECURITY", sementara
--  aplikasi memakai 51 tabel. Tapi RLS bisa saja dinyalakan lewat dashboard
--  tanpa tercatat di repo — jadi jangan simpulkan dari file SQL saja.
--
--  Query ini menunjukkan keadaan SEBENARNYA di database.
-- ============================================================================

SELECT
  c.relname                                   AS tabel,
  c.relrowsecurity                            AS rls_aktif,
  COALESCE(p.jumlah, 0)                       AS jumlah_policy,
  CASE
    WHEN NOT c.relrowsecurity            THEN '⚠️  TERBUKA — anon key bisa baca/tulis'
    WHEN COALESCE(p.jumlah, 0) = 0       THEN '🔒 terkunci total (RLS aktif, tanpa policy)'
    ELSE                                      '✅ terlindungi'
  END                                         AS status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (
  SELECT tablename, COUNT(*) AS jumlah FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename
) p ON p.tablename = c.relname
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity ASC, c.relname;
