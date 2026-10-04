-- MIGRATION 029: Kalkulator LED - hitungan tersimpan di server.
--
-- Sebelumnya isian kalkulator LED hilang saat halaman ditutup; tidak ada
-- daftar hitungan lama yang bisa dibuka lagi. Kini satu baris = satu
-- hitungan (semua isian kalkulator) + ringkasan kecil untuk daftar.
--
-- RLS aktif TANPA policy, sama seperti 027/028: hanya route server
-- app/api/tools-team/led (service role, sesi diperiksa di server) yang
-- menyentuhnya. Semua yang masuk boleh membaca & membuka; mengubah &
-- menghapus hanya pembuat atau Admin/Full Access (yang lain menyimpan salinan).
--
-- Hanya menambah tabel; tidak ada data yang diubah.

create table if not exists public.tools_led_simpan (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (char_length(nama) between 1 and 120),
  data jsonb not null,
  ringkasan jsonb not null default '{}'::jsonb,
  dibuat_oleh uuid references public.users(id) on delete set null,
  dibuat_oleh_nama text not null default '',
  diubah_oleh_nama text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tools_led_simpan_diubah on public.tools_led_simpan (updated_at desc);

alter table public.tools_led_simpan enable row level security;
