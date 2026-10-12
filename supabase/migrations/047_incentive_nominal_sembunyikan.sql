-- 047 - Sembunyikan nominal dari tabel reminders (fase 2, DESTRUKTIF terhadap kolom lama).
--
-- JALANKAN HANYA SETELAH: migrasi 046 sudah diterapkan, kode yang membaca
-- /api/incentive/nominal sudah live di produksi, dan angka insentif
-- terverifikasi benar di layar. Nilainya aman tersalin di incentive_nominal;
-- pengembaliannya ada di sql/rollback-046-047.sql.

-- 1) Salin yang mungkin berubah sejak 046 (nilai baru menang), lalu nolkan kolom lama.
INSERT INTO public.incentive_nominal (reminder_id, nominal, diubah_oleh)
SELECT id, incentive_value, 'migrasi-047'
FROM public.reminders
WHERE COALESCE(incentive_value, 0) > 0
ON CONFLICT (reminder_id) DO UPDATE
  SET nominal = EXCLUDED.nominal, diubah_oleh = EXCLUDED.diubah_oleh, diubah_pada = now()
  WHERE public.incentive_nominal.nominal IS DISTINCT FROM EXCLUDED.nominal;

UPDATE public.reminders SET incentive_value = 0 WHERE COALESCE(incentive_value, 0) <> 0;

-- 2) Penjaga: peramban (anon/authenticated) tidak boleh menulis nominal / dasar HPP
--    ke tabel jadwal lagi. Ditolak dengan pesan yang jelas, bukan dibuang diam-diam,
--    supaya tab lama yang belum dimuat ulang tidak mengira nominalnya tersimpan.
CREATE OR REPLACE FUNCTION public.kunci_nominal_reminders()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF COALESCE(NEW.incentive_value, 0) <> 0 OR NEW.incentive_dasar_hpp IS NOT NULL THEN
      RAISE EXCEPTION 'Nominal insentif tidak disimpan di tabel jadwal. Isi lewat layar Incentive PTS (muat ulang halaman).'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_kunci_nominal_reminders ON public.reminders;
CREATE TRIGGER trg_kunci_nominal_reminders
  BEFORE INSERT OR UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.kunci_nominal_reminders();
