-- ============================================================================
--  KUNCI TABEL LANJUTAN (4) - sapuan terakhir
-- ============================================================================
--
--  SUDAH DITERAPKAN DI PRODUKSI. Berkas ini catatannya.
--
--  Disusun dari penyisiran keadaan NYATA basis data sesudah berkas 1-3 masuk,
--  bukan dari daftar tabel di repo: satu query menanyakan tabel mana yang RLS-
--  nya masih mati atau masih punya policy tanpa syarat, lalu tiap sisanya
--  ditelusuri ke kode sebelum diputuskan.
--
--  Sesudah berkas ini, keadaan seluruh skema (60 tabel):
--      RLS mati                          0
--      tertutup total (nol policy)      12
--      tersaring penuh                  40
--      masih ada perintah tanpa syarat   8   <- semuanya INSERT/UPDATE, sengaja
--      PEMBACAAN masih terbuka           0   <- inti dari seluruh pekerjaan ini
-- ============================================================================


-- ─── 1. Tabel kerja & catatan internal ──────────────────────────────────────
--  identitas_calon / _sisa / _usulan adalah tabel SEMENTARA hasil
--  sql/identitas-uuid-usulan.sql - isinya nama dan id akun, jadi bukan bacaan
--  publik walau sifatnya sementara. sql_diterapkan adalah catatan berkas SQL
--  mana yang sudah dijalankan.
--
--  Keempatnya nol referensi di kode aplikasi. RLS menyala tanpa policy berarti
--  hanya service_role dan SQL Editor yang masuk - skrip identitas tetap
--  berjalan seperti biasa, karena ia memang dijalankan dari sana.
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['identitas_calon','identitas_sisa','identitas_usulan','sql_diterapkan'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      PERFORM buang_policy_lama(tbl);
    END IF;
  END LOOP;
END $$;


-- ─── 2. movement_logs - Unit Movement ───────────────────────────────────────
--  Dibaca luas: halaman Unit Movement, DUA dashboard KPI, dan Global Search.
--  Penyaringan per-orang sudah dikerjakan aplikasi (orangDalam di
--  app/unit-movement/page.tsx), jadi baca dibuka untuk semua yang login.
--
--  Menambah log boleh hampir semua peran - canAddLog di halaman itu mencakup
--  team, team_pts, marketing, BAHKAN guest. Mengunci INSERT ke lingkup_semua()
--  akan mematikan tombol yang hari ini dipakai guest, jadi INSERT mengikuti
--  keadaan sebenarnya: semua yang login.
--
--  Ubah & hapus hanya isAdmin (= hasFullAccess) -> lingkup_semua().
ALTER TABLE movement_logs ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('movement_logs');
CREATE POLICY ml_baca   ON movement_logs FOR SELECT TO anon, authenticated USING (jwt_claim('sub') <> '');
CREATE POLICY ml_tambah ON movement_logs FOR INSERT TO anon, authenticated WITH CHECK (jwt_claim('sub') <> '');
CREATE POLICY ml_ubah   ON movement_logs FOR UPDATE TO anon, authenticated
  USING (lingkup_semua()) WITH CHECK (lingkup_semua());
CREATE POLICY ml_hapus  ON movement_logs FOR DELETE TO anon, authenticated
  USING (lingkup_semua());


-- ─── 3. Log & pengaturan - BACA butuh identitas ─────────────────────────────
--  Ketiganya sebelumnya terbuka untuk pengunjung yang belum login sama sekali.
--  audit_trail dan activity_logs menyebut NAMA ORANG dan NILAI LAMA sebuah
--  data - itu bukan bacaan untuk siapa saja yang memegang anon key.
--
--  INSERT sengaja TETAP tanpa syarat, dan itu keputusan, bukan kelalaian:
--  pencatatan tidak boleh gagal hanya karena token pemanggilnya kebetulan
--  sedang kedaluwarsa - catatan yang bolong justru menghapus gunanya. Yang
--  penting keduanya tetap TIDAK BISA di-UPDATE maupun DELETE oleh siapa pun,
--  termasuk admin; itu yang membuatnya jadi bukti.
DROP POLICY IF EXISTS al_baca ON activity_logs;
CREATE POLICY al_baca ON activity_logs FOR SELECT TO anon, authenticated
  USING (jwt_claim('sub') <> '');

DROP POLICY IF EXISTS audit_trail_baca ON audit_trail;
CREATE POLICY audit_trail_baca ON audit_trail FOR SELECT TO anon, authenticated
  USING (jwt_claim('sub') <> '');

DROP POLICY IF EXISTS iss_baca ON incentive_scheme_settings;
CREATE POLICY iss_baca ON incentive_scheme_settings FOR SELECT TO anon, authenticated
  USING (jwt_claim('sub') <> '');


-- ─── 4. picket_holidays ──────────────────────────────────────────────────────
--  sql/tutup-tabel-terlewat.sql bagian 3 sengaja meninggalkan versi tanpa
--  syarat, dengan catatan: "JANGAN dijalankan sebelum memastikan tombol libur
--  di Piket Showroom memang hanya muncul untuk admin/team - kalau ternyata
--  anggota biasa juga memakainya, tombol itu berhenti bekerja tanpa pesan
--  galat."
--
--  Sudah diperiksa: toggleHoliday di app/picket-showroom/page.tsx dijaga
--  isAdmin, dan isAdmin di berkas itu = hasFullAccess(currentUser). Jadi
--  syaratnya terpenuhi dan versi terkunci itu diterapkan sekarang.
ALTER TABLE picket_holidays ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('picket_holidays');
CREATE POLICY ph_baca  ON picket_holidays FOR SELECT TO anon, authenticated USING (jwt_claim('sub') <> '');
CREATE POLICY ph_tulis ON picket_holidays FOR ALL TO anon, authenticated
  USING (lingkup_semua()) WITH CHECK (lingkup_semua());


-- ============================================================================
--  YANG SENGAJA DIBIARKAN TERBUKA, dan alasannya masing-masing
-- ============================================================================
--
--  Delapan tabel di bawah masih punya perintah tanpa syarat. Semuanya
--  INSERT/UPDATE - tidak satu pun PEMBACAAN. Dicatat di sini supaya
--  pemeriksaan berikutnya tahu mana yang memang keputusan dan mana yang
--  benar-benar terlewat.
--
--    activity_logs, audit_trail          INSERT
--        Pencatatan tidak boleh gagal. Lihat bagian 3 di atas.
--
--    incentive_splits, kpi_snapshot_members   INSERT
--        Sengaja hanya-tulis sejak awal (sql/lock-incentive-splits-rls.sql,
--        sql/tutup-tabel-terlewat.sql). Aplikasi tidak pernah membacanya
--        kembali lewat anon - rekapnya dibaca dari tabel lain atau lewat
--        route server ber-service_role.
--
--    tickets, reminders, project_requests     INSERT, UPDATE
--        Menutup ini butuh pemeriksaan tersendiri atas alur assign, approve,
--        internal review, routing supervisor, dan mirror lintas organisasi -
--        tiap tahap punya pelaku sah yang BERBEDA, dan satu syarat yang
--        keliru akan memacetkan alur kerja tim di tengah hari tanpa pesan
--        galat. Membacanya sudah tersaring; itu yang menutup pengambilan
--        data lintas divisi lewat REST mentah.
--
--    users                                     INSERT
--        Pendaftaran akun baru. Kode yang BERJALAN DI PRODUKSI masih menulis
--        baris users langsung dari peramban; menutupnya sekarang mematikan
--        form registrasi. Risikonya terbatas: trigger
--        guard_users_privileged_columns memaksa setiap INSERT dari anon jadi
--        role 'guest' tanpa satu pun menu.
--
--        SESUDAH cabang yang memuat /api/auth/register ter-deploy ke
--        produksi, jalankan:
--
--            DROP POLICY users_daftar ON public.users;
--            CREATE POLICY users_daftar ON public.users
--              FOR INSERT TO anon, authenticated
--              WITH CHECK (jwt_claim('sub') <> '');


-- ─── Pemeriksaan ────────────────────────────────────────────────────────────
--  baca_masih_terbuka HARUS 0. Kalau tidak, ada policy SELECT tanpa syarat
--  yang lolos - itu yang paling penting dijaga tetap nol.
SELECT
  count(*)                                                           AS total_tabel,
  count(*) FILTER (WHERE NOT c.relrowsecurity)                       AS rls_mati,
  count(*) FILTER (WHERE c.relrowsecurity AND jml = 0)               AS tertutup_total,
  count(*) FILTER (WHERE c.relrowsecurity AND jml > 0 AND polos = 0) AS tersaring_penuh,
  count(*) FILTER (WHERE c.relrowsecurity AND polos > 0)             AS sisa_tulis_terbuka,
  count(*) FILTER (WHERE c.relrowsecurity AND EXISTS (
      SELECT 1 FROM pg_policies q WHERE q.schemaname='public' AND q.tablename=c.relname
        AND q.cmd='SELECT' AND COALESCE(q.qual,'true')='true'))      AS baca_masih_terbuka
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN LATERAL (
  SELECT count(*) AS jml,
         count(*) FILTER (WHERE COALESCE(qual,'true')='true' AND COALESCE(with_check,'true')='true') AS polos
  FROM pg_policies WHERE schemaname='public' AND tablename=c.relname
) p ON true
WHERE n.nspname='public' AND c.relkind='r';
