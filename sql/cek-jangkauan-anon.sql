-- ============================================================================
-- CEK JANGKAUAN ANON KEY - apa saja yang bisa dibaca/ditulis dari browser
-- ============================================================================
--
-- HANYA MEMBACA. Tidak mengubah apa pun, aman dijalankan kapan saja.
--
-- Cara pakai: blok seluruh isi berkas ini, tempel ke Supabase SQL Editor, Run.
--
-- Sengaja disusun sebagai SATU query. Supabase SQL Editor hanya menampilkan
-- hasil query TERAKHIR bila satu berkas berisi beberapa query, jadi laporan
-- yang dipecah-pecah membuat sebagian besarnya jalan tanpa pernah terlihat.
--
-- Kenapa laporan ini perlu: NEXT_PUBLIC_SUPABASE_ANON_KEY ikut ter-bundle di
-- JavaScript yang dikirim ke setiap pengunjung. Siapa pun bisa membacanya dari
-- DevTools lalu memanggil PostgREST langsung, tanpa lewat aplikasi. Yang
-- menahan mereka BUKAN kode di halaman, melainkan RLS di basis data.
--
-- Baris paling atas adalah yang paling perlu diperhatikan.
-- ============================================================================

SELECT z.bagian, z.nama, z.keadaan, z.catatan
FROM (

  -- ── A. Empat tabel yang paling tidak boleh terbuka ────────────────────────
  -- Tidak pernah disentuh dari browser; seluruh pemakaiannya lewat route
  -- server. Jawaban yang benar untuk keempatnya adalah 'TERTUTUP'.
  SELECT
    1 AS urut,
    'A. Kredensial & sesi' AS bagian,
    t.tabel AS nama,
    CASE
      WHEN c.oid IS NULL                THEN 'TABEL TIDAK ADA'
      WHEN NOT c.relrowsecurity         THEN 'TERBUKA PENUH'
      WHEN p.jumlah > 0                 THEN 'TERBUKA POLICY'
      ELSE                                   'TERTUTUP'
    END AS keadaan,
    CASE
      WHEN c.oid IS NULL                THEN 'lewati'
      WHEN NOT c.relrowsecurity         THEN 'BAHAYA - jalankan sql/lock-credentials-rls.sql'
      WHEN p.jumlah > 0                 THEN 'BAHAYA - masih ada ' || p.jumlah || ' policy anon'
      ELSE                                   'aman'
    END AS catatan
  FROM (VALUES ('user_credentials'), ('user_sessions'),
               ('login_attempts'), ('password_reset_otps')) AS t(tabel)
  LEFT JOIN pg_class c
    ON c.relname = t.tabel AND c.relnamespace = 'public'::regnamespace
  LEFT JOIN LATERAL (
    SELECT count(*) AS jumlah FROM pg_policies pp
    WHERE pp.schemaname = 'public' AND pp.tablename = t.tabel
  ) p ON true

  UNION ALL

  -- ── B. Trigger pengunci kolom hak akses di users ──────────────────────────
  -- Tabel users WAJIB terbaca anon (dipakai hampir seluruh layar), jadi yang
  -- dijaga bukan tabelnya melainkan kolom yang menentukan hak: role,
  -- team_type, allowed_menus, allow_incentive_input, access_level. Tanpa
  -- trigger ini, siapa pun yang punya anon key bisa menaikkan dirinya sendiri
  -- jadi admin lewat satu permintaan PATCH.
  SELECT
    2,
    'B. Trigger users',
    COALESCE(t.tgname, '(belum ada trigger)'),
    CASE
      WHEN t.tgname IS NULL     THEN 'BELUM TERPASANG'
      WHEN t.tgenabled = 'D'    THEN 'NONAKTIF'
      ELSE                           'aktif'
    END,
    CASE
      WHEN t.tgname IS NULL     THEN 'BAHAYA - jalankan sql/lock-users-privileged-columns.sql'
      WHEN t.tgenabled = 'D'    THEN 'BAHAYA - trigger ada tapi dimatikan'
      ELSE                           'aman'
    END
  FROM (SELECT 1) x
  LEFT JOIN pg_trigger t
    ON t.tgrelid = 'public.users'::regclass AND NOT t.tgisinternal

  UNION ALL

  -- ── C. Seluruh tabel lain ─────────────────────────────────────────────────
  --   TERBUKA PENUH  RLS mati. Anon bisa baca & tulis seisi tabel. Ini keadaan
  --                  bawaan Postgres - tabel baru selalu begini, bukan sesuatu
  --                  yang perlu dilakukan seseorang.
  --   TERBUKA POLICY RLS aktif tapi semua policy-nya USING (true). Hasilnya
  --                  sama saja dengan terbuka penuh; terlihat aman di daftar
  --                  policy, padahal tidak menyaring apa pun.
  --   TERSARING      RLS aktif dengan policy bersyarat. Inilah yang dituju.
  --   TERTUTUP       RLS aktif tanpa policy. Hanya service_role yang masuk.
  SELECT
    CASE
      WHEN NOT c.relrowsecurity                                  THEN 3
      WHEN COALESCE(p.jumlah,0) > 0
       AND COALESCE(p.polos,0) = COALESCE(p.jumlah,0)            THEN 4
      WHEN COALESCE(p.jumlah,0) = 0                              THEN 6
      ELSE                                                            5
    END,
    'C. Tabel lain',
    c.relname,
    CASE
      WHEN NOT c.relrowsecurity                                  THEN 'TERBUKA PENUH'
      WHEN COALESCE(p.jumlah,0) = 0                              THEN 'TERTUTUP'
      WHEN COALESCE(p.polos,0) = COALESCE(p.jumlah,0)            THEN 'TERBUKA POLICY'
      ELSE                                                            'TERSARING'
    END,
    CASE
      WHEN NOT c.relrowsecurity     THEN 'anon bisa baca & tulis seisi tabel'
      WHEN COALESCE(p.jumlah,0) = 0 THEN 'hanya service_role yang bisa masuk'
      WHEN p.perintah IS NULL       THEN p.jumlah || ' policy, semuanya bersyarat'
      ELSE p.jumlah || ' policy; terbuka tanpa syarat untuk: ' || p.perintah
    END
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN LATERAL (
    SELECT count(*) AS jumlah,
           count(*) FILTER (WHERE pp.tanpa_syarat) AS polos,
           string_agg(DISTINCT pp.cmd, ', ' ORDER BY pp.cmd)
             FILTER (WHERE pp.tanpa_syarat) AS perintah
    FROM (
      SELECT cmd,
             COALESCE(qual, 'true') = 'true'
             AND COALESCE(with_check, 'true') = 'true' AS tanpa_syarat
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = c.relname
    ) pp
  ) p ON true
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT IN ('user_credentials','user_sessions',
                          'login_attempts','password_reset_otps')

) z
ORDER BY z.urut, z.nama;
