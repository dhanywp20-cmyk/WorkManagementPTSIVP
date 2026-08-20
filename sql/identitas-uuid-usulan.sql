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
--  Kenapa berkas ini terpisah, dan kenapa ia TIDAK mengisi apa pun sendiri.
--
--  Sisa yang belum terpetakan hampir semuanya nilai satu kata - "Rozaq",
--  "Adel", "Lutfi", "Nissa". Godaannya adalah menyimpulkan "itu nama depan,
--  tinggal dicocokkan ke nama lengkapnya". Kesimpulan itu tidak boleh diambil,
--  karena sebuah nilai satu kata bisa berarti DUA hal yang berbeda:
--
--    a. potongan nama seseorang yang PUNYA akun
--       "Adel"  ->  Adela Diovany
--
--    b. nama LENGKAP seseorang yang TIDAK punya akun
--       "Adel"  ->  orang bernama Adel, titik. Banyak orang memang bernama
--                   satu kata saja.
--
--  Dari sisi basis data, kedua kemungkinan itu terlihat persis sama. Tidak ada
--  aturan yang bisa memisahkannya - yang tahu cuma orang yang mengenal timnya.
--  Kalau (b) yang benar dan alat ini memilih (a), pekerjaan seseorang terikat
--  ke orang lain, dan itu tidak akan pernah terlihat dari layar.
--
--  Karena itu `identitas_usulan` lahir KOSONG. Berkas ini hanya menunjukkan
--  siapa saja calonnya dan seberapa kuat kecocokannya; yang memasukkan usulan
--  ke dalamnya Anda, satu per satu, lewat setujui().
--
--  Aturan pencarian calonnya tetap ketat - sebuah nilai hanya punya calon bila:
--
--    a. panjangnya minimal 4 huruf. Nama sependek "Ar" cocok dengan "Arman"
--       DAN "Rinaldi Ardilas"; alat ini pernah tertipu persis begitu.
--    b. hanya ADA SATU akun yang cocok. Dua calon berarti tidak ditawarkan.
--    c. cocoknya di batas kata, bukan di tengah kata. Tanpa aturan ini
--       "Febriana" akan dianggap mirip akun bernama "Ria", karena
--       Feb-ria-na memang memuat huruf r-i-a. Itu kebetulan, bukan kemiripan.
--
--  Tanda baca diabaikan saat mencocokkan, jadi "Rafi'i" dan "Rafii" dianggap
--  tulisan yang sama.
--
--  CARA PAKAI
--    1. Jalankan berkas ini. Baca laporannya - kolom `calon` dan `cara`.
--    2. Setujui yang menurut Anda benar, satu per satu:
--         SELECT setujui('Rozaq');
--         SELECT setujui('Dhany Wahyu (Remote Bagas POC)');
--       Kalau satu nilai muncul di beberapa tabel dan Anda hanya mau salah
--       satunya, sebutkan tabel & kolomnya:
--         SELECT setujui('tickets', 'sales_name', 'Lutfi');
--    3. Yang alat ini tidak bisa tebak tapi Anda tahu jawabannya, tunjuk akunnya
--       langsung lewat username:
--         SELECT setujui_ke('tickets', 'sales_name', 'Rafi''i', 'ashila');
--    4. Periksa sekali lagi:  SELECT * FROM identitas_usulan;
--       Salah setuju? Buang:  DELETE FROM identitas_usulan WHERE nilai = 'Adel';
--    5. Jalankan sql/identitas-uuid-terapkan.sql.
--
--  Yang TIDAK Anda setujui akan tetap kosong uuid-nya, dan itu bukan masalah -
--  baris tanpa uuid tetap bekerja lewat nama persis seperti sebelumnya.
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


-- ─── Kotak usulan - sengaja KOSONG ──────────────────────────────────────────
--  Dulu tabel ini diisi otomatis dengan semua calon tunggal. Itu keliru: ia
--  memutuskan bahwa nilai satu kata pasti potongan nama seseorang yang punya
--  akun, padahal bisa saja itu nama lengkap orang yang tidak punya akun.
--  Sekarang ia menunggu Anda.
DROP TABLE IF EXISTS identitas_usulan;
CREATE TABLE identitas_usulan (
  tabel        text NOT NULL,
  kolom        text NOT NULL,
  nilai        text NOT NULL,
  jumlah_baris bigint,
  user_id      uuid NOT NULL,
  nama_akun    text,
  cara         text
);

DROP FUNCTION rapi(text);


-- ─── setujui() - memasukkan satu keputusan Anda ke kotak usulan ─────────────
--
--  Hanya menerima nilai yang calonnya TEPAT SATU. Kalau calonnya nol atau
--  lebih dari satu, ia menolak dan mengatakan alasannya - bukan diam.

CREATE OR REPLACE FUNCTION setujui(p_tabel text, p_kolom text, p_nilai text)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE jml int; nama text;
BEGIN
  SELECT count(DISTINCT user_id), string_agg(DISTINCT nama_akun, ' | ')
    INTO jml, nama
  FROM identitas_calon
  WHERE tabel = p_tabel AND kolom = p_kolom AND nilai = p_nilai;

  IF jml = 0 THEN
    RETURN format('DITOLAK: %s.%s = %L tidak punya calon. Pakai setujui_ke() '
                  'kalau Anda tahu sendiri akunnya.', p_tabel, p_kolom, p_nilai);
  ELSIF jml > 1 THEN
    RETURN format('DITOLAK: %s.%s = %L punya %s calon (%s). Pakai setujui_ke() '
                  'untuk menyebut yang mana.', p_tabel, p_kolom, p_nilai, jml, nama);
  END IF;

  DELETE FROM identitas_usulan
   WHERE tabel = p_tabel AND kolom = p_kolom AND nilai = p_nilai;
  INSERT INTO identitas_usulan (tabel, kolom, nilai, jumlah_baris, user_id, nama_akun, cara)
  SELECT DISTINCT tabel, kolom, nilai, jumlah_baris, user_id, nama_akun, cara
  FROM identitas_calon
  WHERE tabel = p_tabel AND kolom = p_kolom AND nilai = p_nilai;

  RETURN format('OK: %s.%s = %L -> %s', p_tabel, p_kolom, p_nilai, nama);
END $fn$;

--  Bentuk pendek: menyetujui nilai itu di SEMUA tabel & kolom tempat ia muncul.
--  Berguna karena nama yang sama sering muncul di Ticketing dan Reminder
--  sekaligus, dan orangnya sudah pasti sama.
CREATE OR REPLACE FUNCTION setujui(p_nilai text)
RETURNS SETOF text LANGUAGE plpgsql AS $fn$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT tabel, kolom FROM identitas_calon WHERE nilai = p_nilai
  LOOP
    RETURN NEXT setujui(r.tabel, r.kolom, p_nilai);
  END LOOP;
  IF NOT FOUND THEN
    RETURN NEXT format('DITOLAK: %L tidak punya calon di tabel mana pun.', p_nilai);
  END IF;
END $fn$;

--  Menunjuk akunnya sendiri lewat username - untuk yang alat ini tidak bisa
--  tebak, atau yang calonnya lebih dari satu dan Anda tahu yang mana.
--  Tidak dibatasi daftar calon: keputusan Anda mengalahkan tebakan alat.
CREATE OR REPLACE FUNCTION setujui_ke(p_tabel text, p_kolom text, p_nilai text, p_username text)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE u record; ada bigint;
BEGIN
  SELECT id, full_name INTO u FROM users
   WHERE lower(btrim(username)) = lower(btrim(p_username));
  IF u.id IS NULL THEN
    RETURN format('DITOLAK: tidak ada akun dengan username %L.', p_username);
  END IF;

  SELECT jumlah_baris INTO ada FROM identitas_sisa
   WHERE tabel = p_tabel AND kolom = p_kolom AND nilai = p_nilai;
  IF ada IS NULL THEN
    RETURN format('DITOLAK: %s.%s = %L tidak ada di daftar yang belum terpetakan. '
                  'Salah ketik, atau baris itu sudah punya uuid.', p_tabel, p_kolom, p_nilai);
  END IF;

  DELETE FROM identitas_usulan
   WHERE tabel = p_tabel AND kolom = p_kolom AND nilai = p_nilai;
  INSERT INTO identitas_usulan (tabel, kolom, nilai, jumlah_baris, user_id, nama_akun, cara)
  VALUES (p_tabel, p_kolom, p_nilai, ada, u.id, u.full_name, 'ditetapkan manual');

  RETURN format('OK: %s.%s = %L -> %s (%s baris)', p_tabel, p_kolom, p_nilai, u.full_name, ada);
END $fn$;


-- ─── LAPORAN ────────────────────────────────────────────────────────────────
--  Query terakhir, supaya sekali Run langsung terlihat hasilnya.
--
--  Cara baca `putusan`:
--    ADA 1 CALON       Alat ini menemukan satu akun yang cocok - itu TAWARAN,
--                      bukan kesimpulan. Kalau menurut Anda benar orangnya:
--                        SELECT setujui('<nilai>');
--                      Kalau nilai itu ternyata nama lengkap orang lain yang
--                      tidak punya akun, biarkan saja. Tidak perlu apa-apa.
--    ADA BEBERAPA      Dua calon atau lebih. Alat ini menolak memilihkan.
--                      Sebutkan sendiri: setujui_ke(tabel, kolom, nilai,
--                      username). Kalau sebabnya satu orang punya dua akun,
--                      lebih baik gabungkan akunnya lalu ulangi dari awal.
--    TANPA CALON       Tidak menyerupai akun mana pun. Biarkan - besar
--                      kemungkinan ini catatan dari masa platform ini masih
--                      Ticketing saja, dan orangnya memang tidak pernah punya
--                      akun. Baris tanpa uuid tetap bekerja lewat nama.
--    SUDAH ANDA SETUJUI  Sudah masuk kotak usulan, menunggu berkas terapkan.
--
--  `cara` menyebut seberapa kuat kecocokannya:
--    kata utuh                     nilai adalah satu kata penuh di nama akun
--                                  (Rozaq di Muhammad Rozaq)
--    nama akun ada di dalam nilai  nama akun utuh ada di dalam nilai
--                                  (Dhany Wahyu di "Dhany Wahyu (Remote ...)")
--    awalan kata                   nilai hanya AWALAN sebuah kata
--                                  (Adel -> Adela Diovany). Ini yang paling
--                                  perlu Anda periksa: "Adel" juga bisa nama
--                                  lengkap orang yang tidak punya akun.
SELECT s.tabel, s.kolom, s.nilai, s.jumlah_baris,
       CASE WHEN u.sudah THEN 'SUDAH ANDA SETUJUI'
            WHEN n.jml = 1 THEN 'ADA 1 CALON - setujui sendiri kalau benar'
            WHEN n.jml > 1 THEN 'ADA BEBERAPA CALON - sebut yang mana'
            ELSE 'TANPA CALON - biarkan' END AS putusan,
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
LEFT JOIN LATERAL (
  SELECT true AS sudah FROM identitas_usulan iu
   WHERE iu.tabel = s.tabel AND iu.kolom = s.kolom AND iu.nilai = s.nilai LIMIT 1
) u ON true
ORDER BY (CASE WHEN n.jml = 1 THEN 1 WHEN n.jml > 1 THEN 2 ELSE 3 END),
         s.jumlah_baris DESC, s.tabel, s.kolom, s.nilai;
