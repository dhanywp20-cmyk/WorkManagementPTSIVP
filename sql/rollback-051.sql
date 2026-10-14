-- Rollback 051: buang mode mulai & catatan pelanggaran Kelas Eksternal.
DROP FUNCTION IF EXISTS public.lc_eks_catat_pelanggaran(uuid, text);
ALTER TABLE public.lc_eks_hasil
  DROP COLUMN IF EXISTS dikirim_otomatis, DROP COLUMN IF EXISTS log_pelanggaran,
  DROP COLUMN IF EXISTS salin_tempel, DROP COLUMN IF EXISTS keluar_jendela, DROP COLUMN IF EXISTS pindah_tab;
ALTER TABLE public.lc_eks_kelas
  DROP COLUMN IF EXISTS batas_pelanggaran, DROP COLUMN IF EXISTS dimulai_pada, DROP COLUMN IF EXISTS mode_mulai;
