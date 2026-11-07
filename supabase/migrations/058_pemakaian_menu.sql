-- 058 - Catatan pemakaian menu (siapa membuka modul apa) untuk tab Pemakaian di Analytics.
-- Ditulis & dibaca HANYA lewat /api/pemakaian (service role). Peramban tidak bisa menyentuhnya.
-- Satu baris = satu kali modul dibuka; peramban melewatkan modul yang sama dalam 10 menit
-- (lib/pemakaian.ts), jadi pindah-pindah menu tidak membanjiri tabel.

create table if not exists public.pemakaian_menu (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  modul text not null,
  sub text,
  created_at timestamptz not null default now()
);

create index if not exists pemakaian_menu_waktu on public.pemakaian_menu (created_at desc);
create index if not exists pemakaian_menu_modul_waktu on public.pemakaian_menu (modul, created_at desc);

alter table public.pemakaian_menu enable row level security;
revoke all on public.pemakaian_menu from anon, authenticated;
