-- 055 - Hasil Kalkulator AV yang disimpan ke proyek Project Progress.
--
-- Kalkulator AV (layar, proyektor, sinyal, audio, daya, rak, PoE) sebelumnya hanya bisa disalin /
-- dicetak lalu hilang. Sekarang hasilnya (ringkasan teks + lembar A4) bisa disimpan dan dikaitkan ke
-- satu proyek, lalu tampil di detail proyek untuk dicetak ulang.
--
-- Yang disimpan adalah HASIL (potret), bukan isian kalkulator - dihitung ulang tidak perlu, dan isinya
-- tetap sama walau rumus kalkulator diperbarui kemudian.
-- `lembar` hanya seksi 'info' & 'tabel' (dibersihkan server, lib/av-hasil.ts) - tidak ada HTML mentah.
--
-- RLS tanpa policy & tanpa grant: hanya route server (service role) yang membaca/menulis
-- (/api/tools-team/hasil-av), hak lihat mengikuti hak lihat proyeknya.

CREATE TABLE IF NOT EXISTS public.tools_av_hasil (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyek_id        uuid NOT NULL REFERENCES public.checklist_proyek(id) ON DELETE CASCADE,
  judul            text NOT NULL CHECK (char_length(judul) BETWEEN 1 AND 120),
  catatan          text NOT NULL DEFAULT '' CHECK (char_length(catatan) <= 500),
  ringkasan        text NOT NULL DEFAULT '' CHECK (char_length(ringkasan) <= 4000),
  lembar           jsonb NOT NULL,
  dibuat_oleh      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  dibuat_oleh_nama text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tools_av_hasil_proyek ON public.tools_av_hasil (proyek_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tools_av_hasil_dibuat_oleh ON public.tools_av_hasil (dibuat_oleh);

ALTER TABLE public.tools_av_hasil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools_av_hasil FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.tools_av_hasil FROM PUBLIC, anon, authenticated;
