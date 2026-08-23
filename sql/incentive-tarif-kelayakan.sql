-- ═══════════════════════════════════════════════════════════════════════════
-- Insentif: catat ASAL nominal pool, bukan cuma hasilnya.
--
-- MASALAH YANG DIPERBAIKI
--
-- Seluruh Bab II proposal (kriteria kelayakan + tabel tarif 1% / 0,5% / 5% /
-- flat Rp 500.000) hidup DI LUAR platform. Admin menghitung sendiri "1% dari
-- HPP" lalu mengetik hasilnya ke kolom incentive_value.
--
-- Akibatnya nominal pool tidak punya jejak asal. Kalau Finance bertanya
-- "kenapa proyek ini Rp 5 juta?", jawabannya tidak ada di mana pun kecuali di
-- ingatan orang yang mengetiknya - dan salah ketik satu digit tidak akan
-- pernah ketahuan karena tidak ada angka pembanding.
--
-- Sesudah migrasi ini, tiga hal ikut tersimpan bersama nominalnya:
--   * kategori tarif yang dipilih
--   * dasar hitungnya (HPP)
--   * nominal hasil hitungan
-- sehingga ketiganya bisa dicocokkan ulang kapan saja.
--
-- Kolomnya boleh NULL: proyek lama yang nominalnya diketik manual tetap sah,
-- hanya tidak punya jejak asal. Memaksanya NOT NULL akan menolak baris yang
-- sudah ada tanpa ada cara mengisinya.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS incentive_tarif_kunci TEXT,
  ADD COLUMN IF NOT EXISTS incentive_dasar_hpp   NUMERIC;

COMMENT ON COLUMN reminders.incentive_tarif_kunci IS
  'Kunci tarif kelayakan yang dipilih (lihat TarifKelayakan di lib/incentive-scheme.ts). NULL = nominal diisi manual tanpa tarif.';
COMMENT ON COLUMN reminders.incentive_dasar_hpp IS
  'Dasar hitung nominal insentif — umumnya HPP proyek. NULL untuk tarif flat atau nominal manual.';

-- Periksa hasilnya
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name = 'reminders'
      AND column_name IN ('incentive_tarif_kunci','incentive_dasar_hpp')) AS kolom_terpasang,
  (SELECT COUNT(*) FROM reminders WHERE incentive_value > 0)              AS proyek_bernominal,
  (SELECT COUNT(*) FROM reminders WHERE incentive_value > 0
      AND incentive_tarif_kunci IS NULL)                                  AS nominal_tanpa_jejak_asal;
