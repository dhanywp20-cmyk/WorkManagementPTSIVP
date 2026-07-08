-- ============================================================================
-- SALES INTERNAL/EXTERNAL ROUTING — refinement (reuse infra yg sudah ada)
-- ============================================================================
-- Keputusan user:
--  (1) REUSE is_internal_sales + division_ivp_mappings (BUKAN bikin tabel baru).
--  (2) sales_division 'MLDS' = Sales INTERNAL (ikut spec).
-- Perubahan kode (blok-submit divisi tanpa PIC, MLDS auto-internal, rename label,
-- handler mapping mencakup IVP/MVI/MLDS) sudah di app. SQL ini melengkapi DB.
-- ============================================================================

-- ── 1. Backfill: akun sales_division='MLDS' jadi Sales Internal ──────────────
UPDATE users
SET is_internal_sales = TRUE
WHERE role = 'guest'
  AND sales_division = 'MLDS'
  AND is_internal_sales IS DISTINCT FROM TRUE;

-- ── 2. UNIQUE: 1 divisi external cuma boleh punya 1 PIC Sales Internal ───────
-- CATATAN: kalau ada divisi yg SUDAH punya >1 mapping, ALTER ini akan GAGAL.
-- Jalankan cek duplikat dulu & rapikan (sisakan 1 per divisi) sebelum apply:
--   SELECT sales_division, COUNT(*) c FROM division_ivp_mappings
--   GROUP BY sales_division HAVING COUNT(*) > 1;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'division_ivp_mappings_sales_division_key'
  ) THEN
    ALTER TABLE division_ivp_mappings
      ADD CONSTRAINT division_ivp_mappings_sales_division_key UNIQUE (sales_division);
  END IF;
END $$;
