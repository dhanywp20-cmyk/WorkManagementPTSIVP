-- MIGRATION 028: versi Desain 3D Ruang + tautan ke Request Design Project.
--
-- 1. Versi. Setiap simpan ke server membuat baris riwayat baru di
--    tools_desain_ruang_versi (v1, v2, ...). Baris riwayat tidak pernah
--    diubah: yang ditautkan ke Request Design adalah VERSI tertentu, jadi
--    mengedit desain di Tools Team tidak diam-diam mengubah request yang
--    sudah memakainya.
--
-- 2. Tautan. request_desain_ruang menghubungkan satu ruangan sebuah request
--    (project_requests + room_idx) dengan satu versi desain. Data 3D TIDAK
--    disalin ke request - cukup rujukan ke baris versi. Ini TAMBAHAN di
--    samping unggahan file "Design 3D" (PDF) yang sudah ada; keduanya opsional.
--    Melepas tautan hanya menghapus baris ini, desainnya tetap di Tools Team.
--
-- 3. Arsip. Desain yang masih ditautkan tidak bisa dihapus permanen (FK
--    restrict); route server mengarsipkannya (diarsipkan_at) supaya request
--    lama tetap bisa menampilkan versi yang dipakainya.
--
-- RLS aktif TANPA policy di kedua tabel baru, sama seperti 027: hanya route
-- server (service role) yang menyentuhnya, dan route memeriksa hak akses
-- request dengan RLS project_requests milik pengguna itu sendiri.
--
-- Hanya menambah kolom/tabel; tidak ada data yang diubah selain mengisi v1
-- untuk desain yang sudah ada.

alter table public.tools_desain_ruang
  add column if not exists versi integer not null default 1,
  add column if not exists diarsipkan_at timestamptz;

create table if not exists public.tools_desain_ruang_versi (
  id uuid primary key default gen_random_uuid(),
  desain_id uuid not null references public.tools_desain_ruang(id) on delete cascade,
  versi integer not null check (versi >= 1),
  nama text not null,
  data jsonb not null,
  -- Ringkasan kecil untuk Request Design (ukuran ruang, daftar perangkat)
  -- supaya halaman request tidak perlu mengunduh data 3D penuh.
  ringkasan jsonb not null default '{}'::jsonb,
  -- Gambar pratinjau kecil (data URL JPEG, dibatasi di server).
  gambar text,
  dibuat_oleh_nama text not null default '',
  created_at timestamptz not null default now(),
  unique (desain_id, versi)
);

create table if not exists public.request_desain_ruang (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.project_requests(id) on delete cascade,
  room_idx integer not null default 0 check (room_idx >= 0),
  desain_id uuid not null references public.tools_desain_ruang(id) on delete restrict,
  versi_id uuid not null references public.tools_desain_ruang_versi(id) on delete restrict,
  versi integer not null,
  dilampirkan_oleh uuid references public.users(id) on delete set null,
  dilampirkan_oleh_nama text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Satu desain hanya sekali per request.
  unique (request_id, desain_id)
);

create index if not exists request_desain_ruang_request on public.request_desain_ruang (request_id);
create index if not exists request_desain_ruang_desain on public.request_desain_ruang (desain_id);

alter table public.tools_desain_ruang_versi enable row level security;
alter table public.request_desain_ruang enable row level security;

-- v1 untuk desain yang tersimpan sebelum migrasi ini.
insert into public.tools_desain_ruang_versi (desain_id, versi, nama, data, dibuat_oleh_nama, created_at)
select d.id, d.versi, d.nama, d.data, d.diubah_oleh_nama, d.updated_at
from public.tools_desain_ruang d
where not exists (select 1 from public.tools_desain_ruang_versi v where v.desain_id = d.id);

-- Simpan desain + baris versinya dalam SATU transaksi, dengan pemeriksaan
-- versi (optimistic locking): bila desain sudah diubah orang lain sejak
-- dibuka, simpanan ditolak alih-alih menimpa diam-diam.
--   p_id null      -> desain baru (v1)
--   p_id + p_versi -> perbarui; gagal 'konflik' bila versi saat ini != p_versi
create or replace function public.tools_simpan_desain(
  p_id uuid, p_versi integer, p_nama text, p_data jsonb, p_jumlah integer,
  p_ringkasan jsonb, p_gambar text, p_user uuid, p_user_nama text
) returns table (id uuid, versi integer, updated_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_id uuid;
  v_versi integer;
  v_waktu timestamptz := now();
begin
  if p_id is null then
    insert into tools_desain_ruang (nama, data, jumlah_benda, dibuat_oleh, dibuat_oleh_nama, diubah_oleh_nama, versi, updated_at)
    values (p_nama, p_data, p_jumlah, p_user, p_user_nama, p_user_nama, 1, v_waktu)
    returning tools_desain_ruang.id into v_id;
    v_versi := 1;
  else
    update tools_desain_ruang d
       set nama = p_nama, data = p_data, jumlah_benda = p_jumlah, diubah_oleh_nama = p_user_nama,
           versi = d.versi + 1, updated_at = v_waktu, diarsipkan_at = null
     where d.id = p_id and d.versi = p_versi
    returning d.id, d.versi into v_id, v_versi;
    if v_id is null then
      raise exception 'konflik' using errcode = 'P0001';
    end if;
  end if;
  insert into tools_desain_ruang_versi (desain_id, versi, nama, data, ringkasan, gambar, dibuat_oleh_nama, created_at)
  values (v_id, v_versi, p_nama, p_data, coalesce(p_ringkasan, '{}'::jsonb), p_gambar, p_user_nama, v_waktu);
  return query select v_id, v_versi, v_waktu;
end;
$$;

revoke all on function public.tools_simpan_desain(uuid, integer, text, jsonb, integer, jsonb, text, uuid, text) from public, anon, authenticated;
grant execute on function public.tools_simpan_desain(uuid, integer, text, jsonb, integer, jsonb, text, uuid, text) to service_role;
