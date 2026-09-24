-- Project 360: master project + peta record lintas modul.
--
-- Melanjutkan 013. Di 013 "project" masih sekadar string nama yang diulang di
-- tiap tabel, dan project_summary_links hanya menimpa nama kanonik per record.
-- Itu tidak cukup: pengecekan nyata di basis data ini menunjukkan dari 221 nama
-- unik, hanya 13/5/1 yang namanya sama persis antar modul, dan hanya 2 dari 92
-- ticket yang menyimpan reminder_id. Pencocokan by nama TIDAK bisa jadi tulang
-- punggung - jadi yang jadi tulang punggung adalah PEMETAAN yang tersimpan,
-- dengan nama hanya sebagai saran.
--
-- Karena itu:
--   1. public.projects  - master project sungguhan (kode PRJ-0001, dst).
--   2. project_summary_links DIGANTI NAMA jadi project_source_links dan
--      menunjuk project_id, bukan string nama.
--
-- Diterapkan ke basis data lewat migrasi Supabase `project_360_master_dan_mapping`
-- dan `project_360_view_dan_rpc` (20260919235915 & 20260920004140). Berkas ini
-- cerminannya untuk pemasangan dari nol.

create extension if not exists pg_trgm;

-- Normalisasi nama project: satu-satunya definisi, dipakai view, RPC saran,
-- dan backfill. IMMUTABLE supaya bisa dipakai di indeks.
create or replace function public.norm_nama_project(t text)
returns text language sql immutable parallel safe as
$$ select lower(btrim(regexp_replace(coalesce(t,''), '\s+', ' ', 'g'))) $$;

-- 1. Master project

create sequence if not exists public.projects_code_seq;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null default ('PRJ-' || lpad(nextval('public.projects_code_seq')::text, 4, '0')),
  name text not null,
  customer text,
  location text,
  sales_name text,
  sales_division text,
  status text not null default 'active' check (status in ('active','done','archived')),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists projects_code_key on public.projects (code);
create index if not exists projects_norm_name_idx on public.projects (public.norm_nama_project(name));
create index if not exists projects_name_trgm_idx on public.projects using gin (name gin_trgm_ops);
create index if not exists projects_sales_division_idx on public.projects (sales_division);

-- 2. Peta record -> project

alter table if exists public.project_summary_links rename to project_source_links;

do $$ begin
  -- Kolom lama dari 013 diganti nama supaya istilahnya konsisten dengan
  -- "source module" di UI Mapping Center, bukan "table".
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='project_source_links' and column_name='source_table') then
    alter table public.project_source_links rename column source_table to source_module;
    alter table public.project_source_links rename column source_id to source_record_id;
    alter table public.project_source_links rename column linked_by to mapped_by;
    alter table public.project_source_links rename column linked_at to mapped_at;
    alter table public.project_source_links drop column canonical_project_name;
  end if;
end $$;

create table if not exists public.project_source_links (
  id uuid primary key default gen_random_uuid(),
  source_module text not null check (source_module in ('reminders','tickets','project_requests','form_reviews')),
  source_record_id uuid not null,
  mapped_by text,
  mapped_at timestamptz not null default now(),
  unique (source_module, source_record_id)
);

alter table public.project_source_links
  add column if not exists project_id uuid references public.projects(id) on delete cascade,
  -- 'ignored' = sudah diputuskan admin TIDAK punya project (mis. tiket internal).
  -- Dibedakan dari "belum disentuh" supaya antrean Mapping Center bisa habis.
  add column if not exists mapping_type text not null default 'manual' check (mapping_type in ('auto','manual','ignored')),
  add column if not exists confidence numeric,
  add column if not exists match_reason text,
  add column if not exists notes text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'psl_project_wajib_chk') then
    alter table public.project_source_links
      add constraint psl_project_wajib_chk check (mapping_type = 'ignored' or project_id is not null);
  end if;
end $$;

create index if not exists psl_project_id_idx on public.project_source_links (project_id);

-- 3. Ringkasan per project (dipakai daftar Summary Project)
--
-- security_invoker WAJIB: tanpa itu view berjalan sebagai pemiliknya dan RLS
-- tabel sumber (reminders/tickets/...) dilewati - view berubah jadi pintu
-- belakang kebocoran data. Dengan security_invoker, Sales tetap hanya
-- menghitung baris yang memang boleh ia lihat.
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
left join (select l.project_id, count(*) n, max(f2.created_at::date) last_at
           from public.project_source_links l join public.form_reviews f2 on f2.id = l.source_record_id
           where l.source_module='form_reviews'
           group by l.project_id) f on f.project_id = p.id;

-- 4. RPC pendukung Mapping Center

-- Saran project untuk satu nama record yang belum terpeta. Ambang 0.28 dipilih
-- supaya "bpkp pusat" tetap menyarankan "bpkp" tanpa menariknya jadi satu -
-- saran, bukan penggabungan otomatis.
create or replace function public.saran_project(p_nama text, p_limit int default 5)
returns table (project_id uuid, code text, name text, location text, sales_name text, skor real)
language sql stable as
$$
  select p.id, p.code, p.name, p.location, p.sales_name,
         similarity(public.norm_nama_project(p.name), public.norm_nama_project(p_nama)) as skor
  from public.projects p
  where similarity(public.norm_nama_project(p.name), public.norm_nama_project(p_nama)) > 0.28
  order by skor desc, p.name
  limit greatest(1, least(p_limit, 20));
$$;

-- Antrean Mapping Center. form_reviews sengaja TIDAK ikut: ia selalu terikat ke
-- satu reminder lewat reminder_id, jadi ia mengikuti pemetaan reminder-nya dan
-- tidak pernah butuh keputusan manual sendiri.
create or replace function public.record_belum_terpeta(p_limit int default 200)
returns table (source_module text, source_record_id uuid, project_name text, info text, tanggal date)
language sql stable as
$$
  (select 'reminders'::text, r.id, r.project_name,
          concat_ws(' · ', nullif(r.sales_name,''), nullif(r.address,''), nullif(r.category,'')), r.due_date
   from public.reminders r
   where coalesce(r.is_deleted,false)=false and btrim(coalesce(r.project_name,'')) <> ''
     and not exists (select 1 from public.project_source_links l
                     where l.source_module='reminders' and l.source_record_id=r.id))
  union all
  (select 'tickets', t.id, t.project_name,
          concat_ws(' · ', nullif(t.issue_case,''), nullif(t.assign_name,''), nullif(t.address,'')), t.date
   from public.tickets t
   where coalesce(t.is_deleted,false)=false and btrim(coalesce(t.project_name,'')) <> ''
     and not exists (select 1 from public.project_source_links l
                     where l.source_module='tickets' and l.source_record_id=t.id))
  union all
  (select 'project_requests', d.id, d.project_name,
          concat_ws(' · ', nullif(d.requester_name,''), nullif(d.sales_name,''), nullif(d.project_location,'')), d.created_at::date
   from public.project_requests d
   where coalesce(d.is_deleted,false)=false and btrim(coalesce(d.project_name,'')) <> ''
     and not exists (select 1 from public.project_source_links l
                     where l.source_module='project_requests' and l.source_record_id=d.id))
  order by 5 desc nulls last
  limit greatest(1, least(p_limit, 500));
$$;

create or replace function public.ringkasan_mapping()
returns table (auto_mapped bigint, manual_mapped bigint, diabaikan bigint, belum_terpeta bigint, total_project bigint)
language sql stable as
$$
  select (select count(*) from public.project_source_links where mapping_type='auto'),
         (select count(*) from public.project_source_links where mapping_type='manual'),
         (select count(*) from public.project_source_links where mapping_type='ignored'),
         (select count(*) from public.record_belum_terpeta(500)),
         (select count(*) from public.projects);
$$;

-- 5. RLS
--
-- TO anon, authenticated - platform ini memakai skema JWT kustom sendiri
-- (request.jwt.claims lewat GUC, dibaca jwt_claim()); PostgREST tetap
-- menyambung sebagai role `anon`. Policy TO authenticated saja akan memblokir
-- SEMUA lalu lintas aplikasi sungguhan tanpa suara.

alter table public.projects enable row level security;
alter table public.project_source_links enable row level security;

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to anon, authenticated using (true);
drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects
  for all to anon, authenticated
  using (jwt_claim('user_role') in ('admin','superadmin'))
  with check (jwt_claim('user_role') in ('admin','superadmin'));

drop policy if exists psl_select on public.project_source_links;
create policy psl_select on public.project_source_links
  for select to anon, authenticated using (true);
drop policy if exists psl_write on public.project_source_links;
create policy psl_write on public.project_source_links
  for all to anon, authenticated
  using (jwt_claim('user_role') in ('admin','superadmin'))
  with check (jwt_claim('user_role') in ('admin','superadmin'));
