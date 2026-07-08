-- ============================================================================
-- ROUTING: tahap Supervisor untuk Request Design Project & Ticket Troubleshooting
-- ============================================================================
-- Spec: Admin/Manager approve → assign ke SUPERVISOR (atau kerjakan sendiri) →
-- Supervisor assign ke anggota tim (atau sendiri). Reminder Schedule sudah punya
-- kolom ini; migrasi ini menyamakan project_requests & tickets.
--
-- assigned_supervisor_id = id user (jabatan Supervisor) yang wajib assign lanjut.
-- routing_status         = penanda tahap: 'supervisor_assign' saat menunggu SPV.
--                          (project_requests sudah punya kolom ini; tickets belum)
--
-- Aman diulang (IF NOT EXISTS). Tidak menyentuh data lama.
-- ============================================================================

-- ── Request Design Project ──────────────────────────────────────────────────
ALTER TABLE project_requests
  ADD COLUMN IF NOT EXISTS assigned_supervisor_id uuid;

-- ── Ticket Troubleshooting ──────────────────────────────────────────────────
-- tickets belum punya routing_status sama sekali → tambahkan (text, nullable).
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS assigned_supervisor_id uuid;

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS routing_status text;

-- Sales Internal yang di-CC (informational) saat Sales External buat ticket —
-- dipakai supaya ticket muncul di tabel Sales Internal terkait tanpa jadi gate.
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS internal_sales_id uuid;
