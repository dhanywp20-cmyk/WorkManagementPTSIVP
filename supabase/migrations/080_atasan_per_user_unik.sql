-- Atasan per user (user_supervisor_mappings) kini MENGGANTIKAN atasan grup (division_supervisor_mappings)
-- untuk lingkup bawahan dan CC WA. Cegah baris ganda dan user menjadi atasan dirinya sendiri.
-- Aman dijalankan ulang. Batal: alter table public.user_supervisor_mappings drop constraint user_supervisor_mappings_user_supervisor_unik,
--   drop constraint user_supervisor_mappings_bukan_diri_sendiri;
delete from public.user_supervisor_mappings a
  using public.user_supervisor_mappings b
  where a.user_id = b.user_id and a.supervisor_id = b.supervisor_id and a.ctid > b.ctid;
delete from public.user_supervisor_mappings where user_id = supervisor_id;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_supervisor_mappings_user_supervisor_unik') then
    alter table public.user_supervisor_mappings
      add constraint user_supervisor_mappings_user_supervisor_unik unique (user_id, supervisor_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_supervisor_mappings_bukan_diri_sendiri') then
    alter table public.user_supervisor_mappings
      add constraint user_supervisor_mappings_bukan_diri_sendiri check (user_id <> supervisor_id);
  end if;
end $$;
