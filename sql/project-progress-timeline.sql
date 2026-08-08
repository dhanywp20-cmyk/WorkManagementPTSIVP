-- ============================================================================
-- Project Progress — tanggal mulai & target selesai (timeline + deteksi overtime)
-- ============================================================================
--
--  Ditambahkan di DUA level:
--    progress_projects   → jadwal proyek keseluruhan
--    progress_locations  → jadwal per lokasi, karena satu proyek bisa punya
--                          site yang mulai dan selesai di waktu berbeda
--                          (mis. Palembang duluan, Padang menyusul).
--
--  Semua kolom NULLABLE — proyek & lokasi yang sudah ada tidak terganggu dan
--  tetap tampil normal tanpa tanggal sampai diisi.
--
--  Status "overtime" TIDAK disimpan sebagai kolom. Ia dihitung saat tampil
--  (lihat timelineInfo di _components/shared.ts) dengan membandingkan
--  target_date terhadap tanggal hari ini. Menyimpannya sebagai kolom berarti
--  harus ada job yang memperbaruinya tiap hari, dan nilainya pasti basi.
--
--  Aman dijalankan berulang.
-- ============================================================================

ALTER TABLE progress_projects
  ADD COLUMN IF NOT EXISTS start_date  DATE NULL,
  ADD COLUMN IF NOT EXISTS target_date DATE NULL;

ALTER TABLE progress_locations
  ADD COLUMN IF NOT EXISTS start_date  DATE NULL,
  ADD COLUMN IF NOT EXISTS target_date DATE NULL;

-- Jaga agar target tidak lebih awal dari tanggal mulai. Dibungkus DO block
-- karena PostgreSQL tidak punya ADD CONSTRAINT IF NOT EXISTS — tanpa ini,
-- eksekusi kedua gagal dan migrasi berhenti setengah jalan.
DO $$ BEGIN
  ALTER TABLE progress_projects
    ADD CONSTRAINT progress_projects_date_order_check
    CHECK (start_date IS NULL OR target_date IS NULL OR target_date >= start_date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE progress_locations
    ADD CONSTRAINT progress_locations_date_order_check
    CHECK (start_date IS NULL OR target_date IS NULL OR target_date >= start_date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Dipakai halaman listing untuk menyorot proyek yang lewat target.
CREATE INDEX IF NOT EXISTS idx_progress_projects_target
  ON progress_projects(target_date)
  WHERE target_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_progress_locations_target
  ON progress_locations(target_date)
  WHERE target_date IS NOT NULL;
