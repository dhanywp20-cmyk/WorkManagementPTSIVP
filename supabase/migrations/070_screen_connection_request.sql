alter table public.tools_led_simpan add column if not exists svg_koneksi text;

create table if not exists public.request_screen_connection (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.project_requests(id) on delete cascade,
  room_idx integer not null check (room_idx >= 0),
  led_id uuid references public.tools_led_simpan(id) on delete set null,
  nama text not null check (char_length(nama) between 1 and 160),
  svg text not null check (char_length(svg) <= 3000000),
  sumber_diubah_at timestamptz,
  dilampirkan_oleh uuid references public.users(id) on delete set null,
  dilampirkan_oleh_nama text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, room_idx, led_id)
);

create index if not exists request_screen_connection_request_idx on public.request_screen_connection (request_id);

alter table public.request_screen_connection enable row level security;
