-- 050 - Learning Center: Kelas Eksternal (quiz untuk customer, tanpa akun & tanpa login).
--
-- Engine TERPISAH dari Learning Center internal: peserta, percobaan, dan jawaban customer tidak
-- masuk ke lc_quiz_* / users. Soal diambil dari bank soal yang sama (lc_questions, hanya jenis
-- ABCD - dinilai otomatis), tapi kunci jawabannya tidak pernah dikirim ke peramban customer.
--
-- Tanpa kebijakan RLS & tanpa grant: semua baca/tulis lewat route server (service role):
--   publik  : /api/kelas/<token>/...      (token kelas + token peserta)
--   admin   : /api/admin/kelas-eksternal  (admin / Full Access; pimpinan hanya baca)

CREATE TABLE IF NOT EXISTS public.lc_eks_kelas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judul         text NOT NULL CHECK (char_length(judul) BETWEEN 1 AND 120),
  keterangan    text NOT NULL DEFAULT '' CHECK (char_length(keterangan) <= 1000),
  token         text NOT NULL UNIQUE CHECK (char_length(token) BETWEEN 16 AND 64),
  question_ids  uuid[] NOT NULL DEFAULT '{}',
  timer_menit   integer CHECK (timer_menit IS NULL OR timer_menit BETWEEN 1 AND 300),
  passing_grade integer NOT NULL DEFAULT 70 CHECK (passing_grade BETWEEN 0 AND 100),
  acak_soal     boolean NOT NULL DEFAULT true,
  satu_kali     boolean NOT NULL DEFAULT true,
  aktif         boolean NOT NULL DEFAULT true,
  buka_pada     timestamptz,
  tutup_pada    timestamptz,
  maks_peserta  integer NOT NULL DEFAULT 200 CHECK (maks_peserta BETWEEN 1 AND 2000),
  dibuat_oleh   uuid,
  dibuat_nama   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lc_eks_peserta (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas_id      uuid NOT NULL REFERENCES public.lc_eks_kelas(id) ON DELETE CASCADE,
  nama          text NOT NULL CHECK (char_length(nama) BETWEEN 2 AND 80),
  nama_norm     text NOT NULL,
  token_hash    text NOT NULL UNIQUE,            -- sha256 token perangkat; token aslinya hanya di perangkat peserta
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kelas_id, nama_norm)
);
CREATE INDEX IF NOT EXISTS lc_eks_peserta_kelas_idx ON public.lc_eks_peserta (kelas_id);

CREATE TABLE IF NOT EXISTS public.lc_eks_hasil (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kelas_id      uuid NOT NULL REFERENCES public.lc_eks_kelas(id) ON DELETE CASCADE,
  peserta_id    uuid NOT NULL REFERENCES public.lc_eks_peserta(id) ON DELETE CASCADE,
  percobaan     integer NOT NULL DEFAULT 1,
  urutan_soal   uuid[] NOT NULL,
  mulai_pada    timestamptz NOT NULL DEFAULT now(),
  selesai_pada  timestamptz,
  jawaban       jsonb NOT NULL DEFAULT '{}'::jsonb,
  benar         integer,
  jumlah        integer,
  skor          integer,
  lulus         boolean,
  durasi_detik  integer,
  lewat_waktu   boolean NOT NULL DEFAULT false,
  UNIQUE (peserta_id, percobaan)
);
CREATE INDEX IF NOT EXISTS lc_eks_hasil_kelas_idx ON public.lc_eks_hasil (kelas_id);

ALTER TABLE public.lc_eks_kelas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_eks_kelas   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lc_eks_peserta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_eks_peserta FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lc_eks_hasil   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_eks_hasil   FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.lc_eks_kelas, public.lc_eks_peserta, public.lc_eks_hasil FROM PUBLIC, anon, authenticated;
