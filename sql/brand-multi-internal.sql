-- ============================================================================
-- BRAND: Sales External bisa di-handle 2 Sales Internal (MVI House / IVP Global)
-- ============================================================================
-- Sales External pilih brand saat request (WAJIB): MVI (House) / IVP (Global) /
-- Kedua Brand. Request lalu di-route/CC ke Sales Internal sesuai brand yg dipetakan
-- di division_ivp_mappings. Keputusan user:
--   • Ticket = CC saja (fast-track, tanpa gerbang approval) — brand cuma menentukan
--     Sales Internal mana yg di-CC + lihat ticket.
--   • Schedule & Design "Kedua Brand" = WAJIB kedua Sales Internal approve dulu.
--
-- Aman diulang (IF NOT EXISTS). Kolom lama tetap dipakai utk reviewer/brand tunggal.
-- ============================================================================

-- ── 1. Mapping divisi → Sales Internal per BRAND ────────────────────────────
-- brand_type: 'MVI' (House Brand) atau 'IVP' (Global Brand). 1 divisi bisa 2 baris
-- (satu per brand). NULL = mapping lama (dianggap berlaku utk semua brand / legacy).
ALTER TABLE division_ivp_mappings
  ADD COLUMN IF NOT EXISTS brand_type text;

-- ── 2. Kolom brand + reviewer kedua di request ──────────────────────────────
-- brand: 'MVI' | 'IVP' | 'BOTH'. internal_sales_id (lama) = reviewer utama /
-- reviewer MVI saat BOTH. internal_sales_id_2 = reviewer IVP saat BOTH.
-- internal_approved_at_2 = timestamp approve reviewer kedua (BOTH).
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS internal_sales_id_2 uuid;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS internal_approved_at_2 timestamptz;

ALTER TABLE project_requests ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE project_requests ADD COLUMN IF NOT EXISTS internal_sales_id_2 uuid;
ALTER TABLE project_requests ADD COLUMN IF NOT EXISTS internal_approved_at_2 timestamptz;

-- Ticket: brand saja (CC-only, tanpa gerbang approval). internal_sales_id sudah ada
-- (dari routing-supervisor-stage.sql) utk CC utama; internal_sales_id_2 utk brand IVP saat BOTH.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS internal_sales_id_2 uuid;
