-- ============================================================================
--  MEREK & DIVISI SALES - menutup penulisan app_settings
-- ============================================================================
--
--  Merek platform (logo, nama, warna, latar) dan daftar divisi sales sekarang
--  disimpan di app_settings, dibaca lib/merek.ts. Dua baris:
--
--      key = 'merek'             -> JSON berisi field yang BERBEDA dari bawaan
--      key = 'sales_divisions'   -> JSON larik nama divisi
--
--  Keduanya tidak perlu diisi lebih dulu. Selama barisnya belum ada, platform
--  memakai nilai bawaan di lib/merek.ts - yang PERSIS sama dengan tampilan
--  selama ini. Barisnya lahir sendiri saat Admin Panel menekan Simpan.
--
--  YANG DIKERJAKAN BERKAS INI cuma satu: menutup PENULISAN app_settings.
--
--  Sebelum ini app_settings tidak punya RLS sama sekali. Artinya siapa pun yang
--  memegang anon key - termasuk yang belum login - bisa menimpa isinya. Dulu
--  taruhannya kecil (jadwal cron dan satu id manager). Sekarang tabel yang sama
--  menentukan nama, logo, dan warna yang dilihat semua orang di halaman login.
--
--  PEMBACAAN SENGAJA DIBIARKAN TERBUKA. Halaman login membaca merek SEBELUM
--  ada yang masuk, jadi tidak ada klaim identitas apa pun untuk diperiksa.
--  Menutup pembacaan akan membuat halaman login kehilangan logo dan namanya.
--
--  Menjalankan berkas ini TIDAK langsung menyalakan apa pun - ia membuat
--  fungsinya. Penyalaannya satu perintah:
--
--      SELECT kunci_app_settings();
--
--  Membatalkan, berlaku seketika tanpa deploy ulang:
--
--      SELECT buka_app_settings();
--
--  Melihat keadaan sekarang:
--
--      SELECT * FROM keadaan_app_settings();
--
--  Berkas ini JUGA membuat bucket penyimpanan `merek-files` untuk logo dan
--  gambar latar - lihat bagian 6 di bawah. Bagian itu berjalan sendiri saat
--  berkas dijalankan, tidak perlu perintah tambahan.
--
--  SYARAT: sql/rls-lingkup-project.sql sudah jalan - lingkup_semua() dari sana.
-- ============================================================================

-- 1. Siapa yang boleh menulis pengaturan

--  Yang menulis app_settings hari ini ada tiga: Admin Panel (merek, divisi,
--  manager_user_id) dan tombol jadwal reminder di Ticketing.
--
--  Tombol jadwal reminder itu terbuka untuk canApproveAssign, yang mencakup
--  Manager PTS - dan Manager PTS ber-role 'team', BUKAN 'admin'. Karena itu
--  syaratnya lingkup_semua() (admin/superadmin/team), bukan admin saja:
--  membatasinya ke admin akan membuat Manager PTS diam-diam gagal menyimpan
--  jadwal WA harian, tanpa pesan galat yang menjelaskan sebabnya.
--
--  Yang benar-benar ditutup adalah anon tanpa token, guest, dan sales.
CREATE OR REPLACE FUNCTION boleh_tulis_pengaturan()
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT lingkup_semua();
$$;

GRANT EXECUTE ON FUNCTION boleh_tulis_pengaturan() TO anon, authenticated;

-- 2. Menyalakan

CREATE OR REPLACE FUNCTION kunci_app_settings()
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  p record;
  dibuang text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.app_settings') IS NULL THEN
    RETURN 'app_settings tidak ada - tidak ada yang dikerjakan.';
  END IF;

  --  Policy lama dibuang lebih dulu dan namanya disebutkan. Policy permissive
  --  di-OR satu sama lain: satu policy lama yang berbunyi USING (true) akan
  --  membatalkan seluruh penyaringan di bawah, dan RLS akan tampak menyala
  --  padahal tidak menyaring apa pun.
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'app_settings'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.app_settings', p.policyname);
    dibuang := dibuang || p.policyname;
  END LOOP;

  ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

  --  Baca: terbuka. Halaman login membacanya tanpa token.
  CREATE POLICY as_baca ON public.app_settings
    FOR SELECT TO anon, authenticated USING (true);

  --  Tulis: per perintah, TANPA `FOR ALL`. `FOR ALL` di Postgres mencakup
  --  SELECT juga, jadi satu policy FOR ALL akan ikut mengatur pembacaan dan
  --  membuat baris di atas tidak berarti.
  CREATE POLICY as_insert ON public.app_settings
    FOR INSERT TO anon, authenticated WITH CHECK (boleh_tulis_pengaturan());
  CREATE POLICY as_update ON public.app_settings
    FOR UPDATE TO anon, authenticated
    USING (boleh_tulis_pengaturan()) WITH CHECK (boleh_tulis_pengaturan());
  CREATE POLICY as_delete ON public.app_settings
    FOR DELETE TO anon, authenticated USING (boleh_tulis_pengaturan());

  RETURN format(
    'app_settings terkunci. Policy lama dibuang: %s. Baca tetap terbuka, tulis butuh admin/superadmin/team.',
    CASE WHEN array_length(dibuang, 1) IS NULL THEN '(tidak ada)'
         ELSE array_to_string(dibuang, ', ') END);
END;
$$;

-- 3. Membatalkan

CREATE OR REPLACE FUNCTION buka_app_settings()
RETURNS text
LANGUAGE plpgsql AS $$
BEGIN
  IF to_regclass('public.app_settings') IS NULL THEN
    RETURN 'app_settings tidak ada.';
  END IF;
  ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;
  RETURN 'RLS app_settings DIMATIKAN. Policy-nya dibiarkan - menyalakan lagi cukup SELECT kunci_app_settings().';
END;
$$;

-- 4. Melihat keadaan

CREATE OR REPLACE FUNCTION keadaan_app_settings()
RETURNS TABLE(policy text, perintah text, syarat_baca text, syarat_tulis text)
LANGUAGE sql STABLE AS $$
  SELECT policyname::text, cmd::text, coalesce(qual, '-'), coalesce(with_check, '-')
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'app_settings'
  ORDER BY cmd, policyname;
$$;

-- 5. Membaca isi pengaturan yang berlaku

--  Berguna untuk memastikan apa yang benar-benar tersimpan, tanpa membuka
--  Admin Panel. Baris yang belum ada berarti nilainya masih bawaan.
CREATE OR REPLACE FUNCTION isi_pengaturan_merek()
RETURNS TABLE(kunci text, isi text)
LANGUAGE sql STABLE AS $$
  SELECT key::text, coalesce(value::text, '(kosong)')
  FROM public.app_settings
  WHERE key IN ('merek', 'sales_divisions')
  ORDER BY key;
$$;


-- 6. Bucket penyimpanan logo & gambar latar

--  Logo dan gambar latar diunggah dari Admin Panel, bukan diketik URL-nya.
--  Bucket ini publik: halaman login harus bisa memuat logo SEBELUM ada yang
--  masuk, jadi tidak ada identitas apa pun untuk diperiksa saat gambarnya
--  diminta.
--
--  Selama bucket ini belum ada, lib/merek.ts menjatuhkan unggahan ke
--  `project-files` yang sudah dipakai platform - jadi tombol Unggah tetap
--  berfungsi walau bagian ini belum dijalankan. Bucket sendiri tetap lebih
--  baik: berkas merek tidak tercampur dengan lampiran project, sehingga
--  audit storage bisa memisahkan keduanya.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'merek-files', 'merek-files', true,
  8 * 1024 * 1024,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

--  Membaca terbuka, menulis butuh identitas orang dalam - syarat yang sama
--  dengan menulis pengaturannya sendiri. Tanpa policy tulis, tombol Unggah
--  akan gagal diam-diam: RLS storage.objects menyala secara bawaan di
--  Supabase, jadi bucket tanpa policy = tidak ada yang bisa menaruh berkas.
DROP POLICY IF EXISTS merek_baca   ON storage.objects;
DROP POLICY IF EXISTS merek_tulis  ON storage.objects;
DROP POLICY IF EXISTS merek_ganti  ON storage.objects;
DROP POLICY IF EXISTS merek_hapus  ON storage.objects;

CREATE POLICY merek_baca ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'merek-files');

CREATE POLICY merek_tulis ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'merek-files' AND boleh_tulis_pengaturan());

CREATE POLICY merek_ganti ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'merek-files' AND boleh_tulis_pengaturan())
  WITH CHECK (bucket_id = 'merek-files' AND boleh_tulis_pengaturan());

CREATE POLICY merek_hapus ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'merek-files' AND boleh_tulis_pengaturan());
