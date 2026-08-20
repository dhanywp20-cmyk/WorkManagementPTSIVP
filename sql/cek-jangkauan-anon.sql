-- ============================================================================
-- CEK JANGKAUAN ANON KEY - apa saja yang bisa dibaca/ditulis dari browser
-- ============================================================================
--
-- HANYA MEMBACA. Tidak mengubah apa pun, aman dijalankan kapan saja di
-- Supabase SQL Editor.
--
-- Kenapa perlu: NEXT_PUBLIC_SUPABASE_ANON_KEY ikut ter-bundle di JavaScript
-- yang dikirim ke setiap pengunjung. Siapa pun bisa membacanya dari DevTools
-- lalu memanggil PostgREST langsung, tanpa lewat aplikasi. Yang menahan mereka
-- BUKAN kode di halaman, melainkan RLS di basis data. Jadi pertanyaannya
-- bukan "apa yang dibuka aplikasi", tapi "apa yang dibuka basis data".
--
-- Cara baca hasilnya ada di bawah tiap bagian.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- BAGIAN 1 - Keadaan tiap tabel
-- ---------------------------------------------------------------------------
-- taraf:
--   TERBUKA PENUH  RLS mati. Anon bisa SELECT/INSERT/UPDATE/DELETE seisi
--                  tabel. Ini keadaan bawaan Postgres, bukan sesuatu yang
--                  perlu dilakukan seseorang - tabel baru selalu begini.
--   TERBUKA POLICY RLS aktif tapi policy-nya USING (true), jadi hasilnya sama
--                  saja dengan terbuka penuh. Terlihat aman di daftar policy,
--                  padahal tidak menyaring apa pun.
--   TERSARING      RLS aktif dengan policy bersyarat.
--   TERTUTUP       RLS aktif tanpa policy sama sekali. Hanya service_role
--                  yang bisa masuk - inilah yang diinginkan untuk tabel
--                  kredensial dan sesi.
SELECT
  c.relname AS tabel,
  c.relrowsecurity  AS rls_aktif,
  c.relforcerowsecurity AS rls_dipaksa,
  COALESCE(p.jumlah, 0) AS jumlah_policy,
  COALESCE(p.polos, 0)  AS policy_tanpa_syarat,
  CASE
    WHEN NOT c.relrowsecurity                      THEN 'TERBUKA PENUH'
    WHEN COALESCE(p.jumlah, 0) = 0                 THEN 'TERTUTUP'
    WHEN COALESCE(p.polos, 0) = COALESCE(p.jumlah, 0) THEN 'TERBUKA POLICY'
    ELSE 'TERSARING'
  END AS taraf
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (
  SELECT tablename,
         count(*) AS jumlah,
         count(*) FILTER (
           WHERE COALESCE(qual, 'true') IN ('true')
             AND COALESCE(with_check, 'true') IN ('true')
         ) AS polos
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
) p ON p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY
  CASE
    WHEN NOT c.relrowsecurity THEN 1
    WHEN COALESCE(p.polos, 0) = COALESCE(p.jumlah, 0) AND COALESCE(p.jumlah, 0) > 0 THEN 2
    WHEN COALESCE(p.jumlah, 0) = 0 THEN 4
    ELSE 3
  END,
  c.relname;


-- ---------------------------------------------------------------------------
-- BAGIAN 2 - Tabel yang PALING tidak boleh terbuka
-- ---------------------------------------------------------------------------
-- Keempat tabel ini tidak pernah disentuh dari browser; seluruh pemakaiannya
-- lewat route server. Karena itu jawabannya harus 'TERTUTUP'. Kalau bukan,
-- jalankan sql/lock-credentials-rls.sql - baca dulu syarat di kepalanya,
-- karena SUPABASE_SERVICE_ROLE_KEY wajib sudah terpasang lebih dulu.
SELECT
  t.tabel,
  COALESCE(c.relrowsecurity, false) AS rls_aktif,
  COALESCE((SELECT count(*) FROM pg_policies p
            WHERE p.schemaname = 'public' AND p.tablename = t.tabel), 0) AS jumlah_policy,
  CASE
    WHEN c.oid IS NULL                     THEN 'tabel tidak ada'
    WHEN NOT c.relrowsecurity              THEN 'BAHAYA - terbuka untuk anon'
    WHEN EXISTS (SELECT 1 FROM pg_policies p
                 WHERE p.schemaname = 'public' AND p.tablename = t.tabel)
                                           THEN 'BAHAYA - masih ada policy anon'
    ELSE 'aman'
  END AS penilaian
FROM (VALUES
  ('user_credentials'), ('user_sessions'), ('login_attempts'), ('password_reset_otps')
) AS t(tabel)
LEFT JOIN pg_class c
  ON c.relname = t.tabel
 AND c.relnamespace = 'public'::regnamespace;


-- ---------------------------------------------------------------------------
-- BAGIAN 3 - Kolom hak akses di tabel users
-- ---------------------------------------------------------------------------
-- users WAJIB terbaca anon (dipakai hampir seluruh layar), jadi yang dijaga
-- bukan tabelnya melainkan kolom yang menentukan hak: role, team_type,
-- allowed_menus, allow_incentive_input, access_level. Penjaganya trigger dari
-- sql/lock-users-privileged-columns.sql. Tanpa trigger itu, siapa pun yang
-- punya anon key bisa menaikkan dirinya sendiri jadi admin lewat satu
-- permintaan PATCH.
SELECT
  t.tgname AS nama_trigger,
  CASE WHEN t.tgenabled = 'D' THEN 'NONAKTIF' ELSE 'aktif' END AS keadaan
FROM pg_trigger t
WHERE t.tgrelid = 'public.users'::regclass
  AND NOT t.tgisinternal;
-- Hasil kosong = trigger belum terpasang. Jalankan
-- sql/lock-users-privileged-columns.sql.


-- ---------------------------------------------------------------------------
-- BAGIAN 4 - Isi policy yang tidak menyaring apa pun
-- ---------------------------------------------------------------------------
-- Daftar policy yang berbunyi USING (true). Semuanya sah selama basis data
-- belum punya cara mengenali pemanggil; begitu token identitas dari
-- lib/db-token.ts terpasang (cek lewat /api/auth/db-token-check), policy di
-- sini bisa diganti syarat sungguhan satu per satu, mis.
--     USING (sales_name = request.jwt.claims ->> 'full_name')
SELECT tablename AS tabel, policyname AS policy, cmd AS perintah, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND COALESCE(qual, 'true') = 'true'
  AND COALESCE(with_check, 'true') = 'true'
ORDER BY tablename, policyname;
