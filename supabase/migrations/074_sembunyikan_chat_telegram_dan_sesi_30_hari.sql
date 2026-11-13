-- ID chat Telegram tiap pengguna sebelumnya bisa dibaca semua akun yang login (dan dipakai
-- klien untuk mengirim pesan bot ke chat siapa pun). Kini hanya server (service role) yang
-- membacanya; klien cukup tahu apakah akun sudah terhubung lewat kolom telegram_terhubung.
-- PENTING: hak SELECT tabel users kini per kolom - kolom baru wajib di-GRANT ke anon, authenticated.

alter table public.users
  add column if not exists telegram_terhubung boolean
  generated always as (telegram_chat_id is not null) stored;

revoke select on public.users from anon, authenticated;

do $$
declare kolom text;
begin
  select string_agg(quote_ident(column_name), ', ')
    into kolom
    from information_schema.columns
   where table_schema = 'public' and table_name = 'users' and column_name <> 'telegram_chat_id';
  execute format('grant select (%s) on public.users to anon, authenticated', kolom);
end $$;

-- Sesi login kini 30 hari sejak terakhir aktif (diperpanjang otomatis oleh /api/auth/session).
update public.user_sessions
   set expires_at = now() + interval '30 days'
 where expires_at > now() + interval '30 days';
