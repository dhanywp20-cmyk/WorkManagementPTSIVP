-- KPI Team: nilai LC per periode dihitung di SERVER (2026-11-24).
--
-- Masalah: kartu "Penilaian KPI" membaca lc_quiz_attempts langsung dari klien.
-- RLS lc_quiz_attempts (pimpinan_baca) hanya membuka baris milik sendiri untuk
-- role team, jadi Supervisor PTS (mis. Yoga) melihat 0 attempt LC untuk
-- anggotanya -> skor LC anggota = 0 dan KPI-nya jauh lebih rendah daripada
-- yang dilihat Manager/admin (Ferdinan 43% vs 30%, Farhan 67% vs 37%,
-- Deni 70% vs 40%). Tabel sumber KPI lain (tickets, reminders, form_reviews,
-- tech_notes, activity_logs) sudah terbaca sama untuk role team.
--
-- kpi_lc_periode() mengembalikan AGREGAT per anggota saja (jumlah attempt,
-- rata-rata, jumlah lulus, daftar nilai tanpa sesi/waktu). Penjaga sama dengan
-- rekap_lc_tahunan(): admin/Full Access/pimpinan -> siapa pun; Supervisor PTS
-- -> anggota timnya; lainnya -> dirinya sendiri. Akses baris mentah
-- lc_quiz_attempts tidak dibuka.

create or replace function public.kpi_lc_periode(p_user_ids uuid[], p_mulai timestamptz, p_akhir timestamptz)
returns table (user_id uuid, attempts int, rata_rata int, lulus int, nilai numeric[])
language plpgsql stable security definer set search_path = public, pg_temp as
$$
declare
  v_tim text; v_jab text;
begin
  if session_user not in ('postgres', 'supabase_admin') then
    if public.jwt_claim('sub') = '' then raise exception 'Harus login'; end if;
    if not (public.admin_atau_full_access() or public.pimpinan_lihat_semua()) then
      select u.team_type, u.jabatan into v_tim, v_jab from public.users u where u.id = public.jwt_user_id();
      if v_jab = 'Supervisor' and public.jwt_claim('user_role') = 'team' then
        p_user_ids := array(select u.id from public.users u where u.id = any(p_user_ids) and u.team_type = v_tim);
      else
        p_user_ids := array(select x from unnest(p_user_ids) x where x = public.jwt_user_id());
      end if;
    end if;
  end if;

  return query
  select a.user_id,
    count(*)::int,
    coalesce(round(avg(a.score))::int, 0),
    count(*) filter (where a.passed is true)::int,
    coalesce(array_agg(a.score order by a.score) filter (where a.score is not null), '{}'::numeric[])
  from public.lc_quiz_attempts a
  where a.user_id = any(p_user_ids)
    and a.is_submitted
    and a.grading_status is distinct from 'pending_review'
    and a.started_at >= p_mulai and a.started_at <= p_akhir
  group by a.user_id;
end;
$$;
