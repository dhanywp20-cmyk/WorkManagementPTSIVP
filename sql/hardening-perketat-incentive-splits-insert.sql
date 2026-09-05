-- HARDENING P2 lanjutan (tindak lanjut dari sql/hardening-tutup-insert-anonim.sql):
-- incentive_splits INSERT sebelumnya cuma mensyaratkan "sudah login" - siapa
-- pun yang login TAPI tidak punya akses insentif sama sekali (mis. Sales
-- biasa) tetap bisa menulis baris "siapa dapat berapa uang" ke tabel
-- finansial paling sensitif di platform ini. Disamakan dengan sepupu
-- setabelnya (incentive_tranches.it_tambah/it_ubah) yang sudah memakai
-- akses_insentif_input().
--
-- Diverifikasi lewat simulasi (transaksi ROLLBACK): user tanpa akses insentif
-- -> ditolak RLS; user dengan incentive_akses='input' -> lolos RLS (galat
-- berikutnya foreign-key, bukan lagi row-level security - buktinya sudah
-- lewat pemeriksaan akses).

DROP POLICY IF EXISTS "anon_insert_only" ON public.incentive_splits;
CREATE POLICY "anon_insert_only" ON public.incentive_splits
  FOR INSERT WITH CHECK (akses_insentif_input());
