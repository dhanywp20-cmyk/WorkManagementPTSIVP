-- Rollback 046/047: kembalikan nominal ke reminders.incentive_value.
-- Hanya perlu bila kode lama (yang membaca kolom itu) harus dipulihkan.
DROP TRIGGER IF EXISTS trg_kunci_nominal_reminders ON public.reminders;
DROP FUNCTION IF EXISTS public.kunci_nominal_reminders();

UPDATE public.reminders r
SET incentive_value = n.nominal
FROM public.incentive_nominal n
WHERE n.reminder_id = r.id AND COALESCE(r.incentive_value, 0) = 0;

-- Tabel incentive_nominal sengaja TIDAK dihapus (jejak nilai). Hapus manual bila yakin:
-- DROP TABLE public.incentive_nominal;
