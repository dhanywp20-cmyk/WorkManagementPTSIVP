-- 073: audit 13 Nov 2026. Enam bucket publik tidak punya batas ukuran file, sehingga akun yang login bisa
-- mengunggah file berukuran berapa pun (beban kuota storage 1 GB paket Free). File terbesar yang pernah
-- diunggah 5,7 MB; batas 25 MB memberi ruang longgar. Jenis file sengaja tidak dibatasi karena sebagian
-- unggahan lama tercatat application/octet-stream.
-- Batal: update storage.buckets set file_size_limit = null where id in (...).

update storage.buckets
   set file_size_limit = 26214400
 where id in ('project-files', 'ticket-photos', 'reminder-photos', 'movement-files', 'review-photos', 'reports')
   and file_size_limit is null;
