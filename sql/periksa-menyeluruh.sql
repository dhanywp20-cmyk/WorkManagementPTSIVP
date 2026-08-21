-- ============================================================================
--  PERIKSA MENYELURUH - satu Run, satu tabel jawaban
-- ============================================================================
--
--  HANYA MEMBACA. Tidak membuat, mengubah, atau menghapus apa pun.
--
--  Menggabungkan empat pemeriksaan yang selama ini terpisah, karena Supabase
--  SQL Editor cuma menampilkan hasil query TERAKHIR - berkas berisi lima
--  SELECT hanya memperlihatkan satu, dan empat sisanya jalan tanpa terlihat.
--
--    A. FONDASI    keenam fungsi yang dipakai policy - ada atau belum
--    B. POLICY     setiap policy di empat tabel tersibuk, DAN apakah aturannya
--                  benar-benar menyaring atau sebenarnya membuka semua
--    C. RLS        tabel mana yang RLS-nya menyala
--    D. PENERAPAN  berapa berkas sql/ sudah ditandai diterapkan
--
--  Kolom `penilaian` adalah yang perlu dibaca. Baris yang perlu ditindak
--  diurutkan paling atas.
-- ============================================================================

SELECT bagian, hal, nilai, penilaian FROM (

  -- ─── A. FONDASI ───────────────────────────────────────────────────────────
  SELECT 1 AS urut, 'A. FONDASI' AS bagian, f AS hal,
         CASE WHEN ada THEN 'ada' ELSE 'TIDAK ADA' END AS nilai,
         CASE WHEN ada THEN 'siap'
              ELSE 'BELUM ADA - nyalakan_rls() akan menolak jalan' END AS penilaian
  FROM (
    SELECT f, EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                       WHERE n.nspname = 'public' AND p.proname = f) AS ada
    FROM unnest(ARRAY['jwt_claim','jwt_full_name','jwt_user_id',
                      'lingkup_semua','lingkup_divisi','boleh_lihat_baris']) AS f
  ) a

  UNION ALL

  -- ─── B. POLICY ────────────────────────────────────────────────────────────
  --  Policy permissive di-OR satu sama lain. Jadi SATU policy yang aturannya
  --  berbunyi `true` - atau berakhir `OR true` - membatalkan seluruh policy
  --  penyaring di tabel yang sama. Yang dicari di sini bukan "ada policy atau
  --  tidak", melainkan "adakah policy yang membuka semuanya".
  SELECT 2, 'B. POLICY', tablename || ' / ' || policyname || ' (' || cmd || ')',
         left(COALESCE(qual::text, '(tanpa USING)'), 90),
         CASE
           WHEN cmd = 'INSERT' THEN 'INSERT tidak punya USING - wajar'
           WHEN qual IS NULL THEN 'tanpa USING - tidak menyaring baca'
           WHEN btrim(qual::text) = 'true' THEN 'MEMBUKA SEMUA - membatalkan penyaring di tabel ini'
           WHEN qual::text ~* '(^|[^[:alnum:]_])or[[:space:]]+true([^[:alnum:]_]|$)'
                THEN 'BERAKHIR OR TRUE - terlihat menyaring, sebenarnya tidak'
           ELSE 'menyaring'
         END
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('tickets','reminders','project_requests','notifications','form_reviews')

  UNION ALL

  -- ─── C. RLS ───────────────────────────────────────────────────────────────
  SELECT 3, 'C. RLS', c.relname::text,
         CASE WHEN c.relrowsecurity THEN 'menyala' ELSE 'mati' END,
         CASE WHEN NOT c.relrowsecurity THEN 'RLS mati - anon key menjangkau seluruh isi tabel'
              WHEN NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
                   THEN 'menyala TANPA policy - tabel tertutup untuk semua'
              ELSE 'menyala, lihat bagian B untuk isi aturannya' END
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('tickets','reminders','project_requests','notifications','form_reviews')

  UNION ALL

  -- ─── D. PENERAPAN ─────────────────────────────────────────────────────────
  --  Tabel sql_diterapkan belum tentu ada - urutan-penerapan.sql mungkin belum
  --  pernah dijalankan di basis data ini. Menjaganya dengan to_regclass di
  --  dalam CASE TIDAK cukup: Postgres mem-parse dan merencanakan seluruh query
  --  sebelum menjalankannya, jadi menyebut nama tabel yang tidak ada sudah
  --  gagal di tahap perencanaan - cabang CASE-nya tidak pernah sempat dilewati.
  --
  --  query_to_xml menerima query sebagai TEKS, jadi isinya baru disusun saat
  --  baris itu benar-benar dievaluasi. Itu satu-satunya cara menanyakan tabel
  --  yang mungkin tidak ada tanpa membuat fungsi bantu - dan berkas ini memang
  --  tidak boleh membuat apa pun.
  --
  --  xpath-nya menunjuk NAMA KOLOM ('//c/text()'), bukan '//text()'. Yang
  --  kedua ikut menangkap spasi indentasi di dalam XML-nya, dan [1] justru
  --  memilih spasi itu - hasilnya baris kosong yang terlihat seperti "tidak
  --  ada data" padahal datanya ada. tableforest=false supaya bungkusnya satu
  --  <table>, bukan sederet <row> lepas.
  SELECT 4, 'D. PENERAPAN', 'catatan sql_diterapkan',
         CASE WHEN to_regclass('public.sql_diterapkan') IS NULL THEN 'tabelnya belum ada'
              ELSE COALESCE((xpath('//c/text()', query_to_xml(
                     'SELECT count(*) FILTER (WHERE diterapkan_pada IS NOT NULL) || '' dari '''
                     || ' || count(*) || '' berkas ditandai'' AS c FROM sql_diterapkan',
                     false, false, '')))[1]::text, '?') END,
         CASE WHEN to_regclass('public.sql_diterapkan') IS NULL
              THEN 'jalankan sql/urutan-penerapan.sql lalu sql/tandai-produksi.sql'
              ELSE COALESCE((xpath('//c/text()', query_to_xml(
                     'SELECT ''masih menunggu: '' || string_agg(berkas, '', '' ORDER BY urutan) AS c'
                     || ' FROM sql_diterapkan WHERE diterapkan_pada IS NULL'
                     || ' AND golongan NOT IN (''periksa'',''pembatalan'')',
                     false, false, '')))[1]::text, 'semuanya sudah ditandai') END

) r
ORDER BY
  --  yang perlu ditindak naik ke atas
  (penilaian LIKE 'MEMBUKA SEMUA%' OR penilaian LIKE 'BERAKHIR OR TRUE%'
   OR penilaian LIKE 'BELUM ADA%' OR penilaian LIKE 'RLS mati%'
   OR penilaian LIKE 'menyala TANPA policy%') DESC,
  urut, hal;
