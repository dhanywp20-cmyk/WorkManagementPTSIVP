-- 044: gambar Desain 3D (tekstur lantai/dinding & gambar konten layar) disimpan SEKALI per isi.
--
-- Dulu tiap versi desain menyalin seluruh gambarnya (riwayat 10 versi = 10 salinan), dan gambar yang sama
-- di desain lain tersalin lagi. Sekarang data desain hanya menyimpan rujukan "ref:<hash>" (sidik SHA-256
-- isi gambar); gambarnya satu baris di sini dan dikirim ke peramban dengan cache permanen
-- (/api/tools-team/aset). Ber-RLS tanpa policy: hanya service role.
create table if not exists public.tools_gambar_desain (
  hash text primary key check (hash ~ '^[0-9a-f]{40}$'),
  data text not null,
  ukuran integer not null,
  dibuat_oleh uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists tools_gambar_desain_dibuat_oleh_idx on public.tools_gambar_desain (dibuat_oleh);
alter table public.tools_gambar_desain enable row level security;
comment on table public.tools_gambar_desain is
  'Gambar Desain 3D (tekstur & konten layar) per isi (SHA-256). Data desain hanya menyimpan ref:<hash>. Hanya service role.';

-- Hapus gambar yang tidak lagi dirujuk desain, versi, maupun template default (masa tenggang 1 hari untuk
-- gambar yang baru diunggah tapi desainnya belum selesai disimpan). Mengembalikan jumlah yang dihapus.
create or replace function public.bersihkan_gambar_desain() returns integer
language sql security definer set search_path = public as $$
  with dipakai as (
    select substr(v.value, 5) as h from public.tools_desain_ruang d,
      jsonb_each_text(coalesce(d.data->'layar', '{}'::jsonb) || coalesce(d.data->'tekstur', '{}'::jsonb)) v where v.value like 'ref:%'
    union
    select substr(v.value, 5) from public.tools_desain_ruang_versi d,
      jsonb_each_text(coalesce(d.data->'layar', '{}'::jsonb) || coalesce(d.data->'tekstur', '{}'::jsonb)) v where v.value like 'ref:%'
    union
    select substr(v.value, 5) from public.tools_template_kategori d,
      jsonb_each_text(coalesce(d.data->'layar', '{}'::jsonb) || coalesce(d.data->'tekstur', '{}'::jsonb)) v where v.value like 'ref:%'
  ), hapus as (
    delete from public.tools_gambar_desain g
    where g.created_at < now() - interval '1 day' and not exists (select 1 from dipakai where dipakai.h = g.hash)
    returning 1
  )
  select count(*)::int from hapus;
$$;
revoke all on function public.bersihkan_gambar_desain() from public, anon, authenticated;
