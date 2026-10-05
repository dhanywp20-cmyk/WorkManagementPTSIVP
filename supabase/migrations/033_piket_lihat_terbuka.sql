-- MIGRATION 033: Piket Showroom - bawaan: SEMUA akun yang punya menu melihat SEMUA catatan.
--
-- Permintaan pemilik: Sales / Marketing yang diberi menu Piket Showroom
-- melihat hanya 1 project (lingkup nama/divisinya sendiri) - padahal
-- seharusnya semuanya terbuka; yang dibatasi hanya mengisi, menyunting, dan
-- menghapus (hak itu pengaturan terpisah: users.piket_ubah, migrasi 032).
--
-- Sebelumnya bawaan piket_akses NULL = 'lingkup' (dibatasi) dan hanya
-- 'semua' yang membuka. Kini dibalik: NULL = terbuka (bawaan), 'lingkup' =
-- pilihan eksplisit dari Kelola Akun untuk akun yang memang harus dibatasi
-- ("Sesuai divisi"). Kebijakan ptd_baca TIDAK diubah - ia sudah memanggil
-- piket_akses_semua(), jadi cukup fungsi ini yang berubah.
--
-- Tidak ada data yang diubah. Hak tulis tidak tersentuh (032).
-- Mengembalikan bawaan lama: ganti ekspresi menjadi "u.piket_akses = 'semua'".

CREATE OR REPLACE FUNCTION public.piket_akses_semua()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT jwt_claim('sub') <> '' AND (
    public.lingkup_semua() OR COALESCE(
      (SELECT u.piket_akses IS DISTINCT FROM 'lingkup' FROM public.users u WHERE u.id::text = jwt_claim('sub')),
      false
    )
  );
$$;
