-- 051 - Kelas Eksternal: mode mulai (auto / dimulai admin) + catatan pelanggaran per percobaan.
--
-- mode_mulai 'admin': peserta mendaftar lalu menunggu; admin menekan Mulai -> dimulai_pada terisi
-- dan SEMUA peserta berbatas waktu yang sama (dimulai_pada + timer). Akhiri = tutup_pada sekarang.
-- Pelanggaran (pindah tab, keluar jendela, salin/tempel/klik kanan) dilaporkan peramban peserta,
-- dicatat di lc_eks_hasil: jumlah per jenis + log (maks 100 baris). batas_pelanggaran: bila tercapai
-- jawaban dikirim otomatis; NULL = hanya dicatat. Tabel tetap terkunci dari peramban (migrasi 050).

ALTER TABLE public.lc_eks_kelas
  ADD COLUMN IF NOT EXISTS mode_mulai text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS dimulai_pada timestamptz,
  ADD COLUMN IF NOT EXISTS batas_pelanggaran integer;

DO $$ BEGIN
  ALTER TABLE public.lc_eks_kelas ADD CONSTRAINT lc_eks_kelas_mode_mulai_check CHECK (mode_mulai IN ('auto', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.lc_eks_kelas ADD CONSTRAINT lc_eks_kelas_batas_pelanggaran_check CHECK (batas_pelanggaran IS NULL OR batas_pelanggaran BETWEEN 1 AND 50);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.lc_eks_hasil
  ADD COLUMN IF NOT EXISTS pindah_tab integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keluar_jendela integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salin_tempel integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS log_pelanggaran jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dikirim_otomatis text;

DO $$ BEGIN
  ALTER TABLE public.lc_eks_hasil ADD CONSTRAINT lc_eks_hasil_dikirim_otomatis_check CHECK (dikirim_otomatis IS NULL OR dikirim_otomatis IN ('waktu', 'pelanggaran', 'diakhiri'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tambah satu pelanggaran secara atomik (dua laporan bersamaan tidak saling menimpa).
-- Mengembalikan total pelanggaran percobaan itu; NULL bila percobaan tidak terbuka.
CREATE OR REPLACE FUNCTION public.lc_eks_catat_pelanggaran(p_hasil uuid, p_jenis text)
RETURNS integer
LANGUAGE sql
SET search_path TO 'public', 'pg_temp'
AS $function$
  UPDATE public.lc_eks_hasil SET
    pindah_tab     = pindah_tab     + (p_jenis = 'pindah_tab')::int,
    keluar_jendela = keluar_jendela + (p_jenis = 'keluar_jendela')::int,
    salin_tempel   = salin_tempel   + (p_jenis = 'salin_tempel')::int,
    log_pelanggaran = CASE WHEN jsonb_array_length(log_pelanggaran) >= 100 THEN log_pelanggaran
      ELSE log_pelanggaran || jsonb_build_array(jsonb_build_object('j', p_jenis, 't', now())) END
  WHERE id = p_hasil AND selesai_pada IS NULL
    AND p_jenis IN ('pindah_tab', 'keluar_jendela', 'salin_tempel')
  RETURNING pindah_tab + keluar_jendela + salin_tempel;
$function$;
REVOKE EXECUTE ON FUNCTION public.lc_eks_catat_pelanggaran(uuid, text) FROM PUBLIC, anon, authenticated;
