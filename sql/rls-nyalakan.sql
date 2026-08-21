-- ============================================================================
--  RLS - MENYALAKAN penyaringan di empat tabel tersibuk, satu perintah per hari
-- ============================================================================
--
--  Menjalankan berkas ini TIDAK menyalakan apa pun. Ia cuma membuat fungsi.
--  Penyalaannya Anda lakukan sendiri, satu tabel per hari:
--
--      SELECT nyalakan_rls('notifications');   -- hari 1, paling aman
--      SELECT nyalakan_rls('tickets');         -- hari 2
--      SELECT nyalakan_rls('reminders');       -- hari 3
--      SELECT nyalakan_rls('project_requests');-- hari 4
--
--  Membatalkan, berlaku seketika tanpa deploy ulang:
--
--      SELECT matikan_rls('tickets');
--
--  Melihat keadaan sekarang:
--
--      SELECT * FROM keadaan_rls();
--
--  SYARAT sebelum perintah pertama dijalankan:
--    1. sql/rls-project-progress.sql sudah jalan - berkas ini memakai
--       jwt_claim() dan jwt_full_name() dari sana.
--    2. sql/rls-lingkup-project.sql bagian 1 sudah jalan - lingkup_semua(),
--       lingkup_divisi(), jwt_user_id() berasal dari sana.
--    3. /api/auth/db-token-check menjawab siap:true.
--    4. Semua orang sudah logout-login sekali setelah deploy terakhir, supaya
--       tokennya benar-benar terbit.
--
--  SATU TABEL PER HARI, dan itu bukan formalitas. Keempatnya tabel yang dipakai
--  tim sepanjang hari; policy yang keliru membuat modulnya tampak KOSONG bagi
--  orang yang sedang bekerja, tanpa pesan galat apa pun. Kalau satu modul
--  bermasalah, yang perlu dibatalkan hanya satu tabel dan sebabnya sudah pasti.
--
--  Menulis sengaja dibiarkan terbuka di tahap ini. Yang ditutup adalah
--  PEMBACAAN lintas divisi lewat REST mentah. Menutup penulisan butuh
--  pemeriksaan terpisah atas alur assign, approve, dan mirror lintas
--  organisasi - dan mencampurnya ke sini akan membuat kegagalan sulit dilacak.
--
--  JEBAKAN yang membuat rancangan pertama berkas ini LUMPUH TOTAL, dan sudah
--  diperbaiki - ditulis di sini supaya tidak diulang:
--
--      CREATE POLICY tk_write ON tickets FOR ALL ... USING (true);
--
--  `FOR ALL` di Postgres mencakup SELECT, bukan cuma tulis. Dan policy
--  permissive di-OR satu sama lain. Jadi satu baris itu memberi izin baca ke
--  SEMUA orang untuk SEMUA baris, dan policy penyaringnya jadi tidak berarti
--  sama sekali - RLS menyala, lampunya hijau, tapi tidak menyaring apa pun.
--
--  Karena itu izin menulis di bawah ditulis per perintah: INSERT, UPDATE,
--  DELETE, TANPA satu pun `FOR ALL`. Baca dan tulis jadi tidak saling
--  mencampuri. Diuji: sebelum perbaikan keenam akun melihat seluruh tiket;
--  sesudahnya tiap akun hanya melihat miliknya.
-- ============================================================================


-- ─── Lingkup, kini lewat uuid DAN nama ──────────────────────────────────────
--
--  boleh_lihat_project() yang lama hanya mencocokkan NAMA. Itu memang jebakan
--  yang disebut audit: dua orang bisa bernama sama, dan satu orang bisa
--  tercatat dalam beberapa ejaan. Akibatnya nyata - tiket yang tercatat
--  "Rozaq" tidak akan pernah cocok dengan akun bernama "Muhammad Rozaq", dan
--  orangnya kehilangan seluruh pekerjaannya dari layar tanpa pesan apa pun.
--
--  Sekarang kolom uuid sudah terisi (sql/identitas-uuid*.sql), jadi jalur
--  pertama menunjuk ORANGNYA. Jalur nama TETAP ada dan belum boleh dicabut:
--  baris yang namanya ambigu sengaja tidak dipetakan, dan mencabut jalur nama
--  sekarang justru akan menghilangkan pekerjaan orang - persis kerusakan yang
--  sedang dihindari.
CREATE OR REPLACE FUNCTION boleh_lihat_baris(
  sales_uuid uuid, nama_sales text, divisi text, dibuat_oleh text
)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT
    lingkup_semua()
    --  jalur uuid - menunjuk orangnya, tidak peduli namanya ditulis bagaimana
    OR (sales_uuid IS NOT NULL AND sales_uuid = jwt_user_id())
    --  jalur nama - untuk baris lama yang uuid-nya masih kosong
    OR nama_sales  = jwt_full_name()
    OR dibuat_oleh = jwt_claim('username')
    OR (divisi IS NOT NULL AND divisi = ANY (lingkup_divisi()));
$$;

GRANT EXECUTE ON FUNCTION boleh_lihat_baris(uuid, text, text, text) TO anon, authenticated;


-- ─── Membersihkan policy lama sebelum memasang yang baru ───────────────────
--
--  Ini bukan kerapian, ini syarat supaya penyaringannya berfungsi.
--
--  Policy permissive di Postgres di-OR satu sama lain. Satu policy sisa yang
--  berbunyi USING (true) - dan tabel-tabel ini memang punya peninggalan
--  seperti itu - membatalkan SELURUH policy penyaring yang dipasang di
--  sampingnya. Hasilnya RLS menyala, lampunya hijau, tapi tidak menyaring apa
--  pun. Menambah policy tanpa membuang yang lama adalah cara paling mudah
--  merasa aman padahal tidak.
--
--  Yang dibuang DISEBUTKAN namanya, bukan dihapus diam-diam.
CREATE OR REPLACE FUNCTION buang_policy_lama(nama_tabel text)
RETURNS text
LANGUAGE plpgsql AS $fn$
DECLARE r record; dibuang text[] := ARRAY[]::text[];
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = nama_tabel
  LOOP
    EXECUTE format('DROP POLICY %I ON %I', r.policyname, nama_tabel);
    dibuang := dibuang || r.policyname;
  END LOOP;
  RETURN CASE WHEN array_length(dibuang,1) IS NULL THEN 'tidak ada policy lama'
              ELSE 'policy lama dibuang: ' || array_to_string(dibuang, ', ') END;
END $fn$;


-- ─── syarat_siap() - memastikan fondasinya ada SEBELUM menyalakan ──────────
--
--  Policy di bawah memanggil lima fungsi yang dibuat berkas LAIN: jwt_claim
--  dan jwt_full_name dari rls-project-progress.sql, lalu jwt_user_id,
--  lingkup_semua, dan lingkup_divisi dari rls-lingkup-project.sql.
--
--  Kalau salah satunya belum ada, penyalaan berhenti DI TENGAH: RLS sudah
--  menyala, policy lama sudah dibuang, tapi policy penggantinya gagal dibuat.
--  Tabelnya jadi tertutup rapat - pada tabel yang dipakai tim sepanjang hari.
--
--  Karena itu syaratnya ditanyakan langsung ke katalog basis data, bukan
--  dipercayakan pada catatan penerapan. Catatan bisa keliru; katalog tidak.
--
--  syarat_tipe() memeriksa hal yang berbeda dan sama pentingnya: apakah TIPE
--  kolomnya sesuai dengan yang diandaikan policy. Di basis data ini ada dua
--  kolom yang menyimpan id sebagai TEXT, bukan uuid - notifications.user_id
--  dan project_requests.requester_id. Membandingkannya dengan jwt_user_id()
--  yang bertipe uuid membuat CREATE POLICY gagal, dan gagalnya terjadi setelah
--  policy lama dibuang. Penjagaan keberadaan fungsi tidak menangkap ini:
--  fungsinya ada, tipenya yang tidak cocok.
CREATE OR REPLACE FUNCTION syarat_tipe()
RETURNS TABLE (kolom text, tipe_sekarang text, tipe_diharapkan text, cocok boolean)
LANGUAGE sql STABLE AS $$
  SELECT h.k, COALESCE(c.data_type, '(kolomnya tidak ada)'), h.t,
         COALESCE(c.data_type, '') = h.t
  FROM (VALUES
    ('notifications.user_id',            'text'),
    ('project_requests.requester_id',    'text'),
    ('tickets.sales_user_id',            'uuid'),
    ('tickets.assign_user_id',           'uuid'),
    ('reminders.sales_user_id',          'uuid'),
    ('reminders.assign_user_id',         'uuid'),
    ('reminders.internal_sales_id',      'uuid'),
    ('reminders.internal_sales_id_2',    'uuid'),
    ('project_requests.sales_user_id',   'uuid'),
    ('project_requests.assign_user_id',  'uuid'),
    ('project_requests.internal_sales_id','uuid')
  ) AS h(k, t)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name  = split_part(h.k, '.', 1)
   AND c.column_name = split_part(h.k, '.', 2);
$$;

CREATE OR REPLACE FUNCTION syarat_siap()
RETURNS TABLE (fungsi text, ada boolean)
LANGUAGE sql STABLE AS $$
  SELECT f, EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'public' AND p.proname = f)
  --  boleh_lihat_baris ikut diperiksa walau dibuat berkas INI juga. Sebabnya:
  --  kalau berkas ini dijalankan saat fondasinya belum ada, pembuatan fungsi
  --  itu GAGAL - Postgres memvalidasi badan fungsi SQL saat CREATE. Berkasnya
  --  tetap selesai, syarat_siap() nanti menjawab lengkap begitu fondasi
  --  dipasang, tapi boleh_lihat_baris-nya masih tidak ada, dan policy-nya akan
  --  gagal dibuat setelah policy lama terlanjur dibuang. Obatnya: jalankan
  --  ulang berkas ini setelah fondasinya lengkap.
  FROM unnest(ARRAY['jwt_claim','jwt_full_name','jwt_user_id',
                    'lingkup_semua','lingkup_divisi','boleh_lihat_baris']) AS f;
$$;


-- ─── nyalakan_rls / matikan_rls ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nyalakan_rls(nama_tabel text)
RETURNS text
LANGUAGE plpgsql AS $fn$
DECLARE bekas text; kurang text;
BEGIN
  IF nama_tabel NOT IN ('notifications','tickets','reminders','project_requests') THEN
    RAISE EXCEPTION 'Tabel % tidak dikenal. Pilihannya: notifications, tickets, reminders, project_requests.', nama_tabel;
  END IF;

  --  Diperiksa SEBELUM apa pun disentuh. Berhenti di sini tidak meninggalkan
  --  jejak sama sekali; berhenti setelah policy lama dibuang meninggalkan
  --  tabel yang tertutup bagi semua orang.
  SELECT string_agg(fungsi, ', ') INTO kurang FROM syarat_siap() WHERE NOT ada;
  IF kurang IS NOT NULL THEN
    RAISE EXCEPTION
      'Fondasi belum lengkap - fungsi ini belum ada: %. Jalankan '
      'sql/rls-project-progress.sql lalu sql/rls-lingkup-project.sql bagian 1, '
      'kemudian JALANKAN ULANG berkas ini. TIDAK ADA yang diubah.', kurang;
  END IF;

  --  Tipe kolom diperiksa juga. Policy yang membandingkan text dengan uuid
  --  gagal dibuat, dan gagalnya setelah policy lama dibuang.
  SELECT string_agg(kolom || ' (' || tipe_sekarang || ', diharapkan ' || tipe_diharapkan || ')', '; ')
    INTO kurang FROM syarat_tipe() WHERE NOT cocok;
  IF kurang IS NOT NULL THEN
    RAISE EXCEPTION
      'Tipe kolom tidak sesuai yang diandaikan policy: %. Policy-nya perlu '
      'disesuaikan lebih dulu. TIDAK ADA yang diubah.', kurang;
  END IF;

  bekas := buang_policy_lama(nama_tabel);

  IF nama_tabel = 'notifications' THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    --  Notifikasi milik satu orang dan tidak punya alur bercabang. Karena itu
    --  tabel ini didahulukan: ia pembuktian paling murah bahwa token identitas
    --  benar-benar sampai ke basis data.
    --  jwt_claim('sub'), BUKAN jwt_user_id(). Kolom notifications.user_id
    --  bertipe text di basis data ini, sementara jwt_user_id() mengembalikan
    --  uuid - Postgres tidak punya operator untuk membandingkan keduanya, dan
    --  CREATE POLICY-nya gagal. Kegagalannya terjadi SETELAH policy lama
    --  dibuang, jadi akibatnya bukan "tidak ada yang berubah" melainkan tabel
    --  notifikasi tertutup untuk semua orang.
    CREATE POLICY nt_own ON notifications FOR ALL TO anon, authenticated
      USING (user_id = jwt_claim('sub') OR lingkup_semua())
      WITH CHECK (true);
    RETURN 'notifications: RLS menyala, nt_own dipasang. ' || bekas;

  ELSIF nama_tabel = 'tickets' THEN
    ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tk_select ON tickets FOR SELECT TO anon, authenticated
      USING (
        boleh_lihat_baris(sales_user_id, sales_name, sales_division, created_by)
        --  Yang mengerjakan tiket harus melihat tiketnya sendiri.
        OR assign_user_id = jwt_user_id()
        OR assign_name    = jwt_full_name()
      );
    CREATE POLICY tk_insert ON tickets FOR INSERT TO anon, authenticated WITH CHECK (true);
    CREATE POLICY tk_update ON tickets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
    CREATE POLICY tk_delete ON tickets FOR DELETE TO anon, authenticated USING (true);
    RETURN 'tickets: RLS menyala, tk_select menyaring baca, menulis masih terbuka. ' || bekas;

  ELSIF nama_tabel = 'reminders' THEN
    ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
    CREATE POLICY rm_select ON reminders FOR SELECT TO anon, authenticated
      USING (
        boleh_lihat_baris(sales_user_id, sales_name, sales_division, created_by)
        --  Tanpa empat baris ini, handler kehilangan seluruh jadwalnya sendiri
        --  dan Sales Internal kehilangan yang harus ia review.
        OR assign_user_id      = jwt_user_id()
        OR assigned_to         = jwt_claim('username')
        OR internal_sales_id   = jwt_user_id()
        OR internal_sales_id_2 = jwt_user_id()
      );
    CREATE POLICY rm_insert ON reminders FOR INSERT TO anon, authenticated WITH CHECK (true);
    CREATE POLICY rm_update ON reminders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
    CREATE POLICY rm_delete ON reminders FOR DELETE TO anon, authenticated USING (true);
    RETURN 'reminders: RLS menyala, rm_select menyaring baca, menulis masih terbuka. ' || bekas;

  ELSIF nama_tabel = 'project_requests' THEN
    ALTER TABLE project_requests ENABLE ROW LEVEL SECURITY;
    --  project_requests tidak punya kolom created_by; penginputnya tersimpan
    --  sebagai requester_id (uuid), jadi kepemilikan dicocokkan lewat itu.
    CREATE POLICY pr_select ON project_requests FOR SELECT TO anon, authenticated
      USING (
        boleh_lihat_baris(sales_user_id, sales_name, sales_division, NULL)
        --  requester_id bertipe text di basis data ini, bukan uuid - sebab
        --  yang sama seperti notifications.user_id di atas.
        OR requester_id       = jwt_claim('sub')
        OR assign_user_id     = jwt_user_id()
        OR assign_name        = jwt_full_name()
        OR internal_sales_id  = jwt_user_id()
      );
    CREATE POLICY pr_insert ON project_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
    CREATE POLICY pr_update ON project_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
    CREATE POLICY pr_delete ON project_requests FOR DELETE TO anon, authenticated USING (true);
    RETURN 'project_requests: RLS menyala, pr_select menyaring baca, menulis masih terbuka. ' || bekas;

  END IF;
END $fn$;


CREATE OR REPLACE FUNCTION matikan_rls(nama_tabel text)
RETURNS text
LANGUAGE plpgsql AS $fn$
BEGIN
  IF nama_tabel NOT IN ('notifications','tickets','reminders','project_requests') THEN
    RAISE EXCEPTION 'Tabel % tidak dikenal.', nama_tabel;
  END IF;
  --  Policy-nya sengaja TIDAK dibuang, hanya RLS-nya dimatikan. Dengan begitu
  --  menyalakannya lagi tidak perlu menyusun ulang aturannya dari awal.
  EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', nama_tabel);
  RETURN nama_tabel || ': RLS dimatikan. Policy-nya tetap tersimpan, siap dinyalakan lagi.';
END $fn$;


-- ─── keadaan_rls() - siapa sudah menyala, siapa belum ───────────────────────
CREATE OR REPLACE FUNCTION keadaan_rls()
RETURNS TABLE (tabel text, rls_menyala boolean, jumlah_policy bigint, policy_terpasang text)
LANGUAGE sql STABLE AS $$
  SELECT c.relname::text,
         c.relrowsecurity,
         count(p.polname),
         COALESCE(string_agg(p.polname::text, ', ' ORDER BY p.polname), '-')
  FROM pg_class c
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
  WHERE c.relname IN ('notifications','tickets','reminders','project_requests')
  GROUP BY c.relname, c.relrowsecurity
  ORDER BY c.relrowsecurity, c.relname;
$$;


-- ─── LAPORAN ────────────────────────────────────────────────────────────────
--  Query terakhir, supaya sekali Run langsung terlihat keadaannya sekarang.
--  Semua baris `rls_menyala = false` berarti berkas ini baru menyiapkan alat,
--  dan belum ada satu pun tabel yang berubah perilakunya - memang begitu.
--
--  Baris `fondasi:` di atas menjawab pertanyaan yang menentukan: apakah kelima
--  fungsi yang dipakai policy sudah ada. Kalau ada yang BELUM ADA,
--  nyalakan_rls() akan menolak jalan - dan itu jawaban dari katalog basis
--  data, bukan dari catatan penerapan yang bisa keliru.
SELECT 'fondasi: ' || fungsi AS tabel,
       ada AS rls_menyala,
       NULL::bigint AS jumlah_policy,
       CASE WHEN ada THEN 'siap' ELSE 'BELUM ADA - jalankan berkas fondasinya dulu' END AS policy_terpasang
FROM syarat_siap()
UNION ALL
SELECT tabel, rls_menyala, jumlah_policy, policy_terpasang FROM keadaan_rls();
