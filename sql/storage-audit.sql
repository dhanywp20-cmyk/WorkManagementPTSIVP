-- ============================================================================
-- AUDIT STORAGE — cari berkas boros yang menghabiskan kuota & egress
-- ============================================================================
--
--  SEMUANYA HANYA MEMBACA. Tidak ada satu pun perintah yang menghapus atau
--  mengubah data. Aman dijalankan kapan saja, berkali-kali.
--
--  Latar belakang: Unit Movement dulu mengunggah foto MENTAH tanpa kompresi
--  (sudah diperbaiki), jadi berkas lama di bucket 'movement-files' bisa
--  berukuran 3-8MB per foto. Query di bawah membantu menemukannya supaya kamu
--  bisa memutuskan mana yang layak dihapus.
--
--  Bucket yang dipakai aplikasi ini:
--    project-files    — Request Design Project & Project Progress
--    movement-files   — Unit Movement
--    review-photos    — Form Review
--    reminder-photos  — Request Schedule
--
--  Cara pakai: buka Supabase SQL Editor, jalankan satu blok pada satu waktu.
-- ============================================================================


-- ── 1. RINGKASAN PER BUCKET ─────────────────────────────────────────────────
--  Lihat dulu gambaran besarnya: bucket mana yang paling gemuk.
SELECT
  bucket_id                                                   AS bucket,
  COUNT(*)                                                    AS jumlah_berkas,
  pg_size_pretty(SUM((metadata->>'size')::bigint))            AS total_ukuran,
  pg_size_pretty(AVG((metadata->>'size')::bigint)::bigint)    AS rata_rata,
  pg_size_pretty(MAX((metadata->>'size')::bigint))            AS terbesar
FROM storage.objects
WHERE metadata->>'size' IS NOT NULL
GROUP BY bucket_id
ORDER BY SUM((metadata->>'size')::bigint) DESC;


-- ── 2. 50 BERKAS TERBESAR (semua bucket) ────────────────────────────────────
--  Kandidat utama untuk ditinjau.
SELECT
  bucket_id                                        AS bucket,
  name                                             AS path,
  pg_size_pretty((metadata->>'size')::bigint)      AS ukuran,
  metadata->>'mimetype'                            AS tipe,
  to_char(created_at, 'DD Mon YYYY')               AS diunggah
FROM storage.objects
WHERE metadata->>'size' IS NOT NULL
ORDER BY (metadata->>'size')::bigint DESC
LIMIT 50;


-- ── 3. FOTO BESAR YANG BELUM TERKOMPRES ─────────────────────────────────────
--  Gambar > 1MB. Setelah perbaikan, foto baru seharusnya 100-250KB — jadi
--  apa pun di atas 1MB hampir pasti unggahan lama sebelum kompresi aktif.
SELECT
  bucket_id                                        AS bucket,
  name                                             AS path,
  pg_size_pretty((metadata->>'size')::bigint)      AS ukuran,
  to_char(created_at, 'DD Mon YYYY')               AS diunggah
FROM storage.objects
WHERE metadata->>'mimetype' LIKE 'image/%'
  AND (metadata->>'size')::bigint > 1024 * 1024
ORDER BY (metadata->>'size')::bigint DESC;


-- ── 4. ESTIMASI PENGHEMATAN ─────────────────────────────────────────────────
--  Berapa yang bisa dihemat kalau foto > 1MB itu dikompres ulang ke ~200KB.
WITH besar AS (
  SELECT (metadata->>'size')::bigint AS ukuran
  FROM storage.objects
  WHERE metadata->>'mimetype' LIKE 'image/%'
    AND (metadata->>'size')::bigint > 1024 * 1024
)
SELECT
  COUNT(*)                                              AS jumlah_foto_besar,
  pg_size_pretty(SUM(ukuran))                           AS terpakai_sekarang,
  pg_size_pretty(COUNT(*) * 200 * 1024)                 AS perkiraan_setelah_kompres,
  pg_size_pretty(SUM(ukuran) - COUNT(*) * 200 * 1024)   AS potensi_hemat
FROM besar;


-- ── 5. BERKAS YATIM — SEMUA BUCKET ──────────────────────────────────────────
--  Berkas yang TIDAK lagi dirujuk baris mana pun di database — biasanya sisa
--  dari upload yang batal atau record yang sudah dihapus. Ini yang paling aman
--  dihapus karena sudah tidak dipakai fitur apa pun.
--
--  Pemetaan bucket → kolom yang merujuknya:
--    project-files   → project_attachments.file_url,
--                      progress_components.photo_url / photo_thumb_url
--    movement-files  → movement_logs.foto_surat_url / foto_barang_url
--    review-photos   → form_reviews.foto_dokumentasi_url
--    reminder-photos → reminders.completion_photo_url
--
--  Catatan: pencocokan memakai LIKE pada URL. PERIKSA hasilnya dulu sebelum
--  menghapus apa pun — jangan langsung percaya begitu saja.
SELECT
  o.bucket_id                                      AS bucket,
  o.name                                           AS path,
  pg_size_pretty((o.metadata->>'size')::bigint)    AS ukuran,
  to_char(o.created_at, 'DD Mon YYYY')             AS diunggah
FROM storage.objects o
WHERE
  CASE o.bucket_id
    WHEN 'project-files' THEN
      NOT EXISTS (SELECT 1 FROM project_attachments a WHERE a.file_url LIKE '%' || o.name)
      AND NOT EXISTS (
        SELECT 1 FROM progress_components c
        WHERE c.photo_url LIKE '%' || o.name OR c.photo_thumb_url LIKE '%' || o.name
      )
    WHEN 'movement-files' THEN
      NOT EXISTS (
        SELECT 1 FROM movement_logs m
        WHERE m.foto_surat_url LIKE '%' || o.name OR m.foto_barang_url LIKE '%' || o.name
      )
    WHEN 'review-photos' THEN
      NOT EXISTS (SELECT 1 FROM form_reviews f WHERE f.foto_dokumentasi_url LIKE '%' || o.name)
    WHEN 'reminder-photos' THEN
      NOT EXISTS (SELECT 1 FROM reminders r WHERE r.completion_photo_url LIKE '%' || o.name)
    ELSE false
  END
ORDER BY (o.metadata->>'size')::bigint DESC;


-- ============================================================================
--  CARA MENGHAPUS — JANGAN lewat SQL
-- ============================================================================
--
--  DELETE FROM storage.objects TIDAK disarankan: barisnya hilang dari tabel
--  tapi berkas fisiknya bisa tertinggal di penyimpanan, sehingga kuota tidak
--  benar-benar turun dan datanya jadi tak terlacak.
--
--  Pakai salah satu cara berikut:
--
--  a) Supabase Dashboard → Storage → pilih bucket → centang berkas → Delete.
--     Paling aman untuk jumlah sedikit; bisa dilihat dulu isinya sebelum
--     dihapus.
--
--  b) Untuk jumlah banyak, lewat API dengan service_role key:
--       const { error } = await supabase.storage
--         .from('movement-files')
--         .remove(['path/berkas-1.jpg', 'path/berkas-2.jpg']);
--     Ambil daftar path-nya dari hasil query 2/3/5 di atas.
--
--  SEBELUM MENGHAPUS: pastikan berkasnya memang tidak dipakai. Query 5 sudah
--  menyaring yang yatim untuk project-files, tapi untuk bucket lain periksa
--  dulu apakah URL-nya masih dirujuk (movement_logs, form_reviews, reminders).
-- ============================================================================
