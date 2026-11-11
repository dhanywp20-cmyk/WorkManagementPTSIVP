-- MIGRATION 069: AV Solution Tools - Single Line Diagram (SLD) tersimpan di server.
--
-- Pola sama dengan Desain 3D (027/028):
-- 1. tools_sld        dokumen SLD tim (nama, data JSON, versi, pembuat).
-- 2. tools_sld_versi  riwayat tiap simpan (v1, v2, ...). Baris riwayat tidak pernah diubah.
-- 3. request_sld      tautan OPSIONAL satu ruangan Request Design Project ke satu VERSI SLD
--                     (rujukan saja, data tidak disalin). Melepas tautan tidak menghapus SLD.
--
-- Data yang disimpan TIDAK berisi foto unggahan pengguna (dibuang di route server lewat
-- tanpaFoto); hanya teks, posisi, kabel dan jalur foto produk bawaan (/sld/produk/*.jpg).
-- Jadi ukuran per versi kecil (puluhan KB) - hemat penyimpanan & egress.
--
-- RLS aktif TANPA policy: hanya route server (service role) app/api/tools-team/sld dan
-- app/api/form-require-project/[id]/sld yang menyentuh tabel ini. Route memeriksa sesi,
-- pemilik / Admin, dan hak akses request lewat RLS project_requests milik pengguna.
--
-- Hanya menambah tabel & fungsi; tidak ada data lama yang diubah.

create table if not exists public.tools_sld (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (char_length(nama) between 1 and 120),
  data jsonb not null,
  versi integer not null default 1,
  jumlah_perangkat integer not null default 0,
  dibuat_oleh uuid references public.users(id) on delete set null,
  dibuat_oleh_nama text not null default '',
  diubah_oleh_nama text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  diarsipkan_at timestamptz
);

create index if not exists tools_sld_diubah on public.tools_sld (updated_at desc);
create index if not exists tools_sld_dibuat_oleh on public.tools_sld (dibuat_oleh);

create table if not exists public.tools_sld_versi (
  id uuid primary key default gen_random_uuid(),
  sld_id uuid not null references public.tools_sld(id) on delete cascade,
  versi integer not null check (versi >= 1),
  nama text not null,
  data jsonb not null,
  dibuat_oleh_nama text not null default '',
  created_at timestamptz not null default now(),
  unique (sld_id, versi)
);

create table if not exists public.request_sld (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.project_requests(id) on delete cascade,
  room_idx integer not null default 0 check (room_idx >= 0),
  sld_id uuid not null references public.tools_sld(id) on delete restrict,
  versi_id uuid not null references public.tools_sld_versi(id) on delete restrict,
  versi integer not null,
  dilampirkan_oleh uuid references public.users(id) on delete set null,
  dilampirkan_oleh_nama text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, sld_id)
);

create index if not exists request_sld_request on public.request_sld (request_id);
create index if not exists request_sld_sld on public.request_sld (sld_id);

alter table public.tools_sld enable row level security;
alter table public.tools_sld_versi enable row level security;
alter table public.request_sld enable row level security;

-- Simpan SLD + baris versinya dalam SATU transaksi dengan pemeriksaan versi
-- (optimistic locking): bila sudah diubah orang lain sejak dibuka, simpanan ditolak.
--   p_id null      -> SLD baru (v1)
--   p_id + p_versi -> perbarui; gagal 'konflik' bila versi saat ini != p_versi
create or replace function public.tools_simpan_sld(
  p_id uuid, p_versi integer, p_nama text, p_data jsonb, p_jumlah integer, p_user uuid, p_user_nama text
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
    insert into tools_sld (nama, data, jumlah_perangkat, dibuat_oleh, dibuat_oleh_nama, diubah_oleh_nama, versi, updated_at)
    values (p_nama, p_data, p_jumlah, p_user, p_user_nama, p_user_nama, 1, v_waktu)
    returning tools_sld.id into v_id;
    v_versi := 1;
  else
    update tools_sld s
       set nama = p_nama, data = p_data, jumlah_perangkat = p_jumlah, diubah_oleh_nama = p_user_nama,
           versi = s.versi + 1, updated_at = v_waktu, diarsipkan_at = null
     where s.id = p_id and s.versi = p_versi
    returning s.id, s.versi into v_id, v_versi;
    if v_id is null then
      raise exception 'konflik' using errcode = 'P0001';
    end if;
  end if;
  insert into tools_sld_versi (sld_id, versi, nama, data, dibuat_oleh_nama, created_at)
  values (v_id, v_versi, p_nama, p_data, p_user_nama, v_waktu);
  return query select v_id, v_versi, v_waktu;
end;
$$;

revoke all on function public.tools_simpan_sld(uuid, integer, text, jsonb, integer, uuid, text) from public, anon, authenticated;
grant execute on function public.tools_simpan_sld(uuid, integer, text, jsonb, integer, uuid, text) to service_role;
