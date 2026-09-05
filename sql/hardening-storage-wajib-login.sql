-- HARDENING (WORKMANAGEMENTHARDENINGPHASE) - storage.objects: 4 bucket
-- (ticket-photos, project-files, reminder-photos, movement-files) mengizinkan
-- INSERT/UPDATE/DELETE TANPA syarat login sama sekali - siapa pun yang punya
-- anon API key (ikut di setiap bundle browser) bisa upload/timpa/hapus file
-- di bucket ini walau tidak pernah login sama sekali ke platform.
--
-- Perbaikan MINIMAL: tambah syarat "harus login" (jwt_claim('sub') <> '') ke
-- masing-masing policy tulis, tanpa mengubah bucket mana yang dipakai fitur
-- mana. Semua upload/hapus NYATA di kode selalu terjadi dari user yang sudah
-- login (form-nya ada di balik autentikasi platform), jadi ini tidak
-- mengubah perilaku fitur yang ada - sudah diverifikasi lewat simulasi
-- (INSERT langsung ke storage.objects sbg role anon +/- klaim jwt, dibungkus
-- transaksi ROLLBACK): anonim diblok, user login tetap bisa upload ke
-- keempat bucket.
--
-- READ (SELECT) SENGAJA TIDAK disentuh - bucket-bucket ini bertanda `public`
-- di level bucket (storage.buckets.public = true), yang membuat SETIAP file
-- di dalamnya bisa diunduh oleh siapa saja yang tahu/menebak URL-nya, TANPA
-- peduli RLS storage.objects sama sekali (itu bekerja di jalur API publik
-- Supabase Storage, bukan jalur yang dijaga RLS ini). Menutup itu perlu
-- bucket di-set private + migrasi ke signed URL di setiap tempat yang
-- menampilkan file_url (banyak <img src>/<a href> di seluruh app) - risiko
-- regresi tinggi kalau dikerjakan tergesa, DIDOKUMENTASIKAN TERPISAH sebagai
-- temuan yang butuh persetujuan eksplisit, bukan ditebak/dikerjakan di sini.

DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'ticket-photos' AND jwt_claim('sub'::text) <> '');

DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
CREATE POLICY "Allow public uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'project-files' AND jwt_claim('sub'::text) <> '');

DROP POLICY IF EXISTS "Allow anon upload" ON storage.objects;
CREATE POLICY "Allow anon upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'reminder-photos' AND jwt_claim('sub'::text) <> '');

DROP POLICY IF EXISTS "Allow anon update" ON storage.objects;
CREATE POLICY "Allow anon update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'reminder-photos' AND jwt_claim('sub'::text) <> '');

DROP POLICY IF EXISTS "Allow public upload" ON storage.objects;
CREATE POLICY "Allow public upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'movement-files' AND jwt_claim('sub'::text) <> '');

DROP POLICY IF EXISTS "Allow public delete" ON storage.objects;
CREATE POLICY "Allow public delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'movement-files' AND jwt_claim('sub'::text) <> '');
