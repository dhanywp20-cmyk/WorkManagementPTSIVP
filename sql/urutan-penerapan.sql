-- ============================================================================
--  URUTAN PENERAPAN - menjawab "berkas mana yang sudah jalan di basis data ini"
-- ============================================================================
--
--  AMAN dijalankan kapan saja, dan aman diulang. Ia cuma membuat satu tabel
--  catatan dan mengisinya dengan daftar berkas. Tidak menyentuh tabel
--  pekerjaan mana pun, tidak menjalankan satu pun berkas SQL.
--
--  MASALAH YANG DIJAWAB
--
--  Ada dua tempat SQL di repo ini, dan keduanya bekerja berbeda:
--
--    supabase/migrations/  dijalankan Supabase CLI, otomatis dan berurutan.
--                          CLI mencatat sendiri mana yang sudah jalan.
--    sql/                  dijalankan manusia lewat SQL Editor. TIDAK ADA
--                          yang mencatat apa pun.
--
--  Akibat dari baris kedua itulah yang jadi temuan audit: tidak ada yang bisa
--  menjawab berkas mana yang sudah masuk ke sebuah basis data. Untuk produksi
--  jawabannya "semuanya, kira-kira" - dan "kira-kira" tidak cukup saat harus
--  membangun lingkungan kedua.
--
--  KENAPA FOLDERNYA TIDAK DIGABUNG SAJA
--
--  Karena itu justru merusak. Supabase CLI mencatat migrasi yang sudah jalan
--  BERDASARKAN NAMA BERKAS. Memindahkan berkas sql/ ke supabase/migrations/
--  membuat CLI menganggapnya migrasi baru, lalu menjalankannya di basis data
--  yang isinya sudah ada - CREATE TABLE atas tabel yang sudah punya data,
--  ALTER yang mengulang, UPDATE yang menimpa. Yang hilang bukan foldernya,
--  melainkan CATATANNYA. Jadi catatan itu yang dibuat di sini.
--
--  CARA PAKAI
--
--    Basis data yang SUDAH berjalan (produksi):
--        SELECT tandai_semua_skema();
--      Menandai ke-27 berkas skema sebagai sudah diterapkan sekaligus -
--      platformnya jalan, jadi memang sudah. Sesudah itu tiap berkas BARU
--      ditandai satu per satu:
--        SELECT tandai('nama-berkas.sql');
--
--    GOLONGAN `pembatalan` JANGAN PERNAH dijalankan berurutan bersama yang
--    lain. Isinya pembatalan darurat - unlock-credentials-rls.sql MEMBUKA
--    KEMBALI akses anon ke user_credentials, user_sessions, login_attempts,
--    dan password_reset_otps. Menjalankannya "karena statusnya BELUM" berarti
--    membuka tabel kredensial platform. Statusnya sengaja ditulis
--    JANGAN JALANKAN, bukan BELUM.
--
--    Basis data BARU (lingkungan kedua, tenant baru):
--      1. Jalankan Supabase CLI dulu - supabase/migrations/ adalah fondasinya.
--      2. Jalankan berkas golongan `skema` di bawah SESUAI URUTAN, satu per
--         satu, tandai tiap selesai.
--      3. Golongan `keamanan` menyusul setelah data masuk.
--      4. Golongan `periksa` tidak perlu dijalankan - itu alat baca.
--      5. Golongan `identitas` hanya untuk basis data yang punya data lama
--         berkolom nama; lingkungan baru menulis uuid sejak baris pertama.
--
--  Urutannya diambil dari riwayat git - kapan tiap berkas pertama kali masuk
--  repo. Itu urutan yang BENAR-BENAR dipakai saat berkas-berkas itu
--  dijalankan, bukan urutan yang dikira-kira belakangan.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sql_diterapkan (
  berkas          text PRIMARY KEY,
  urutan          int  NOT NULL,
  golongan        text NOT NULL,
  diterapkan_pada timestamptz,
  catatan         text
);

COMMENT ON TABLE sql_diterapkan IS
  'Catatan berkas sql/ yang sudah dijalankan di basis data INI. Diisi manusia lewat tandai().';

--  Daftar berkas. ON CONFLICT memperbarui urutan & golongan tanpa menghapus
--  penandaan yang sudah ada - jadi menjalankan berkas ini lagi setelah ada
--  berkas SQL baru di repo tidak menghilangkan riwayat.
INSERT INTO sql_diterapkan (berkas, urutan, golongan) VALUES
  ('incentive-pts-migration.sql', 1, 'skema'),
  ('user-hierarchy-atasan.sql', 2, 'skema'),
  ('propagate-user-rename.sql', 3, 'skema'),
  ('piket-produk-lain.sql', 4, 'skema'),
  ('lock-credentials-rls.sql', 5, 'keamanan'),
  ('unlock-credentials-rls.sql', 6, 'pembatalan'),
  ('lock-users-privileged-columns.sql', 7, 'keamanan'),
  ('lock-incentive-splits-rls.sql', 8, 'keamanan'),
  ('routing-pipeline-phase1.sql', 9, 'skema'),
  ('reminder-batch-dates.sql', 10, 'skema'),
  ('rename-mlds-to-mvi.sql', 11, 'skema'),
  ('routing-internal-review.sql', 12, 'skema'),
  ('routing-supervisor-assign.sql', 13, 'skema'),
  ('routing-project-request-internal-review.sql', 14, 'skema'),
  ('sales-routing-refine.sql', 15, 'skema'),
  ('ticket-status-pending-action.sql', 16, 'skema'),
  ('routing-supervisor-stage.sql', 17, 'skema'),
  ('brand-multi-internal.sql', 18, 'skema'),
  ('project-progress.sql', 19, 'skema'),
  ('project-progress-component-states.sql', 20, 'skema'),
  ('project-progress-photo-pic.sql', 21, 'skema'),
  ('storage-audit.sql', 22, 'periksa'),
  ('learning-center-essay.sql', 23, 'skema'),
  ('diagnose-top-performers.sql', 24, 'periksa'),
  ('project-progress-timeline.sql', 25, 'skema'),
  ('project-progress-reminder-link.sql', 26, 'skema'),
  ('cek-rls.sql', 27, 'periksa'),
  ('cek-policy.sql', 28, 'periksa'),
  ('rls-project-progress.sql', 29, 'keamanan'),
  ('cek-kesiapan-rls.sql', 30, 'periksa'),
  ('project-progress-weighted-issues.sql', 31, 'skema'),
  ('user-full-access-toggle.sql', 32, 'skema'),
  ('learning-center-ai-grading.sql', 33, 'skema'),
  ('learning-center-essay-answer-fix.sql', 34, 'skema'),
  ('tech-note-folder-category.sql', 35, 'skema'),
  ('design-project-brand-display-2.sql', 36, 'skema'),
  ('incentive-scheme-settings.sql', 37, 'skema'),
  ('cek-jangkauan-anon.sql', 38, 'periksa'),
  ('rls-lingkup-project.sql', 39, 'keamanan'),
  ('rapikan-policy.sql', 40, 'keamanan'),
  ('tutup-tabel-terlewat.sql', 41, 'keamanan'),
  ('rls-form-reviews.sql', 42, 'keamanan'),
  ('cek-nama-tidak-cocok.sql', 43, 'periksa'),
  ('identitas-uuid.sql', 44, 'identitas'),
  ('identitas-uuid-lanjutan.sql', 45, 'identitas'),
  ('identitas-uuid-terapkan.sql', 46, 'identitas'),
  ('identitas-uuid-usulan.sql', 47, 'identitas'),
  ('cek-akun-kembar.sql', 48, 'periksa'),
  ('identitas-uuid-putuskan.sql', 49, 'identitas'),
  ('rls-nyalakan.sql', 50, 'keamanan'),
  ('urutan-penerapan.sql', 51, 'periksa'),
  ('kunci-tabel-lanjutan.sql', 52, 'keamanan'),
  ('kunci-tabel-lanjutan-2.sql', 53, 'keamanan')
ON CONFLICT (berkas) DO UPDATE
  SET urutan = EXCLUDED.urutan, golongan = EXCLUDED.golongan;


-- ─── tandai() ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION tandai(nama_berkas text, ket text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql AS $fn$
DECLARE ada boolean;
BEGIN
  SELECT true INTO ada FROM sql_diterapkan WHERE berkas = nama_berkas;
  IF ada IS NOT TRUE THEN
    --  Berkas di luar daftar tetap dicatat, bukan ditolak. Daftar ini foto
    --  keadaan repo saat berkas ini ditulis, dan repo terus bertambah.
    INSERT INTO sql_diterapkan (berkas, urutan, golongan, diterapkan_pada, catatan)
    VALUES (nama_berkas,
            COALESCE((SELECT max(urutan) FROM sql_diterapkan), 0) + 1,
            'tambahan', now(), ket);
    RETURN nama_berkas || ': dicatat sebagai berkas tambahan, ditandai diterapkan.';
  END IF;
  IF (SELECT golongan FROM sql_diterapkan WHERE berkas = nama_berkas) = 'pembatalan' THEN
    --  Berkas pembatalan bukan sesuatu yang "diterapkan". Menandainya akan
    --  membuatnya tampak seperti langkah normal yang sudah dilewati, padahal
    --  ia justru membuka kembali apa yang ditutup berkas lain.
    RETURN nama_berkas || ': DITOLAK - ini berkas pembatalan darurat, bukan langkah penerapan.';
  END IF;
  UPDATE sql_diterapkan
     SET diterapkan_pada = now(), catatan = COALESCE(ket, catatan)
   WHERE berkas = nama_berkas;
  RETURN nama_berkas || ': ditandai diterapkan.';
END $fn$;

CREATE OR REPLACE FUNCTION batalkan_tandai(nama_berkas text)
RETURNS text
LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE sql_diterapkan SET diterapkan_pada = NULL WHERE berkas = nama_berkas;
  RETURN nama_berkas || ': penandaan dibatalkan.';
END $fn$;

--  Untuk basis data yang platformnya SUDAH berjalan. Hanya golongan `skema` -
--  golongan lain memang belum tentu pernah dijalankan, dan menandainya
--  borongan akan menyembunyikan yang benar-benar belum.
CREATE OR REPLACE FUNCTION tandai_semua_skema()
RETURNS text
LANGUAGE plpgsql AS $fn$
DECLARE n int;
BEGIN
  UPDATE sql_diterapkan
     SET diterapkan_pada = now(),
         catatan = COALESCE(catatan, 'ditandai borongan - platform sudah berjalan')
   WHERE golongan = 'skema' AND diterapkan_pada IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n || ' berkas skema ditandai diterapkan.';
END $fn$;


-- ─── LAPORAN ────────────────────────────────────────────────────────────────
--  Query terakhir, supaya sekali Run langsung terlihat keadaannya.
--
--  Kolom `status`:
--    sudah          sudah dijalankan di basis data ini
--    BELUM          perlu dijalankan - urut dari atas
--    alat baca      tidak perlu dijalankan, aman kapan saja
SELECT urutan, golongan, berkas,
       CASE WHEN golongan = 'pembatalan'         THEN 'JANGAN JALANKAN - darurat saja'
            WHEN golongan = 'periksa'            THEN 'alat baca'
            WHEN diterapkan_pada IS NOT NULL     THEN 'sudah'
            ELSE                                      'BELUM' END AS status,
       diterapkan_pada, catatan
FROM sql_diterapkan
ORDER BY (CASE WHEN golongan='pembatalan' THEN 3
               WHEN golongan='periksa' THEN 2
               WHEN diterapkan_pada IS NULL THEN 0 ELSE 1 END), urutan;
