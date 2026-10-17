-- 054 - Kelas Eksternal: data peserta tambahan (perusahaan & kontak) + gambar soal.
--
-- 1. lc_eks_kelas.isian_peserta - yang diminta saat peserta masuk:
--      'nama'     : nama saja (bawaan, perilaku lama)
--      'instansi' : nama + perusahaan/instansi (wajib)
--      'kontak'   : nama + perusahaan (wajib) + email/HP (opsional) + izin dihubungi
--    Untuk acara customer: Sales tahu siapa yang hadir dan siapa yang mau dihubungi.
-- 2. lc_eks_peserta.instansi / kontak / izin_kontak. Hanya dibaca admin lewat server (tabel terkunci, 050).
-- 3. lc_questions.gambar_url - gambar opsional per soal (foto perangkat, diagram). Hanya URL unggahan
--    sendiri (bucket merek-files/kuis-live/, lihat rapikanUrlGambar di lib/kuis-live.ts). Grant tabel
--    lc_questions berlaku per tabel, jadi kolom baru ikut aturan baca/tulis yang sudah ada.

ALTER TABLE public.lc_eks_kelas
  ADD COLUMN IF NOT EXISTS isian_peserta text NOT NULL DEFAULT 'nama';
DO $$ BEGIN
  ALTER TABLE public.lc_eks_kelas ADD CONSTRAINT lc_eks_kelas_isian_peserta_check CHECK (isian_peserta IN ('nama', 'instansi', 'kontak'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.lc_eks_peserta
  ADD COLUMN IF NOT EXISTS instansi text,
  ADD COLUMN IF NOT EXISTS kontak text,
  ADD COLUMN IF NOT EXISTS izin_kontak boolean NOT NULL DEFAULT false;
DO $$ BEGIN
  ALTER TABLE public.lc_eks_peserta ADD CONSTRAINT lc_eks_peserta_instansi_check CHECK (instansi IS NULL OR char_length(instansi) BETWEEN 2 AND 120);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.lc_eks_peserta ADD CONSTRAINT lc_eks_peserta_kontak_check CHECK (kontak IS NULL OR char_length(kontak) BETWEEN 5 AND 120);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.lc_questions
  ADD COLUMN IF NOT EXISTS gambar_url text;
DO $$ BEGIN
  ALTER TABLE public.lc_questions ADD CONSTRAINT lc_questions_gambar_url_check CHECK (gambar_url IS NULL OR char_length(gambar_url) <= 400);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
