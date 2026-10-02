-- MIGRATION 025: Project Progress berbasis checklist.
--
-- Project Progress lama (progress_projects -> locations -> components) diganti
-- konsep Checklist Tools:
--
--   checklist_proyek   proyek: client, Sales & divisi, jadwal, status
--   checklist_daftar   checklist per lokasi/ruangan di dalam proyek
--   checklist_anggota  akun yang di-assign ke satu checklist (boleh edit)
--   checklist_bagian / checklist_item / checklist_riwayat  (dari migrasi 024)
--
-- Tulis tetap HANYA lewat route server (service role). Yang dibuka di sini
-- adalah BACA untuk integrasi yang memakai token pengguna (antrean kerja
-- Beranda, pencarian global, Asisten): admin/team melihat semua, Sales
-- melihat proyeknya, anggota melihat checklist yang di-assign. Kolom
-- share_token TIDAK ikut dibuka - link share hanya dibuat & dibaca server.
--
-- Tabel progress_* lama TIDAK dihapus: tetap ada sebagai cadangan. Datanya
-- disalin sekali ke tabel baru (bagian bawah berkas, aman dijalankan ulang).

-- ── 1. Proyek ──────────────────────────────────────────────────────────────
create table if not exists public.checklist_proyek (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (char_length(nama) between 1 and 200),
  client text,
  deskripsi text not null default '',
  sales_name text,
  sales_division text,
  status text not null default 'in_progress' check (status in ('in_progress', 'done', 'blocked')),
  start_date date,
  target_date date,
  origin text not null default 'manual' check (origin in ('manual', 'auto_reminder', 'migrasi')),
  source_reminder_id uuid,
  share_token text unique,
  share_aktif boolean not null default false,
  dibuat_oleh uuid,
  dibuat_oleh_nama text,
  legacy_project_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists checklist_proyek_sales on public.checklist_proyek (sales_name);

-- ── 2. Checklist per lokasi ────────────────────────────────────────────────
alter table public.checklist_daftar
  add column if not exists proyek_id uuid references public.checklist_proyek(id) on delete cascade,
  add column if not exists start_date date,
  add column if not exists target_date date,
  add column if not exists urutan integer not null default 0,
  add column if not exists origin text not null default 'manual',
  add column if not exists source_reminder_id uuid,
  add column if not exists legacy_location_id uuid unique;
create index if not exists checklist_daftar_proyek on public.checklist_daftar (proyek_id, urutan);
-- Satu reminder = satu checklist: sinkron ganda dari Request Schedule ditolak.
create unique index if not exists checklist_daftar_reminder on public.checklist_daftar (source_reminder_id)
  where source_reminder_id is not null;

alter table public.checklist_daftar drop constraint if exists checklist_daftar_sumber_check;
alter table public.checklist_daftar add constraint checklist_daftar_sumber_check
  check (sumber in ('teks', 'excel', 'duplikat', 'kosong', 'reminder', 'migrasi'));

-- ── 3. Anggota (yang di-assign) ────────────────────────────────────────────
create table if not exists public.checklist_anggota (
  daftar_id uuid not null references public.checklist_daftar(id) on delete cascade,
  user_id uuid not null,
  nama text not null,
  created_at timestamptz not null default now(),
  primary key (daftar_id, user_id)
);
create index if not exists checklist_anggota_user on public.checklist_anggota (user_id);

-- ── 4. Item: kendala + foto ────────────────────────────────────────────────
alter table public.checklist_item
  add column if not exists kendala boolean not null default false,
  add column if not exists kendala_catatan text not null default '',
  add column if not exists kendala_oleh text,
  add column if not exists kendala_pada timestamptz,
  add column if not exists foto_url text,
  add column if not exists foto_thumb_url text,
  add column if not exists legacy_component_id uuid unique;

alter table public.checklist_riwayat drop constraint if exists checklist_riwayat_aksi_check;
alter table public.checklist_riwayat add constraint checklist_riwayat_aksi_check
  check (aksi in ('centang', 'batal', 'kendala', 'kendala_selesai'));

-- ── 5. Akses BACA untuk token pengguna ─────────────────────────────────────
alter table public.checklist_proyek  enable row level security;
alter table public.checklist_anggota enable row level security;
revoke all on public.checklist_proyek  from anon, authenticated;
revoke all on public.checklist_anggota from anon, authenticated;

-- Apakah pengguna (dari klaim JWT) anggota checklist ini. SECURITY DEFINER
-- supaya policy tidak saling memanggil RLS tabel lain secara berulang.
create or replace function public.checklist_saya_anggota(p_daftar uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from checklist_anggota a where a.daftar_id = p_daftar and a.user_id = jwt_user_id());
$$;

create or replace function public.checklist_boleh_lihat_proyek(p_proyek uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select is_progress_admin()
      or exists (select 1 from checklist_proyek p where p.id = p_proyek and p.sales_name is not null and p.sales_name = jwt_full_name())
      or exists (select 1 from checklist_daftar d join checklist_anggota a on a.daftar_id = d.id
                 where d.proyek_id = p_proyek and a.user_id = jwt_user_id());
$$;

create or replace function public.checklist_boleh_lihat_daftar(p_daftar uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select is_progress_admin()
      or checklist_saya_anggota(p_daftar)
      or exists (select 1 from checklist_daftar d join checklist_proyek p on p.id = d.proyek_id
                 where d.id = p_daftar and p.sales_name is not null and p.sales_name = jwt_full_name());
$$;

revoke all on function public.checklist_saya_anggota(uuid) from public;
revoke all on function public.checklist_boleh_lihat_proyek(uuid) from public;
revoke all on function public.checklist_boleh_lihat_daftar(uuid) from public;
grant execute on function public.checklist_saya_anggota(uuid) to anon, authenticated;
grant execute on function public.checklist_boleh_lihat_proyek(uuid) to anon, authenticated;
grant execute on function public.checklist_boleh_lihat_daftar(uuid) to anon, authenticated;

drop policy if exists cp_select on public.checklist_proyek;
create policy cp_select on public.checklist_proyek for select to anon, authenticated
  using (checklist_boleh_lihat_proyek(id));
drop policy if exists cd_select on public.checklist_daftar;
create policy cd_select on public.checklist_daftar for select to anon, authenticated
  using (checklist_boleh_lihat_daftar(id));
drop policy if exists ca_select on public.checklist_anggota;
create policy ca_select on public.checklist_anggota for select to anon, authenticated
  using (checklist_boleh_lihat_daftar(daftar_id));
drop policy if exists cb_select on public.checklist_bagian;
create policy cb_select on public.checklist_bagian for select to anon, authenticated
  using (checklist_boleh_lihat_daftar(daftar_id));
drop policy if exists ci_select on public.checklist_item;
create policy ci_select on public.checklist_item for select to anon, authenticated
  using (checklist_boleh_lihat_daftar(daftar_id));

-- Hak kolom: share_token sengaja tidak termasuk.
grant select (id, nama, client, deskripsi, sales_name, sales_division, status, start_date, target_date,
              origin, share_aktif, dibuat_oleh_nama, created_at, updated_at)
  on public.checklist_proyek to anon, authenticated;
grant select (id, proyek_id, judul, keterangan, sumber, share_aktif, start_date, target_date, urutan,
              origin, dibuat_oleh_nama, created_at, updated_at)
  on public.checklist_daftar to anon, authenticated;
grant select on public.checklist_anggota to anon, authenticated;
grant select on public.checklist_bagian to anon, authenticated;
grant select (id, daftar_id, bagian_id, kelompok, teks, catatan, urutan, selesai, selesai_oleh, selesai_pada,
              selesai_lewat, kendala, kendala_catatan, kendala_oleh, kendala_pada, foto_url, foto_thumb_url)
  on public.checklist_item to anon, authenticated;

-- ── 6. Salin data Project Progress lama (sekali; aman dijalankan ulang) ────

-- 6a. Proyek. share_token lama ikut, supaya link view-only yang sudah
--     tersebar tetap terbuka di halaman baru.
insert into public.checklist_proyek (nama, client, deskripsi, sales_name, sales_division, status,
  start_date, target_date, origin, source_reminder_id, share_token, share_aktif, dibuat_oleh_nama,
  legacy_project_id, created_at, updated_at)
select coalesce(nullif(trim(p.name), ''), 'Proyek tanpa nama'), p.client, coalesce(p.description, ''),
       p.sales_name, p.sales_division,
       case when p.status in ('in_progress', 'done', 'blocked') then p.status else 'in_progress' end,
       p.start_date, p.target_date,
       case when p.origin = 'auto_reminder' then 'auto_reminder' else 'migrasi' end,
       p.source_reminder_id, p.share_token, coalesce(p.share_enabled, false), p.created_by,
       p.id, p.created_at, coalesce(p.updated_at, p.created_at)
from public.progress_projects p
where not exists (select 1 from public.checklist_proyek x where x.legacy_project_id = p.id);

-- 6b. Lokasi -> checklist.
insert into public.checklist_daftar (proyek_id, judul, keterangan, sumber, start_date, target_date, urutan,
  origin, source_reminder_id, dibuat_oleh_nama, legacy_location_id, created_at, updated_at)
select cp.id,
       coalesce(nullif(trim(l.name), ''), 'Lokasi ' || (l.sort_order + 1)),
       coalesce(l.note, ''), 'migrasi', l.start_date, l.target_date, l.sort_order,
       case when l.origin = 'auto_reminder' then 'auto_reminder' else 'migrasi' end,
       l.source_reminder_id, cp.dibuat_oleh_nama, l.id, l.created_at, l.created_at
from public.progress_locations l
join public.checklist_proyek cp on cp.legacy_project_id = l.project_id
where not exists (select 1 from public.checklist_daftar x where x.legacy_location_id = l.id);

-- 6c. PIC lokasi -> anggota (dicocokkan ke akun lewat nama lengkap).
insert into public.checklist_anggota (daftar_id, user_id, nama)
select d.id, u.id, u.full_name
from public.progress_locations l
join public.checklist_daftar d on d.legacy_location_id = l.id
join public.users u on lower(trim(u.full_name)) = lower(trim(l.pic))
where l.pic is not null
on conflict do nothing;

-- 6d. Satu bagian per kategori komponen ("Komponen" bila kosong).
insert into public.checklist_bagian (daftar_id, judul, urutan)
select d.id, k.judul, k.urutan
from public.checklist_daftar d
join lateral (
  select coalesce(nullif(trim(c.category), ''), 'Komponen') judul,
         (row_number() over (order by min(c.sort_order)) - 1)::int urutan
  from public.progress_components c
  where c.location_id = d.legacy_location_id
  group by coalesce(nullif(trim(c.category), ''), 'Komponen')
) k on true
where d.legacy_location_id is not null
  and not exists (select 1 from public.checklist_bagian b where b.daftar_id = d.id and b.judul = k.judul);

-- 6e. Komponen -> item. Siapa & kapan diambil dari audit trail (perubahan
--     status terakhir ke Done / Stuck); bila tidak ada, PIC & waktu dibuat.
insert into public.checklist_item (daftar_id, bagian_id, teks, catatan, urutan, selesai, selesai_oleh,
  selesai_pada, selesai_lewat, kendala, kendala_catatan, kendala_oleh, kendala_pada, foto_url,
  foto_thumb_url, legacy_component_id)
select d.id, b.id, coalesce(nullif(trim(c.label), ''), 'Item'),
       case when c.state = 'progress' then 'Sedang dikerjakan (status lama)' else '' end,
       c.sort_order,
       c.state = 'done',
       case when c.state = 'done' then coalesce(ad.user_name, l.pic, 'Project Progress lama') end,
       case when c.state = 'done' then coalesce(ad.created_at, c.created_at) end,
       case when c.state = 'done' then 'admin' end,
       c.state = 'stuck',
       case when c.state = 'stuck' then coalesce(nullif(trim(l.note), ''), 'Kendala (status Stuck di Project Progress lama)') else '' end,
       case when c.state = 'stuck' then coalesce(ast.user_name, l.pic, 'Project Progress lama') end,
       case when c.state = 'stuck' then coalesce(ast.created_at, c.created_at) end,
       c.photo_url, c.photo_thumb_url, c.id
from public.progress_components c
join public.progress_locations l on l.id = c.location_id
join public.checklist_daftar d on d.legacy_location_id = l.id
join public.checklist_bagian b on b.daftar_id = d.id and b.judul = coalesce(nullif(trim(c.category), ''), 'Komponen')
left join lateral (
  select a.user_name, a.created_at from public.audit_trail a
  where a.module = 'project-progress' and a.target_id::text = c.id::text and a.new_value ilike 'done'
  order by a.created_at desc limit 1
) ad on true
left join lateral (
  select a.user_name, a.created_at from public.audit_trail a
  where a.module = 'project-progress' and a.target_id::text = c.id::text and a.new_value ilike 'stuck'
  order by a.created_at desc limit 1
) ast on true
where not exists (select 1 from public.checklist_item x where x.legacy_component_id = c.id);

-- 6f. Isu proyek -> bagian "Isu" pada checklist pertama proyeknya, sebagai
--     item ber-kendala (atau selesai bila isunya sudah resolved/closed).
insert into public.checklist_bagian (daftar_id, judul, urutan)
select distinct on (cp.id) d.id, 'Isu', 999
from public.progress_issues i
join public.checklist_proyek cp on cp.legacy_project_id = i.project_id
join public.checklist_daftar d on d.proyek_id = cp.id
where not exists (select 1 from public.checklist_bagian b where b.daftar_id = d.id and b.judul = 'Isu')
order by cp.id, d.urutan, d.created_at;

insert into public.checklist_item (daftar_id, bagian_id, teks, catatan, urutan, selesai, selesai_oleh,
  selesai_pada, selesai_lewat, kendala, kendala_catatan, kendala_oleh, kendala_pada)
select b.daftar_id, b.id, left(coalesce(nullif(trim(i.issue), ''), 'Isu'), 1000),
       concat_ws(' · ', 'Severity ' || i.severity, nullif(i.location_label, ''), nullif(i.note, '')),
       10000 + i.sort_order,
       i.status in ('resolved', 'closed'),
       case when i.status in ('resolved', 'closed') then coalesce(i.pic, 'Project Progress lama') end,
       case when i.status in ('resolved', 'closed') then coalesce(i.resolved_at, i.created_at) end,
       case when i.status in ('resolved', 'closed') then 'admin' end,
       i.status not in ('resolved', 'closed'),
       case when i.status not in ('resolved', 'closed') then concat_ws(' · ', nullif(i.root_cause, ''), nullif(i.action_plan, '')) else '' end,
       case when i.status not in ('resolved', 'closed') then coalesce(i.pic, 'Project Progress lama') end,
       case when i.status not in ('resolved', 'closed') then i.created_at end
from public.progress_issues i
join public.checklist_proyek cp on cp.legacy_project_id = i.project_id
join public.checklist_daftar d on d.proyek_id = cp.id
join public.checklist_bagian b on b.daftar_id = d.id and b.judul = 'Isu'
where not exists (
  select 1 from public.checklist_item x
  where x.bagian_id = b.id and x.teks = left(coalesce(nullif(trim(i.issue), ''), 'Isu'), 1000)
);

-- 6g. Checklist dari migrasi 024 yang belum punya proyek: tiap satu dibuatkan
--     proyek bernama sama, supaya tidak hilang dari daftar.
with yatim as (
  select d.id, d.judul, d.dibuat_oleh, d.dibuat_oleh_nama, d.created_at
  from public.checklist_daftar d where d.proyek_id is null
), baru as (
  insert into public.checklist_proyek (nama, origin, dibuat_oleh, dibuat_oleh_nama, created_at)
  select y.judul, 'manual', y.dibuat_oleh, y.dibuat_oleh_nama, y.created_at from yatim y
  returning id, nama, created_at
)
update public.checklist_daftar d set proyek_id = b.id
from yatim y join baru b on b.nama = y.judul and b.created_at = y.created_at
where d.id = y.id;

-- Sesudah semua checklist punya proyek, kolomnya wajib.
alter table public.checklist_daftar alter column proyek_id set not null;
