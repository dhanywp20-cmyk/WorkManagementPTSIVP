-- MIGRATION 077: berkas tersimpan AV Solution Tools (Kalkulator AV, Checklist Barang, Product Comparison).
--
-- Sebelumnya isian Kalkulator AV (8 sub), Checklist Barang dan draf Product Comparison hanya
-- ada di browser; tidak bisa disimpan, dibuka ulang, diganti (replace) atau disimpan sebagai
-- salinan oleh tim. Satu baris = satu berkas milik satu alat (kolom "alat").
--
-- RLS aktif TANPA policy (sama seperti 029): hanya route server app/api/tools-team/file
-- (service role, sesi & menu diperiksa di server) yang menyentuhnya. Semua yang punya menu
-- Tools Team boleh membaca & membuka; mengubah & menghapus hanya pembuat atau Admin/Full Access.
--
-- Hanya menambah tabel; tidak ada data yang diubah.

create table if not exists public.tools_file (
  id uuid primary key default gen_random_uuid(),
  alat text not null check (alat ~ '^[a-z][a-z0-9-]{1,39}$'),
  nama text not null check (char_length(nama) between 1 and 120),
  data jsonb not null,
  ringkasan text not null default '' check (char_length(ringkasan) <= 300),
  dibuat_oleh uuid references public.users(id) on delete set null,
  dibuat_oleh_nama text not null default '',
  diubah_oleh_nama text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tools_file_alat_diubah on public.tools_file (alat, updated_at desc);

alter table public.tools_file enable row level security;
