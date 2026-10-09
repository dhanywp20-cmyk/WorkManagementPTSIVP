-- 041: bucket merek-files menerima berkas SUARA (suara notifikasi yang diunggah Admin,
-- Admin Panel › Kelompok & Notifikasi). Tulis tetap hanya Admin (policy merek_tulis:
-- boleh_tulis_pengaturan()); baca publik seperti logo. Batas ukuran per berkas di aplikasi 1 MB.
-- Rollback: sql/rollback-041.sql (kembali ke daftar gambar saja).
update storage.buckets
set allowed_mime_types = array[
  'image/png','image/jpeg','image/webp','image/svg+xml','image/gif',
  'audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/wave','audio/ogg','audio/webm','audio/mp4','audio/x-m4a','audio/aac'
]
where id = 'merek-files';
