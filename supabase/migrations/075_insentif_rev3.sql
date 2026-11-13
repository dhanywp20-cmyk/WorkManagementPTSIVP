-- 075 - Incentive PTS: Proposal Rev3 (aditif, tidak menghapus data).
-- 1) users.tanggal_nonaktif: tanggal resign/tidak aktif. Hanya admin (service role) yang boleh mengubahnya.
-- 2) incentive_penetapan (+ log): Level A/B/C/D, cakupan kategori, Net Profit, status validasi, kunci.
--    Terkunci seperti incentive_nominal: tanpa kebijakan RLS, hanya service role (/api/incentive/penetapan).
-- 3) incentive_redistribusi: log redistribusi porsi anggota yang resign.
-- 4) incentive_splits.redistribusi_dari: baris "Redistribusi dari [nama]" di rekap.
-- 5) Skema Rev3 sebagai versi baru (versi lama tetap di riwayat).
-- 6) Tahapan yang BELUM diproses ikut skema Rev3; snapshot lama disimpan di scheme_snapshot_pra_rev3.
-- PENTING (sejak 074): kolom baru users wajib di-GRANT SELECT ke anon, authenticated.

alter table public.users add column if not exists tanggal_nonaktif date;
grant select (tanggal_nonaktif) on public.users to anon, authenticated;

create or replace function public.guard_users_privileged_columns()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role                  := 'guest';
    new.team_type             := 'Pending Approval';
    new.allow_incentive_input := coalesce(new.allow_incentive_input, false) and false;
    new.access_level          := 'guest';
    new.incentive_akses       := null;
    new.incentive_brand_scope := null;
    new.piket_akses           := null;
    new.piket_ubah            := false;
    new.pimpinan              := false;
    new.telegram_chat_id      := null;
    new.bisa_ditugaskan       := true;
    new.daftar_via_event      := false;
    new.pts_daerah            := null;
    new.tanggal_nonaktif      := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.role                  := old.role;
    new.team_type             := old.team_type;
    new.allow_incentive_input := old.allow_incentive_input;
    new.allowed_menus         := old.allowed_menus;
    new.access_level          := old.access_level;
    new.incentive_akses       := old.incentive_akses;
    new.incentive_brand_scope := old.incentive_brand_scope;
    new.piket_akses           := old.piket_akses;
    new.piket_ubah            := old.piket_ubah;
    new.pimpinan              := old.pimpinan;
    new.telegram_chat_id      := old.telegram_chat_id;
    new.bisa_ditugaskan       := old.bisa_ditugaskan;
    new.daftar_via_event      := old.daftar_via_event;
    new.pts_daerah            := old.pts_daerah;
    new.tanggal_nonaktif      := old.tanggal_nonaktif;

    new.username  := old.username;
    new.full_name := old.full_name;
    new.jabatan   := old.jabatan;

    new.sales_division    := old.sales_division;
    new.divisi            := old.divisi;
    new.pts_type          := old.pts_type;
    new.is_internal_sales := old.is_internal_sales;

    if not public.admin_atau_full_access() then
      new.atasan_id   := old.atasan_id;
      new.kpi_enabled := old.kpi_enabled;
    end if;

    return new;
  end if;

  return new;
end $function$;

create table if not exists public.incentive_penetapan (
  reminder_id     uuid primary key references public.reminders(id) on delete cascade,
  level           text not null check (level in ('A', 'B', 'C', 'D')),
  level_status    text not null default 'diusulkan' check (level_status in ('diusulkan', 'divalidasi')),
  cakupan         jsonb not null default '[]'::jsonb,
  cue             jsonb not null default '[]'::jsonb,
  net_profit      numeric check (net_profit >= 0),
  nominal         numeric check (nominal >= 0),
  nominal_dasar   text check (nominal_dasar in ('net_profit', 'flat', 'cue')),
  diusulkan_oleh  text,
  diusulkan_pada  timestamptz,
  divalidasi_oleh text,
  divalidasi_pada timestamptz,
  net_profit_oleh text,
  net_profit_pada timestamptz,
  diubah_pada     timestamptz not null default now()
);
alter table public.incentive_penetapan enable row level security;
alter table public.incentive_penetapan force row level security;
revoke all on public.incentive_penetapan from public, anon, authenticated;

create table if not exists public.incentive_penetapan_log (
  id          uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  aksi        text not null,
  dari        jsonb,
  ke          jsonb,
  alasan      text,
  oleh        text not null,
  pada        timestamptz not null default now()
);
create index if not exists incentive_penetapan_log_reminder on public.incentive_penetapan_log (reminder_id, pada desc);
alter table public.incentive_penetapan_log enable row level security;
alter table public.incentive_penetapan_log force row level security;
revoke all on public.incentive_penetapan_log from public, anon, authenticated;

create table if not exists public.incentive_redistribusi (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.reminders(id) on delete cascade,
  tranche_id     uuid references public.incentive_tranches(id) on delete cascade,
  tahun          integer not null,
  tahap          integer,
  sumber_user_id uuid,
  sumber_nama    text not null,
  nominal        numeric not null check (nominal >= 0),
  penerima       jsonb not null,
  dibuat_oleh    text,
  dibuat_pada    timestamptz not null default now()
);
create index if not exists incentive_redistribusi_project on public.incentive_redistribusi (project_id);
create index if not exists incentive_redistribusi_tranche on public.incentive_redistribusi (tranche_id);
alter table public.incentive_redistribusi enable row level security;
revoke all on public.incentive_redistribusi from public, anon, authenticated;
grant select, insert on public.incentive_redistribusi to anon, authenticated;
drop policy if exists ir_baca on public.incentive_redistribusi;
create policy ir_baca on public.incentive_redistribusi for select to anon, authenticated using (public.akses_insentif_input());
drop policy if exists ir_tambah on public.incentive_redistribusi;
create policy ir_tambah on public.incentive_redistribusi for insert to anon, authenticated with check (public.akses_insentif_input());

alter table public.incentive_splits add column if not exists redistribusi_dari text;

alter table public.incentive_tranches add column if not exists scheme_snapshot_pra_rev3 jsonb;

with rev3(s) as (select '{"versi":4,"porsi":[{"peran":"pic","label":"PIC Proyek","persen":60,"bagiRata":false},{"peran":"support","label":"Tim Support (Troubleshooting)","persen":17,"bagiRata":true},{"peran":"supervisor","label":"Supervisor","persen":15,"bagiRata":true},{"peran":"manager","label":"Manager","persen":8,"bagiRata":false}],"tanpaSupport":{"pic":77,"supervisor":15,"manager":8},"jendelaSupportBulan":12,"hangusSupervisorKe":"manager","managerSebagaiPic":{"adaSupport":{"pic":70,"support":30},"tanpaSupport":{"pic":100}},"installerAktif":true,"installerRemotePersen":30,"installerHanyaRemote":true,"installerBayarDiMuka":true,"tranche":[{"nomor":1,"persen":50,"tahunKe":1},{"nomor":2,"persen":35,"tahunKe":2},{"nomor":3,"persen":15,"tahunKe":3}],"porsiRemote":{"aktif":true,"adaSupport":{"pic":32.9,"installer":30,"support":12.4,"supervisor":16.5,"manager":8.2},"tanpaSupport":{"pic":45.3,"installer":30,"supervisor":16.5,"manager":8.2}},"supervisorSebagaiPic":{"aktif":true,"remote":{"adaSupport":{"pic":32.9,"installer":30,"support":12.4,"manager":24.7},"tanpaSupport":{"pic":45.3,"installer":30,"manager":24.7}},"onsite":{"adaSupport":{"pic":60,"support":17,"manager":23},"tanpaSupport":{"pic":77,"manager":23}}},"tarif":{"persenNetProfitA":1,"kategori":[{"kode":"led","label":"LED","item":[{"kode":"vx","label":"VX / TU sederhana","min":500000,"max":500000},{"kode":"h","label":"H series / advanced","min":1500000,"max":1500000}]},{"kode":"videowall","label":"Videowall","item":[{"kode":"4-9","label":"4–9 panel","min":1000000,"max":1000000},{"kode":"10-16","label":"10–16 panel","min":2000000,"max":2000000},{"kode":"17-30","label":"17–30 panel","min":3000000,"max":3000000},{"kode":">30","label":">30 panel","min":5000000,"max":5000000}]},{"kode":"projector","label":"Projector","item":[{"kode":"1","label":"1 unit","min":500000,"max":500000},{"kode":"2-3","label":"2–3 unit","min":1000000,"max":1000000},{"kode":"4-6","label":"4–6 unit","min":2000000,"max":2000000},{"kode":"blending","label":"Projection Blending","min":2000000,"max":3000000},{"kode":"immersive","label":"Immersive Projection","min":3000000,"max":5000000}]},{"kode":"avoip","label":"AV over IP","item":[{"kode":"avoip","label":"AV over IP","min":2000000,"max":5000000}]},{"kode":"matrix","label":"Matrix","item":[{"kode":"standalone","label":"Standalone","min":500000,"max":500000},{"kode":"endpoint","label":"+ Endpoint","min":1000000,"max":1000000},{"kode":"controller","label":"+ Controller & programming","min":1500000,"max":2000000}]},{"kode":"vp","label":"Video Processor","item":[{"kode":"standalone","label":"Standalone","min":750000,"max":750000},{"kode":"display","label":"+ Display","min":1000000,"max":1000000},{"kode":"videowall","label":"+ Videowall","min":2000000,"max":2000000},{"kode":"led","label":"+ LED","min":2000000,"max":2000000}]},{"kode":"ifp","label":"IFP / Signage","item":[{"kode":"1-5","label":"1–5 unit","min":500000,"max":500000},{"kode":"6-10","label":"6–10 unit","min":1000000,"max":1000000},{"kode":"11-20","label":"11–20 unit","min":1500000,"max":1500000},{"kode":"21-50","label":"21–50 unit","min":2500000,"max":2500000},{"kode":">50","label":">50 unit","min":4000000,"max":4000000}]},{"kode":"smr","label":"Smart Meeting Room","item":[{"kode":"tunggal","label":"Perangkat tunggal","min":250000,"max":500000}]},{"kode":"hospitality","label":"Hospitality TV","item":[{"kode":"1-50","label":"1–50 unit","min":1000000,"max":1000000},{"kode":"51-100","label":"51–100 unit","min":2000000,"max":2000000},{"kode":"101-250","label":"101–250 unit","min":3000000,"max":3000000},{"kode":"251-500","label":"251–500 unit","min":5000000,"max":5000000},{"kode":"501-800","label":"501–800 unit","min":7500000,"max":7500000},{"kode":">800","label":">800 unit","min":10000000,"max":10000000}]}],"cue":{"dasar":1000000,"item":[{"kode":"single","label":"Display / Projector / Sensor / Camera single","nominal":250000},{"kode":"multi","label":"Matrix / VP / Lighting / DSP / Camera multi","nominal":500000},{"kode":"tracking","label":"Camera tracking","nominal":750000},{"kode":"otomasi","label":"Automation kompleks / API cloud","nominal":1000000}]}}}'::jsonb),
baru as (
  insert into public.incentive_scheme_settings (scheme, updated_at, updated_by)
  select s, now(), 'migrasi-075 (Proposal Rev3)' from rev3
  returning id
)
update public.incentive_tranches t
   set scheme_snapshot_pra_rev3 = coalesce(t.scheme_snapshot_pra_rev3, t.scheme_snapshot),
       scheme_snapshot = rev3.s,
       scheme_label = 'Skema v4 (Rev3) · pic60/support17/supervisor15/manager8 · migrasi-075'
  from rev3
 where t.status = 'pending' and exists (select 1 from baru);
