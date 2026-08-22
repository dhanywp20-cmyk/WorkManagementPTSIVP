-- ============================================================================
--  TABEL users - menutup pembacaan & penulisan oleh pengunjung anonim
-- ============================================================================
--
--  SUDAH DITERAPKAN DI PRODUKSI. Berkas ini catatannya, sekaligus cara
--  memasang ulang bila diperlukan.
--
--  APA YANG DITEMUKAN
--
--  Policy lama satu-satunya di tabel ini:
--
--      Enable all for users    FOR ALL    USING (true)    WITH CHECK (true)
--
--  Diuji sebagai role anon TANPA token identitas - keadaan siapa pun yang
--  membuka halaman, karena anon key ikut terkirim ke peramban:
--
--      SELECT  -> 74 baris, lengkap dengan nama, username, dan nomor telepon
--      UPDATE  -> BISA mengubah nomor telepon orang lain
--      DELETE  -> BISA menghapus akun siapa pun
--
--  Username di platform ini adalah pengenal login, jadi daftar itu sekaligus
--  menyerahkan daftar sasaran yang lengkap untuk percobaan masuk.
--
--  Kenaikan hak (mengangkat diri jadi admin) sudah tertutup lebih dulu oleh
--  trigger guard_users_privileged_columns - ia memaksa role, team_type,
--  access_level, dan allowed_menus kembali ke nilai lama pada setiap UPDATE
--  yang datang dari anon/authenticated. Yang belum tertutup adalah tiga hal
--  di atas.
--
--  KENAPA jwt_claim('sub'), BUKAN role Postgres
--
--  Seluruh platform berjalan sebagai role `anon` dan membawa identitasnya di
--  klaim token (lihat lib/db-token.ts - klaim `role` sengaja 'anon'). Jadi
--  "sudah login" di sini berarti ADA klaim sub, bukan role = authenticated.
--  Memakai role Postgres sebagai syarat akan menutup platform untuk semua
--  orang sekaligus.
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for users" ON public.users;
DROP POLICY IF EXISTS users_baca   ON public.users;
DROP POLICY IF EXISTS users_daftar ON public.users;
DROP POLICY IF EXISTS users_ubah   ON public.users;
DROP POLICY IF EXISTS users_hapus  ON public.users;

--  Baca: butuh identitas. Seluruh isi tabel memang perlu terbaca oleh orang
--  yang sudah masuk - daftar assign, pohon organisasi, pemilih PIC, dan KPI
--  semuanya membacanya. Yang ditutup adalah pembacaan oleh yang belum masuk.
CREATE POLICY users_baca ON public.users
  FOR SELECT TO anon, authenticated
  USING (jwt_claim('sub') <> '');

--  Ubah: diri sendiri, atau orang dalam.
--  Diri sendiri  -> tombol simpan nomor telepon di halaman Profil.
--  Orang dalam   -> pemetaan atasan di User Management.
--  Kolom istimewa tetap dijaga trigger, jadi "orang dalam" di sini tidak
--  berarti bisa mengangkat siapa pun jadi admin.
CREATE POLICY users_ubah ON public.users
  FOR UPDATE TO anon, authenticated
  USING (id::text = jwt_claim('sub') OR lingkup_semua())
  WITH CHECK (id::text = jwt_claim('sub') OR lingkup_semua());

--  Hapus: hanya admin. Tombol hapus akun memang hanya ada di Admin Panel.
CREATE POLICY users_hapus ON public.users
  FOR DELETE TO anon, authenticated
  USING (jwt_claim('user_role') IN ('admin','superadmin'));

-- ── PENDAFTARAN AKUN BARU ───────────────────────────────────────────────────
--
--  SEMENTARA terbuka. Kode yang sedang berjalan di produksi masih menulis
--  baris users langsung dari peramban; menutupnya sekarang mematikan form
--  registrasi sampai versi baru ter-deploy.
--
--  Risikonya terbatas: trigger guard_users_privileged_columns memaksa setiap
--  INSERT dari anon menjadi role 'guest', team_type 'Pending Approval',
--  access_level 'guest', tanpa satu pun menu. Akun begitu tidak bisa berbuat
--  apa-apa sampai admin menyetujuinya.
--
--  SETELAH /api/auth/register ter-deploy, ganti baris ini dengan yang di
--  bawahnya:
CREATE POLICY users_daftar ON public.users
  FOR INSERT TO anon, authenticated WITH CHECK (true);

--  Versi final - jalankan setelah deploy:
--
--      DROP POLICY users_daftar ON public.users;
--      CREATE POLICY users_daftar ON public.users
--        FOR INSERT TO anon, authenticated
--        WITH CHECK (jwt_claim('sub') <> '');

-- ── Memeriksa keadaan ───────────────────────────────────────────────────────
--
--      SELECT policyname, cmd, coalesce(qual, with_check) AS syarat
--      FROM pg_policies WHERE schemaname='public' AND tablename='users'
--      ORDER BY cmd;
