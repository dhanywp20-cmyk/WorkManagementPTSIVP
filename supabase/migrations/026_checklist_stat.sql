-- MIGRATION 026: ringkasan jumlah item per checklist dihitung di basis data.
--
-- Daftar proyek & detail proyek hanya butuh tiga angka per checklist
-- (total, selesai, kendala). Sebelumnya route server menarik SEMUA baris
-- item lalu menghitungnya sendiri - setiap buka daftar proyek = ribuan baris
-- keluar dari Supabase. Di paket gratis itu memakan kuota egress. View ini
-- mengirim satu baris per checklist.
--
-- security_invoker: view tunduk pada hak pemanggil. Hanya service role
-- (route server) yang membacanya; anon & authenticated tidak diberi akses.
create or replace view public.checklist_stat_daftar
with (security_invoker = true) as
select daftar_id,
       count(*)::int as total,
       (count(*) filter (where selesai))::int as selesai,
       (count(*) filter (where kendala and not selesai))::int as kendala
from public.checklist_item
group by daftar_id;

revoke all on public.checklist_stat_daftar from anon, authenticated;
