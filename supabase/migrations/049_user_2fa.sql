-- 049 - Verifikasi dua langkah (2FA, TOTP authenticator) per akun.
--
-- Tabel terpisah dari user_credentials supaya baris kredensial lama tidak tersentuh. Rahasia
-- TOTP disimpan TERENKRIPSI (AES-256-GCM, kunci di server - lib/totp.ts); kode cadangan hanya
-- hash SHA-256. Tanpa kebijakan RLS & tanpa grant: hanya route server (service role) yang
-- membaca/menulis - /api/auth/login, /api/auth/login-2fa, /api/auth/2fa, /api/admin/2fa.
--
-- Darurat (admin satu-satunya kehilangan HP & kode cadangan): hapus barisnya di SQL editor
--   DELETE FROM public.user_2fa WHERE user_id = '<id>';
-- dan matikan "wajib 2FA admin":  DELETE FROM public.app_settings WHERE key = 'keamanan_2fa';

CREATE TABLE IF NOT EXISTS public.user_2fa (
  user_id          uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  rahasia          text NOT NULL CHECK (char_length(rahasia) <= 200),
  aktif            boolean NOT NULL DEFAULT false,
  cadangan         text[] NOT NULL DEFAULT '{}',
  langkah_terakhir bigint NOT NULL DEFAULT -1,
  diaktifkan_pada  timestamptz,
  dibuat           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_2fa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_2fa FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_2fa FROM PUBLIC, anon, authenticated;

-- Pengaturan "wajib 2FA admin" (app_settings.keamanan_2fa) hanya boleh diubah server
-- (/api/admin/2fa, admin + sudah ber-2FA). Kebijakan tulis app_settings yang ada mengizinkan
-- semua peran 'team' (boleh_tulis_pengaturan -> lingkup_semua) - tanpa ini satu akun tim bisa
-- mematikan 2FA wajib dari peramban.
DROP POLICY IF EXISTS as_kunci_2fa ON public.app_settings;
CREATE POLICY as_kunci_2fa ON public.app_settings AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (key <> 'keamanan_2fa') WITH CHECK (key <> 'keamanan_2fa');
