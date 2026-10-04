-- MIGRATION 030: gambar resolusi tinggi per versi Desain 3D Ruang.
--
-- Pratinjau 480 px (kolom gambar) cukup untuk daftar, tapi pecah saat
-- dicetak di lembar Request Design / paket ZIP. gambar_hd (JPEG ±1600 px,
-- dibatasi di server) hanya diambil saat cetak/unduh, jadi daftar & halaman
-- request tetap ringan.
--
-- Hanya menambah kolom.

alter table public.tools_desain_ruang_versi add column if not exists gambar_hd text;

-- Diisi SEKALI tepat setelah versi dibuat; versi yang sudah punya gambar_hd
-- tidak bisa ditimpa (riwayat tetap tidak berubah). Hanya service_role.
create or replace function public.tools_simpan_desain_hd(p_desain uuid, p_versi integer, p_gambar_hd text)
returns void language sql security invoker set search_path = public, pg_temp as $$
  update tools_desain_ruang_versi set gambar_hd = p_gambar_hd where desain_id = p_desain and versi = p_versi and gambar_hd is null;
$$;
revoke all on function public.tools_simpan_desain_hd(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.tools_simpan_desain_hd(uuid, integer, text) to service_role;
