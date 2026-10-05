-- MIGRATION 031: Piket Showroom - kegiatan INTERNAL tidak lagi tersembunyi dari Sales/Marketing.
--
-- GEJALA: akun Sales / Marketing yang diberi menu Piket Showroom melihat
-- halaman kosong: Ringkasan Aktivitas 0, semua pie chart kosong, tiap hari
-- tanpa kegiatan. Jadwal PIC tetap tampil (piket_schedules terbuka).
--
-- SEBAB: kode halaman (app/picket-showroom/page.tsx, filterLingkup dengan
-- sertakanTanpaPemilik) SUDAH dirancang menampilkan kegiatan yang tidak
-- punya nama sales - training/RnD, maintenance, shooting markom - karena itu
-- bukan kunjungan pelanggan siapa pun. Tetapi kebijakan ptd_baca hanya
-- meloloskan boleh_lihat_project(nama_sales, sales_division): untuk
-- nama_sales NULL hasilnya NULL (ditolak). 30 dari 68 baris (RnD 21,
-- Maintenance 7, Shooting Markom 2) tidak pernah sampai ke Sales; sisanya
-- hanya yang atas nama/divisinya sendiri. Simulasi JWT 6 akun guest berizin
-- menu ini: 0-2 dari 68 baris terlihat (hanya akun piket_akses='semua' yang
-- melihat 68). Pola yang sama dengan sql/piket-akses-rls.sql: kode benar,
-- RLS tertinggal.
--
-- PERBAIKAN: satu jalur lolos baru di kebijakan SELECT - baris tanpa nama
-- sales DAN tanpa nama instansi tamu (= kegiatan internal) terbaca oleh
-- siapa pun yang masuk. Syarat "tanpa instansi" dipasang supaya catatan
-- kunjungan pelanggan yang kebetulan lupa diisi nama salesnya TIDAK ikut
-- terbuka. Saat ini 0 baris yang tanpa sales tetapi beralamat instansi.
--
-- TIDAK diubah: kunjungan pelanggan (ada nama sales) tetap hanya untuk
-- pemiliknya / divisinya / Tim PTS / piket_akses='semua', dan kebijakan TULIS
-- (ptd_tulis) tetap tidak tersentuh - Sales tetap tidak bisa menyunting.
-- piket_produk_lain ikut otomatis (ppl_baca membaca lewat piket_tamu_detail).
--
-- Mengembalikan: jalankan ulang bagian USING lama (lihat sql/piket-akses-rls.sql).

DROP POLICY IF EXISTS ptd_baca ON public.piket_tamu_detail;
CREATE POLICY ptd_baca ON public.piket_tamu_detail
  FOR SELECT TO anon, authenticated
  USING (
    (
      jwt_claim('sub') <> ''
      AND (
        boleh_lihat_project(nama_sales, sales_division)
        OR lingkup_semua()
        -- Kegiatan internal: tanpa pemilik (nama sales) dan tanpa instansi tamu.
        OR (
          NULLIF(btrim(COALESCE(nama_sales, '')), '') IS NULL
          AND NULLIF(btrim(COALESCE(tamu_instansi, '')), '') IS NULL
        )
      )
    )
    OR public.piket_akses_semua()
  );
