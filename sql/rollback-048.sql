-- Rollback 048: hapus catatan galat di layar pengguna.
DROP FUNCTION IF EXISTS public.catat_galat_klien(text, text, text, text, text, text, uuid);
DROP TABLE IF EXISTS public.galat_klien;
