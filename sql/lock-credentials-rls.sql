-- ============================================================================
-- LOCKDOWN RLS — tabel kredensial & session (TUTUP AKSES ANON)
-- ============================================================================
--
--  ⛔ JANGAN JALANKAN SQL INI SEBELUM 3 SYARAT DI BAWAH TERPENUHI ⛔
--
--  Tabel berikut akan ditutup TOTAL dari anon key (yang ikut ter-bundle di
--  browser). Setelah ini, HANYA server (pakai SERVICE_ROLE key) yang bisa
--  baca/tulis. Bila server belum punya SERVICE_ROLE key, SEMUA LOGIN AKAN
--  GAGAL. Maka, urutannya WAJIB:
--
--  1) Set environment variable di Vercel (Project → Settings → Environment
--     Variables):
--         SUPABASE_SERVICE_ROLE_KEY = <service_role key dari Supabase>
--     (Supabase Dashboard → Project Settings → API → service_role secret.
--      JANGAN pakai prefix NEXT_PUBLIC_ — key ini RAHASIA, server-only.)
--
--  2) Re-deploy aplikasi (push terakhir sudah memakai getAdminClient + route
--     /api/auth/set-credential). Pastikan deploy SUKSES.
--
--  3) TEST di aplikasi live: login, logout, lupa-password (OTP), ganti
--     password, registrasi user baru, dan admin "Tambah Akun". Semua harus
--     berhasil. (Saat ini mereka masih jalan via anon — fungsinya identik —
--     jadi kalau ada yang gagal, hentikan dan kabari.)
--
--  Baru setelah 1–3 OK, jalankan SQL ini di Supabase SQL Editor.
--
--  Setelah dijalankan, ulangi test login/registrasi sekali lagi untuk
--  memastikan server benar-benar pakai SERVICE_ROLE key.
-- ============================================================================

-- Drop SEMUA policy pada tabel sensitif lalu enable RLS tanpa policy anon.
-- RLS aktif + tanpa policy = anon ditolak total; service_role otomatis bypass.
DO $$
DECLARE
  pol  RECORD;
  tbl  TEXT;
  tables TEXT[] := ARRAY['user_credentials','user_sessions','login_attempts','password_reset_otps'];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=tbl) THEN
      -- hapus semua policy yang ada (mis. "Allow all for anon")
      FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname='public' AND tablename=tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
      END LOOP;
      -- aktifkan RLS (tanpa membuat policy apa pun → anon tertutup)
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

-- Verifikasi: keempat tabel harus rls_enabled = true dan TIDAK punya policy.
SELECT c.relname AS tabel,
       c.relrowsecurity AS rls_enabled,
       COALESCE((SELECT count(*) FROM pg_policies p
                 WHERE p.schemaname='public' AND p.tablename=c.relname), 0) AS jumlah_policy
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN ('user_credentials','user_sessions','login_attempts','password_reset_otps')
ORDER BY c.relname;
