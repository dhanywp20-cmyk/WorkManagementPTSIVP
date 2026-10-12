-- 046 - Nominal total proyek insentif pindah ke tabel TERKUNCI (fase 1, aditif).
--
-- Sebelumnya nominal ada di kolom reminders.incentive_value. Tabel reminders
-- terbaca semua orang yang boleh melihat jadwalnya (sales, PIC, pembuat,
-- lingkup divisi), jadi nominal bisa dibaca lewat REST walau layar
-- menyembunyikannya. Tabel baru ini tidak punya kebijakan RLS dan hak
-- anon/authenticated dicabut: hanya server (service role) yang bisa
-- membaca/menulis, lewat /api/incentive/nominal.
--
-- Fase 1 ini AMAN dijalankan kapan saja: hanya menambah tabel & menyalin nilai,
-- kode lama tetap membaca reminders.incentive_value seperti biasa.
-- Fase 2 (047) menolkan kolom lama SETELAH kode baru live dan terverifikasi.

CREATE TABLE IF NOT EXISTS public.incentive_nominal (
  reminder_id uuid PRIMARY KEY REFERENCES public.reminders(id) ON DELETE CASCADE,
  nominal     numeric NOT NULL DEFAULT 0 CHECK (nominal >= 0),
  diubah_oleh text,
  diubah_pada timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incentive_nominal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_nominal FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.incentive_nominal FROM PUBLIC, anon, authenticated;

INSERT INTO public.incentive_nominal (reminder_id, nominal, diubah_oleh)
SELECT id, incentive_value, 'migrasi-046'
FROM public.reminders
WHERE COALESCE(incentive_value, 0) > 0
ON CONFLICT (reminder_id) DO NOTHING;

COMMENT ON TABLE public.incentive_nominal IS
  'Nominal total proyek insentif. Terkunci: tanpa kebijakan RLS, hanya service role (/api/incentive/nominal).';
