-- ═══════════════════════════════════════════════════════════════════════════
-- Insentif: kunci skema yang dipakai tiap proyek, dan simpan riwayatnya.
--
-- MASALAH YANG DIPERBAIKI
--
-- Sebuah proyek dihitung TIGA KALI dalam rentang tiga tahun (satu kali per
-- tahap pencairan). Selama ini tiap perhitungan membaca skema yang BERLAKU
-- SAAT ITU, sementara simpanSkema() menimpa satu-satunya baris pengaturan.
-- Akibatnya, begitu porsi diubah di tahun ke-2:
--
--   * Tahap 1 sudah dibayar dengan angka lama.
--   * Tahap 2 & 3 memakai angka baru.
--   * Angka lama sudah hilang, jadi selisihnya tidak bisa dijelaskan ke
--     siapa pun - termasuk ke Finance yang sudah menerima rekap tahap 1.
--
-- Sesudah migrasi ini:
--
--   * incentive_scheme_settings jadi TAMBAH-SAJA. Tiap penyimpanan membuat
--     baris baru; yang terbaru yang berlaku, yang lama jadi riwayat.
--   * Tiap baris incentive_tranches membawa SALINAN skema yang dipakai saat
--     tahapan itu dibuat. Perhitungan membaca salinan itu, bukan skema
--     terkini - jadi mengubah kebijakan tidak pernah mengubah surut proyek
--     yang sudah berjalan.
--
-- Salinannya disimpan utuh (bukan sekadar id) dengan sengaja: kalau baris
-- pengaturan aslinya kelak terhapus, bukti perhitungannya tetap ada di
-- tahapan yang bersangkutan.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Salinan skema pada tiap tahapan
ALTER TABLE incentive_tranches
  ADD COLUMN IF NOT EXISTS scheme_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS scheme_label    TEXT;

COMMENT ON COLUMN incentive_tranches.scheme_snapshot IS
  'Salinan utuh SkemaInsentif yang berlaku saat tahapan ini dibuat. Perhitungan memakai ini, bukan skema terkini.';
COMMENT ON COLUMN incentive_tranches.scheme_label IS
  'Penanda skema untuk rekap ke Finance, mis. "Skema 12 Agu 2026 - Dhany Wahyu".';

-- 2. Batas jumlah tahapan dilonggarkan.
--    CHECK lama mengunci tranche_number ke (1,2,3), padahal layar Skema
--    Pembagian punya tombol "+ Tahap" - menambah tahap ke-4 di sana akan
--    membuat penyimpanan tahapan GAGAL dengan galat batasan basis data yang
--    tidak menyebut sebabnya. Pengaturan yang boleh diubah tapi ditolak
--    diam-diam oleh tabelnya lebih buruk daripada pengaturan yang tidak ada.
ALTER TABLE incentive_tranches DROP CONSTRAINT IF EXISTS incentive_tranches_tranche_number_check;
ALTER TABLE incentive_tranches
  ADD CONSTRAINT incentive_tranches_tranche_number_check CHECK (tranche_number >= 1);

-- 3. Tahapan ganda untuk proyek yang sama dicegah di TINGKAT BASIS DATA.
--    Penjagaan di layar sudah dipasang, tapi ia hanya menahan satu peramban.
--    Dua orang yang menekan tombolnya bersamaan tetap lolos - dan hasilnya
--    dua set tahapan yang dibayar dua kali tanpa galat apa pun.
CREATE UNIQUE INDEX IF NOT EXISTS incentive_tranches_unik_per_proyek
  ON incentive_tranches (project_id, tranche_number);

-- 4. Riwayat skema: pembacaan "yang terbaru" dilakukan tiap kali menghitung,
--    jadi urutannya diberi indeks.
CREATE INDEX IF NOT EXISTS incentive_scheme_settings_terbaru
  ON incentive_scheme_settings (updated_at DESC);

COMMENT ON TABLE incentive_scheme_settings IS
  'Riwayat aturan pembagian insentif - TAMBAH-SAJA. Baris terbaru yang berlaku; baris lama adalah bukti perhitungan periode sebelumnya dan tidak boleh dihapus.';

-- 5. Periksa hasilnya
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name = 'incentive_tranches' AND column_name IN ('scheme_snapshot','scheme_label')) AS kolom_baru_terpasang,
  (SELECT COUNT(*) FROM incentive_scheme_settings) AS jumlah_versi_skema,
  (SELECT COUNT(*) FROM incentive_tranches WHERE scheme_snapshot IS NULL) AS tahapan_tanpa_salinan;
