-- MIGRATION 071: AV Solution Tools - SLD katalog object buatan tim.
--
-- Object yang belum ada di katalog bawaan (lib/sld/katalog.ts) bisa ditambah tim sekali,
-- lalu muncul sama di semua akun. Foto disimpan KECIL (JPEG maks 400 px, dikompres di
-- browser, dibatasi 160 ribu karakter base64 di sini) dan disajikan lewat route
-- app/api/tools-team/sld/katalog/[id]/[versi] dengan cache browser permanen, jadi tiap
-- browser hanya mengunduh satu kali per versi foto (egress kecil).
--
-- Daftar katalog tidak pernah memuat kolom foto (cukup ada_foto), supaya ringan.
-- Hapus = lunak (dihapus_at), agar SLD lama yang memakai object tersebut tetap bergambar.
--
-- RLS aktif TANPA policy: hanya route server (service role) yang menyentuh tabel ini.
-- Route memeriksa sesi, pemilik / Admin, dan pimpinan (hanya lihat).
--
-- Hanya menambah satu tabel; tidak ada data lama yang diubah.

create table if not exists public.tools_sld_katalog (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (char_length(nama) between 1 and 80),
  kategori text not null default '' check (char_length(kategori) <= 80),
  kelompok text not null default 'sumber' check (kelompok in ('display', 'middleware', 'sumber', 'audio', 'kontrol', 'listrik')),
  ikon text not null default 'umum' check (char_length(ikon) between 1 and 40),
  model text not null default '' check (char_length(model) <= 120),
  port text[] not null default '{}' check (cardinality(port) <= 48),
  ket text not null default '' check (char_length(ket) <= 400),
  lebar numeric not null default 40 check (lebar between 12 and 200),
  foto text check (foto is null or char_length(foto) <= 160000),
  ada_foto boolean generated always as (foto is not null) stored,
  rasio numeric check (rasio is null or rasio between 0.1 and 10),
  versi integer not null default 1 check (versi >= 1),
  dibuat_oleh uuid references public.users(id) on delete set null,
  dibuat_oleh_nama text not null default '',
  diubah_oleh_nama text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dihapus_at timestamptz
);

create index if not exists tools_sld_katalog_aktif on public.tools_sld_katalog (kelompok, nama) where dihapus_at is null;
create index if not exists tools_sld_katalog_dibuat_oleh on public.tools_sld_katalog (dibuat_oleh);

alter table public.tools_sld_katalog enable row level security;
