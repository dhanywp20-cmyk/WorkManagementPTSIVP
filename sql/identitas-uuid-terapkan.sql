-- ============================================================================
--  IDENTITAS UUID - TERAPKAN: menuliskan usulan yang sudah Anda setujui
-- ============================================================================
--
--  Jalankan HANYA setelah membaca laporan sql/identitas-uuid-usulan.sql dan
--  membuang usulan yang tidak Anda setujui dari tabel `identitas_usulan`.
--
--  Berkas ini menulis apa yang ADA DI TABEL ITU - tidak lebih. Ia tidak
--  menebak apa pun sendiri. Kalau Anda menghapus satu baris usulan, baris
--  pekerjaan yang bersangkutan tetap kosong dan tetap bekerja lewat nama.
--
--  Penjagaan yang tetap berlaku walau tabelnya Anda sunting:
--    - hanya menyentuh baris yang uuid-nya MASIH KOSONG. Pemetaan yang sudah
--      benar tidak mungkin tertimpa.
--    - hanya user_id yang benar-benar ada di tabel users.
--    - satu nilai hanya boleh menunjuk satu orang. Kalau Anda tidak sengaja
--      memasukkan dua baris untuk nilai yang sama, berkas ini BERHENTI dengan
--      pesan galat, bukan memilih salah satu diam-diam.
--
--  Nama TIDAK diubah. Yang ditulis cuma kolom uuid-nya. "Dhany Wahyu (Remote
--  Bagas POC)" tetap tertulis apa adanya - keterangan installer remote di
--  dalamnya adalah catatan yang disengaja, dan menghapusnya berarti
--  menghilangkan keterangan yang tidak ada di tempat lain.
--
--  Kalau dijalankan lagi setelah berhasil, ia BERHENTI dengan pesan "Tabel
--  identitas_usulan belum ada" - tabel itu memang sudah dibersihkan. Itu galat
--  yang benar, bukan kegagalan: tidak ada baris yang berubah. Untuk putaran
--  berikutnya, jalankan usulan-nya lagi dari awal.
-- ============================================================================


-- ─── Penjagaan DAN penerapan, dalam SATU pernyataan ────────────────────────
--
--  Seluruhnya dibungkus satu blok DO, dan itu bukan gaya penulisan - itu
--  syarat keselamatan. Kalau penjagaan dan penerapan ditulis sebagai
--  pernyataan-pernyataan terpisah, RAISE di penjagaan memang menampilkan
--  galat, tapi psql (dan alat lain yang tidak menyalakan ON_ERROR_STOP) akan
--  MELANJUTKAN ke pernyataan berikutnya - penerapannya tetap jalan, dan
--  tabel usulannya tetap terhapus. Penjagaan yang bisa dilewati begitu bukan
--  penjagaan. Satu blok DO adalah satu pernyataan: gagal berarti tidak ada
--  satu pun baris yang berubah.
DO $terapkan$
DECLARE bentrok text;
BEGIN
  IF to_regclass('public.identitas_usulan') IS NULL THEN
    RAISE EXCEPTION 'Tabel identitas_usulan belum ada. Jalankan sql/identitas-uuid-usulan.sql dulu.';
  END IF;

  --  Satu nilai menunjuk dua orang = pertanyaan yang belum terjawab, bukan
  --  pilihan yang boleh diambil berkas ini.
  SELECT string_agg(format('%s.%s = %L', tabel, kolom, nilai), '; ')
    INTO bentrok
  FROM (SELECT tabel, kolom, nilai FROM identitas_usulan
        GROUP BY tabel, kolom, nilai HAVING count(DISTINCT user_id) > 1) b;
  IF bentrok IS NOT NULL THEN
    RAISE EXCEPTION 'Ada nilai yang diusulkan ke lebih dari satu orang: %. Buang salah satunya dulu.', bentrok;
  END IF;

  --  Usulan yang menunjuk akun yang sudah tidak ada tidak diterapkan.
  DELETE FROM identitas_usulan u
   WHERE NOT EXISTS (SELECT 1 FROM users x WHERE x.id = u.user_id);

  UPDATE tickets t SET sales_user_id = u.user_id FROM identitas_usulan u
    WHERE u.tabel='tickets' AND u.kolom='sales_name'
      AND t.sales_name = u.nilai AND t.sales_user_id IS NULL;
  UPDATE tickets t SET assign_user_id = u.user_id FROM identitas_usulan u
    WHERE u.tabel='tickets' AND u.kolom='assign_name'
      AND t.assign_name = u.nilai AND t.assign_user_id IS NULL;

  UPDATE reminders r SET sales_user_id = u.user_id FROM identitas_usulan u
    WHERE u.tabel='reminders' AND u.kolom='sales_name'
      AND r.sales_name = u.nilai AND r.sales_user_id IS NULL;
  UPDATE reminders r SET assign_user_id = u.user_id FROM identitas_usulan u
    WHERE u.tabel='reminders' AND u.kolom='assigned_to'
      AND r.assigned_to = u.nilai AND r.assign_user_id IS NULL;

  UPDATE project_requests p SET sales_user_id = u.user_id FROM identitas_usulan u
    WHERE u.tabel='project_requests' AND u.kolom='sales_name'
      AND p.sales_name = u.nilai AND p.sales_user_id IS NULL;
  UPDATE project_requests p SET assign_user_id = u.user_id FROM identitas_usulan u
    WHERE u.tabel='project_requests' AND u.kolom='assign_name'
      AND p.assign_name = u.nilai AND p.assign_user_id IS NULL;

  UPDATE form_reviews f SET sales_user_id = u.user_id FROM identitas_usulan u
    WHERE u.tabel='form_reviews' AND u.kolom='sales_name'
      AND f.sales_name = u.nilai AND f.sales_user_id IS NULL;
  UPDATE form_reviews f SET guest_user_id = u.user_id FROM identitas_usulan u
    WHERE u.tabel='form_reviews' AND u.kolom='guest_username'
      AND f.guest_username = u.nilai AND f.guest_user_id IS NULL;

  UPDATE progress_projects pp SET sales_user_id = u.user_id FROM identitas_usulan u
    WHERE u.tabel='progress_projects' AND u.kolom='sales_name'
      AND pp.sales_name = u.nilai AND pp.sales_user_id IS NULL;
  UPDATE progress_locations pl SET sales_user_id = u.user_id FROM identitas_usulan u
    WHERE u.tabel='progress_locations' AND u.kolom='sales_name'
      AND pl.sales_name = u.nilai AND pl.sales_user_id IS NULL;
  UPDATE progress_locations pl SET pic_user_id = u.user_id FROM identitas_usulan u
    WHERE u.tabel='progress_locations' AND u.kolom='pic'
      AND pl.pic = u.nilai AND pl.pic_user_id IS NULL;

  --  Dibersihkan di DALAM blok ini juga. Kalau ditaruh di luar, satu galat di
  --  atas akan tetap menghapus hasil pemeriksaan yang sudah Anda kerjakan.
  DROP TABLE IF EXISTS identitas_calon;
  DROP TABLE IF EXISTS identitas_sisa;
  DROP TABLE IF EXISTS identitas_usulan;
END $terapkan$;


-- ─── LAPORAN AKHIR ──────────────────────────────────────────────────────────
--  Query terakhir, supaya sekali Run langsung terlihat hasilnya.
--  Angka `belum_terpetakan` yang tersisa sekarang adalah orang-orang yang
--  memang tidak punya akun di platform ini. Itu bukan cacat: kolom namanya
--  tetap menjadi catatannya, dan memang untuk itu ia tidak dibuang.
SELECT tabel, kolom, terpetakan, belum_terpetakan,
       CASE WHEN terpetakan + belum_terpetakan = 0 THEN '-'
            ELSE round(100.0 * terpetakan / (terpetakan + belum_terpetakan)) || '%'
       END AS persen_terpetakan
FROM (
  SELECT 'tickets' AS tabel, 'sales_name' AS kolom,
         count(*) FILTER (WHERE sales_user_id IS NOT NULL) AS terpetakan,
         count(*) FILTER (WHERE sales_user_id IS NULL AND btrim(COALESCE(sales_name,'')) <> '') AS belum_terpetakan
  FROM tickets
  UNION ALL SELECT 'tickets', 'assign_name',
         count(*) FILTER (WHERE assign_user_id IS NOT NULL),
         count(*) FILTER (WHERE assign_user_id IS NULL AND btrim(COALESCE(assign_name,'')) <> '') FROM tickets
  UNION ALL SELECT 'reminders', 'sales_name',
         count(*) FILTER (WHERE sales_user_id IS NOT NULL),
         count(*) FILTER (WHERE sales_user_id IS NULL AND btrim(COALESCE(sales_name,'')) <> '') FROM reminders
  UNION ALL SELECT 'reminders', 'assigned_to',
         count(*) FILTER (WHERE assign_user_id IS NOT NULL),
         count(*) FILTER (WHERE assign_user_id IS NULL AND btrim(COALESCE(assigned_to,'')) <> '') FROM reminders
  UNION ALL SELECT 'project_requests', 'sales_name',
         count(*) FILTER (WHERE sales_user_id IS NOT NULL),
         count(*) FILTER (WHERE sales_user_id IS NULL AND btrim(COALESCE(sales_name,'')) <> '') FROM project_requests
  UNION ALL SELECT 'project_requests', 'assign_name',
         count(*) FILTER (WHERE assign_user_id IS NOT NULL),
         count(*) FILTER (WHERE assign_user_id IS NULL AND btrim(COALESCE(assign_name,'')) <> '') FROM project_requests
  UNION ALL SELECT 'form_reviews', 'sales_name',
         count(*) FILTER (WHERE sales_user_id IS NOT NULL),
         count(*) FILTER (WHERE sales_user_id IS NULL AND btrim(COALESCE(sales_name,'')) <> '') FROM form_reviews
  UNION ALL SELECT 'form_reviews', 'guest_username',
         count(*) FILTER (WHERE guest_user_id IS NOT NULL),
         count(*) FILTER (WHERE guest_user_id IS NULL AND btrim(COALESCE(guest_username,'')) <> '') FROM form_reviews
  UNION ALL SELECT 'progress_projects', 'sales_name',
         count(*) FILTER (WHERE sales_user_id IS NOT NULL),
         count(*) FILTER (WHERE sales_user_id IS NULL AND btrim(COALESCE(sales_name,'')) <> '') FROM progress_projects
  UNION ALL SELECT 'progress_locations', 'sales_name',
         count(*) FILTER (WHERE sales_user_id IS NOT NULL),
         count(*) FILTER (WHERE sales_user_id IS NULL AND btrim(COALESCE(sales_name,'')) <> '') FROM progress_locations
  UNION ALL SELECT 'progress_locations', 'pic',
         count(*) FILTER (WHERE pic_user_id IS NOT NULL),
         count(*) FILTER (WHERE pic_user_id IS NULL AND btrim(COALESCE(pic,'')) <> '') FROM progress_locations
) r
ORDER BY belum_terpetakan DESC, tabel, kolom;
