-- =====================================================================
-- Piket Showroom - `piket_akses` TIDAK PERNAH TEMBUS KE RLS
-- =====================================================================
--
-- GEJALA: admin memberi seorang Guest (resepsionis/front desk) lingkup
-- "Semua catatan" dari Kelola Akun, TAPI daftar kegiatannya di Piket
-- Showroom tetap kosong - Ringkasan Aktivitas 0 jam, kolom Kegiatan/Jam/
-- Produk/Tamu Instansi/Sales semuanya "—".
--
-- SEBAB: PERSIS pola yang sama dengan T-9 di Incentive PTS
-- (sql/incentive-akses-reminders-rls.sql) - hanya beda tabel. Halaman Piket
-- Showroom membaca `piket_tamu_detail` pakai anon key milik pengguna sendiri.
-- Kebijakan RLS `ptd_baca`/`ptd_tulis` pada tabel itu sama sekali tidak
-- tahu-menahu soal kolom `piket_akses` yang baru dibuat - qual-nya cuma
-- `boleh_lihat_project(nama_sales, sales_division) OR lingkup_semua()`,
-- yaitu aturan Sales biasa (nama sendiri / divisi yang dipetakan).
--
-- Kode aplikasi (app/picket-showroom/page.tsx) SUDAH BENAR: kalau
-- `piket_akses='semua'`, ia berhenti memasang filter `.or(batas)` dan
-- meminta SEMUA baris. Tapi permintaan "semua baris" itu tetap dipangkas
-- RLS di database SEBELUM sempat sampai ke kode - baris yang ditolak RLS
-- tidak pernah terlihat, terlepas dari filter yang diminta klien.
--
-- Diverifikasi langsung: mensimulasikan JWT akun contoh (Guest, Marketing,
-- piket_akses masih NULL/bawaan) menghasilkan HANYA 1 dari 61 baris - dan
-- angka itu TIDAK AKAN BERUBAH sekalipun piket_akses-nya sudah diset
-- 'semua', karena RLS belum tahu kolom itu ada.
--
-- PERBAIKAN: tambah SATU jalur lolos baru khusus di kebijakan SELECT -
-- pemegang `piket_akses = 'semua'` boleh membaca seluruh
-- `piket_tamu_detail`, terlepas dari nama/divisinya. Kebijakan TULIS
-- (INSERT/UPDATE/DELETE, `ptd_tulis`) SENGAJA TIDAK disentuh - "Semua
-- catatan" hanya soal MELIHAT, hak mengisi/menyunting tetap murni Tim PTS
-- (lib/piket-akses.ts bisaIsiKegiatan) seperti yang sudah dirancang.
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.piket_akses_semua()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.lingkup_semua() OR COALESCE(
    (SELECT u.piket_akses = 'semua' FROM public.users u WHERE u.id::text = jwt_claim('sub')),
    false
  );
$$;

DROP POLICY IF EXISTS ptd_baca ON public.piket_tamu_detail;
CREATE POLICY ptd_baca ON public.piket_tamu_detail
  FOR SELECT TO anon, authenticated
  USING (
    (jwt_claim('sub') <> '' AND (boleh_lihat_project(nama_sales, sales_division) OR lingkup_semua()))
    OR public.piket_akses_semua()
  );
