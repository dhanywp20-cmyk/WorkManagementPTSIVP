-- ═══════════════════════════════════════════════════════════════════════════
-- Request Design Project — brand display Ruangan 1 (+ display kedua)
--
-- DUA hal sekaligus:
--
-- 1. Kolom brand untuk RUANGAN 1 memang belum pernah ada. Ruangan ke-2 dan
--    seterusnya disimpan di kolom `rooms` (JSONB) sehingga brand-nya ikut
--    tersimpan sendirinya, tapi Ruangan 1 disimpan di kolom tabel — dan
--    kolom brand-nya tidak pernah dibuat. Akibatnya memilih Brand Display di
--    Ruangan 1 tidak berefek apa pun: tidak tersimpan, PIC-nya tidak pernah
--    dikabari, dan tidak muncul di detail.
--
-- 2. Slot display KEDUA: satu ruangan bisa memakai dua produk display dari
--    brand berbeda, dan tiap brand punya PIC-nya sendiri.
--
-- AMAN dijalankan berulang kali.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE project_requests
  ADD COLUMN IF NOT EXISTS brand_display              TEXT,
  ADD COLUMN IF NOT EXISTS brand_display_pic_id       TEXT,
  ADD COLUMN IF NOT EXISTS brand_display_pic_name     TEXT,
  ADD COLUMN IF NOT EXISTS brand_display_2            TEXT,
  ADD COLUMN IF NOT EXISTS brand_display_2_pic_id     TEXT,
  ADD COLUMN IF NOT EXISTS brand_display_2_pic_name   TEXT,
  ADD COLUMN IF NOT EXISTS brand_middleware           TEXT,
  ADD COLUMN IF NOT EXISTS brand_middleware_pic_id    TEXT,
  ADD COLUMN IF NOT EXISTS brand_middleware_pic_name  TEXT;

COMMENT ON COLUMN project_requests.brand_display_2 IS
  'Brand display KEDUA untuk Ruangan 1 — satu ruangan bisa memakai dua produk display dengan PIC berbeda';
