-- Audit putaran 2 (2026-09-24): KPI x Learning Center + Mapping Center.
--
-- 1. rekap_lc_tahunan(): rekap kelulusan LC setahun dihitung di SERVER.
--    Versi klien (lib/kpi-lc-tahunan.ts) punya dua cacat:
--      a. RLS lca_milik: anggota tim hanya bisa membaca attempt miliknya,
--         jadi apakah sebuah sesi nonaktif "pernah dijalankan" terlihat beda
--         antara anggota dan atasannya - faktor KPI yang sama bisa berbeda.
--      b. max-rows PostgREST (1000) memotong attempt diam-diam, sehingga
--         attempt lulus yang terpotong terbaca "tidak dikerjakan".
--    SECURITY DEFINER dengan penjaga yang meniru scope halaman KPI:
--    admin/Full Access -> siapa pun; Supervisor PTS -> anggota timnya;
--    lainnya -> dirinya sendiri. Yang dikembalikan hanya angka agregat.
--
--    Aturan (keputusan pemilik 2026-09-24): satuan SESI; lulus bila ada
--    attempt passed; sesi bertarget yang selesai tanpa attempt = tidak ikut.
--    Tambahan hasil audit: attempt gagal di sesi yang MASIH BUKA dan boleh
--    retake belum dihitung gagal - kalau tidak, mengerjakan lebih awal justru
--    dihukum lebih dulu daripada menunda. Sesi target "semua" (target NULL)
--    tidak menghukum yang tidak ikut: sesi seperti itu dipakai juga untuk
--    sesi khusus Sales, dan menghukum seluruh PTS karenanya salah sasaran.
-- 2. ringkasan_mapping(): belum_terpeta tidak lagi terpotong di 500.
-- 3. Indeks trigram pada norm_nama_project(name) + kandidat_duplikat_project
--    langsung dari tabel projects (bukan self-join view 4 agregasi).

-- 1 ------------------------------------------------------------------------
create or replace function public.rekap_lc_tahunan(p_user_ids uuid[], p_tahun int)
returns table (user_id uuid, wajib int, lulus int, gagal int, tidak_ikut int)
language plpgsql stable security definer set search_path = public, pg_temp as
$$
declare
  v_tim text; v_jab text;
begin
  -- Penjaga SELALU aktif kecuali superuser (SQL editor/migrasi) - bukan
  -- bergantung pada nama role PostgREST.
  if session_user not in ('postgres', 'supabase_admin') then
    if public.jwt_claim('sub') = '' then raise exception 'Harus login'; end if;
    if not public.admin_atau_full_access() then
      select u.team_type, u.jabatan into v_tim, v_jab from public.users u where u.id = public.jwt_user_id();
      if v_jab = 'Supervisor' and public.jwt_claim('user_role') = 'team' then
        p_user_ids := array(select u.id from public.users u where u.id = any(p_user_ids) and u.team_type = v_tim);
      else
        p_user_ids := array(select x from unnest(p_user_ids) x where x = public.jwt_user_id());
      end if;
    end if;
  end if;

  return query
  with s as (
    select q.id, q.target_user_ids, coalesce(q.allow_retake, false) boleh_ulang,
      (q.closed_at is not null
        or (q.close_at is not null and q.close_at < now())
        or (q.is_active = false and exists (
              select 1 from public.lc_quiz_attempts a2 where a2.quiz_session_id = q.id and a2.is_submitted))) selesai
    from public.lc_quiz_sessions q
    where extract(year from (coalesce(q.open_at, q.scheduled_at, q.created_at) at time zone 'Asia/Jakarta')) = p_tahun
  ), per as (
    select x uid, s.selesai, s.boleh_ulang,
      x = any(coalesce(s.target_user_ids, '{}'::uuid[])) ditargetkan,
      count(a.id) n,
      coalesce(bool_or(a.passed), false) ada_lulus,
      coalesce(bool_or(a.grading_status = 'pending_review'), false) ada_pending
    from unnest(p_user_ids) x
    cross join s
    left join public.lc_quiz_attempts a on a.quiz_session_id = s.id and a.user_id = x and a.is_submitted
    group by x, s.id, s.selesai, s.boleh_ulang, s.target_user_ids
  ), status as (
    select uid,
      case
        when n > 0 and ada_lulus then 'lulus'
        when n > 0 and ada_pending then null
        when n > 0 and boleh_ulang and not selesai then null
        when n > 0 then 'gagal'
        when ditargetkan and selesai then 'tidak_ikut'
      end st
    from per
  )
  select x,
    count(st.st)::int,
    count(*) filter (where st.st = 'lulus')::int,
    count(*) filter (where st.st = 'gagal')::int,
    count(*) filter (where st.st = 'tidak_ikut')::int
  from unnest(p_user_ids) x
  left join status st on st.uid = x
  group by x;
end;
$$;

-- 2 ------------------------------------------------------------------------
create or replace function public.ringkasan_mapping()
returns table (auto_mapped bigint, manual_mapped bigint, diabaikan bigint, belum_terpeta bigint, total_project bigint)
language sql stable set search_path = public, pg_temp as
$$
  select (select count(*) from public.project_source_links where mapping_type='auto'),
         (select count(*) from public.project_source_links where mapping_type='manual'),
         (select count(*) from public.project_source_links where mapping_type='ignored'),
         (select count(*) from public.reminders r
            where coalesce(r.is_deleted,false)=false and btrim(coalesce(r.project_name,'')) <> ''
              and not exists (select 1 from public.project_source_links l where l.source_module='reminders' and l.source_record_id=r.id))
       + (select count(*) from public.tickets t
            where coalesce(t.is_deleted,false)=false and btrim(coalesce(t.project_name,'')) <> ''
              and not exists (select 1 from public.project_source_links l where l.source_module='tickets' and l.source_record_id=t.id))
       + (select count(*) from public.project_requests d
            where coalesce(d.is_deleted,false)=false and btrim(coalesce(d.project_name,'')) <> ''
              and not exists (select 1 from public.project_source_links l where l.source_module='project_requests' and l.source_record_id=d.id)),
         (select count(*) from public.projects);
$$;

-- 3 ------------------------------------------------------------------------
create index if not exists projects_norm_name_trgm_idx
  on public.projects using gin (public.norm_nama_project(name) gin_trgm_ops);

create or replace function public.kandidat_duplikat_project(p_ambang real default 0.5, p_limit int default 100)
returns table (a_id uuid, a_code text, a_name text, a_total bigint,
               b_id uuid, b_code text, b_name text, b_total bigint, skor real)
language sql stable set search_path = public, pg_temp as
$$
  with pasangan as (
    select a.id a_id, a.code a_code, a.name a_name, b.id b_id, b.code b_code, b.name b_name,
           similarity(public.norm_nama_project(a.name), public.norm_nama_project(b.name)) skor
    from public.projects a
    join public.projects b
      on a.id < b.id
     and public.norm_nama_project(a.name) % public.norm_nama_project(b.name)
    where a.status <> 'archived' and b.status <> 'archived'
  ), tersaring as (
    select * from pasangan where skor >= greatest(p_ambang, 0.3)
    order by skor desc, a_name
    limit greatest(1, least(p_limit, 300))
  )
  select t.a_id, t.a_code, t.a_name, coalesce(va.total_activity, 0),
         t.b_id, t.b_code, t.b_name, coalesce(vb.total_activity, 0), t.skor
  from tersaring t
  left join public.v_project_summary va on va.project_id = t.a_id
  left join public.v_project_summary vb on vb.project_id = t.b_id
  order by t.skor desc, t.a_name;
$$;

-- 4. Penjaga yang sama untuk fungsi admin sebelumnya (dulu: session_user = 'authenticator').
--    Diterapkan lewat migrasi audit_penjaga_superuser.
