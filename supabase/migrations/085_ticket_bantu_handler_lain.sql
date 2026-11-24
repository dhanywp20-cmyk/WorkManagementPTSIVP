-- Ticketing Troubleshooting: handler lain (role 'team') boleh MEMBANTU update
-- status ticket yang bukan miliknya. Handler yang di-assign (assign_name)
-- tetap pemilik ticket: informasi di atas & tanda tangan report tidak berubah.
-- Pembantu hanya boleh mengubah kolom status; kolom lain dikunci trigger.

create or replace function public.tim_bantu_ticket()
returns boolean
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select jwt_claim('sub') <> ''
     and jwt_claim('user_role') = 'team'
     and not pimpinan_lihat_semua();
$$;

drop policy if exists tk_update on public.tickets;
create policy tk_update on public.tickets
  for update
  using (admin_atau_full_access() or assign_name = jwt_full_name()
         or created_by = jwt_claim('username') or assigned_supervisor_id = jwt_user_id()
         or tim_bantu_ticket())
  with check (admin_atau_full_access() or assign_name = jwt_full_name()
         or created_by = jwt_claim('username') or assigned_supervisor_id = jwt_user_id()
         or tim_bantu_ticket());

-- Pembantu (bukan admin/full access, bukan handler, pembuat, atau supervisor
-- ticket itu) hanya boleh mengubah status & data unit — tidak bisa memindah
-- handler, mengganti data project, atau menghapus ticket.
create or replace function public.trg_kunci_kolom_tiket_pembantu()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  boleh constant text[] := array['status', 'services_status', 'sn_unit', 'current_team', 'updated_at'];
begin
  if coalesce(jwt_claim('user_role'), '') <> 'team'
     or admin_atau_full_access() is true
     or (old.assign_name = jwt_full_name()) is true
     or (old.created_by = jwt_claim('username')) is true
     or (old.assigned_supervisor_id = jwt_user_id()) is true then
    return new;
  end if;
  if (to_jsonb(new) - boleh) is distinct from (to_jsonb(old) - boleh) then
    raise exception 'Handler pembantu hanya boleh mengubah status ticket, bukan handler atau data ticket.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists kunci_kolom_tiket_pembantu on public.tickets;
create trigger kunci_kolom_tiket_pembantu
  before update on public.tickets
  for each row execute function trg_kunci_kolom_tiket_pembantu();

-- Issue tambahan ticket ikut terbuka untuk pembantu.
create or replace function public.boleh_ubah_ticket(p_ticket uuid)
returns boolean
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select jwt_claim('sub') <> ''
     and not pimpinan_lihat_semua()
     and (
       admin_atau_full_access()
       or tim_bantu_ticket()
       or exists (
         select 1 from tickets t
          where t.id = p_ticket
            and (t.assign_name = jwt_full_name()
                 or t.created_by = jwt_claim('username')
                 or t.assigned_supervisor_id = jwt_user_id())
       )
     );
$$;

-- Perpanjangan overdue saat status Pending Action juga boleh oleh pembantu.
create or replace function public.boleh_atur_overdue_tiket(p_ticket uuid)
returns boolean
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select admin_atau_full_access() or tim_bantu_ticket() or exists (
    select 1 from tickets t
    where t.id = p_ticket
      and (t.assign_name = jwt_full_name() or t.created_by = jwt_claim('username') or t.assigned_supervisor_id = jwt_user_id())
  );
$$;
