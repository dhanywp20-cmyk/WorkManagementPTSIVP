-- ============================================================================
-- ROUTING PIPELINE — Fase 1 (fondasi mapping)
-- ============================================================================
-- Tabel routing tipe produk → supervisor (LED→Wahyu, LCD/Middleware→Yoga).
-- Mapping akun external→internal SUDAH ADA (division_ivp_mappings) — untuk MVI/MLDS
-- tinggal tambah baris di Admin Panel. Akun Manager disimpan di app_settings.
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_supervisor_map (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type  TEXT NOT NULL UNIQUE,          -- 'LED' | 'LCD' | 'Middleware'
  supervisor_id UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE product_supervisor_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON product_supervisor_map;
CREATE POLICY "Allow all for anon" ON product_supervisor_map FOR ALL USING (true) WITH CHECK (true);

-- Akun Manager (gerbang approval Manager) — disimpan sebagai setting key/value.
-- Di-set via Admin Panel. Default: pilih akun Dhany. app_settings sudah ada.
--   key='manager_user_id', value='<uuid user manager>'
-- (Tidak perlu membuat tabel baru.)
