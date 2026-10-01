-- MIGRATION 023: log & batas pemakaian AI per user (Asisten, draf Daily Report).
-- Kuota Gemini gratis terbatas per menit & per hari untuk SATU token bersama;
-- tanpa batas per user, satu orang bisa menghabiskannya untuk seluruh tim.
-- RLS aktif tanpa policy: hanya service role (route server) yang menyentuh.
create table if not exists public.ai_pakai_log (
  id bigserial primary key,
  user_id uuid not null,
  fitur text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_pakai_log_user_waktu on public.ai_pakai_log (user_id, created_at desc);
alter table public.ai_pakai_log enable row level security;
revoke all on public.ai_pakai_log from anon, authenticated;
