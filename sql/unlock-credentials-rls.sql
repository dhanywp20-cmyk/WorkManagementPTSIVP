-- ============================================================================
-- ROLLBACK / DARURAT — BUKA KEMBALI akses anon ke tabel kredensial & session
-- ============================================================================
-- Jalankan ini bila sql/lock-credentials-rls.sql terlanjur dijalankan SEBELUM
-- SUPABASE_SERVICE_ROLE_KEY di-set → login gagal. SQL ini mengembalikan policy
-- "Allow all for anon" sehingga aplikasi (yang masih pakai anon key) bisa login
-- lagi seperti semula. TIDAK perlu re-deploy.
--
-- Aman dijalankan kapan saja; idempotent.
-- ============================================================================

DO $$
DECLARE
  tbl    TEXT;
  tables TEXT[] := ARRAY['user_credentials','user_sessions','login_attempts','password_reset_otps'];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', tbl);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Allow all for anon" ON public.%I', tbl);
      EXECUTE format('CREATE POLICY "Allow all for anon" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl);
    END IF;
  END LOOP;
END $$;

-- Verifikasi: tiap tabel harus punya 1 policy (jumlah_policy = 1) → anon bisa akses lagi.
SELECT c.relname AS tabel,
       c.relrowsecurity AS rls_enabled,
       COALESCE((SELECT count(*) FROM pg_policies p
                 WHERE p.schemaname='public' AND p.tablename=c.relname), 0) AS jumlah_policy
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('user_credentials','user_sessions','login_attempts','password_reset_otps')
ORDER BY c.relname;
