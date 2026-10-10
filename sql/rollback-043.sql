-- Rollback migrasi 043 (Objek saya Desain 3D). Menghapus SEMUA objek pribadi yang tersimpan.
drop table if exists public.tools_objek_saya;
