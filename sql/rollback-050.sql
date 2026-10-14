-- Rollback 050: hapus Kelas Eksternal Learning Center (peserta & hasil ikut terhapus).
DROP TABLE IF EXISTS public.lc_eks_hasil;
DROP TABLE IF EXISTS public.lc_eks_peserta;
DROP TABLE IF EXISTS public.lc_eks_kelas;
