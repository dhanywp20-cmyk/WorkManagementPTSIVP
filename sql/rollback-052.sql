-- Rollback 052: buang format Kuis Live Kelas Eksternal (jawaban live ikut terhapus).
DROP FUNCTION IF EXISTS public.lc_eks_live_papan(uuid, integer, integer);
DROP TABLE IF EXISTS public.lc_eks_live_jawaban;
ALTER TABLE public.lc_eks_kelas
  DROP CONSTRAINT IF EXISTS lc_eks_kelas_tema_warna_check,
  DROP CONSTRAINT IF EXISTS lc_eks_kelas_live_tahap_check,
  DROP CONSTRAINT IF EXISTS lc_eks_kelas_detik_per_soal_check,
  DROP CONSTRAINT IF EXISTS lc_eks_kelas_jenis_check,
  DROP COLUMN IF EXISTS latar_url, DROP COLUMN IF EXISTS logo_url, DROP COLUMN IF EXISTS tema_warna,
  DROP COLUMN IF EXISTS live_sesi, DROP COLUMN IF EXISTS live_soal_tutup, DROP COLUMN IF EXISTS live_soal_mulai,
  DROP COLUMN IF EXISTS live_urutan, DROP COLUMN IF EXISTS live_indeks, DROP COLUMN IF EXISTS live_tahap,
  DROP COLUMN IF EXISTS detik_per_soal, DROP COLUMN IF EXISTS jenis;
