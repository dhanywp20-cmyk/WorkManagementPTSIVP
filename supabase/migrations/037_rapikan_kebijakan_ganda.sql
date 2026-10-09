-- 037_rapikan_kebijakan_ganda.sql
--
-- Advisor performa Supabase "multiple_permissive_policies" (40 temuan): kebijakan *_tulis dibuat
-- FOR ALL, sehingga ikut berlaku untuk SELECT di samping *_baca -> tiap SELECT mengevaluasi dua
-- kebijakan. Hak akses TIDAK diubah:
--   - SELECT  : satu kebijakan = (syarat baca) OR (syarat tulis)  -> persis efek sebelumnya
--   - INSERT / UPDATE / DELETE : kebijakan tulis yang sama, dipecah per aksi.
-- Kebijakan RESTRICTIVE (pimpinan_hanya_lihat_*) tidak disentuh.

do $$
declare
  pasangan text[][] := array[
    ['brand_pic_mappings', 'bpm_baca', 'bpm_tulis'],
    ['daily_report_team_entries', 'drte_baca', 'drte_tulis'],
    ['division_ivp_mappings', 'division_ivp_mappings_baca', 'division_ivp_mappings_tulis'],
    ['division_supervisor_mappings', 'division_supervisor_mappings_baca', 'division_supervisor_mappings_tulis'],
    ['form_reviews', 'fr_baca', 'fr_tulis'],
    ['incentive_scheme_settings', 'iss_baca', 'iss_tulis'],
    ['kpi_global_settings', 'kgs_baca', 'kgs_tulis'],
    ['kpi_period_snapshots', 'kps_baca', 'kps_tulis'],
    ['lc_answers', 'pimpinan_baca', 'lcj_milik'],
    ['lc_materials', 'lcm_baca', 'lcm_tulis'],
    ['lc_questions', 'lcq_baca', 'lcq_tulis'],
    ['lc_quiz_attempts', 'pimpinan_baca', 'lca_milik'],
    ['lc_quiz_sessions', 'lcs_baca', 'lcs_tulis'],
    ['overdue_settings', 'os_baca', 'os_tulis'],
    ['picket_holidays', 'ph_baca', 'ph_tulis'],
    ['product_team_map', 'ptm_baca', 'ptm_tulis'],
    ['project_source_links', 'psl_select', 'psl_write'],
    ['projects', 'projects_select', 'projects_write'],
    ['team_members', 'tm_baca', 'tm_tulis'],
    ['user_supervisor_mappings', 'user_supervisor_mappings_baca', 'user_supervisor_mappings_tulis']
  ];
  i int;
  t text; pb text; pt text;
  q_baca text; q_tulis text; c_tulis text;
begin
  for i in 1 .. array_length(pasangan, 1) loop
    t := pasangan[i][1]; pb := pasangan[i][2]; pt := pasangan[i][3];
    select qual into q_baca from pg_policies where schemaname = 'public' and tablename = t and policyname = pb and cmd = 'SELECT';
    select qual, coalesce(with_check, qual) into q_tulis, c_tulis from pg_policies
      where schemaname = 'public' and tablename = t and policyname = pt and cmd = 'ALL';
    if q_baca is null or q_tulis is null then
      raise notice 'lewati %: pasangan % / % tidak ditemukan (mungkin sudah dirapikan)', t, pb, pt;
      continue;
    end if;
    execute format('drop policy %I on public.%I', pb, t);
    execute format('drop policy %I on public.%I', pt, t);
    execute format('create policy %I on public.%I for select to anon, authenticated using ((%s) or (%s))', pb, t, q_baca, q_tulis);
    execute format('create policy %I on public.%I for insert to anon, authenticated with check (%s)', pt || '_tambah', t, c_tulis);
    execute format('create policy %I on public.%I for update to anon, authenticated using (%s) with check (%s)', pt || '_ubah', t, q_tulis, c_tulis);
    execute format('create policy %I on public.%I for delete to anon, authenticated using (%s)', pt || '_hapus', t, q_tulis);
  end loop;
end $$;
