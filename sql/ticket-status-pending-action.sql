-- ============================================================================
-- FIX: tabel tickets menolak status 'Pending Action'
-- ============================================================================
-- Error di production:
--   new row for relation "tickets" violates check constraint "tickets_status_check"
-- Sebab: kode ticketing menambah status BARU 'Pending Action', tapi CHECK
-- constraint di kolom tickets.status belum mengizinkannya. Migrasi ini membuat
-- ulang constraint dgn daftar status LENGKAP (termasuk 'Pending Action').
--
-- Pakai NOT VALID: baris LAMA tidak di-scan ulang (jadi tidak gagal walau ada
-- data lama dgn status di luar daftar), TAPI INSERT/UPDATE baru tetap divalidasi.
-- ============================================================================

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_status_check CHECK (
    status IN (
      -- Alur PTS
      'Waiting Approval', 'Pending', 'Call', 'Onsite', 'In Progress',
      'Pending Action', 'Solved', 'Overdue', 'Rejected', 'Returned to PTS', 'Cancelled',
      -- Alur Services (kalau-kalau pernah ditulis ke kolom status)
      'Warranty', 'Out Of Warranty', 'Waiting PO from Sales', 'Submit RMA',
      'Waiting sparepart', 'Process Repair'
    )
  ) NOT VALID;
