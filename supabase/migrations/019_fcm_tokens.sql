-- MIGRATION 019: token perangkat aplikasi Android (Firebase Cloud Messaging).
-- Diisi /api/push/fcm saat aplikasi dibuka dalam keadaan login; dibaca
-- lib/fcm-server.ts. RLS aktif tanpa policy: hanya service role.
create table if not exists public.fcm_tokens (
  token text primary key,
  user_id uuid not null,
  platform text not null default 'android',
  diperbarui_pada timestamptz not null default now()
);
create index if not exists fcm_tokens_user on public.fcm_tokens (user_id);
alter table public.fcm_tokens enable row level security;
revoke all on public.fcm_tokens from anon, authenticated;
