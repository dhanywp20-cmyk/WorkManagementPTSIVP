-- ═══════════════════════════════════════════════════════════════════════════
-- Skema pembagian insentif project — disimpan sebagai DATA, bukan kode.
--
-- Sebelumnya angka pembagian (65/15/10/10, faktor Remote 0.85, potongan
-- Installer 15%) ditulis langsung di dalam rumus. Setiap perubahan kebijakan
-- menuntut penyuntingan kode di beberapa tempat sekaligus lalu build ulang —
-- dan cukup satu tempat terlewat untuk membuat rekap tidak berjumlah 100%.
--
-- Kolomnya sengaja JSONB, bukan satu kolom per peran: menambah peran baru
-- (mis. Installer Cabang kembali diberi porsi, atau peran QC) tidak lagi
-- membutuhkan ALTER TABLE maupun perubahan kode.
--
-- Jalankan sekali di Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS incentive_scheme_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme      JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT
);

COMMENT ON TABLE  incentive_scheme_settings IS
  'Satu baris berisi seluruh aturan pembagian insentif. Baris terbaru yang berlaku.';
COMMENT ON COLUMN incentive_scheme_settings.scheme IS
  'Lihat SkemaInsentif di lib/incentive-scheme.ts untuk bentuk datanya.';

-- Isi awal = kebijakan yang berlaku (Proposal Insentif 2026, tanpa porsi
-- Installer). Hanya diisi bila tabelnya masih kosong, supaya menjalankan
-- ulang berkas ini tidak menimpa pengaturan yang sudah disunting admin.
INSERT INTO incentive_scheme_settings (scheme, updated_by)
SELECT '{
  "versi": 2,
  "porsi": [
    { "peran": "pic",        "label": "PIC Proyek",                    "persen": 50, "bagiRata": true  },
    { "peran": "support",    "label": "Tim Support (Troubleshooting)", "persen": 20, "bagiRata": true  },
    { "peran": "supervisor", "label": "Supervisor",                    "persen": 15, "bagiRata": true  },
    { "peran": "manager",    "label": "Manager",                       "persen": 15, "bagiRata": false }
  ],
  "tanpaSupport": { "pic": 60, "supervisor": 20, "manager": 20 },
  "jendelaSupportBulan": 12,
  "hangusSupervisorKe": "manager",
  "managerSebagaiPic": { "pic": 100 },
  "installerRemotePersen": 0,
  "installerBayarDiMuka": true,
  "tranche": [
    { "nomor": 1, "persen": 50, "tahunKe": 1 },
    { "nomor": 2, "persen": 35, "tahunKe": 2 },
    { "nomor": 3, "persen": 15, "tahunKe": 3 }
  ]
}'::jsonb, 'migrasi awal'
WHERE NOT EXISTS (SELECT 1 FROM incentive_scheme_settings);

ALTER TABLE incentive_scheme_settings ENABLE ROW LEVEL SECURITY;

-- Skema pembagian bukan rahasia per orang: seluruh pengguna yang login boleh
-- MEMBACA-nya (dipakai layar rincian untuk menjelaskan asal angka), tetapi
-- hanya boleh diubah lewat layar Pengaturan yang sudah dibatasi admin.
DROP POLICY IF EXISTS incentive_scheme_baca ON incentive_scheme_settings;
CREATE POLICY incentive_scheme_baca ON incentive_scheme_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS incentive_scheme_tulis ON incentive_scheme_settings;
CREATE POLICY incentive_scheme_tulis ON incentive_scheme_settings
  FOR ALL USING (true) WITH CHECK (true);
