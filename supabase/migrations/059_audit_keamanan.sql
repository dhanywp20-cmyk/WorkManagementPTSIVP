-- 059: hasil audit keamanan 30 Okt 2026.
--
-- 1. Password plaintext: 16 baris user_credentials (akun yang belum pernah login, panjang 4-23 karakter)
--    masih tersimpan polos. Di-hash di tempat dengan bcrypt pgcrypto (bf, cost 12 -> "$2a$12$...", diuji cocok
--    dengan bcryptjs di /api/auth/login) - pemiliknya tetap masuk dengan password yang sama. Jalur pembanding
--    plaintext di login dihapus di kode yang sama.
-- 2. Foto dokumentasi Form Review tidak pernah tersimpan: bucket review-photos tidak punya kebijakan INSERT,
--    jadi semua unggahan dari peramban ditolak (121 form review, 0 foto). Disamakan dengan ticket-photos.
-- 3. movement-files: kebijakan DELETE membolehkan SEMUA akun login (termasuk akun tamu/Sales) menghapus foto
--    surat & barang - aplikasi sendiri tidak pernah menghapus. Dicabut (hapus hanya lewat service role).
-- 4. activity_logs: catatan, foto & tautan berkas SEMUA ticket terbaca semua akun login, padahal tabel tickets
--    sendiri membatasi baris per sales / divisi. Sekarang: Admin / Team / pimpinan seperti biasa (lingkup_semua),
--    selain itu hanya log ticket yang memang boleh ia lihat (subkueri tickets ikut RLS tickets).
--
-- Kebijakan UPDATE reminder-photos (menimpa foto orang lain) dicabut di 060 SESUDAH kode yang tidak lagi
-- memakai upsert terpasang - supaya unggahan dari versi lama tidak gagal di sela deploy.

update public.user_credentials
   set password_hash = extensions.crypt(password_hash, extensions.gen_salt('bf', 12)),
       algorithm = 'bcrypt'
 where not (password_hash like '$2a$%' or password_hash like '$2b$%');

drop policy if exists "review_photos_tambah" on storage.objects;
create policy "review_photos_tambah" on storage.objects for insert
  with check (bucket_id = 'review-photos' and public.jwt_claim('sub') <> '');

drop policy if exists "Allow public delete" on storage.objects;

drop policy if exists "al_baca" on public.activity_logs;
create policy "al_baca" on public.activity_logs for select to anon, authenticated
  using (
    public.jwt_claim('sub') <> ''
    and (public.lingkup_semua() or exists (select 1 from public.tickets t where t.id = activity_logs.ticket_id))
  );
