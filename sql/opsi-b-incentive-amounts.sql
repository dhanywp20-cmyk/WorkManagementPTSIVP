-- ============================================================================
-- OPSI B — sembunyikan NOMINAL TOTAL proyek dari anon
-- ============================================================================
--
--  Nominal incentive proyek sekarang di reminders.incentive_value (tabel dipakai
--  banyak modul, terbaca anon). Opsi B memindahkannya ke tabel terkunci
--  `incentive_amounts`; aplikasi baca/tulis lewat server route (service_role)
--  dengan filter privasi (admin/allow_incentive_input lihat nominal, lainnya 0).
--
--  Dijalankan DUA FASE (DB dipakai bersama preview & production):
--
--  ── FASE 1 (AMAN, additive) — jalankan SEBELUM test ─────────────────────────
--    Membuat tabel + menyalin nominal dari reminders + kunci RLS. TIDAK mengubah
--    reminders, jadi production (kode lama) tetap normal. Preview (kode baru)
--    sudah bisa baca incentive_amounts.
--
--  ── FASE 2 (DESTRUKTIF, menyembunyikan) — jalankan SETELAH merge+verifikasi ──
--    Men-nol-kan reminders.incentive_value supaya tak terbaca anon lagi. Jalankan
--    HANYA setelah kode Opsi B live di production DAN kamu verifikasi semua angka
--    incentive (split, tranche, export) benar. Data asli aman tersalin di
--    incentive_amounts (bisa dikembalikan bila perlu).
-- ============================================================================

-- ─────────────────────────── FASE 1 ───────────────────────────
CREATE TABLE IF NOT EXISTS incentive_amounts (
  reminder_id UUID PRIMARY KEY REFERENCES reminders(id) ON DELETE CASCADE,
  amount      NUMERIC NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Salin nominal yang sudah ada.
INSERT INTO incentive_amounts (reminder_id, amount)
SELECT id, COALESCE(incentive_value, 0)
FROM reminders
WHERE COALESCE(incentive_value, 0) > 0
ON CONFLICT (reminder_id) DO UPDATE SET amount = EXCLUDED.amount;

-- Kunci: anon tidak boleh akses sama sekali; server (service_role) bypass RLS.
ALTER TABLE incentive_amounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE incentive_amounts FORCE ROW LEVEL SECURITY;
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname='public' AND tablename='incentive_amounts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.incentive_amounts', pol.policyname);
  END LOOP;
END $$;
-- (tanpa policy apa pun → anon ditolak total)

-- Verifikasi Fase 1:
SELECT count(*) AS jumlah_nominal_tersalin FROM incentive_amounts;


-- ─────────────────────────── FASE 2 ───────────────────────────
-- ⚠️ JANGAN jalankan blok ini sampai kode Opsi B LIVE di production & angka
-- incentive terverifikasi benar. Hapus tanda komentar lalu Run.
--
-- UPDATE reminders SET incentive_value = 0 WHERE COALESCE(incentive_value,0) > 0;
-- SELECT count(*) AS sisa_nominal_di_reminders FROM reminders WHERE COALESCE(incentive_value,0) > 0; -- harus 0
