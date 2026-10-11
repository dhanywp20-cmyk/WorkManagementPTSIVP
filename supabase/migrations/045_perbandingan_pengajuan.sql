-- 045: Product Comparison (Tools Team) - pengajuan verifikasi battle card dari Sales / Marketing.
-- Yang disimpan HANYA data hasil perbandingan (JSON teks + kutipan sumber), bukan berkas brosur / PDF.
-- Dihapus otomatis 30 hari setelah dibuat (API /api/tools-team/perbandingan/pengajuan) - hemat kuota Free.
-- RLS aktif tanpa policy: hanya service role (route API) yang membaca / menulis.
create table if not exists public.tools_perbandingan (
  id uuid primary key default gen_random_uuid(),
  dibuat_oleh uuid not null references public.users(id) on delete cascade,
  dibuat_nama text,
  judul text not null default '',
  data jsonb not null,
  status text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak')),
  catatan_verifikator text,
  diverifikasi_oleh uuid references public.users(id) on delete set null,
  diverifikasi_nama text,
  diverifikasi_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tools_perbandingan_pembuat_idx on public.tools_perbandingan (dibuat_oleh, created_at desc);
create index if not exists tools_perbandingan_status_idx on public.tools_perbandingan (status, created_at desc);
create index if not exists tools_perbandingan_verifikator_idx on public.tools_perbandingan (diverifikasi_oleh);
alter table public.tools_perbandingan enable row level security;
revoke all on public.tools_perbandingan from anon, authenticated;
