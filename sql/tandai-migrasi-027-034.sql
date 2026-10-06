-- ============================================================================
--  TANDAI MIGRASI 027-034 - mencatat migrasi supabase/migrations yang sudah terpasang
-- ============================================================================
--
--  Catatan `sql_diterapkan` berhenti diperbarui sejak 21 Agustus 2026, padahal migrasi
--  027-034 (Tools Team, Request Design 3D, piket, akun pimpinan) sudah berjalan di
--  produksi. Audit 6 Okt 2026: tabel itu hanya memuat berkas folder `sql/`; migrasi
--  bernomor di `supabase/migrations/` tidak pernah dicatat.
--
--  Jalankan SEKALI di SQL Editor produksi. Aman diulang. Hanya menyentuh `sql_diterapkan`.
--
--  DASARNYA bukan tebakan: tiap berkas ditandai HANYA bila objek yang dibuatnya benar-benar
--  ada di basis data ini (tabel / kolom / fungsi / policy). Yang buktinya tidak ada
--  dilewati dan disebut di hasil - catatan yang salah lebih buruk daripada tidak ada catatan.
--
--  Prasyarat: fungsi tandai() dari sql/urutan-penerapan.sql sudah ada (sudah, dipakai sejak Agustus).
--  Setelah menjalankan 035 & 036, tandai keduanya satu per satu: SELECT tandai('035_hapus_wa_trigger_lama.sql');

WITH bukti(berkas, ket, lolos) AS (
  VALUES
    ('027_tools_team.sql',                     'Tools Team: desain 3D ruang di server',            to_regclass('public.tools_desain_ruang') IS NOT NULL),
    ('028_desain_ruang_versi_request.sql',     'Versi desain 3D + tautan ke Request Design',        to_regclass('public.request_desain_ruang') IS NOT NULL
                                                                                                      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'tools_simpan_desain')),
    ('029_tools_led_simpan.sql',               'Tools Team: hitungan LED tersimpan',                to_regclass('public.tools_led_simpan') IS NOT NULL),
    ('030_desain_ruang_gambar_hd.sql',         'Gambar HD desain 3D',                               EXISTS (SELECT 1 FROM information_schema.columns
                                                                                                             WHERE table_name = 'tools_desain_ruang_versi' AND column_name ILIKE '%hd%')),
    ('031_piket_kegiatan_internal_terbuka.sql','Piket: kegiatan internal terbuka',                  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'piket_tamu_detail' AND policyname = 'ptd_baca')),
    ('032_piket_hak_ubah.sql',                 'Piket: hak ubah per akun',                          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'piket_ubah')
                                                                                                      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'piket_boleh_ubah')),
    ('033_piket_lihat_terbuka.sql',            'Piket: semua orang melihat semua',                  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'piket_akses_semua')),
    ('034_akun_pimpinan.sql',                  'Akun Pimpinan: lihat semua, hanya baca',            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'pimpinan')
                                                                                                      AND EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pimpinan_hanya_lihat_tambah'))
)
SELECT berkas,
       CASE WHEN lolos THEN tandai(berkas, ket)
            ELSE berkas || ': DILEWATI - objeknya tidak ditemukan di basis data ini (belum dijalankan?)' END AS hasil
FROM bukti
ORDER BY berkas;
