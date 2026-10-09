-- Rollback 041: merek-files kembali hanya menerima gambar (nilai sebelum 041, dicatat 2026-10-09).
update storage.buckets
set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml','image/gif']
where id = 'merek-files';
