-- 048 - Catatan galat di layar pengguna (Admin Panel -> Kesehatan Sistem).
--
-- Sebelum ini galat di peramban pengguna hanya masuk konsol: tidak ada yang tahu sampai ada yang
-- mengeluh. Satu baris per (pesan, halaman, hari) - kejadian berulang hanya menambah `jumlah`,
-- jadi tabelnya tetap kecil di paket Free. Tanpa kebijakan RLS: hanya server (service role)
-- lewat /api/galat yang menulis, dan /api/admin/kesehatan yang membaca.

CREATE TABLE IF NOT EXISTS public.galat_klien (
  sidik     text PRIMARY KEY,                       -- sha1(pesan|jalur|hari)
  hari      date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date),
  pesan     text NOT NULL CHECK (char_length(pesan) <= 300),
  jalur     text CHECK (char_length(jalur) <= 200),
  sumber    text CHECK (sumber IN ('halaman', 'skrip', 'janji')),
  digest    text CHECK (char_length(digest) <= 60),
  contoh_ua text CHECK (char_length(contoh_ua) <= 160),
  user_id   uuid,
  jumlah    integer NOT NULL DEFAULT 1,
  pertama   timestamptz NOT NULL DEFAULT now(),
  terakhir  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS galat_klien_terakhir_idx ON public.galat_klien (terakhir DESC);
CREATE INDEX IF NOT EXISTS galat_klien_hari_idx ON public.galat_klien (hari);

ALTER TABLE public.galat_klien ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galat_klien FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.galat_klien FROM PUBLIC, anon, authenticated;

-- Tambah satu kejadian: baris baru, atau `jumlah`+1 bila galat yang sama sudah tercatat hari ini.
CREATE OR REPLACE FUNCTION public.catat_galat_klien(
  p_sidik text, p_pesan text, p_jalur text, p_sumber text, p_digest text, p_ua text, p_user uuid
) RETURNS void
LANGUAGE sql
SET search_path TO 'public', 'pg_temp'
AS $function$
  INSERT INTO public.galat_klien (sidik, pesan, jalur, sumber, digest, contoh_ua, user_id)
  VALUES (p_sidik, left(p_pesan, 300), left(p_jalur, 200), p_sumber, left(p_digest, 60), left(p_ua, 160), p_user)
  ON CONFLICT (sidik) DO UPDATE SET jumlah = public.galat_klien.jumlah + 1, terakhir = now();
$function$;
REVOKE EXECUTE ON FUNCTION public.catat_galat_klien(text, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
