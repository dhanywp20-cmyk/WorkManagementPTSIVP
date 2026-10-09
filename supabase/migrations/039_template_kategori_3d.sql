-- 039_template_kategori_3d.sql
--
-- Tools Team > Desain 3D: Admin / Full Access dapat menjadikan desainnya sebagai TEMPLATE DEFAULT
-- sebuah kategori ruangan (Meeting, Auditorium, Mapping, ...). Siapa pun yang memilih kategori itu
-- mendapat isi ini, bukan template bawaan kode. Tanpa baris = template bawaan kode.
--
-- Yang disimpan SALINAN isinya (ruang + benda + gambar layar), bukan tautan ke tools_desain_ruang:
-- mengubah / menghapus desain asalnya tidak mengubah default kategori diam-diam.
--
-- RLS menyala tanpa policy, sama seperti tools_desain_ruang (027/028): hanya service role di
-- /api/tools-team/template-kategori yang menyentuhnya; hak Admin diperiksa di server.

create table if not exists public.tools_template_kategori (
  kategori text primary key check (kategori ~ '^[a-z][a-z-]{1,39}$'),
  nama text not null check (char_length(nama) between 1 and 120),
  data jsonb not null,
  ditetapkan_oleh uuid references public.users(id) on delete set null,
  ditetapkan_oleh_nama text,
  updated_at timestamptz not null default now()
);

alter table public.tools_template_kategori enable row level security;

comment on table public.tools_template_kategori is
  'Template default per kategori Desain 3D (Tools Team), ditetapkan Admin. Diakses lewat /api/tools-team/template-kategori.';
