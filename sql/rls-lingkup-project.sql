-- ============================================================================
--  RLS lingkup project - tickets, reminders, project_requests, notifications
-- ============================================================================
--
--  Bagian 1 dan 2 AMAN dijalankan sekaligus: keduanya cuma membuat fungsi dan
--  menampilkan laporan, tanpa menyentuh satu policy pun. Bagian 3 yang
--  menyalakan policy, dan itu satu tabel per hari. Urutannya bukan formalitas: tiga tabel di bawah adalah
--  tabel paling sibuk di platform, dan policy yang keliru membuat modulnya
--  tampak KOSONG bagi orang yang sedang bekerja.
--
--  Syarat sebelum bagian mana pun dijalankan:
--    1. sql/rls-project-progress.sql sudah dijalankan dan Project Progress
--       terbukti masih normal. Berkas ini memakai fungsi jwt_claim() dan
--       jwt_full_name() dari sana.
--    2. /api/auth/db-token-check menjawab siap:true untuk admin.
--    3. Semua orang sudah logout-login ulang sekali sesudah deploy terakhir,
--       supaya tokennya benar-benar terbit.
--
--  Kalau salah satu belum terpenuhi, berhenti di sini.
--
--  Cara membatalkan ada di bagian 5.
-- ============================================================================


-- ─── BAGIAN 1. Fungsi lingkup (aman, belum menegakkan apa pun) ──────────────
--  Membuat fungsi saja tidak mengubah perilaku tabel mana pun. Bagian ini
--  boleh dijalankan kapan saja.
--
--  Aturannya disalin dari lib/project-scope.ts, dan HARUS tetap sama dengan
--  berkas itu. Kalau salah satunya berubah sendiri, aplikasi dan basis data
--  akan berbeda pendapat soal siapa boleh melihat apa - dan yang menang adalah
--  basis data, secara diam-diam.

--  Id user pemanggil, dari klaim `sub`. Dipakai untuk membaca profilnya
--  langsung dari tabel users alih-alih memercayai klaim yang bisa basi.
CREATE OR REPLACE FUNCTION jwt_user_id()
RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(jwt_claim('sub'), '')::uuid;
$$;

--  Orang dalam PTS melihat seluruh project: mereka memang menangani semua
--  divisi. Dibaca dari klaim, bukan dari tabel, supaya tidak ada query
--  tambahan di setiap baris yang diperiksa.
CREATE OR REPLACE FUNCTION lingkup_semua()
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT jwt_claim('user_role') IN ('admin', 'superadmin', 'team');
$$;

--  Divisi yang boleh dilihat seorang Sales Internal: yang dipetakan kepadanya
--  lewat division_ivp_mappings, ditambah divisinya sendiri - Sales Internal
--  selalu boleh melihat project divisinya sendiri walau belum dipetakan.
--  Sales biasa mendapat larik kosong.
CREATE OR REPLACE FUNCTION lingkup_divisi()
RETURNS text[]
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN u.is_internal_sales IS NOT TRUE THEN ARRAY[]::text[]
    ELSE ARRAY(
      SELECT DISTINCT d FROM (
        SELECT m.sales_division AS d
        FROM division_ivp_mappings m
        WHERE m.ivp_id = u.id
        UNION
        SELECT u.sales_division
      ) x
      WHERE d IS NOT NULL AND d <> ''
    )
  END
  FROM users u
  WHERE u.id = jwt_user_id();
$$;

--  Apakah satu baris boleh dilihat pemanggil.
--
--  Sengaja lebih longgar daripada penyaringan di aplikasi: yang ditutup di
--  sini adalah pengambilan data lintas divisi lewat REST mentah, bukan setiap
--  nuansa tampilan. Baris yang DIBUAT seseorang tetap terlihat olehnya walau
--  namanya tidak tercatat sebagai sales - lewat SBU, Sales Internal memang
--  mengajukan atas nama orang lain, dan menutupnya akan menghilangkan
--  pekerjaan mereka sendiri dari layar.
CREATE OR REPLACE FUNCTION boleh_lihat_project(
  nama_sales text, divisi text, dibuat_oleh text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT
    lingkup_semua()
    OR nama_sales   = jwt_full_name()
    OR dibuat_oleh  = jwt_claim('username')
    OR (divisi IS NOT NULL AND divisi = ANY (lingkup_divisi()));
$$;

GRANT EXECUTE ON FUNCTION
  jwt_user_id(), lingkup_semua(), lingkup_divisi(),
  boleh_lihat_project(text, text, text)
  TO anon, authenticated;


-- ─── BAGIAN 2. PEMERIKSAAN - tidak mengubah apa pun ────────────────────────
--  Menjawab satu pertanyaan: kalau policy di bagian 3 dinyalakan, ADAKAH orang
--  yang membuka modulnya lalu menemukannya KOSONG?
--
--  Yang dicari BUKAN "berapa baris yang hilang" - bagi Sales, kehilangan baris
--  milik orang lain memang tujuannya. Yang berbahaya adalah akun yang berakhir
--  melihat NOL baris padahal ia punya pekerjaan di sana.
--
--  Penyebab paling sering: nama tidak sama persis. Policy mencocokkan
--  sales_name dengan full_name akun. Kalau tiket tercatat atas nama "Dedi K."
--  sementara akunnya bernama "Dedi Kurnia", tidak ada yang cocok - dan orang
--  itu kehilangan seluruh pekerjaannya dari layar tanpa pesan apa pun.
--
--  Kolom `nama_mirip` menghitung baris yang menyebut nama depan akun tapi
--  tidak sama persis. Kalau `akan_terlihat` nol SEKALIGUS `nama_mirip` lebih
--  dari nol, itu tanda kuat ada ketidakcocokan penulisan nama - dan HARUS
--  dibereskan di data lebih dulu, sebelum policy dinyalakan.
DROP FUNCTION IF EXISTS simulasi_lingkup(text);

CREATE OR REPLACE FUNCTION periksa_lingkup(nama_tabel text)
RETURNS TABLE (tabel text, akun text, peran text, akan_terlihat bigint,
               nama_mirip bigint, penilaian text)
LANGUAGE plpgsql STABLE AS $fn$
DECLARE kolom_dibuat text;
BEGIN
  --  created_by tidak ada di semua tabel; kalau kolomnya tak dikenal, seluruh
  --  query gagal, jadi keberadaannya diperiksa dulu.
  kolom_dibuat := CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=nama_tabel AND column_name='created_by'
  ) THEN 't.created_by' ELSE 'NULL::text' END;

  RETURN QUERY EXECUTE format($f$
    WITH hitung AS (
      SELECT u.full_name::text AS akun, u.role::text AS peran,
        count(*) FILTER (WHERE
          u.role IN ('admin','superadmin','team')
          OR t.sales_name = u.full_name
          OR %s = u.username
          OR (t.sales_division IS NOT NULL AND t.sales_division = ANY (
                CASE WHEN u.is_internal_sales IS NOT TRUE THEN ARRAY[]::text[]
                     ELSE ARRAY(SELECT DISTINCT d FROM (
                       SELECT m.sales_division AS d FROM division_ivp_mappings m WHERE m.ivp_id=u.id
                       UNION SELECT u.sales_division) x WHERE d IS NOT NULL AND d <> '') END))
        ) AS terlihat,
        count(*) FILTER (WHERE
          t.sales_name IS DISTINCT FROM u.full_name
          AND t.sales_name ILIKE '%%' || split_part(u.full_name, ' ', 1) || '%%'
        ) AS mirip
      FROM users u CROSS JOIN %I t
      GROUP BY u.full_name, u.role, u.id, u.username, u.is_internal_sales, u.sales_division
    )
    SELECT %L::text, akun, peran, terlihat, mirip,
      CASE
        WHEN peran IN ('admin','superadmin','team') THEN 'orang dalam - lihat semua'
        WHEN terlihat > 0                           THEN 'aman'
        WHEN mirip > 0                              THEN 'PERIKSA - nol baris, tapi ada ' || mirip || ' baris bernama mirip'
        ELSE                                             'nol baris, dan memang tidak ada yang bernama mirip'
      END
    FROM hitung
    ORDER BY (CASE WHEN peran IN ('admin','superadmin','team') THEN 2
                   WHEN terlihat = 0 AND mirip > 0 THEN 0 ELSE 1 END), akun
  $f$, kolom_dibuat, nama_tabel, nama_tabel);
END;
$fn$;

--  Laporan untuk ketiga tabel sekaligus. Sengaja query TERAKHIR di berkas ini
--  supaya sekali Run langsung keluar tabelnya - Supabase SQL Editor hanya
--  menampilkan hasil query terakhir, jadi laporan yang ditulis sebagai
--  komentar akan tampak "Success. No rows returned".
--
--  Baris paling atas adalah yang paling perlu diperiksa.
--  UNION dibungkus subquery: ORDER BY di atas UNION hanya menerima nama kolom,
--  bukan ekspresi seperti LIKE.
SELECT * FROM (
  SELECT * FROM periksa_lingkup('tickets')
  UNION ALL
  SELECT * FROM periksa_lingkup('reminders')
  UNION ALL
  SELECT * FROM periksa_lingkup('project_requests')
) r
ORDER BY (penilaian LIKE 'PERIKSA%') DESC, tabel, akun;


-- ─── BAGIAN 3. Menyalakan policy - SATU TABEL PER HARI ──────────────────────
--  Jalankan blok yang SATU saja, lalu pakai platform seharian dengan beberapa
--  akun berbeda (admin, Sales Internal, Sales biasa, anggota tim). Baru
--  keesokan harinya lanjut ke tabel berikutnya. Kalau satu modul bermasalah,
--  yang perlu dibatalkan hanya satu tabel dan penyebabnya sudah pasti.

-- --- 3a. tickets ---
-- ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS tk_select ON tickets;
-- DROP POLICY IF EXISTS tk_write  ON tickets;
-- CREATE POLICY tk_select ON tickets FOR SELECT TO anon, authenticated
--   USING (boleh_lihat_project(sales_name, sales_division, created_by));
-- --  Menulis dibiarkan terbuka pada tahap ini. Menutupnya butuh pemeriksaan
-- --  terpisah atas alur assign, approve, dan mirror lintas organisasi.
-- CREATE POLICY tk_write ON tickets FOR ALL TO anon, authenticated
--   USING (true) WITH CHECK (true);

-- --- 3b. reminders ---
-- ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS rm_select ON reminders;
-- DROP POLICY IF EXISTS rm_write  ON reminders;
-- CREATE POLICY rm_select ON reminders FOR SELECT TO anon, authenticated
--   USING (
--     boleh_lihat_project(sales_name, sales_division, created_by)
--     --  Reminder juga terlihat oleh yang mengerjakannya dan oleh Sales
--     --  Internal yang ditunjuk mereviewnya. Tanpa dua baris ini, handler
--     --  kehilangan seluruh jadwalnya sendiri.
--     OR assigned_to        = jwt_claim('username')
--     OR internal_sales_id  = jwt_user_id()
--     OR internal_sales_id_2 = jwt_user_id()
--   );
-- CREATE POLICY rm_write ON reminders FOR ALL TO anon, authenticated
--   USING (true) WITH CHECK (true);

-- --- 3c. project_requests ---
-- ALTER TABLE project_requests ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS pr_select ON project_requests;
-- DROP POLICY IF EXISTS pr_write  ON project_requests;
-- --  project_requests tidak punya kolom created_by; penginputnya disimpan
-- --  sebagai requester_id (uuid), jadi kepemilikan dicocokkan lewat itu.
-- CREATE POLICY pr_select ON project_requests FOR SELECT TO anon, authenticated
--   USING (
--     boleh_lihat_project(sales_name, sales_division)
--     OR requester_id = jwt_user_id()
--     OR assign_name  = jwt_full_name()
--   );
-- CREATE POLICY pr_write ON project_requests FOR ALL TO anon, authenticated
--   USING (true) WITH CHECK (true);


-- ─── BAGIAN 4. notifications - paling sederhana, boleh didahulukan ──────────
--  Notifikasi milik satu orang dan tidak punya alur bercabang, jadi tabel ini
--  justru latihan paling aman untuk membuktikan bahwa token identitas benar
--  benar sampai ke basis data. Kerjakan ini SEBELUM bagian 3.
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS nt_own ON notifications;
-- CREATE POLICY nt_own ON notifications FOR ALL TO anon, authenticated
--   USING (user_id = jwt_user_id() OR lingkup_semua())
--   WITH CHECK (true);


-- ─── BAGIAN 5. PEMBATALAN ───────────────────────────────────────────────────
--  Kalau sebuah modul tampak kosong setelah policy dinyalakan, jalankan baris
--  untuk tabel itu. Berlaku seketika, tanpa perlu deploy ulang.
-- ALTER TABLE tickets          DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE reminders        DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE project_requests DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications    DISABLE ROW LEVEL SECURITY;


-- ─── Pemeriksaan sesudah bagian 3 ──────────────────────────────────────────
--  Sengaja BUKAN query aktif. Kalau ditaruh sebagai query terakhir, dialah yang
--  tampil di Supabase SQL Editor dan laporan di bagian 2 tidak pernah terlihat.
--  Jalankan terpisah setelah menyalakan policy:
--
--    SELECT c.relname AS tabel,
--           c.relrowsecurity AS rls_aktif,
--           (SELECT count(*) FROM pg_policies p
--            WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS jumlah_policy
--    FROM pg_class c
--    WHERE c.relnamespace = 'public'::regnamespace
--      AND c.relname IN ('tickets','reminders','project_requests','notifications')
--    ORDER BY c.relname;
