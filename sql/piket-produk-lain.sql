-- ============================================================================
-- PIKET SHOWROOM — tabel piket_produk_lain (barang temporer di luar list + watt)
-- Run this in Supabase SQL Editor
-- ============================================================================
-- Tabel relasional ternormalisasi (bukan JSONB) supaya beban daya unit eksternal
-- bisa di-query / di-aggregate langsung di SQL (mis. SUM(watt) per periode).
-- 1 baris = 1 unit. kegiatan_id → piket_tamu_detail(id) ON DELETE CASCADE.
-- ============================================================================

CREATE TABLE IF NOT EXISTS piket_produk_lain (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kegiatan_id UUID REFERENCES piket_tamu_detail(id) ON DELETE CASCADE,
  piket_id    UUID,                       -- denormalized untuk query cepat per-piket
  nama        TEXT NOT NULL DEFAULT '',
  watt        INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_piket_produk_lain_kegiatan ON piket_produk_lain(kegiatan_id);
CREATE INDEX IF NOT EXISTS idx_piket_produk_lain_piket    ON piket_produk_lain(piket_id);

ALTER TABLE piket_produk_lain ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON piket_produk_lain;
CREATE POLICY "Allow all for anon" ON piket_produk_lain FOR ALL USING (true) WITH CHECK (true);

-- Migrasi data lama dari kolom JSONB produk_lain (bila sempat dibuat), lalu drop kolomnya
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='piket_tamu_detail' AND column_name='produk_lain') THEN
    INSERT INTO piket_produk_lain (kegiatan_id, piket_id, nama, watt)
    SELECT d.id, d.piket_id,
           COALESCE(x->>'nama',''),
           COALESCE(NULLIF(x->>'watt','')::int, 0)
    FROM piket_tamu_detail d
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(d.produk_lain,'[]'::jsonb)) AS x
    WHERE jsonb_typeof(d.produk_lain) = 'array';
    ALTER TABLE piket_tamu_detail DROP COLUMN produk_lain;
  END IF;
END $$;
