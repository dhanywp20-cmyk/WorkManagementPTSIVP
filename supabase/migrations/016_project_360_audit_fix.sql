-- Project 360: perbaikan hasil audit (2026-09-24).
--
-- 1. RLS baca projects/project_source_links: dulu `using (true)` untuk anon,
--    artinya siapa pun yang memegang anon key publik (ada di bundel peramban)
--    bisa membaca seluruh daftar project + lokasi + nama sales TANPA login.
--    Sekarang mengikuti aturan tabel sumber: boleh_lihat_baris() - login
--    wajib, PTS/admin melihat semua, Sales hanya miliknya/divisinya.
-- 2. EXECUTE dicabut dari fungsi SECURITY DEFINER yang tidak untuk RPC.
-- 3. search_path dipaku di fungsi Fase 1 (advisor function_search_path_mutable).
-- 4. v_project_summary: review_count selalu 0 karena Form Review tidak
--    pernah dipetakan langsung - ia ikut reminder-nya. Kini dihitung lewat
--    reminder yang terpeta (plus yang dipetakan langsung, bila ada).
-- 5. Project otomatis yang kehilangan record terakhirnya (nama record
--    diubah, dipindah, dilepas, digabung) dihapus - tidak menumpuk jadi
--    baris kosong. Project buatan admin TIDAK ikut dihapus.
-- 6. RPC kandidat_duplikat_project() & gabungkan_project() (atomik).

-- 1 ------------------------------------------------------------------------
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to anon, authenticated
  using (public.boleh_lihat_baris(null, sales_name, sales_division, null));

drop policy if exists psl_select on public.project_source_links;
create policy psl_select on public.project_source_links
  for select to anon, authenticated
  using (public.jwt_claim('sub') <> '');

-- 2 ------------------------------------------------------------------------
revoke execute on function public.petakan_semua_otomatis() from public, anon, authenticated;
revoke execute on function public.trg_petakan_project_otomatis() from public, anon, authenticated;

-- 3 ------------------------------------------------------------------------
alter function public.norm_nama_project(text) set search_path = public, pg_temp;
alter function public.saran_project(text, int) set search_path = public, pg_temp;
alter function public.record_belum_terpeta(int) set search_path = public, pg_temp;
alter function public.ringkasan_mapping() set search_path = public, pg_temp;

-- 4 ------------------------------------------------------------------------
create or replace view public.v_project_summary with (security_invoker = true) as
select p.id as project_id, p.code, p.name, p.customer, p.location,
       p.sales_name, p.sales_division, p.status, p.created_at,
       coalesce(s.n,0) as schedule_count,
       coalesce(t.n,0) as ticket_count,
       coalesce(d.n,0) as design_count,
       coalesce(f.n,0) as review_count,
       coalesce(s.n,0) + coalesce(t.n,0) + coalesce(d.n,0) + coalesce(f.n,0) as total_activity,
       greatest(s.last_at, t.last_at, d.last_at, f.last_at) as last_activity
from public.projects p
left join (select l.project_id, count(*) n, max(r.due_date) last_at
           from public.project_source_links l join public.reminders r on r.id = l.source_record_id
           where l.source_module='reminders' and coalesce(r.is_deleted,false)=false
           group by l.project_id) s on s.project_id = p.id
left join (select l.project_id, count(*) n, max(t2.date) last_at
           from public.project_source_links l join public.tickets t2 on t2.id = l.source_record_id
           where l.source_module='tickets' and coalesce(t2.is_deleted,false)=false
           group by l.project_id) t on t.project_id = p.id
left join (select l.project_id, count(*) n, max(d2.created_at::date) last_at
           from public.project_source_links l join public.project_requests d2 on d2.id = l.source_record_id
           where l.source_module='project_requests' and coalesce(d2.is_deleted,false)=false
           group by l.project_id) d on d.project_id = p.id
left join (select x.project_id, count(distinct x.review_id) n, max(x.tgl) last_at from (
             select l.project_id, f2.id review_id, f2.created_at::date tgl
             from public.project_source_links l
             join public.reminders r on r.id = l.source_record_id and coalesce(r.is_deleted,false)=false
             join public.form_reviews f2 on f2.reminder_id = r.id
             where l.source_module='reminders' and l.project_id is not null
             union all
             select l.project_id, f2.id, f2.created_at::date
             from public.project_source_links l join public.form_reviews f2 on f2.id = l.source_record_id
             where l.source_module='form_reviews' and l.project_id is not null
           ) x group by x.project_id) f on f.project_id = p.id;

-- 5 ------------------------------------------------------------------------
create or replace function public.trg_bersihkan_project_otomatis_kosong()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as
$$
begin
  if old.project_id is null then return null; end if;
  if tg_op = 'UPDATE' and new.project_id is not distinct from old.project_id then return null; end if;
  delete from public.projects p
  where p.id = old.project_id
    and p.created_by = 'sistem (otomatis)'
    and not exists (select 1 from public.project_source_links l where l.project_id = p.id);
  return null;
end;
$$;
revoke execute on function public.trg_bersihkan_project_otomatis_kosong() from public, anon, authenticated;

drop trigger if exists bersihkan_project_otomatis_kosong on public.project_source_links;
create trigger bersihkan_project_otomatis_kosong
  after delete or update of project_id on public.project_source_links
  for each row execute function public.trg_bersihkan_project_otomatis_kosong();

-- 6 ------------------------------------------------------------------------
-- Pasangan project bernama mirip (kemungkinan beda ketik). SECURITY INVOKER:
-- hanya project yang boleh dilihat pemanggil yang ikut dibandingkan.
create or replace function public.kandidat_duplikat_project(p_ambang real default 0.5, p_limit int default 100)
returns table (a_id uuid, a_code text, a_name text, a_total bigint,
               b_id uuid, b_code text, b_name text, b_total bigint, skor real)
language sql stable set search_path = public, pg_temp as
$$
  select a.project_id, a.code, a.name, a.total_activity,
         b.project_id, b.code, b.name, b.total_activity,
         similarity(public.norm_nama_project(a.name), public.norm_nama_project(b.name))
  from public.v_project_summary a
  join public.v_project_summary b
    on a.project_id < b.project_id
   and public.norm_nama_project(a.name) % public.norm_nama_project(b.name)
  where a.status <> 'archived' and b.status <> 'archived'
    and similarity(public.norm_nama_project(a.name), public.norm_nama_project(b.name)) >= greatest(p_ambang, 0.3)
  order by 9 desc, a.name
  limit greatest(1, least(p_limit, 300));
$$;

-- Gabung atomik: pindah seluruh link lalu hapus project asal, dalam satu
-- transaksi. SECURITY INVOKER - RLS psl_write/projects_write (admin) berlaku.
create or replace function public.gabungkan_project(p_asal uuid, p_tujuan uuid, p_oleh text default null)
returns integer
language plpgsql set search_path = public, pg_temp as
$$
declare n int;
begin
  if p_asal = p_tujuan then raise exception 'Project asal dan tujuan sama'; end if;
  if public.jwt_claim('user_role') not in ('admin','superadmin') and session_user = 'authenticator' then
    raise exception 'Hanya admin yang boleh menggabungkan project';
  end if;
  if not exists (select 1 from public.projects where id = p_tujuan) then
    raise exception 'Project tujuan tidak ditemukan';
  end if;
  update public.project_source_links
     set project_id = p_tujuan, mapping_type = 'manual', confidence = null,
         match_reason = 'digabung dari project lain', mapped_by = p_oleh, mapped_at = now()
   where project_id = p_asal;
  get diagnostics n = row_count;
  delete from public.projects where id = p_asal;
  return n;
end;
$$;
