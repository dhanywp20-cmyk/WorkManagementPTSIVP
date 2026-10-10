-- 042: indeks untuk dua foreign key Tools Team yang dilaporkan advisor Supabase
-- (unindexed_foreign_keys). Tanpa indeks, menghapus/mengubah user memindai seluruh
-- tabel ini. Hanya menambah indeks - tidak mengubah data.
create index if not exists tools_pustaka_dibuat_oleh_idx
  on public.tools_pustaka (dibuat_oleh);
create index if not exists tools_template_kategori_ditetapkan_oleh_idx
  on public.tools_template_kategori (ditetapkan_oleh);
