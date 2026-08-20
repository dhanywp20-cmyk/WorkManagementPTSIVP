-- ============================================================================
--  IDENTITAS UUID - USULAN: menawarkan tebakan, TIDAK menerapkannya
-- ============================================================================
--
--  HANYA MEMBACA tabel pekerjaan. Yang dibuat cuma satu tabel bantu,
--  `identitas_usulan`, dan itu tidak dipakai siapa pun sampai Anda menjalankan
--  sql/identitas-uuid-terapkan.sql.
--
--  Jalankan SETELAH identitas-uuid.sql dan identitas-uuid-lanjutan.sql.
--
--  Kenapa berkas ini terpisah. Sisa yang belum terpetakan hampir seluruhnya
--  NAMA DEPAN SAJA - "Rozaq", "Febri", "Adel", "Lutfi". Mencocokkan nama depan
--  ke nama lengkap itu tebakan, dan tebakan yang salah akan mengikat pekerjaan
--  seseorang ke orang lain tanpa pernah terlihat dari layar. Jadi berkas ini
--  hanya MENGUSULKAN; yang memutuskan Anda.
--
--  Aturan usulnya sengaja ketat - sebuah nilai hanya diusulkan bila:
--
--    a. panjangnya minimal 4 huruf. Nama sependek "Ar" cocok dengan "Arman"
--       DAN "Rinaldi Ardilas"; alat ini pernah tertipu persis begitu.
--    b. hanya ADA SATU akun yang cocok. Dua calon berarti tidak ada usulan.
--    c. cocoknya di batas kata, bukan di tengah kata. Tanpa aturan ini
--       "Febriana" akan dianggap mirip akun bernama "Ria", karena
--       Feb-ria-na memang memuat huruf r-i-a. Itu kebetulan, bukan kemiripan.
--
--  Tanda baca diabaikan saat mencocokkan, jadi "Rafi'i" dan "Rafii" dianggap
--  tulisan yang sama.
--
--  CARA PAKAI
--    1. Jalankan berkas ini. Baca laporannya.
--    2. Buang usulan yang Anda tidak setujui:
--         DELETE FROM identitas_usulan WHERE nilai = 'Febri';
--    3. Tambahkan yang alat ini tidak bisa tebak tapi Anda tahu jawabannya:
--         INSERT INTO identitas_usulan (tabel, kolom, nilai, user_id, nama_akun)
--         SELECT 'tickets', 'sales_name', 'Rafi''i', id, full_name
--         FROM users WHERE username = 'ashila';
--    4. Periksa sekali lagi:  SELECT * FROM identitas_usulan;
--    5. Jalankan sql/identitas-uuid-terapkan.sql.
--
--  Membatalkan: selama BELUM menjalankan berkas terapkan, tidak ada yang
--  berubah - cukup DROP TABLE identitas_usulan.
-- ============================================================================


-- ─── Nilai yang masih belum terpetakan ──────────────────────────────────────
DROP TABLE IF EXISTS identitas_sisa;
CREATE TABLE identitas_sisa AS
  SELECT 'tickets' AS tabel, 'sales_name' AS kolom, sales_name AS nilai, count(*)::bigint AS jumlah_baris
    FROM tickets WHERE sales_user_id IS NULL AND btrim(COALESCE(sales_name,'')) <> '' GROUP BY 3
  UNION ALL
  SELECT 'tickets', 'assign_name', assign_name, count(*)
    FROM tickets WHERE assign_user_id IS NULL AND btrim(COALESCE(assign_name,'')) <> '' GROUP BY 3
  UNION ALL
  SELECT 'reminders', 'sales_name', sales_name, count(*)
    FROM reminders WHERE sales_user_id IS NULL AND btrim(COALESCE(sales_name,'')) <> '' GROUP BY 3
  UNION ALL
  SELECT 'reminders', 'assigned_to', assigned_to, count(*)
    FROM reminders WHERE assign_user_id IS NULL AND btrim(COALESCE(assigned_to,'')) <> '' GROUP BY 3
  UNION ALL
  SELECT 'project_requests', 'sales_name', sales_name, count(*)
    FROM project_requests WHERE sales_user_id IS NULL AND btrim(COALESCE(sales_name,'')) <> '' GROUP BY 3
  UNION ALL
  SELECT 'project_requests', 'assign_name', assign_name, count(*)
    FROM project_requests WHERE assign_user_id IS NULL AND btrim(COALESCE(assign_name,'')) <> '' GROUP BY 3
  UNION ALL
  SELECT 'form_reviews', 'sales_name', sales_name, count(*)
    FROM form_reviews WHERE sales_user_id IS NULL AND btrim(COALESCE(sales_name,'')) <> '' GROUP BY 3
  UNION ALL
  SELECT 'form_reviews', 'guest_username', guest_username, count(*)
    FROM form_reviews WHERE guest_user_id IS NULL AND btrim(COALESCE(guest_username,'')) <> '' GROUP BY 3
  UNION ALL
  SELECT 'progress_projects', 'sales_name', sales_name, count(*)
    FROM progress_projects WHERE sales_user_id IS NULL AND btrim(COALESCE(sales_name,'')) <> '' GROUP BY 3
  UNION ALL
  SELECT 'progress_locations', 'sales_name', sales_name, count(*)
    FROM progress_locations WHERE sales_user_id IS NULL AND btrim(COALESCE(sales_name,'')) <> '' GROUP BY 3
  UNION ALL
  SELECT 'progress_locations', 'pic', pic, count(*)
    FROM progress_locations WHERE pic_user_id IS NULL AND btrim(COALESCE(pic,'')) <> '' GROUP BY 3;


-- ─── Calon: satu baris per (nilai, akun yang mungkin) ───────────────────────
--  rapi() membuang tanda baca dan merapikan spasi, lalu memberi bantalan spasi
--  di kedua ujung. Bantalan itulah yang membuat pencocokan berhenti di batas
--  kata: ' febriana rosana ' memuat ' febri', tapi tidak memuat ' ria'.
CREATE OR REPLACE FUNCTION rapi(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT ' ' || btrim(regexp_replace(lower(COALESCE(t,'')), '[^a-z0-9]+', ' ', 'g')) || ' ';
$$;

DROP TABLE IF EXISTS identitas_calon;
CREATE TABLE identitas_calon AS
  SELECT s.tabel, s.kolom, s.nilai, s.jumlah_baris,
         u.id AS user_id, u.full_name AS nama_akun,
         --  Cara mencocokkannya ikut dicatat, karena tidak semua cara sama
         --  kuatnya. 'kata utuh' hampir pasti benar; 'awalan kata' (Adel ->
         --  Adela Diovany) adalah tebakan yang masih perlu Anda benarkan.
         CASE
           WHEN rapi(u.full_name) LIKE '% ' || btrim(rapi(s.nilai)) || ' %' THEN 'kata utuh'
           WHEN rapi(s.nilai) LIKE '% ' || btrim(rapi(u.full_name)) || ' %' THEN 'nama akun ada di dalam nilai'
           ELSE 'awalan kata'
         END AS cara
  FROM identitas_sisa s
  JOIN users u
    ON length(btrim(regexp_replace(lower(s.nilai), '[^a-z0-9]+', '', 'g'))) >= 4
   AND btrim(COALESCE(u.full_name,'')) <> ''
   AND (
         --  nilai = satu kata utuh atau awalan kata di nama akun
         --  ' adela diovany '  LIKE  '% adel%'   -> ya
         --  ' ria '            LIKE  '% febriana%' -> tidak
         rapi(u.full_name) LIKE '%' || btrim(rapi(s.nilai)) || ' %'
         OR rapi(u.full_name) LIKE '% ' || btrim(rapi(s.nilai)) || '%'
         --  atau sebaliknya: nama akun utuh ada di dalam nilai
         --  'Dhany Wahyu (Remote Bagas POC)' memuat 'Dhany Wahyu'
         OR rapi(s.nilai) LIKE '%' || btrim(rapi(u.full_name)) || ' %'
       );


-- ─── Usulan: HANYA yang calonnya tepat satu ─────────────────────────────────
DROP TABLE IF EXISTS identitas_usulan;
CREATE TABLE identitas_usulan AS
  SELECT c.tabel, c.kolom, c.nilai, c.jumlah_baris, c.user_id, c.nama_akun, c.cara
  FROM identitas_calon c
  WHERE (SELECT count(DISTINCT c2.user_id) FROM identitas_calon c2
          WHERE c2.tabel = c.tabel AND c2.kolom = c.kolom AND c2.nilai = c.nilai) = 1;

DROP FUNCTION rapi(text);


-- ─── LAPORAN ────────────────────────────────────────────────────────────────
--  Query terakhir, supaya sekali Run langsung terlihat hasilnya.
--
--  Cara baca `putusan`:
--    USUL - periksa lalu terapkan   Satu calon. Sudah masuk identitas_usulan.
--                                   Baca nama_akun-nya: kalau salah orang,
--                                   DELETE baris itu sebelum menerapkan.
--    RAGU - lebih dari satu calon   Alat ini menolak memilihkan. Biasanya
--                                   karena ada dua akun untuk orang yang sama;
--                                   gabungkan akunnya, lalu ulangi.
--    TIDAK ADA AKUNNYA              Namanya tidak menyerupai akun mana pun.
--                                   Biarkan saja - baris tanpa uuid tetap
--                                   bekerja lewat nama seperti sebelumnya.
SELECT s.tabel, s.kolom, s.nilai, s.jumlah_baris,
       CASE WHEN n.jml = 1 THEN 'USUL - periksa lalu terapkan'
            WHEN n.jml > 1 THEN 'RAGU - lebih dari satu calon'
            ELSE 'TIDAK ADA AKUNNYA' END AS putusan,
       (SELECT string_agg(DISTINCT c.nama_akun, ' | ' ORDER BY c.nama_akun)
          FROM identitas_calon c
         WHERE c.tabel = s.tabel AND c.kolom = s.kolom AND c.nilai = s.nilai) AS calon,
       --  Seberapa kuat kecocokannya. 'kata utuh' hampir pasti benar;
       --  'awalan kata' adalah tebakan yang paling perlu Anda periksa.
       (SELECT string_agg(DISTINCT c.cara, ' | ')
          FROM identitas_calon c
         WHERE c.tabel = s.tabel AND c.kolom = s.kolom AND c.nilai = s.nilai) AS cara
FROM identitas_sisa s
LEFT JOIN LATERAL (
  SELECT count(DISTINCT c.user_id) AS jml FROM identitas_calon c
   WHERE c.tabel = s.tabel AND c.kolom = s.kolom AND c.nilai = s.nilai
) n ON true
ORDER BY (CASE WHEN n.jml = 1 THEN 1 WHEN n.jml > 1 THEN 2 ELSE 3 END),
         s.jumlah_baris DESC, s.tabel, s.kolom, s.nilai;
