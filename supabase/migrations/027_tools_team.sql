-- MIGRATION 027: Tools Team - desain ruang 3D tersimpan di server.
--
-- Sebelumnya desain hanya ada di localStorage perangkat pembuatnya: tidak
-- bisa dibuka rekan kerja dan hilang bila cache peramban dibersihkan.
--
-- RLS aktif TANPA policy: hanya route server app/api/tools-team/desain
-- (service role, sesi diperiksa di server lewat pastikanMasuk) yang menyentuh
-- tabel ini. Aturan aksesnya di route: semua yang masuk boleh membaca;
-- mengubah & menghapus hanya pembuat atau Admin/Full Access.
--
-- Referensi LED bersama TIDAK butuh tabel: disimpan sebagai satu baris
-- app_settings (key 'tools_team_referensi_led') lewat app/api/tools-team/
-- referensi-led.
--
-- Hanya menambah tabel; tidak ada data yang diubah.

create table if not exists public.tools_desain_ruang (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (char_length(nama) between 1 and 120),
  -- { ruang, benda } dari Desain3D. Gambar unggahan & model GLB impor tidak
  -- ikut (hanya ada di memori peramban).
  data jsonb not null,
  jumlah_benda integer not null default 0,
  dibuat_oleh uuid references public.users(id) on delete set null,
  dibuat_oleh_nama text not null default '',
  diubah_oleh_nama text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tools_desain_ruang_diubah on public.tools_desain_ruang (updated_at desc);
create index if not exists tools_desain_ruang_dibuat_oleh on public.tools_desain_ruang (dibuat_oleh);

alter table public.tools_desain_ruang enable row level security;
