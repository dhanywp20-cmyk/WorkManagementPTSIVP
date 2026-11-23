create or replace function public.boleh_atur_overdue_tiket(p_ticket uuid)
returns boolean
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select admin_atau_full_access() or exists (
    select 1 from tickets t
    where t.id = p_ticket
      and (t.assign_name = jwt_full_name() or t.created_by = jwt_claim('username') or t.assigned_supervisor_id = jwt_user_id())
  );
$$;

drop policy if exists os_tulis_tambah on public.overdue_settings;
create policy os_tulis_tambah on public.overdue_settings
  for insert to anon, authenticated
  with check (boleh_atur_overdue_tiket(ticket_id));

drop policy if exists os_tulis_ubah on public.overdue_settings;
create policy os_tulis_ubah on public.overdue_settings
  for update to anon, authenticated
  using (boleh_atur_overdue_tiket(ticket_id))
  with check (boleh_atur_overdue_tiket(ticket_id));
