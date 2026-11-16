-- 077 - Issue Log harian lintas proyek (mis. "BPKP 33 Kota" = 3 proyek Project Progress).
--
--  isu_grup    : wadah yang menggabungkan beberapa checklist_proyek; lokasinya = checklist_daftar
--                dari proyek-proyek itu. Punya link share hanya-lihat sendiri (share_token).
--  isu_log     : satu baris = satu isu di satu lokasi, dengan status Open/On Progress/Pending/Solved.
--  isu_riwayat : jejak tiap perubahan (dibuat, ganti status, update action) - siapa & kapan.
--
--  Semua akses lewat route server (service_role). Tabel dikunci dari anon/authenticated,
--  sama seperti tabel checklist_* (025).

create table if not exists public.isu_grup (
  id               uuid primary key default gen_random_uuid(),
  nama             text not null,
  client           text,
  keterangan       text not null default '',
  proyek_ids       uuid[] not null default '{}',
  kategori         text[] not null default array['Display','Audio','Video Conference','Kontrol','Jaringan','Listrik','Furniture','Lainnya'],
  share_token      text unique,
  share_aktif      boolean not null default false,
  dibuat_oleh_nama text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.isu_log (
  id               uuid primary key default gen_random_uuid(),
  grup_id          uuid not null references public.isu_grup(id) on delete cascade,
  nomor            integer not null,
  daftar_id        uuid references public.checklist_daftar(id) on delete set null,
  lokasi           text not null,
  tanggal          date not null default ((now() at time zone 'Asia/Jakarta')::date),
  kategori         text not null default 'Lainnya',
  prioritas        text not null default 'sedang' check (prioritas in ('tinggi','sedang','rendah')),
  judul            text not null,
  deskripsi        text not null default '',
  pelapor          text not null default '',
  pic              text not null default '',
  status           text not null default 'open' check (status in ('open','progress','pending','solved')),
  action           text not null default '',
  solusi           text not null default '',
  catatan_internal text not null default '',
  foto_url         text,
  foto_thumb_url   text,
  selesai_pada     timestamptz,
  dibuat_oleh_nama text,
  diubah_oleh_nama text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (grup_id, nomor)
);

create table if not exists public.isu_riwayat (
  id          uuid primary key default gen_random_uuid(),
  isu_id      uuid not null references public.isu_log(id) on delete cascade,
  aksi        text not null,          -- dibuat | status | action | ubah
  dari        text,
  ke          text,
  keterangan  text not null default '',
  nama        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_isu_log_grup_tanggal on public.isu_log(grup_id, tanggal desc);
create index if not exists idx_isu_log_grup_status  on public.isu_log(grup_id, status);
create index if not exists idx_isu_log_daftar       on public.isu_log(daftar_id);
create index if not exists idx_isu_riwayat_isu      on public.isu_riwayat(isu_id, created_at);

create or replace function public.isu_sentuh() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_isu_grup_sentuh on public.isu_grup;
create trigger trg_isu_grup_sentuh before update on public.isu_grup
  for each row execute function public.isu_sentuh();
drop trigger if exists trg_isu_log_sentuh on public.isu_log;
create trigger trg_isu_log_sentuh before update on public.isu_log
  for each row execute function public.isu_sentuh();

alter table public.isu_grup    enable row level security;
alter table public.isu_log     enable row level security;
alter table public.isu_riwayat enable row level security;
revoke all on public.isu_grup    from anon, authenticated;
revoke all on public.isu_log     from anon, authenticated;
revoke all on public.isu_riwayat from anon, authenticated;
