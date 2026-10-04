-- MIGRATION 024: Checklist Tools.
--
-- Checklist pekerjaan yang DIIMPOR admin (tempel teks/Markdown atau Excel),
-- lalu dibagikan lewat link ke tim lain untuk dicentang tanpa login.
--
-- RLS aktif tanpa policy: hanya service role (route server di
-- app/api/checklist/) yang menyentuh tabel-tabel ini. Admin lewat sesi yang
-- diperiksa di server, tim lain lewat share_token. Anon key di browser tidak
-- bisa membaca maupun menulis apa pun di sini.

create table if not exists public.checklist_daftar (
  id uuid primary key default gen_random_uuid(),
  judul text not null check (char_length(judul) between 1 and 200),
  keterangan text not null default '',
  sumber text not null default 'teks' check (sumber in ('teks', 'excel', 'duplikat')),
  share_token text unique,
  share_aktif boolean not null default false,
  dibuat_oleh uuid,
  dibuat_oleh_nama text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_bagian (
  id uuid primary key default gen_random_uuid(),
  daftar_id uuid not null references public.checklist_daftar(id) on delete cascade,
  judul text not null,
  catatan text not null default '',
  urutan integer not null default 0
);
create index if not exists checklist_bagian_daftar on public.checklist_bagian (daftar_id, urutan);

create table if not exists public.checklist_item (
  id uuid primary key default gen_random_uuid(),
  daftar_id uuid not null references public.checklist_daftar(id) on delete cascade,
  bagian_id uuid not null references public.checklist_bagian(id) on delete cascade,
  kelompok text not null default '',
  teks text not null check (char_length(teks) between 1 and 1000),
  catatan text not null default '',
  urutan integer not null default 0,
  selesai boolean not null default false,
  selesai_oleh text,
  selesai_pada timestamptz,
  selesai_lewat text check (selesai_lewat in ('admin', 'link'))
);
create index if not exists checklist_item_daftar on public.checklist_item (daftar_id, urutan);
create index if not exists checklist_item_bagian on public.checklist_item (bagian_id, urutan);

-- Siapa mencentang / membatalkan apa, kapan. Item yang dihapus admin tetap
-- meninggalkan jejaknya (item_id jadi null, teks_item tetap terbaca).
create table if not exists public.checklist_riwayat (
  id bigserial primary key,
  daftar_id uuid not null references public.checklist_daftar(id) on delete cascade,
  item_id uuid references public.checklist_item(id) on delete set null,
  teks_item text not null default '',
  aksi text not null check (aksi in ('centang', 'batal')),
  nama text not null,
  lewat text not null check (lewat in ('admin', 'link')),
  created_at timestamptz not null default now()
);
create index if not exists checklist_riwayat_daftar_waktu on public.checklist_riwayat (daftar_id, created_at desc);

alter table public.checklist_daftar  enable row level security;
alter table public.checklist_bagian  enable row level security;
alter table public.checklist_item    enable row level security;
alter table public.checklist_riwayat enable row level security;
revoke all on public.checklist_daftar  from anon, authenticated;
revoke all on public.checklist_bagian  from anon, authenticated;
revoke all on public.checklist_item    from anon, authenticated;
revoke all on public.checklist_riwayat from anon, authenticated;
