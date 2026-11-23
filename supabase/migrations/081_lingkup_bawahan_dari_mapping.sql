-- Atasan hanya melihat data bawahan yang DI-MAPPING kepadanya:
--   * mapping per user (user_supervisor_mappings), atau
--   * mapping grup (division_supervisor_mappings): anggota guest grup itu yang jabatannya lebih rendah
--     dan TIDAK punya mapping per user (mapping per user mengalahkan grup),
--   * berantai mengikuti mapping (maks 10 tingkat).
-- Logika sama dengan pilihBawahan di lib/atasan.ts. Dipakai RLS tickets, reminders, project_requests
-- supaya atasan bisa membaca tiket / jadwal / request tim yang di-mapping, termasuk yang berada di divisi lain.
-- Juga mengisi users.atasan_id (Struktur Organisasi) yang masih kosong dari mapping per user tunggal.
-- Aman dijalankan ulang. Batal: kembalikan qual tk_select / rm_select / pr_select seperti di 03 Nov
--   (tanpa klausa bawahan_*), lalu drop function bawahan_saya, bawahan_nama_saya, bawahan_username_saya.

create or replace function public.bawahan_saya()
returns uuid[]
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with recursive
  tier(j, t) as (
    values ('Staff', 1), ('Supervisor', 2), ('Manager', 3), ('Deputy General Manager', 4), ('General Manager', 5), ('Direktur', 6)
  ),
  langkah(atasan, bawahan) as (
    select m.supervisor_id, m.user_id from user_supervisor_mappings m
    union
    select g.supervisor_id, u.id
    from division_supervisor_mappings g
    join users a on a.id = g.supervisor_id
    join users u on u.sales_division = g.sales_division and lower(coalesce(u.role, '')) = 'guest' and u.id <> g.supervisor_id
    where coalesce((select t from tier where j = u.jabatan), 0) < coalesce((select t from tier where j = a.jabatan), 0)
      and not exists (select 1 from user_supervisor_mappings p where p.user_id = u.id)
  ),
  pohon(id, d) as (
    select l.bawahan, 1 from langkah l where l.atasan = jwt_user_id()
    union
    select l.bawahan, p.d + 1 from pohon p join langkah l on l.atasan = p.id where p.d < 10
  )
  select coalesce(array_agg(distinct id) filter (where id is distinct from jwt_user_id()), '{}'::uuid[]) from pohon;
$$;

create or replace function public.bawahan_nama_saya()
returns text[]
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(array_agg(u.full_name) filter (where u.full_name is not null and u.full_name <> ''), '{}'::text[])
  from users u where u.id = any (bawahan_saya());
$$;

create or replace function public.bawahan_username_saya()
returns text[]
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(array_agg(u.username) filter (where u.username is not null and u.username <> ''), '{}'::text[])
  from users u where u.id = any (bawahan_saya());
$$;

revoke execute on function public.bawahan_saya(), public.bawahan_nama_saya(), public.bawahan_username_saya() from anon;

alter policy tk_select on public.tickets using (
  boleh_lihat_baris(sales_user_id, sales_name, sales_division, created_by)
  or (assign_user_id = jwt_user_id())
  or (assign_name = jwt_full_name())
  or (sales_user_id = any ((select bawahan_saya())::uuid[]))
  or (internal_sales_id = any ((select bawahan_saya())::uuid[]))
  or (internal_sales_id_2 = any ((select bawahan_saya())::uuid[]))
  or (created_by = any ((select bawahan_username_saya())::text[]))
  or (sales_name = any ((select bawahan_nama_saya())::text[]))
);

alter policy rm_select on public.reminders using (
  boleh_lihat_baris(sales_user_id, sales_name, sales_division, created_by)
  or (assign_user_id = (select jwt_user_id()))
  or (assigned_to = (select jwt_claim('username'::text)))
  or (internal_sales_id = (select jwt_user_id()))
  or (internal_sales_id_2 = (select jwt_user_id()))
  or (((select akses_insentif()) = any (array['input'::text, 'penuh'::text])) and (category = any (((select kategori_insentif_db()))::text[])))
  or pernah_dapat_bagian_insentif(id)
  or (sales_user_id = any ((select bawahan_saya())::uuid[]))
  or (internal_sales_id = any ((select bawahan_saya())::uuid[]))
  or (internal_sales_id_2 = any ((select bawahan_saya())::uuid[]))
  or (created_by = any ((select bawahan_username_saya())::text[]))
  or (sales_name = any ((select bawahan_nama_saya())::text[]))
);

alter policy pr_select on public.project_requests using (
  boleh_lihat_baris(sales_user_id, sales_name, sales_division, null::text)
  or (requester_id = jwt_claim('sub'::text))
  or (assign_user_id = jwt_user_id())
  or (assign_name = jwt_full_name())
  or (internal_sales_id = jwt_user_id())
  or (assigned_supervisor_id = jwt_user_id())
  or (sales_user_id = any ((select bawahan_saya())::uuid[]))
  or (requester_id = any ((select bawahan_saya())::text[]))
  or (internal_sales_id = any ((select bawahan_saya())::uuid[]))
  or (sales_name = any ((select bawahan_nama_saya())::text[]))
);

update public.users u
set atasan_id = m.supervisor_id
from (
  select user_id, (array_agg(supervisor_id))[1] as supervisor_id
  from public.user_supervisor_mappings
  group by user_id
  having count(*) = 1
) m
where u.id = m.user_id and u.atasan_id is null and u.id <> m.supervisor_id;
