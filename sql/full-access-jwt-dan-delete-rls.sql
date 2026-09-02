-- =====================================================================
-- Full Access ("access_level") TIDAK PERNAH SAMPAI KE DATABASE
-- =====================================================================
--
-- GEJALA: Manager PTS (atau siapa pun yang ditandai Full Access di Kelola
-- Akun) menekan tombol Hapus di Ticketing - tombolnya tampil (layar
-- memang mengizinkan), modal konfirmasi tertutup seolah berhasil, tapi
-- tiketnya MASIH ADA. Sebaliknya di Reminder Schedule tombol yang sama
-- terlihat bekerja - tapi cuma untuk SATU orang tertentu.
--
-- SEBAB AKAR: JWT yang diterbitkan saat login (lib/db-token.ts,
-- issueDbToken) TIDAK PERNAH menyertakan klaim `access_level` - kolomnya
-- dibaca dari database oleh route login/session, tapi payload token yang
-- dibangun tidak menyalinnya. Setiap kebijakan RLS yang memeriksa
-- jwt_claim('access_level') karena itu SELALU membaca string kosong,
-- terlepas dari apa yang disetel admin di Kelola Akun.
--
-- Baru ketahuan sekarang karena Reminder Schedule (satu-satunya modul yang
-- sempat mencoba memeriksa access_level di RLS - fungsi
-- boleh_hapus_reminder()) punya JALUR CADANGAN yang menutupinya: ID
-- pengguna tertunjuk manual di app_settings.manager_user_id (kebetulan
-- Dhany). Itu membuat Delete "kelihatan jalan" untuk SATU orang, dan
-- menyembunyikan bahwa cabang Full Access-nya mati total untuk semua
-- orang lain. Ticketing & Design Project (project_requests) tidak punya
-- jalur cadangan semacam itu - jadi di sana kegagalannya kelihatan.
--
-- PERBAIKAN 1 (WAJIB, di lib/db-token.ts): payload JWT sekarang ikut
-- menyertakan access_level. Efeknya LANGSUNG memperbaiki
-- boleh_hapus_reminder() tanpa perlu mengubah fungsi itu sama sekali -
-- cabang Full Access-nya sudah lama benar, cuma klaimnya yang belum
-- pernah terkirim.
--
-- PERBAIKAN 2 (di sini): dua tabel yang RLS DELETE-nya memang belum pernah
-- punya cabang Full Access sama sekali - cuma admin/superadmin.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_atau_full_access()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT jwt_claim('user_role') = ANY (ARRAY['admin', 'superadmin'])
      OR jwt_claim('access_level') = 'full';
$$;

-- tickets: DELETE dulu cuma admin/superadmin. Tombolnya (canManageTickets =
-- canAccessAccountSettings || hasFullAccess) sudah lama menjanjikan Full
-- Access bisa menghapus - RLS-nya yang belum menyusul. Kode klien juga
-- tidak memeriksa hasil delete() sama sekali (tidak ada .select(), tidak
-- ada pengecekan error/rows) - persis pola T-1: RLS menolak diam-diam, UI
-- tetap melapor sukses.
DROP POLICY IF EXISTS tk_delete ON public.tickets;
CREATE POLICY tk_delete ON public.tickets
  FOR DELETE TO anon, authenticated
  USING (public.admin_atau_full_access());

-- project_requests (Design Project): sama - DELETE dulu cuma admin/superadmin,
-- dan tombolnya di layar SEBELUMNYA memang belum ditawarkan ke Full Access
-- (isSuperAdmin || isAdmin saja) - jadi bukan silent-failure, tapi tetap
-- tidak sesuai kebijakan "Admin atau Full Access boleh hapus". Tombolnya
-- diperbaiki bersamaan di app/form-require-project/page.tsx (memakai
-- bisaKelolaRequest yang sudah ada, bukan syarat baru).
DROP POLICY IF EXISTS pr_delete ON public.project_requests;
CREATE POLICY pr_delete ON public.project_requests
  FOR DELETE TO anon, authenticated
  USING (public.admin_atau_full_access());

-- =====================================================================
-- DIVERIFIKASI (simulasi JWT langsung, akun Team biasa - BUKAN Dhany,
-- BUKAN admin - supaya membuktikan perbaikannya berlaku umum, bukan
-- kebetulan cocok untuk satu orang):
--
--   access_level='full'  -> admin_atau_full_access() = true,
--                            boleh_hapus_reminder()   = true
--   access_level='guest' -> admin_atau_full_access() = false  (kontrol)
-- =====================================================================
