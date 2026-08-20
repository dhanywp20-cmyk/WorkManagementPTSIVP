-- ============================================================================
--  RLS form_reviews - memindahkan penyaringan dari aplikasi ke basis data
-- ============================================================================
--
--  Keadaan sekarang: tabel ini punya tiga policy dan KETIGANYA tidak menyaring
--  apa pun.
--
--    allow_all              ALL     public   USING (true)
--    anon_all_form_reviews  ALL     anon     USING (true)
--    guest_own_reviews      SELECT  public   USING (
--                                     (guest_fullname = klaim 'username')
--                                     OR true )
--
--  Yang ketiga perlu dibaca pelan-pelan. Sekilas ia terbaca sebagai aturan
--  "guest hanya melihat review miliknya", tapi ujungnya `OR true`, dan
--  X OR true selalu benar - syarat di sebelah kirinya tidak pernah menentukan
--  apa pun. Kolomnya pun keliru: guest_fullname berisi NAMA LENGKAP, sementara
--  yang dibandingkan klaim `username`. Jadi seandainya `OR true` dibuang saja,
--  syaratnya tetap tidak akan pernah cocok dan Form Review malah kosong untuk
--  semua guest.
--
--  Akibatnya penyaringan Form Review hari ini SEPENUHNYA dikerjakan aplikasi
--  (app/form-review/page.tsx menyaring guest_username atau sales_name).
--  Siapa pun yang memanggil PostgREST langsung dengan anon key melewatinya dan
--  membaca seluruh penilaian, termasuk penilaian atas orang lain.
--
--  ── Syarat sebelum dijalankan ──────────────────────────────────────────────
--  Buka Project Progress dan pastikan datanya masih tampil normal. Modul itu
--  sudah memakai klaim JWT, jadi kalau ia normal berarti token identitas benar
--  benar sampai ke basis data - dan itulah yang dipakai berkas ini.
--
--  Berkas ini memakai is_progress_admin(), jwt_claim(), dan jwt_full_name()
--  dari sql/rls-project-progress.sql. Ketiganya sudah ada; itulah yang membuat
--  tabel progress_* bervonis TERSARING.
--
--  ── Sesudah dijalankan, UJI TIGA AKUN ──────────────────────────────────────
--    admin        - harus melihat seluruh review
--    anggota tim  - harus melihat seluruh review
--    satu guest   - hanya review yang dia nilai + review atas dirinya sebagai
--                   sales, dan MASIH BISA menyimpan bintang
--
--  Kalau ada yang tidak beres, blok pembatalan ada di bawah dan berlaku
--  seketika tanpa deploy ulang.
-- ============================================================================

ALTER TABLE form_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all"             ON form_reviews;
DROP POLICY IF EXISTS "anon_all_form_reviews" ON form_reviews;
DROP POLICY IF EXISTS "guest_own_reviews"     ON form_reviews;
DROP POLICY IF EXISTS fr_baca                 ON form_reviews;
DROP POLICY IF EXISTS fr_tulis                ON form_reviews;

--  Terlihat oleh orang dalam PTS, oleh guest yang diminta menilai, dan oleh
--  sales yang namanya tercantum. Sama persis dengan penyaringan yang selama
--  ini dikerjakan halaman Form Review.
--
--  Perhatikan kolomnya: guest_username dibandingkan dengan klaim `username`,
--  sedangkan sales_name dengan klaim `full_name`. Itu bukan kelalaian - kedua
--  kolom itu memang menyimpan bentuk nama yang berbeda, dan tertukarnya
--  keduanya persis yang membuat guest_own_reviews tidak pernah cocok.
CREATE POLICY fr_baca ON form_reviews
  FOR SELECT TO anon, authenticated
  USING (
    is_progress_admin()
    OR guest_username = jwt_claim('username')
    OR sales_name     = jwt_full_name()
  );

--  Menulis: orang dalam PTS, dan guest pada barisnya sendiri - dialah yang
--  memberi bintang, jadi menutup tulis untuknya akan memacetkan gerbang
--  "belum memberi bintang, belum bisa membuat Reminder Schedule".
--
--  Sales yang namanya tercantum sengaja TIDAK ikut: ia boleh melihat penilaian
--  atas dirinya, bukan mengubahnya.
CREATE POLICY fr_tulis ON form_reviews
  FOR ALL TO anon, authenticated
  USING      (is_progress_admin() OR guest_username = jwt_claim('username'))
  WITH CHECK (is_progress_admin() OR guest_username = jwt_claim('username'));


-- ─── PEMBATALAN ─────────────────────────────────────────────────────────────
--  Mengembalikan keadaan semula. Berlaku seketika, tanpa deploy ulang.
--
--    DROP POLICY IF EXISTS fr_baca  ON form_reviews;
--    DROP POLICY IF EXISTS fr_tulis ON form_reviews;
--    CREATE POLICY "allow_all" ON form_reviews FOR ALL TO public
--      USING (true) WITH CHECK (true);


-- ─── Pemeriksaan ────────────────────────────────────────────────────────────
--  Harus menyisakan tepat dua policy: fr_baca (SELECT) dan fr_tulis (ALL).
SELECT policyname AS policy, cmd AS perintah, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'form_reviews'
ORDER BY policyname;
