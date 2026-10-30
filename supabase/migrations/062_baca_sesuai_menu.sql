-- 062: data tim hanya terbaca oleh yang PUNYA menunya (audit keamanan 30 Okt 2026).
--
-- Sebelumnya daily report, nilai KPI, dan catatan barang keluar-masuk terbaca SEMUA akun yang login (cukup
-- jwt sub ada) - termasuk ±106 akun tamu/Sales yang menunya memang tidak diberi (pemilik: "role itu tidak saya
-- allowed menu-nya"). Menu hanya menyembunyikan tombol; lewat REST dengan token sendiri datanya tetap bisa ditarik.
--
-- Sekarang baca = Admin / Team / Full Access / pimpinan seperti biasa, ATAU akun yang allowed_menus-nya memuat menu
-- itu (2 tamu punya daily-report, 4 tamu punya unit-movement - tetap bisa), ATAU baris miliknya sendiri. Tampilan
-- di aplikasi tidak berubah: halaman & widget dashboard yang membaca tabel ini sudah disaring menu yang sama.

create or replace function public.boleh_menu(p_menu text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select jwt_claim('sub') <> '' and (
    lingkup_semua()
    or admin_atau_full_access()
    or (select pimpinan_lihat_semua())
    or exists (select 1 from public.users u where u.id::text = jwt_claim('sub') and p_menu = any(coalesce(u.allowed_menus, '{}')))
  );
$$;

drop policy if exists "dr_baca" on public.daily_reports;
create policy "dr_baca" on public.daily_reports for select to anon, authenticated
  using (jwt_claim('sub') <> '' and ((user_id)::text = jwt_claim('sub') or public.boleh_menu('daily-report')));

drop policy if exists "drte_baca" on public.daily_report_team_entries;
create policy "drte_baca" on public.daily_report_team_entries for select to anon, authenticated
  using (jwt_claim('sub') <> '' and (entered_by = jwt_claim('username') or public.boleh_menu('daily-report')));

drop policy if exists "kmv_baca" on public.kpi_manual_values;
create policy "kmv_baca" on public.kpi_manual_values for select to anon, authenticated
  using (jwt_claim('sub') <> '' and ((user_id)::text = jwt_claim('sub') or public.boleh_menu('kpi-team')));

drop policy if exists "kps_baca" on public.kpi_period_snapshots;
create policy "kps_baca" on public.kpi_period_snapshots for select to anon, authenticated
  using (public.boleh_menu('kpi-team'));

drop policy if exists "kgs_baca" on public.kpi_global_settings;
create policy "kgs_baca" on public.kpi_global_settings for select to anon, authenticated
  using (public.boleh_menu('kpi-team'));

drop policy if exists "ml_baca" on public.movement_logs;
create policy "ml_baca" on public.movement_logs for select to anon, authenticated
  using (jwt_claim('sub') <> '' and (created_by = jwt_claim('username') or public.boleh_menu('unit-movement')));
