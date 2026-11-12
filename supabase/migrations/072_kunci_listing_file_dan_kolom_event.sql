-- 072: hasil audit keamanan 12 Nov 2026.
--
-- 1) Bucket project-files, ticket-photos, reminder-photos: daftar isi (list) bisa ditarik TANPA login memakai
--    anon key yang tertanam di aplikasi (terverifikasi 450 objek terlihat sebagai anon). Sekarang SELECT pada
--    storage.objects wajib login. Link publik (/object/public/...) tidak lewat RLS, jadi gambar & lampiran yang
--    sudah tampil di aplikasi tetap terbuka seperti biasa. Aplikasi tidak memakai list()/download() bucket ini.
-- 2) users.daftar_via_event & users.pts_daerah belum dikunci trigger: akun event bisa mengubah daftar_via_event
--    miliknya menjadi false dan lepas dari pembatasan baca daftar user. Kedua kolom kini hanya bisa diubah server
--    (service role, lewat /api/admin/users & /api/auth/register).
--
-- Batal: buat ulang policy lama dengan using (bucket_id = '<bucket>') untuk role public, dan hapus dua baris
-- daftar_via_event / pts_daerah dari guard_users_privileged_columns().

drop policy if exists "Allow public select" on storage.objects;
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Allow public read" on storage.objects;

create policy "project_files_baca_login" on storage.objects for select to anon, authenticated
  using (bucket_id = 'project-files' and public.jwt_claim('sub') <> '');
create policy "ticket_photos_baca_login" on storage.objects for select to anon, authenticated
  using (bucket_id = 'ticket-photos' and public.jwt_claim('sub') <> '');
create policy "reminder_photos_baca_login" on storage.objects for select to anon, authenticated
  using (bucket_id = 'reminder-photos' and public.jwt_claim('sub') <> '');

create or replace function public.guard_users_privileged_columns()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role                  := 'guest';
    new.team_type             := 'Pending Approval';
    new.allow_incentive_input := coalesce(new.allow_incentive_input, false) and false;
    new.access_level          := 'guest';
    new.incentive_akses       := null;
    new.incentive_brand_scope := null;
    new.piket_akses           := null;
    new.piket_ubah            := false;
    new.pimpinan              := false;
    new.telegram_chat_id      := null;
    new.bisa_ditugaskan       := true;
    new.daftar_via_event      := false;
    new.pts_daerah            := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.role                  := old.role;
    new.team_type             := old.team_type;
    new.allow_incentive_input := old.allow_incentive_input;
    new.allowed_menus         := old.allowed_menus;
    new.access_level          := old.access_level;
    new.incentive_akses       := old.incentive_akses;
    new.incentive_brand_scope := old.incentive_brand_scope;
    new.piket_akses           := old.piket_akses;
    new.piket_ubah            := old.piket_ubah;
    new.pimpinan              := old.pimpinan;
    new.telegram_chat_id      := old.telegram_chat_id;
    new.bisa_ditugaskan       := old.bisa_ditugaskan;
    new.daftar_via_event      := old.daftar_via_event;
    new.pts_daerah            := old.pts_daerah;

    new.username  := old.username;
    new.full_name := old.full_name;
    new.jabatan   := old.jabatan;

    new.sales_division    := old.sales_division;
    new.divisi            := old.divisi;
    new.pts_type          := old.pts_type;
    new.is_internal_sales := old.is_internal_sales;

    if not public.admin_atau_full_access() then
      new.atasan_id   := old.atasan_id;
      new.kpi_enabled := old.kpi_enabled;
    end if;

    return new;
  end if;

  return new;
end $function$;
