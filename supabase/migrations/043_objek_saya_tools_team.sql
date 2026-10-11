-- 043: "Objek saya" Desain 3D (Tools Team) - perpustakaan objek PRIBADI per akun.
-- Benda yang sudah diatur (ukuran, warna, teks, siluet, model 3D impor) disimpan per akun, dipakai lagi
-- di desain lain, dan bisa diekspor / diimpor antar akun lewat berkas .json (lib/objek-saya.ts).
-- Ber-RLS tanpa policy: hanya service role di /api/tools-team/objek-saya yang menyentuhnya, dan route
-- itu selalu membatasi user_id = akun yang masuk.
create table if not exists public.tools_objek_saya (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  nama text not null check (char_length(nama) between 1 and 80),
  ket text not null default '' check (char_length(ket) <= 120),
  jenis text not null,
  atur jsonb not null default '{}'::jsonb,
  -- Model 3D (GLB, data URL base64) untuk jenis 'model' - dibaca hanya saat objeknya dipasang.
  model text,
  ukuran_model integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tools_objek_saya_user_idx on public.tools_objek_saya (user_id, created_at desc);
alter table public.tools_objek_saya enable row level security;
comment on table public.tools_objek_saya is
  'Objek saya Desain 3D (Tools Team): objek pribadi per akun; ekspor/impor .json antar akun. Hanya lewat /api/tools-team/objek-saya (service role).';
