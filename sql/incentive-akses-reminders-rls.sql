-- =====================================================================
-- Incentive PTS - AKSES INSENTIF TIDAK TEMBUS KE RLS `reminders`
-- =====================================================================
--
-- GEJALA: admin memberi Anes akses 'input' + lingkup brand IVP di
-- Pengaturan Akses, TAPI daftar proyeknya di Incentive PTS cuma tampil 5
-- dari 43 - dan tidak satu pun bertanda IVP/BOTH tambahan yang seharusnya
-- boleh ia lihat.
--
-- SEBAB: `fetchIncentiveProjects()` mengambil baris dari tabel `reminders`
-- pakai anon key milik Anes sendiri. Kebijakan RLS `rm_select` pada tabel
-- itu ADALAH ATURAN SALES ("boleh_lihat_baris") - hanya meloloskan baris
-- milik sendiri / divisi yang dipetakan kepadanya. Aturan itu berlaku untuk
-- SEMUA pembacaan reminders, termasuk yang dilakukan halaman Incentive PTS,
-- dan sama sekali tidak tahu-menahu soal `incentive_akses` /
-- `incentive_brand_scope`.
--
-- Akibatnya: `incentive_brand_scope` = IVP hanya bisa MENYEMPITKAN dari apa
-- yang sudah diloloskan RLS - tidak pernah bisa MELEBARKANNYA. RLS sudah
-- memangkas ke 5 baris SEBELUM kode Incentive PTS sempat menyaring
-- berdasarkan brand sama sekali. Diverifikasi langsung: mensimulasikan JWT
-- Anes dan menghitung baris kategori-insentif yang lolos RLS menghasilkan
-- persis 5 - sama dengan yang tampil di layarnya.
--
-- PERBAIKAN: tambah SATU jalur lolos baru khusus di `rm_select` - orang
-- yang diberi akses insentif 'input'/'penuh' boleh membaca baris berkategori
-- insentif, TERLEPAS dari kepemilikan/divisinya. Penyaringan brand
-- (bolehLihatBrand di halaman) tetap jalan SESUDAHNYA seperti biasa -
-- perbaikan ini hanya membuka pintu yang sebelumnya tertutup rapat sebelum
-- penyaringan brand sempat bekerja.
--
-- Kategori insentif dibaca dari skema tersimpan (bukan dipaku di sini),
-- konsisten dengan `kategoriProyek` yang sudah bisa diatur dari layar Skema
-- Pembagian - lihat lib/incentive-scheme.ts.
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.kategori_insentif_db()
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(
    (SELECT ARRAY(SELECT jsonb_array_elements_text(scheme->'kategoriProyek'))
       FROM public.incentive_scheme_settings
      ORDER BY updated_at DESC LIMIT 1),
    ARRAY['Konfigurasi', 'Konfigurasi & Training', 'Training']
  );
$$;

DROP POLICY IF EXISTS rm_select ON public.reminders;
CREATE POLICY rm_select ON public.reminders
  FOR SELECT TO anon, authenticated
  USING (
    boleh_lihat_baris(sales_user_id, sales_name, sales_division, created_by)
    OR (assign_user_id = jwt_user_id())
    OR (assigned_to = jwt_claim('username'))
    OR (internal_sales_id = jwt_user_id())
    OR (internal_sales_id_2 = jwt_user_id())
    -- BARU: pemegang akses insentif 'input'/'penuh' boleh membaca baris
    -- berkategori insentif, terlepas dari kepemilikan/divisinya. Ini yang
    -- membuat incentive_brand_scope berarti apa-apa - tanpa ini, brand
    -- scope hanya bisa menyempitkan dari apa yang sudah dipangkas RLS ke
    -- "milik sendiri saja", tidak pernah bisa melebarkannya.
    OR (public.akses_insentif() IN ('input', 'penuh') AND category = ANY (public.kategori_insentif_db()))
  );
