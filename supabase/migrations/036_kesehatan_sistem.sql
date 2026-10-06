-- 036 - Ringkasan kesehatan sistem untuk Admin Panel -> Sistem -> Kesehatan Sistem.
--
-- Satu fungsi baca-saja yang merangkum hal-hal yang selama ini hanya terlihat lewat
-- SQL Editor: ukuran basis data & storage (dibanding batas paket Free), jadwal pg_cron
-- beserta hasil jalan terakhirnya, trigger yang memanggil HTTP keluar (mis. WA
-- langsung ke Fonnte - lihat 035), dan fungsi yang masih menyimpan rahasia tertulis.
--
-- Hanya service_role (route server /api/admin/kesehatan, setelah pastikanAdmin) yang
-- boleh memanggilnya - anon/authenticated dicabut. Tidak mengubah data apa pun.
--
-- Kembali ke semula: DROP FUNCTION public.kesehatan_sistem();

CREATE OR REPLACE FUNCTION public.kesehatan_sistem()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  hasil jsonb;
  cron  jsonb := '[]'::jsonb;
BEGIN
  --  pg_cron opsional: dibaca dinamis supaya fungsi tetap jalan bila ekstensinya tidak ada.
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE $q$
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'nama', j.jobname, 'jadwal', j.schedule, 'aktif', j.active,
        'terakhir', r.end_time, 'status', r.status) ORDER BY j.jobname), '[]'::jsonb)
      FROM cron.job j
      LEFT JOIN LATERAL (
        SELECT d.end_time, d.status FROM cron.job_run_details d
        WHERE d.jobid = j.jobid ORDER BY d.end_time DESC NULLS LAST LIMIT 1
      ) r ON true
    $q$ INTO cron;
  END IF;

  SELECT jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'tabel', (
      SELECT coalesce(jsonb_agg(t ORDER BY (t->>'bytes')::bigint DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('nama', c.relname, 'bytes', pg_total_relation_size(c.oid), 'baris', greatest(c.reltuples, 0)::bigint) AS t
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 8
      ) x),
    'bucket', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', bucket_id, 'bytes', bytes, 'jumlah', jumlah) ORDER BY bytes DESC), '[]'::jsonb) FROM (
        SELECT bucket_id, sum(coalesce((metadata->>'size')::bigint, 0)) AS bytes, count(*) AS jumlah
        FROM storage.objects GROUP BY bucket_id
      ) b),
    'cron', cron,
    'pemicu_http', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('trigger', t.tgname, 'tabel', c.relname, 'fungsi', p.proname)), '[]'::jsonb)
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE NOT t.tgisinternal AND p.prosrc ILIKE '%http_post%'),
    'fungsi_berahasia', (
      SELECT coalesce(jsonb_agg(p.proname), '[]'::jsonb)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND (p.prosrc ~ 'eyJ[A-Za-z0-9_-]{20,}' OR p.prosrc ILIKE '%api.fonnte.com%'))
  ) INTO hasil;
  RETURN hasil;
END;
$$;

REVOKE ALL ON FUNCTION public.kesehatan_sistem() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kesehatan_sistem() TO service_role;

-- Pemeriksaan: harus mengembalikan satu objek JSON.
SELECT jsonb_pretty(public.kesehatan_sistem());

-- SELECT tandai('036_kesehatan_sistem.sql');
