-- ═══════════════════════════════════════════════════════════════════════════
-- Incentive PTS: mengeluarkan sebuah proyek dari daftar, TANPA menghapus
-- jadwalnya di Request Schedule.
--
-- MASALAH YANG DIPECAHKAN
--
-- Daftar Incentive PTS bukan tabel tersendiri. Isinya diturunkan langsung dari
-- `reminders`: kategori Konfigurasi / Konfigurasi & Training / Training yang
-- berstatus selesai. Akibatnya tidak ada cara mengeluarkan satu proyek dari
-- perhitungan insentif - salah kategori, proyek batal, atau jadwal kembar -
-- selain menghapus jadwalnya, dan itu ikut menghapus riwayat pekerjaan yang
-- tidak bersalah.
--
-- Kolom ini memisahkan dua hal yang selama ini menyatu: "pekerjaan ini pernah
-- terjadi" (tetap di Request Schedule) dan "pekerjaan ini dihitung insentifnya"
-- (bisa dimatikan).
--
-- Karena hanya sebuah penanda, keputusannya bisa dibatalkan: tombol
-- "Sync ke Incentive" di Request Schedule mengembalikannya ke FALSE.
--
-- NULL diperlakukan sama dengan FALSE. Itu sengaja: seluruh baris lama tidak
-- berubah perilakunya sedetik pun setelah kolom ini dipasang.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS incentive_excluded BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN reminders.incentive_excluded IS
  'TRUE = tidak ikut dihitung di Incentive PTS. Jadwalnya TETAP ada di Request Schedule. NULL/FALSE = ikut dihitung (bawaan).';

-- Indeks parsial: yang dibaca daftar Incentive justru baris yang TIDAK
-- dikecualikan, dan itu hampir seluruh tabel - jadi yang layak diindeks adalah
-- himpunan kecilnya, untuk layar "yang dikeluarkan" dan pemeriksaan sesekali.
CREATE INDEX IF NOT EXISTS idx_reminders_incentive_excluded
  ON reminders (incentive_excluded)
  WHERE incentive_excluded IS TRUE;

-- ── Periksa hasilnya ───────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'reminders' AND column_name = 'incentive_excluded') AS kolom_terpasang,
  (SELECT COUNT(*) FROM reminders
     WHERE category IN ('Konfigurasi', 'Konfigurasi & Training', 'Training')
       AND status = 'done')                                                 AS proyek_insentif,
  (SELECT COUNT(*) FROM reminders WHERE incentive_excluded IS TRUE)         AS dikeluarkan;
