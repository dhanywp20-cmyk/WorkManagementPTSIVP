-- Rollback 049: matikan 2FA untuk semua akun (login kembali hanya dengan password).
DROP POLICY IF EXISTS as_kunci_2fa ON public.app_settings;
DELETE FROM public.app_settings WHERE key = 'keamanan_2fa';
DROP TABLE IF EXISTS public.user_2fa;
