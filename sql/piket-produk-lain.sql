-- ============================================================================
-- PIKET SHOWROOM — kolom produk_lain (barang temporer di luar list + beban daya)
-- Run this in Supabase SQL Editor
-- ============================================================================
-- Menyimpan barang temporer di luar PRODUK_LIST default beserta beban dayanya
-- (watt), per kegiatan. Format: [{ "nama": "...", "watt": 1200 }, ...]
-- Jam mulai/selesai mengikuti kegiatan (jam_mulai/jam_selesai yang sudah ada).
-- ============================================================================

ALTER TABLE piket_tamu_detail ADD COLUMN IF NOT EXISTS produk_lain JSONB DEFAULT '[]'::jsonb;
