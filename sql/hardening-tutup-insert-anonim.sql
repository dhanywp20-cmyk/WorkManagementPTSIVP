-- HARDENING (WORKMANAGEMENTHARDENINGPHASE) - menutup beberapa policy INSERT/
-- UPDATE yang WITH CHECK (true) tanpa syarat apa pun, ditemukan lewat query:
--
--   select tablename, policyname, cmd, qual, with_check from pg_policies
--   where schemaname='public' and (qual='true' or with_check='true');
--
-- Semua perbaikan di sini HANYA menambah syarat "harus sudah login"
-- (jwt_claim('sub') <> '') atau "harus mengaku sebagai diri sendiri"
-- (user_id = jwt_claim('sub')) - tidak mengubah satu pun alur bisnis yang
-- ada. Setiap satu sudah diverifikasi via simulasi role Postgres
-- (SET LOCAL ROLE anon + request.jwt.claims palsu, dibungkus transaksi
-- ROLLBACK) sebelum dan sesudah, memastikan: (a) percobaan anonim/spoofing
-- diblok, (b) pemakaian NYATA di kode (logAudit, notify-orang-lain,
-- processYearlyBatch) tetap jalan tanpa berubah.

-- 1) audit_trail: logAudit() (lib/audit.ts) SELALU mengisi user_id dari
--    currentUser.id milik pemanggil sendiri - dikunci ke situ, bukan cuma
--    "sudah login", supaya jejak audit tidak bisa dipalsukan atas nama orang lain.
DROP POLICY IF EXISTS "audit_trail_tambah" ON public.audit_trail;
CREATE POLICY "audit_trail_tambah" ON public.audit_trail
  FOR INSERT WITH CHECK (user_id = jwt_claim('sub'::text));

-- 2) activity_logs: tabel ini punya DUA policy INSERT yang tumpang tindih
--    dari dua era migrasi berbeda (al_tambah vs allow_insert_activity_logs).
--    RLS meng-OR-kan keduanya untuk perintah yang sama - menutup satu saja
--    percuma. al_tambah (gaya penamaan proyek yang konsisten dipakai di
--    tabel lain) dipertahankan & dikunci; yang lama dihapus supaya tidak ada
--    lagi kebijakan bayangan yang gampang terlewat saat audit berikutnya.
DROP POLICY IF EXISTS "al_tambah" ON public.activity_logs;
CREATE POLICY "al_tambah" ON public.activity_logs
  FOR INSERT WITH CHECK (jwt_claim('sub'::text) <> '');
DROP POLICY IF EXISTS "allow_insert_activity_logs" ON public.activity_logs;

-- 3) incentive_splits: baca sudah dikunci ketat lewat /api/incentive/splits
--    (lihat sql/lock-incentive-splits-rls.sql) - INSERT-nya SENGAJA tetap
--    longgar untuk siapa saja yang login (processYearlyBatch menulis
--    pembagian ke ORANG LAIN, bukan cuma penulisnya), tapi sebelumnya tanpa
--    syarat login SAMA SEKALI - siapa pun dg anon key bisa menyisipkan baris
--    "siapa dapat berapa" palsu ke tabel finansial paling sensitif di
--    platform ini.
DROP POLICY IF EXISTS "anon_insert_only" ON public.incentive_splits;
CREATE POLICY "anon_insert_only" ON public.incentive_splits
  FOR INSERT WITH CHECK (jwt_claim('sub'::text) <> '');

-- 4) users_daftar: policy INSERT lama (WITH CHECK true) yang sudah tidak
--    dipakai sejak pendaftaran (app/api/auth/register) & pembuatan user oleh
--    admin (app/api/admin/users) SAMA-SAMA pindah ke service-role. Dikonfirmasi
--    tidak ada satu pun call-site tersisa yang insert ke `users` lewat client
--    anon. Dihapus total (bukan sekadar dikunci) - tabel ini memang tidak
--    perlu terbuka untuk pengunjung anonim lagi, seperti yang sudah
--    didokumentasikan di komentar app/api/auth/register/route.ts sendiri.
DROP POLICY IF EXISTS "users_daftar" ON public.users;

-- 5) notifications.nt_own (FOR ALL, WITH CHECK true) - dipecah per perintah.
--    INSERT tetap longgar (perlu utk notify-orang-lain), tapi UPDATE kini
--    WITH CHECK yang SAMA dengan USING - pemilik baris (non-admin) tidak lagi
--    bisa memindahkan notifikasi miliknya ke user_id lain sambil mengganti
--    isi, yang sebelumnya bisa dipakai menanam notifikasi palsu/phishing di
--    kotak masuk orang lain.
DROP POLICY IF EXISTS "nt_own" ON public.notifications;

CREATE POLICY "nt_select" ON public.notifications
  FOR SELECT USING (user_id = jwt_claim('sub'::text) OR admin_atau_full_access());

CREATE POLICY "nt_insert" ON public.notifications
  FOR INSERT WITH CHECK (jwt_claim('sub'::text) <> '');

CREATE POLICY "nt_update" ON public.notifications
  FOR UPDATE
  USING (user_id = jwt_claim('sub'::text) OR admin_atau_full_access())
  WITH CHECK (user_id = jwt_claim('sub'::text) OR admin_atau_full_access());

CREATE POLICY "nt_delete" ON public.notifications
  FOR DELETE USING (user_id = jwt_claim('sub'::text) OR admin_atau_full_access());
