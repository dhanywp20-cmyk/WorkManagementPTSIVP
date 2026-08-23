-- ============================================================================
--  KUNCI TABEL LANJUTAN - menutup sisa tabel yang masih TERBUKA PENUH/POLICY
-- ============================================================================
--
--  Lanjutan dari sql/rapikan-policy.sql, sql/tutup-tabel-terlewat.sql, dan
--  sql/rls-nyalakan.sql. Ketiganya sudah menutup: users, app_settings,
--  audit_trail, form_reviews, notifications, tickets/reminders/
--  project_requests (baca saja), progress_actions, kpi_snapshot_members,
--  incentive_splits. Berkas ini mengerjakan SISANYA - dikumpulkan dari
--  scripts/enable-rls.sql (daftar 35 tabel aslinya) plus tabel yang baru
--  belakangan, sesudah dicek satu per satu ke kode aplikasi yang benar-benar
--  memakainya.
--
--  ATURAN BAWAAN yang dipakai berulang di bawah, kecuali disebut lain:
--    BACA   siapa saja yang sudah login (jwt_claim('sub') <> ''). Alasannya
--           ada di app/dashboard/_components/shared.ts: RESTRICTED_MENU_KEYS
--           cuma berisi 'project-progress' - HAMPIR SEMUA modul lain,
--           termasuk Learning Center, boleh diberikan admin ke akun guest/
--           sales. Mengunci baca ke lingkup_semua() akan mengunci akun yang
--           MEMANG diberi akses modul itu oleh admin sendiri.
--    TULIS  lingkup_semua() - admin, superadmin, atau team. Dipakai karena
--           tiap tombol simpan/hapus di modul-modul ini nyatanya memang hanya
--           muncul untuk peran itu (dicek satu per satu di kode, bukan
--           diasumsikan).
--
--  Dijalankan sebagai SATU transaksi supaya tidak ada keadaan setengah jadi.
--  Kalau satu bagian gagal, semuanya batal - tidak ada tabel yang tertutup
--  rapat sendirian karena bagian sebelumnya berhasil dan bagian ini gagal.
-- ============================================================================

BEGIN;


-- ─── 0. Pemeriksaan fondasi ─────────────────────────────────────────────────
--  lingkup_semua(), jwt_claim(), buang_policy_lama() dibuat berkas lain -
--  rls-project-progress.sql, rls-lingkup-project.sql, rls-nyalakan.sql. Kalau
--  salah satu belum ada, berhenti sekarang, bukan di tengah.
DO $$
DECLARE kurang text;
BEGIN
  SELECT string_agg(f, ', ') INTO kurang
  FROM unnest(ARRAY['jwt_claim','lingkup_semua','buang_policy_lama']) AS f
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = f
  );
  IF kurang IS NOT NULL THEN
    RAISE EXCEPTION 'Fondasi belum lengkap - fungsi belum ada: %. Jalankan sql/rls-project-progress.sql, sql/rls-lingkup-project.sql, dan sql/rls-nyalakan.sql lebih dulu.', kurang;
  END IF;
END $$;


-- ─── 1. Tabel mati - dikunci total, nol policy ──────────────────────────────
--  Ditelusuri lewat grep ke seluruh app/**, lib/**: TIDAK ADA satu pun
--  panggilan supabase.from(...) untuk ketiganya. RLS menyala tanpa policy
--  berarti hanya service_role yang bisa masuk - dan tidak ada route server
--  yang memakainya juga, jadi ini murni menutup jangkauan anon key tanpa
--  mengubah perilaku apa pun.
--
--  Aman dijalankan walau salah satu tabelnya sudah tidak ada - blok ini
--  melewatinya, bukan gagal.
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['incentive_disbursements','incentive_settings','ticket_support_assignment'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      PERFORM buang_policy_lama(tbl);
      RAISE NOTICE '%: RLS menyala, nol policy - tertutup total.', tbl;
    ELSE
      RAISE NOTICE '%: tabel tidak ada, dilewati.', tbl;
    END IF;
  END LOOP;
END $$;


-- ─── 2. activity_logs - jadi hanya-tambah, sama seperti audit_trail ─────────
--  sql/rapikan-policy.sql bagian 1 sudah membuang policy KEMBAR di tabel ini,
--  tapi sengaja MENYISAKAN satu: "Allow all activity_logs" (FOR ALL TO
--  public USING (true)). Itu argumennya waktu itu benar - membuangnya saat
--  itu akan menutup tabel sepenuhnya tanpa pengganti. Sekarang penggantinya
--  ditulis di sini.
--
--  supabase/migrations/005_immutable_activity_logs.sql sudah mendokumentasikan
--  rancangan yang dituju: anon INSERT + SELECT, TANPA UPDATE/DELETE - log
--  yang bisa ditulis ulang oleh yang dicatat bukan lagi bukti. Blok ini
--  menerapkannya, persis pola audit_trail yang sudah terbukti aman.
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('activity_logs');

CREATE POLICY al_tambah ON activity_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY al_baca ON activity_logs
  FOR SELECT TO anon, authenticated USING (true);


-- ─── 3. incentive_scheme_settings - skema pembagian insentif ────────────────
--  Satu baris JSON yang menentukan siapa dapat berapa persen (sql/incentive-
--  scheme-settings.sql). Baca dibiarkan terbuka: seluruh layar Incentive PTS
--  memerlukannya untuk menghitung rekap, termasuk akun non-admin yang cuma
--  melihat rekapnya sendiri. Tulis dikunci - ini rencana komentar di
--  sql/rapikan-policy.sql bagian 3a, diterapkan sungguhan di sini.
ALTER TABLE incentive_scheme_settings ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('incentive_scheme_settings');

CREATE POLICY iss_baca ON incentive_scheme_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY iss_tulis ON incentive_scheme_settings
  FOR ALL TO anon, authenticated
  USING (lingkup_semua()) WITH CHECK (lingkup_semua());


-- ─── 4. Tabel pemetaan - dibaca semua orang login, ditulis admin panel ──────
--  division_ivp_mappings, division_supervisor_mappings, user_supervisor_
--  mappings, guest_mappings: keempatnya dibaca dari banyak layar (routing
--  ticket/reminder/request, notifikasi, pencarian) selalu DISARING ke id/
--  divisi pemanggil sendiri lewat .eq(...) - jadi baca terbuka untuk siapa
--  saja yang login tidak menambah bocoran apa pun yang belum ada di baca per-
--  baris yang sudah dilakukan aplikasi. Tulisnya HANYA dari
--  app/dashboard/_components/modal-user.tsx (Admin Panel - User Management),
--  jadi dikunci ke lingkup_semua().
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['division_ivp_mappings','division_supervisor_mappings',
                              'user_supervisor_mappings','guest_mappings'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      PERFORM buang_policy_lama(tbl);
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (jwt_claim(''sub'') <> '''')',
        tbl || '_baca', tbl);
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO anon, authenticated USING (lingkup_semua()) WITH CHECK (lingkup_semua())',
        tbl || '_tulis', tbl);
    END IF;
  END LOOP;
END $$;


-- ─── 4b. Menambal kebocoran "nama kosong" pada fungsi lingkup ──────────────
--
--  TEMUAN dari pengujian di replika lokal, dan ini menyangkut policy yang
--  SUDAH BERJALAN DI PRODUKSI - bukan hanya berkas ini.
--
--  boleh_lihat_project() dan boleh_lihat_baris() menyaring lewat baris:
--
--      OR nama_sales = jwt_full_name()
--
--  Untuk pengunjung yang BELUM LOGIN, jwt_full_name() mengembalikan string
--  kosong - bukan NULL, karena jwt_claim() sudah membungkusnya COALESCE(...,'').
--  Jadi pada setiap baris yang sales_name-nya kebetulan '' (bukan NULL,
--  melainkan kosong - hal yang biasa terjadi pada data lama atau baris yang
--  dibuat lewat impor), syaratnya berbunyi '' = '' dan bernilai BENAR.
--
--  Akibatnya: siapa pun yang memegang anon key, TANPA login sama sekali,
--  bisa membaca baris-baris bernama kosong di tickets, reminders,
--  project_requests, dan piket_tamu_detail. Diuji di replika: anon melihat
--  tepat 1 dari 4 baris piket_tamu_detail - yang nama_sales-nya ''.
--
--  Tambalannya satu baris: haruskan ada identitas dulu. Ini pengetatan
--  MURNI - tidak ada pengguna sah yang kehilangan akses, karena setiap
--  pengguna sah selalu membawa klaim `sub`, dan route server memakai
--  service_role yang melewati RLS sepenuhnya.
CREATE OR REPLACE FUNCTION boleh_lihat_project(
  nama_sales text, divisi text, dibuat_oleh text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT jwt_claim('sub') <> '' AND (
    lingkup_semua()
    OR nama_sales   = jwt_full_name()
    OR dibuat_oleh  = jwt_claim('username')
    OR (divisi IS NOT NULL AND divisi = ANY (lingkup_divisi()))
  );
$$;

CREATE OR REPLACE FUNCTION boleh_lihat_baris(
  sales_uuid uuid, nama_sales text, divisi text, dibuat_oleh text
)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT jwt_claim('sub') <> '' AND (
    lingkup_semua()
    OR (sales_uuid IS NOT NULL AND sales_uuid = jwt_user_id())
    OR nama_sales  = jwt_full_name()
    OR dibuat_oleh = jwt_claim('username')
    OR (divisi IS NOT NULL AND divisi = ANY (lingkup_divisi()))
  );
$$;

GRANT EXECUTE ON FUNCTION boleh_lihat_project(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION boleh_lihat_baris(uuid, text, text, text) TO anon, authenticated;


-- ─── 5. tickets / reminders / project_requests - kunci HAPUS ────────────────
--  sql/rls-nyalakan.sql menyalakan RLS di ketiganya dengan baca tersaring
--  tapi INSERT/UPDATE/DELETE sengaja USING (true) - dan itu argumennya
--  sudah benar untuk UPDATE (alur assign/approve/routing punya banyak
--  pelaku sah berbeda per tahap, menutupnya butuh pemeriksaan sendiri di
--  luar cakupan berkas ini). Yang dikunci di sini HANYA hapus, dan hanya
--  karena tiap tombol Hapus di kode sudah punya penjaga peran yang jelas,
--  DICEK LANGSUNG dari kode aplikasi, dan ternyata BEDA per tabel:
--
--    tickets           deleteTicket() app/ticketing/page.tsx:330
--                       role !== 'admin' && role !== 'superadmin' -> ditolak
--    project_requests   app/form-require-project/page.tsx:563
--                       tombol Hapus hanya muncul untuk isSuperAdmin || isAdmin
--    reminders          app/reminder-schedule/page.tsx:3690, :3945
--                       tombol Hapus muncul untuk isAdmin || isManager, dan
--                       isManager = hasFullAccess(user) ATAU akun ini yang
--                       tercatat sebagai app_settings.manager_user_id
--                       (app/reminder-schedule/page.tsx:1383-1386)
--
--  reminders sengaja beda: seorang team member dengan toggle "Full Access"
--  aktif (lib/constants.ts hasFullAccess) memang diberi hak hapus reminder
--  oleh aplikasi, walau bukan admin. boleh_hapus_reminder() di bawah meniru
--  itu persis - bukan disamaratakan ke admin-saja, karena itu akan MENOLAK
--  hak yang sekarang sungguh dimiliki akun tersebut.
CREATE OR REPLACE FUNCTION boleh_hapus_reminder()
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT
    jwt_claim('user_role') IN ('admin', 'superadmin')
    OR jwt_claim('access_level') = 'full'
    OR EXISTS (
      --  value bertipe JSONB di produksi, berisi JSON string - bukan text.
      --  `s.value = jwt_claim('sub')` gagal dengan "operator does not exist:
      --  jsonb = text", dan `s.value::text` pun keliru karena hasilnya masih
      --  membawa tanda kutip ("f7d4..."). #>> '{}' mengambil isinya sebagai
      --  teks polos. Ketahuan saat diterapkan ke produksi: replika uji lokal
      --  memakai kolom text, jadi perbedaan tipe ini tidak muncul di sana.
      SELECT 1 FROM app_settings s
      WHERE s.key = 'manager_user_id' AND s.value #>> '{}' = jwt_claim('sub')
    );
$$;

GRANT EXECUTE ON FUNCTION boleh_hapus_reminder() TO anon, authenticated;

--  CATATAN: access_level BELUM ada di klaim token (lib/db-token.ts hanya
--  menulis sub, username, user_role, full_name, sales_division). Baris
--  jwt_claim('access_level') di atas karena itu SELALU kosong sampai
--  db-token.ts diperbarui menyertakannya - fungsi ini tetap benar untuk
--  admin/superadmin dan untuk override manager_user_id, hanya belum
--  mencakup toggle "Full Access" pada akun team biasa. Ditulis begini
--  (bukan dihilangkan) supaya begitu klaimnya ditambahkan, hak hapus ikut
--  berlaku tanpa perlu menyunting policy lagi.

--  ENABLE ROW LEVEL SECURITY di ketiganya WAJIB disebut di sini, walau
--  sql/rls-nyalakan.sql sudah menyalakannya di produksi lewat nyalakan_rls().
--
--  Kenapa: rancangan pertama berkas ini hanya membuat policy dan mengandalkan
--  RLS "kan sudah menyala". Diuji di replika lokal, hasilnya seluruh policy
--  DELETE di bawah TIDAK BERLAKU SAMA SEKALI - anon tetap bisa menghapus
--  tiket siapa pun - karena di replika itu RLS-nya memang belum menyala.
--  Policy pada tabel yang RLS-nya mati diabaikan Postgres tanpa satu pun
--  peringatan. Di produksi mungkin tidak terasa, tapi di basis data kedua
--  (lingkungan staging, tenant baru, restore dari backup) berkas ini akan
--  memasang penjagaan yang tampak benar di daftar policy padahal tidak
--  menjaga apa-apa. Satu baris ini yang membedakan.
ALTER TABLE tickets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_requests ENABLE ROW LEVEL SECURITY;

SELECT buang_policy_lama('tickets');
CREATE POLICY tk_select ON tickets FOR SELECT TO anon, authenticated
  USING (boleh_lihat_baris(sales_user_id, sales_name, sales_division, created_by)
         OR assign_user_id = jwt_user_id() OR assign_name = jwt_full_name());
CREATE POLICY tk_insert ON tickets FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY tk_update ON tickets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY tk_delete ON tickets FOR DELETE TO anon, authenticated
  USING (jwt_claim('user_role') IN ('admin','superadmin'));

SELECT buang_policy_lama('project_requests');
CREATE POLICY pr_select ON project_requests FOR SELECT TO anon, authenticated
  USING (boleh_lihat_baris(sales_user_id, sales_name, sales_division, NULL)
         OR requester_id = jwt_claim('sub') OR assign_user_id = jwt_user_id()
         OR assign_name = jwt_full_name() OR internal_sales_id = jwt_user_id());
CREATE POLICY pr_insert ON project_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pr_update ON project_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY pr_delete ON project_requests FOR DELETE TO anon, authenticated
  USING (jwt_claim('user_role') IN ('admin','superadmin'));

SELECT buang_policy_lama('reminders');
CREATE POLICY rm_select ON reminders FOR SELECT TO anon, authenticated
  USING (boleh_lihat_baris(sales_user_id, sales_name, sales_division, created_by)
         OR assign_user_id = jwt_user_id() OR assigned_to = jwt_claim('username')
         OR internal_sales_id = jwt_user_id() OR internal_sales_id_2 = jwt_user_id());
CREATE POLICY rm_insert ON reminders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY rm_update ON reminders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY rm_delete ON reminders FOR DELETE TO anon, authenticated
  USING (boleh_hapus_reminder());


-- ─── Pemeriksaan ────────────────────────────────────────────────────────────
SELECT c.relname AS tabel, c.relrowsecurity AS rls_aktif,
       COALESCE(string_agg(DISTINCT p.cmd, ', ' ORDER BY p.cmd), '(tidak ada policy)') AS perintah_tersaring
FROM pg_class c
LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN (
    'incentive_disbursements','incentive_settings','ticket_support_assignment',
    'activity_logs','incentive_scheme_settings',
    'division_ivp_mappings','division_supervisor_mappings',
    'user_supervisor_mappings','guest_mappings',
    'tickets','reminders','project_requests'
  )
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

COMMIT;


-- ─── PEMBATALAN ─────────────────────────────────────────────────────────────
--  Berlaku seketika, tanpa deploy ulang. Kalau satu modul bermasalah setelah
--  bagian ini, matikan RLS tabel itu SAJA:
--
--    ALTER TABLE <nama_tabel> DISABLE ROW LEVEL SECURITY;
--
--  Untuk mengembalikan hapus tickets/reminders/project_requests ke terbuka
--  tanpa mematikan RLS seluruh tabel (mis. baca tersaringnya tetap ingin
--  dipertahankan):
--
--    DROP POLICY tk_delete ON tickets;
--    CREATE POLICY tk_delete ON tickets FOR DELETE TO anon, authenticated USING (true);
--    DROP POLICY pr_delete ON project_requests;
--    CREATE POLICY pr_delete ON project_requests FOR DELETE TO anon, authenticated USING (true);
--    DROP POLICY rm_delete ON reminders;
--    CREATE POLICY rm_delete ON reminders FOR DELETE TO anon, authenticated USING (true);
