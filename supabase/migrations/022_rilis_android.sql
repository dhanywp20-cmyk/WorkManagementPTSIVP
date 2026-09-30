-- Rilis APK Android yang diunggah admin dari Admin Panel -> Aplikasi Android.
-- Berkas APK disimpan di bucket PRIVAT "aplikasi-android"; unduhan lewat
-- /api/android/unduh (sesi wajib) yang memberi signed URL berumur pendek.
-- Tabel & bucket hanya disentuh service role lewat route server: RLS aktif
-- tanpa policy = tertutup untuk anon/authenticated.

create table if not exists public.rilis_android (
  id            uuid primary key default gen_random_uuid(),
  versi         text        not null check (versi ~ '^[0-9A-Za-z.\-]{1,32}$'),
  kode_versi    integer     not null unique check (kode_versi > 0),
  ukuran        bigint      not null check (ukuran > 0),
  path          text,
  catatan       text        check (char_length(catatan) <= 2000),
  wajib         boolean     not null default false,
  diunggah_oleh uuid        references public.users(id) on delete set null,
  diunggah_pada timestamptz not null default now()
);
create index if not exists rilis_android_diunggah_oleh_idx on public.rilis_android (diunggah_oleh);
alter table public.rilis_android enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aplikasi-android', 'aplikasi-android', false, 104857600,
        array['application/vnd.android.package-archive'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
