-- Rollback migrasi 044. PERHATIAN: desain yang sudah menyimpan rujukan "ref:<hash>" akan kehilangan gambarnya
-- (lantai/dinding/layar kembali bawaan). Jalankan hanya bila belum ada desain yang disimpan sesudah 044.
drop function if exists public.bersihkan_gambar_desain();
drop table if exists public.tools_gambar_desain;
