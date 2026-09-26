-- Project 360 fase 2b: pemetaan OTOMATIS record -> project.
--
-- Keputusan pemilik platform: petakan semuanya otomatis dulu, admin cukup
-- mengoreksi yang salah di Mapping Center. Jadi:
--   - nama project (setelah norm_nama_project) yang sama persis dengan SATU
--     project yang ada -> dipetakan ke project itu;
--   - belum ada project dengan nama itu -> project baru dibuat;
--   - cocok ke LEBIH DARI SATU project -> dibiarkan di antrean (ambigu,
--     keputusan admin).
-- Semua pemetaan ini bertanda mapping_type = 'auto'. Pemetaan 'manual' dan
-- 'ignored' TIDAK PERNAH disentuh, termasuk saat nama record diubah.
--
-- Berlaku untuk record lama (backfill di akhir berkas) dan record baru
-- (trigger AFTER INSERT/UPDATE OF project_name di reminders, tickets,
-- project_requests). form_reviews tidak dipetakan: ia ikut reminder-nya.

-- 1. Pemetaan satu record (inti) ------------------------------------------

create or replace function public.petakan_record_otomatis(
  p_modul text, p_id uuid, p_nama text,
  p_sales text default null, p_divisi text default null, p_lokasi text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as
$$
declare
  k text := public.norm_nama_project(p_nama);
  pid uuid;
  n int;
begin
  if k = '' or p_modul not in ('reminders','tickets','project_requests') then return null; end if;
  if exists (select 1 from public.project_source_links
             where source_module = p_modul and source_record_id = p_id) then
    return null;
  end if;

  -- Dua record baru bernama sama yang masuk bersamaan tidak boleh membuat
  -- dua project kembar.
  perform pg_advisory_xact_lock(hashtext('project360:' || k));

  select count(*), (array_agg(id))[1] into n, pid
  from public.projects
  where public.norm_nama_project(name) = k and status <> 'archived';

  if n > 1 then return null; end if;

  if n = 0 then
    insert into public.projects (name, sales_name, sales_division, location, created_by)
    values (btrim(regexp_replace(p_nama, '\s+', ' ', 'g')),
            nullif(btrim(coalesce(p_sales,'')), ''), nullif(btrim(coalesce(p_divisi,'')), ''),
            nullif(btrim(coalesce(p_lokasi,'')), ''), 'sistem (otomatis)')
    returning id into pid;
  else
    -- Lengkapi isian project yang masih kosong dari record ini.
    update public.projects set
      sales_name     = coalesce(sales_name, nullif(btrim(coalesce(p_sales,'')), '')),
      sales_division = coalesce(sales_division, nullif(btrim(coalesce(p_divisi,'')), '')),
      location       = coalesce(location, nullif(btrim(coalesce(p_lokasi,'')), ''))
    where id = pid and (sales_name is null or sales_division is null or location is null);
  end if;

  insert into public.project_source_links
    (source_module, source_record_id, project_id, mapping_type, confidence, match_reason, mapped_by)
  values (p_modul, p_id, pid, 'auto', 1,
          case when n = 0 then 'project dibuat otomatis dari nama' else 'nama project sama persis' end,
          'sistem')
  on conflict (source_module, source_record_id) do nothing;

  return pid;
end;
$$;

-- Hanya dipanggil dari trigger & backfill (keduanya berjalan sebagai pemilik).
-- Tanpa ini, siapa pun lewat PostgREST bisa membuat project sembarangan.
revoke execute on function public.petakan_record_otomatis(text, uuid, text, text, text, text)
  from public, anon, authenticated;

-- 2. Trigger record baru / nama diubah ------------------------------------

create or replace function public.trg_petakan_project_otomatis()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as
$$
declare
  r jsonb := to_jsonb(new);
begin
  if coalesce((r->>'is_deleted')::boolean, false) then return null; end if;

  if tg_op = 'UPDATE' then
    if public.norm_nama_project(old.project_name) = public.norm_nama_project(new.project_name) then
      return null;
    end if;
    -- Nama berubah: hanya pemetaan otomatis yang ikut dihitung ulang.
    delete from public.project_source_links
    where source_module = tg_table_name and source_record_id = new.id and mapping_type = 'auto';
  end if;

  perform public.petakan_record_otomatis(
    tg_table_name, new.id, new.project_name,
    r->>'sales_name', r->>'sales_division', coalesce(r->>'address', r->>'project_location'));
  return null;
exception when others then
  -- Pemetaan adalah pelengkap. Kegagalannya TIDAK BOLEH menggagalkan
  -- pembuatan jadwal/ticket/request - record tetap masuk antrean Mapping Center.
  raise warning '[project360] pemetaan otomatis % % gagal: %', tg_table_name, new.id, sqlerrm;
  return null;
end;
$$;

drop trigger if exists petakan_project_otomatis on public.reminders;
create trigger petakan_project_otomatis
  after insert or update of project_name on public.reminders
  for each row execute function public.trg_petakan_project_otomatis();

drop trigger if exists petakan_project_otomatis on public.tickets;
create trigger petakan_project_otomatis
  after insert or update of project_name on public.tickets
  for each row execute function public.trg_petakan_project_otomatis();

drop trigger if exists petakan_project_otomatis on public.project_requests;
create trigger petakan_project_otomatis
  after insert or update of project_name on public.project_requests
  for each row execute function public.trg_petakan_project_otomatis();

-- 3. Backfill: semua record yang belum terpeta ----------------------------
--
-- Urutan: Request Schedule dulu (paling lengkap isian sales & alamatnya,
-- jadi project yang dibuat mewarisi datanya), lalu Design, lalu Ticket;
-- masing-masing dari yang tertua.

create or replace function public.petakan_semua_otomatis()
returns integer
language plpgsql security definer set search_path = public, pg_temp as
$$
declare
  rec record;
  n int := 0;
begin
  -- Lewat PostgREST hanya admin; dari SQL editor/migrasi (bukan authenticator) bebas.
  if session_user = 'authenticator' and public.jwt_claim('user_role') not in ('admin','superadmin') then
    raise exception 'Hanya admin yang boleh menjalankan pemetaan otomatis massal';
  end if;

  for rec in
    select 'reminders'::text m, id, project_name, sales_name, sales_division, address lok, 1 urut, due_date::timestamptz t
      from public.reminders where coalesce(is_deleted,false) = false and btrim(coalesce(project_name,'')) <> ''
    union all
    select 'project_requests', id, project_name, sales_name, sales_division, project_location, 2, created_at
      from public.project_requests where coalesce(is_deleted,false) = false and btrim(coalesce(project_name,'')) <> ''
    union all
    select 'tickets', id, project_name, sales_name, sales_division, address, 3, coalesce(date::timestamptz, created_at)
      from public.tickets where coalesce(is_deleted,false) = false and btrim(coalesce(project_name,'')) <> ''
    order by urut, t nulls last
  loop
    if public.petakan_record_otomatis(rec.m, rec.id, rec.project_name, rec.sales_name, rec.sales_division, rec.lok) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

select public.petakan_semua_otomatis();
