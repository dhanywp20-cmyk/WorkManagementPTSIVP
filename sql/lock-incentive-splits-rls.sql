-- ============================================================================
-- LOCK incentive_splits — sembunyikan "siapa dapat berapa" dari anon
-- ============================================================================
--
--  Pembagian per-orang (incentive_splits.amount) adalah data paling sensitif.
--  Sekarang bisa dibaca anon langsung via REST. SQL ini menutup SELECT untuk
--  anon; baca hanya boleh lewat /api/incentive/splits (service_role) yang
--  memfilter: admin / allow_incentive_input lihat semua, lainnya hanya jatahnya.
--
--  anon TETAP boleh INSERT (batch processYearlyBatch menulis splits dari klien).
--  Nominal TOTAL proyek ada di tabel reminders (dipakai modul lain) → TIDAK
--  dikunci di sini (itu Opsi B, butuh bedah skema).
--
--  ⚠️ URUTAN (DB dipakai bersama preview & production):
--    1) Merge branch ini ke main & PASTIKAN production sudah deploy (route
--       /api/incentive/splits + fetchVisibleSplits aktif).
--    2) Test di production: buka Incentive PTS sbg admin (lihat semua split) &
--       sbg user biasa (hanya lihat jatah sendiri, tidak error).
--    3) BARU jalankan SQL ini.
--    4) Test lagi langkah 2 + coba SELECT incentive_splits via REST anon → kosong.
--
--  Jangan jalankan SEBELUM langkah 1–2, atau halaman Incentive di production
--  akan gagal memuat split (kode lama masih baca langsung via anon).
-- ============================================================================

ALTER TABLE incentive_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE incentive_splits FORCE ROW LEVEL SECURITY;

-- Hapus semua policy lama (mis. "Allow all for anon").
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname='public' AND tablename='incentive_splits'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.incentive_splits', pol.policyname);
  END LOOP;
END $$;

-- anon HANYA boleh INSERT (tidak SELECT/UPDATE/DELETE). service_role bypass RLS.
CREATE POLICY "anon_insert_only" ON incentive_splits
  FOR INSERT TO anon WITH CHECK (true);

-- Verifikasi: rls_enabled true, hanya 1 policy (INSERT).
SELECT c.relname AS tabel, c.relrowsecurity AS rls_enabled,
  (SELECT string_agg(p.cmd, ',') FROM pg_policies p
   WHERE p.schemaname='public' AND p.tablename='incentive_splits') AS policy_cmds
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='incentive_splits';
