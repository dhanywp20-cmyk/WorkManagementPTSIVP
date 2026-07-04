-- ============================================================================
-- ROUTING PIPELINE — Fase 1 (fondasi mapping)
-- ============================================================================
-- Tabel routing tipe produk → TIM (bukan orang): LED → Team PTS MVI,
-- LCD & Middleware → Team PTS IVP. Supervisor tim itu dicari otomatis dari
-- Struktur Organisasi (team_type + jabatan=Supervisor) — tidak hardcode nama,
-- jadi tahan lama walau supervisornya berganti orang.
-- "LED & LCD" (proyek butuh keduanya) → kedua tim ikut ter-mapping (array);
-- keduanya di-notify, tapi cuma 1 tim yang benar-benar eksekusi (diputuskan
-- belakangan, bukan otomatis split).
--
-- Mapping akun external→internal SUDAH ADA (division_ivp_mappings) — untuk
-- MVI/MLDS tinggal tambah baris di Admin Panel. Akun Manager disimpan di
-- app_settings.
--
-- REVISI: product_supervisor_map (person-based) diganti product_team_map
-- (team-based). Tabel lama belum pernah dipakai di production (masih di
-- branch, 0 baris) — aman di-drop.
-- ============================================================================

-- Tipe produk dipilih sales saat buat request (LED / LCD/Middleware / LED & LCD).
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS product_type TEXT;

DROP TABLE IF EXISTS product_supervisor_map;

CREATE TABLE IF NOT EXISTS product_team_map (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type  TEXT NOT NULL UNIQUE,          -- 'LED' | 'LCD/Middleware' | 'LED & LCD'
  team_types    TEXT[] NOT NULL DEFAULT '{}',  -- mis. ['Team PTS MVI'] atau ['Team PTS MVI','Team PTS IVP']
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE product_team_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON product_team_map;
CREATE POLICY "Allow all for anon" ON product_team_map FOR ALL USING (true) WITH CHECK (true);

-- Akun Manager (gerbang approval Manager) — disimpan sebagai setting key/value.
-- Di-set via Admin Panel. Default: pilih akun Dhany. app_settings sudah ada.
--   key='manager_user_id', value='<uuid user manager>'
-- (Tidak perlu membuat tabel baru.)

-- Flag eksplisit Internal/External untuk akun Guest (Sales) — menggantikan
-- tebakan dari sales_division IN ('IVP','MVI'). Di-set manual per akun di
-- Admin Panel (default FALSE = external; admin centang TRUE utk akun internal).
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_internal_sales BOOLEAN NOT NULL DEFAULT FALSE;
