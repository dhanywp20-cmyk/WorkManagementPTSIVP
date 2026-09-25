-- MIGRATION 018: log & batas kirim WA lewat /api/notifikasi/whatsapp/kirim.
-- Tanpa ini, pengguna yang sudah masuk bisa mengirim WA ke nomor mana pun
-- tanpa batas memakai kuota gateway perusahaan.
-- RLS aktif tanpa policy: hanya service role (route server) yang menyentuh.
create table if not exists public.wa_kirim_log (
  id bigserial primary key,
  user_id uuid not null,
  target text not null,
  created_at timestamptz not null default now()
);
create index if not exists wa_kirim_log_user_waktu on public.wa_kirim_log (user_id, created_at desc);
create index if not exists wa_kirim_log_target_waktu on public.wa_kirim_log (target, created_at desc);
alter table public.wa_kirim_log enable row level security;
revoke all on public.wa_kirim_log from anon, authenticated;
