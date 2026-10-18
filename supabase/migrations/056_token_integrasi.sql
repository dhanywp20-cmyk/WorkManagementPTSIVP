-- 056 - Token integrasi pribadi (DIWAYPI, asisten desktop milik pemegang akun).
--
-- Satu token = satu akun. DIWAYPI bertindak SEBAGAI pemilik token: setiap aksi berjalan dengan
-- token DB milik orang itu (lib/ai-server.ts klienSebagaiUser), jadi RLS berlaku persis seperti
-- di layarnya sendiri - token tidak memberi hak lebih dari akunnya.
--
-- Yang disimpan hanya hash SHA-256; token penuh ditampilkan SEKALI saat dibuat. Empat huruf
-- terakhir disimpan sebagai penanda supaya pemilik bisa mengenali token mana yang ia cabut.
-- cakupan: 'baca' (selalu) + opsional 'tulis' (catatan/status tiket, daily report, checklist).
--
-- Tanpa kebijakan RLS & tanpa grant: hanya route server (service role) yang membaca/menulis -
-- /api/integrasi/token (kelola token, sesi cookie) dan /api/integrasi/diwaypi (pakai token).
--
-- Darurat (token bocor dan pemiliknya tidak bisa masuk):
--   UPDATE public.token_integrasi SET dicabut = now() WHERE user_id = '<id>';

CREATE TABLE IF NOT EXISTS public.token_integrasi (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nama              text NOT NULL CHECK (char_length(nama) BETWEEN 1 AND 60),
  token_hash        text NOT NULL UNIQUE CHECK (char_length(token_hash) = 64),
  akhiran           text NOT NULL CHECK (char_length(akhiran) = 4),
  cakupan           text[] NOT NULL DEFAULT '{baca}' CHECK (cakupan <@ ARRAY['baca', 'tulis']::text[]),
  dibuat            timestamptz NOT NULL DEFAULT now(),
  terakhir_dipakai  timestamptz,
  dicabut           timestamptz
);

CREATE INDEX IF NOT EXISTS token_integrasi_user_idx ON public.token_integrasi (user_id);

ALTER TABLE public.token_integrasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_integrasi FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.token_integrasi FROM PUBLIC, anon, authenticated;
