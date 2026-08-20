-- ============================================================================
--  RLS lingkup project - tickets, reminders, project_requests, notifications
-- ============================================================================
--
--  JANGAN JALANKAN SEKALIGUS. Berkas ini disusun sebagai LIMA bagian yang
--  dijalankan pada hari yang berbeda, dan bagian 2 adalah simulasi yang tidak
--  mengubah apa pun. Urutannya bukan formalitas: tiga tabel di bawah adalah
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


-- ─── BAGIAN 2. SIMULASI - jalankan ini dulu, beberapa hari ──────────────────
--  TIDAK mengubah apa pun. Untuk tiap akun, hitung berapa baris yang akan
--  TERLIHAT dan berapa yang akan HILANG bila policy di bagian 3 dinyalakan.
--
--  Yang dicari: baris "hilang" yang bukan nol pada akun yang memang berhak.
--  Kalau ada, JANGAN lanjut - berarti ada jalur kepemilikan yang belum
--  tertampung di boleh_lihat_project(), dan menyalakan policy akan
--  menghilangkan pekerjaan orang dari layarnya.
--
--  Dijalankan dari SQL Editor (service_role), jadi ia membaca seluruh baris
--  lalu menilainya sendiri - bukan bergantung pada klaim JWT.
CREATE OR REPLACE FUNCTION simulasi_lingkup(nama_tabel text)
RETURNS TABLE (
  akun text, peran text, terlihat bigint, hilang bigint
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  kolom_dibuat text;
BEGIN
  kolom_dibuat := CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = nama_tabel AND column_name = 'created_by'
  ) THEN 't.created_by' ELSE 'NULL::text' END;

  RETURN QUERY EXECUTE format($f$
    SELECT
      u.full_name::text,
      u.role::text,
      count(*) FILTER (WHERE
        u.role IN ('admin','superadmin','team')
        OR t.sales_name = u.full_name
        OR %s = u.username
        OR (t.sales_division IS NOT NULL AND t.sales_division = ANY (
              CASE WHEN u.is_internal_sales IS NOT TRUE THEN ARRAY[]::text[]
                   ELSE ARRAY(
                     SELECT DISTINCT d FROM (
                       SELECT m.sales_division AS d FROM division_ivp_mappings m WHERE m.ivp_id = u.id
                       UNION SELECT u.sales_division
                     ) x WHERE d IS NOT NULL AND d <> ''
                   ) END))
      ),
      count(*) FILTER (WHERE NOT (
        u.role IN ('admin','superadmin','team')
        OR t.sales_name = u.full_name
        OR %s = u.username
        OR (t.sales_division IS NOT NULL AND t.sales_division = ANY (
              CASE WHEN u.is_internal_sales IS NOT TRUE THEN ARRAY[]::text[]
                   ELSE ARRAY(
                     SELECT DISTINCT d FROM (
                       SELECT m.sales_division AS d FROM division_ivp_mappings m WHERE m.ivp_id = u.id
                       UNION SELECT u.sales_division
                     ) x WHERE d IS NOT NULL AND d <> ''
                   ) END))
      ))
    FROM users u CROSS JOIN %I t
    GROUP BY u.full_name, u.role
    ORDER BY 4 DESC, 1
  $f$, kolom_dibuat, kolom_dibuat, nama_tabel);
END;
$$;

--  Jalankan satu per satu, dan baca kolom "hilang":
-- SELECT * FROM simulasi_lingkup('tickets');
-- SELECT * FROM simulasi_lingkup('reminders');
-- SELECT * FROM simulasi_lingkup('project_requests');


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


-- ─── Pemeriksaan akhir ──────────────────────────────────────────────────────
SELECT c.relname AS tabel,
       c.relrowsecurity AS rls_aktif,
       (SELECT count(*) FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS jumlah_policy
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('tickets', 'reminders', 'project_requests', 'notifications')
ORDER BY c.relname;
