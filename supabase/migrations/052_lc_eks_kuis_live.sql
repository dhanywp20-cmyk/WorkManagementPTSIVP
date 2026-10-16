-- 052 - Kelas Eksternal: format "Kuis Live" (ala Kahoot) di samping format lama "mandiri".
--
-- Live: admin memandu dari layar host. Peserta masuk dengan nama lalu menunggu di lobi; TIDAK
-- ada yang bisa mulai sebelum admin menekan Mulai. Satu soal untuk semua sekaligus, waktu per
-- soal sama, poin ala Kahoot (benar & cepat = lebih besar, salah = 0), tanpa nilai lulus.
--
-- Status permainan disimpan di lc_eks_kelas:
--   live_tahap      'lobi' | 'soal' | 'papan' | 'selesai'  ('siap' & 'hasil' diturunkan dari waktu)
--   live_indeks     soal ke berapa (0..)          live_urutan  urutan soal sesi ini
--   live_soal_mulai saat pilihan jawaban dibuka   live_soal_tutup batas menjawab
--   live_sesi       naik tiap Mulai (Main lagi = sesi baru, skor lama tetap tersimpan)
-- Tampilan per kuis: tema_warna (#rrggbb, kosong = ungu Kahoot), logo_url & latar_url (gambar di
-- bucket merek-files/kuis-live/, diunggah lewat /api/admin/kelas-eksternal/unggah).
-- Jawaban per soal di lc_eks_live_jawaban: satu jawaban per peserta per soal per sesi, poin
-- dihitung server. Tabel tetap terkunci dari peramban (tanpa kebijakan & tanpa grant, seperti 050).

ALTER TABLE public.lc_eks_kelas
  ADD COLUMN IF NOT EXISTS jenis text NOT NULL DEFAULT 'mandiri',
  ADD COLUMN IF NOT EXISTS detik_per_soal integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS live_tahap text NOT NULL DEFAULT 'lobi',
  ADD COLUMN IF NOT EXISTS live_indeks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_urutan uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS live_soal_mulai timestamptz,
  ADD COLUMN IF NOT EXISTS live_soal_tutup timestamptz,
  ADD COLUMN IF NOT EXISTS live_sesi integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tema_warna text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS latar_url text;

DO $$ BEGIN
  ALTER TABLE public.lc_eks_kelas ADD CONSTRAINT lc_eks_kelas_jenis_check CHECK (jenis IN ('mandiri', 'live'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.lc_eks_kelas ADD CONSTRAINT lc_eks_kelas_detik_per_soal_check CHECK (detik_per_soal BETWEEN 5 AND 240);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.lc_eks_kelas ADD CONSTRAINT lc_eks_kelas_tema_warna_check CHECK (tema_warna IS NULL OR tema_warna ~ '^#[0-9a-f]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.lc_eks_kelas ADD CONSTRAINT lc_eks_kelas_live_tahap_check CHECK (live_tahap IN ('lobi', 'soal', 'papan', 'selesai'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.lc_eks_live_jawaban (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas_id    uuid NOT NULL REFERENCES public.lc_eks_kelas(id) ON DELETE CASCADE,
  peserta_id  uuid NOT NULL REFERENCES public.lc_eks_peserta(id) ON DELETE CASCADE,
  sesi        integer NOT NULL,
  indeks      integer NOT NULL,
  soal_id     uuid NOT NULL,
  pilihan     text NOT NULL CHECK (pilihan IN ('A', 'B', 'C', 'D')),
  benar       boolean NOT NULL,
  poin        integer NOT NULL CHECK (poin BETWEEN 0 AND 1000),
  waktu_ms    integer NOT NULL CHECK (waktu_ms >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (peserta_id, sesi, indeks)
);
CREATE INDEX IF NOT EXISTS lc_eks_live_jawaban_soal_idx ON public.lc_eks_live_jawaban (kelas_id, sesi, indeks);

ALTER TABLE public.lc_eks_live_jawaban ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_eks_live_jawaban FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.lc_eks_live_jawaban FROM PUBLIC, anon, authenticated;

-- Rekap skor per peserta untuk satu sesi, sampai soal ke-p_sampai (inklusif). Peserta yang belum
-- menjawab tetap muncul dengan 0. Agregasi di basis data: jumlah baris jawaban (peserta x soal)
-- bisa melewati batas baris PostgREST, rekapnya tidak.
CREATE OR REPLACE FUNCTION public.lc_eks_live_papan(p_kelas uuid, p_sesi integer, p_sampai integer)
RETURNS TABLE (peserta_id uuid, nama text, poin bigint, benar bigint, dijawab bigint, waktu_benar_ms bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p.id, p.nama,
         COALESCE(SUM(j.poin), 0),
         COUNT(j.id) FILTER (WHERE j.benar),
         COUNT(j.id),
         COALESCE(SUM(j.waktu_ms) FILTER (WHERE j.benar), 0)
  FROM public.lc_eks_peserta p
  LEFT JOIN public.lc_eks_live_jawaban j
    ON j.peserta_id = p.id AND j.sesi = p_sesi AND j.indeks <= p_sampai
  WHERE p.kelas_id = p_kelas
  GROUP BY p.id, p.nama;
$function$;
REVOKE EXECUTE ON FUNCTION public.lc_eks_live_papan(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
