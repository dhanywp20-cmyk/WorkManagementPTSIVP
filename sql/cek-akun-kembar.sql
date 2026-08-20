-- ============================================================================
--  CEK AKUN KEMBAR - dua akun untuk satu orang, yang mana yang dipakai?
-- ============================================================================
--
--  HANYA MEMBACA. Aman dijalankan kapan saja.
--
--  Dipakai saat identitas-uuid-usulan.sql menjawab "ADA BEBERAPA CALON".
--  Sebabnya hampir selalu sama: satu orang punya dua akun, biasanya karena
--  namanya pernah ditulis dengan huruf besar-kecil yang berbeda.
--
--  Berkas ini tidak memutuskan apa pun. Ia menunjukkan JEJAK masing-masing
--  akun - berapa banyak pekerjaan yang sudah menempel padanya - supaya Anda
--  bisa memilih dengan alasan, bukan dengan menebak.
--
--  Cara membaca: pilih akun yang jejaknya paling banyak. Bukan karena akun itu
--  "lebih benar", tapi karena memilih yang lain berarti sisa pekerjaannya
--  harus ikut dipindahkan, dan setiap pemindahan adalah kesempatan baru untuk
--  salah. Kalau kedua akun sama-sama punya jejak, keduanya memang dipakai
--  bergantian - dan itu perlu dibereskan lebih dulu di Struktur Organisasi.
--
--  Akun yang tidak jadi dipakai JANGAN dihapus. Menghapusnya akan memutus
--  baris yang sudah menunjuk ke sana. Nonaktifkan saja.
-- ============================================================================

SELECT nama_seragam, username, full_name, role,
       tickets_sales + tickets_assign + reminders_sales + reminders_assign
     + preq_sales + preq_assign + freviews_sales + freviews_guest
     + pprojects + plocations_sales + plocations_pic AS total_jejak,
       tickets_sales, tickets_assign, reminders_sales, reminders_assign,
       preq_sales, preq_assign, freviews_sales, freviews_guest,
       pprojects, plocations_sales, plocations_pic,
       id
FROM (
  SELECT lower(btrim(u.full_name)) AS nama_seragam,
         u.username, u.full_name, u.role, u.id,
         (SELECT count(*) FROM tickets           x WHERE x.sales_user_id  = u.id) AS tickets_sales,
         (SELECT count(*) FROM tickets           x WHERE x.assign_user_id = u.id) AS tickets_assign,
         (SELECT count(*) FROM reminders         x WHERE x.sales_user_id  = u.id) AS reminders_sales,
         (SELECT count(*) FROM reminders         x WHERE x.assign_user_id = u.id) AS reminders_assign,
         (SELECT count(*) FROM project_requests  x WHERE x.sales_user_id  = u.id) AS preq_sales,
         (SELECT count(*) FROM project_requests  x WHERE x.assign_user_id = u.id) AS preq_assign,
         (SELECT count(*) FROM form_reviews      x WHERE x.sales_user_id  = u.id) AS freviews_sales,
         (SELECT count(*) FROM form_reviews      x WHERE x.guest_user_id  = u.id) AS freviews_guest,
         (SELECT count(*) FROM progress_projects x WHERE x.sales_user_id  = u.id) AS pprojects,
         (SELECT count(*) FROM progress_locations x WHERE x.sales_user_id = u.id) AS plocations_sales,
         (SELECT count(*) FROM progress_locations x WHERE x.pic_user_id   = u.id) AS plocations_pic
  FROM users u
  WHERE btrim(COALESCE(u.full_name,'')) <> ''
    AND EXISTS (SELECT 1 FROM users v
                 WHERE v.id <> u.id
                   AND lower(btrim(v.full_name)) = lower(btrim(u.full_name)))
) r
ORDER BY nama_seragam, total_jejak DESC, username;
