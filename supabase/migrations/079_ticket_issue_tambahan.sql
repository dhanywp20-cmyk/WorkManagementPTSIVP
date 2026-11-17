-- 079 - Ticket Troubleshooting: issue tambahan per ticket, status per section.
--
--  Satu ticket sering ternyata punya lebih dari satu kasus (mis. datang untuk "Display mati",
--  di lokasi ketemu juga "Mic wireless putus"). Issue #1 tetap kolom tickets.issue_case +
--  tickets.status (alur lama tidak berubah). Issue #2 dst. disimpan di sini, masing-masing
--  punya status sendiri (alur PTS: Pending -> Call/Onsite/In Progress -> Pending Action -> Solved).
--
--  ticket_issues      : satu baris = satu issue tambahan.
--  ticket_issue_logs  : riwayat update per issue (siapa, kapan, status, catatan, foto).
--                       Sengaja TERPISAH dari activity_logs supaya hitungan overdue, KPI, insentif,
--                       dan jejak progres ticket utama tidak ikut membaca status issue tambahan.
--
--  Akses mengikuti tickets: baca = yang boleh melihat ticket-nya; tambah/ubah = yang boleh mengubah
--  ticket-nya (Admin/Full Access, handler, pembuat, supervisor yang ditugaskan); pimpinan hanya lihat;
--  hapus = Admin/Full Access. Riwayat tidak bisa diubah/dihapus (sama seperti activity_logs).

create table if not exists public.ticket_issues (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null references public.tickets(id) on delete cascade,
  nomor            integer not null check (nomor >= 2),
  issue_case       text not null check (length(btrim(issue_case)) > 0),
  description      text not null default '',
  product          text not null default '',
  sn_unit          text not null default '',
  status           text not null default 'Pending'
                   check (status in ('Pending','Call','Onsite','In Progress','Pending Action','Solved')),
  dibuat_oleh      text not null default '',
  dibuat_oleh_nama text not null default '',
  selesai_pada     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (ticket_id, nomor)
);

create table if not exists public.ticket_issue_logs (
  id               uuid primary key default gen_random_uuid(),
  issue_id         uuid not null references public.ticket_issues(id) on delete cascade,
  ticket_id        uuid not null references public.tickets(id) on delete cascade,
  handler_name     text not null default '',
  handler_username text not null default '',
  dari_status      text,
  new_status       text not null,
  action_taken     text not null default '',
  notes            text not null default '',
  photo_url        text not null default '',
  photo_name       text not null default '',
  created_at       timestamptz not null default now()
);

create index if not exists idx_ticket_issues_ticket     on public.ticket_issues(ticket_id, nomor);
create index if not exists idx_ticket_issue_logs_issue  on public.ticket_issue_logs(issue_id, created_at desc);
create index if not exists idx_ticket_issue_logs_ticket on public.ticket_issue_logs(ticket_id);

create or replace function public.ticket_issue_sentuh() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  if new.status = 'Solved' and (tg_op = 'INSERT' or old.status is distinct from 'Solved') then
    new.selesai_pada = now();
  elsif new.status <> 'Solved' then
    new.selesai_pada = null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ticket_issue_sentuh on public.ticket_issues;
create trigger trg_ticket_issue_sentuh before insert or update on public.ticket_issues
  for each row execute function public.ticket_issue_sentuh();

-- Boleh mengubah ticket induk = boleh menambah/mengubah issue & menulis riwayatnya.
create or replace function public.boleh_ubah_ticket(p_ticket uuid) returns boolean
language sql stable set search_path = public, pg_temp as $$
  select jwt_claim('sub') <> ''
     and not pimpinan_lihat_semua()
     and (
       admin_atau_full_access()
       or exists (
         select 1 from tickets t
          where t.id = p_ticket
            and (t.assign_name = jwt_full_name()
                 or t.created_by = jwt_claim('username')
                 or t.assigned_supervisor_id = jwt_user_id())
       )
     );
$$;

alter table public.ticket_issues     enable row level security;
alter table public.ticket_issue_logs enable row level security;

grant select, insert, update, delete on public.ticket_issues     to anon, authenticated;
grant select, insert                 on public.ticket_issue_logs to anon, authenticated;
revoke truncate, references, trigger on public.ticket_issues from anon, authenticated;
revoke update, delete, truncate, references, trigger on public.ticket_issue_logs from anon, authenticated;

drop policy if exists ti_baca  on public.ticket_issues;
drop policy if exists ti_tambah on public.ticket_issues;
drop policy if exists ti_ubah  on public.ticket_issues;
drop policy if exists ti_hapus on public.ticket_issues;

create policy ti_baca on public.ticket_issues for select to anon, authenticated
  using (jwt_claim('sub') <> '' and (lingkup_semua() or exists (select 1 from public.tickets t where t.id = ticket_issues.ticket_id)));
create policy ti_tambah on public.ticket_issues for insert to anon, authenticated
  with check (public.boleh_ubah_ticket(ticket_id));
create policy ti_ubah on public.ticket_issues for update to anon, authenticated
  using (public.boleh_ubah_ticket(ticket_id)) with check (public.boleh_ubah_ticket(ticket_id));
create policy ti_hapus on public.ticket_issues for delete to anon, authenticated
  using (admin_atau_full_access());

drop policy if exists til_baca   on public.ticket_issue_logs;
drop policy if exists til_tambah on public.ticket_issue_logs;

create policy til_baca on public.ticket_issue_logs for select to anon, authenticated
  using (jwt_claim('sub') <> '' and (lingkup_semua() or exists (select 1 from public.tickets t where t.id = ticket_issue_logs.ticket_id)));
create policy til_tambah on public.ticket_issue_logs for insert to anon, authenticated
  with check (
    public.boleh_ubah_ticket(ticket_id)
    and exists (select 1 from public.ticket_issues i where i.id = ticket_issue_logs.issue_id and i.ticket_id = ticket_issue_logs.ticket_id)
  );
