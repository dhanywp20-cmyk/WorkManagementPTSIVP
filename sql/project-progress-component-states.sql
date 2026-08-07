-- ============================================================================
-- Project Progress — status komponen jadi 4 nilai
-- ============================================================================
--
--  Sebelumnya: done | warning | blocked
--  Sekarang  : done | progress | pending | stuck
--
--  Progres lokasi TIDAK lagi diisi manual. Nilainya dihitung dari komposisi
--  status komponen (lihat computeProgress di _components/shared.ts):
--    Selesai = bobot 1, Proses = 0.5, Pending & Stuck = 0.
--  Kolom progress_locations.progress tetap ada karena dipakai halaman listing
--  untuk agregat tanpa perlu menarik semua komponen — nilainya ditulis ulang
--  setiap kali admin menekan Simpan.
--
--  Jalankan SETELAH sql/project-progress.sql.
--  Aman dijalankan berulang.
-- ============================================================================

-- Petakan nilai lama ke nilai baru.
UPDATE progress_components SET state = 'progress' WHERE state = 'warning';
UPDATE progress_components SET state = 'stuck'    WHERE state = 'blocked';

-- Nilai di luar keempatnya (kalau ada sisa data lama) diamankan ke 'pending'
-- supaya tidak menghasilkan bobot tak terdefinisi saat progres dihitung.
UPDATE progress_components
   SET state = 'pending'
 WHERE state NOT IN ('done', 'progress', 'pending', 'stuck');

-- Kunci di level DB supaya nilai asing tidak bisa masuk lagi.
ALTER TABLE progress_components DROP CONSTRAINT IF EXISTS progress_components_state_check;
ALTER TABLE progress_components
  ADD CONSTRAINT progress_components_state_check
  CHECK (state IN ('done', 'progress', 'pending', 'stuck'));

ALTER TABLE progress_components ALTER COLUMN state SET DEFAULT 'pending';
