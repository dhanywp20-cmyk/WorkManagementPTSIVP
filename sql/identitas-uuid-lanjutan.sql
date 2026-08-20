-- ============================================================================
--  IDENTITAS UUID - PUTARAN KEDUA: mengejar baris yang tahap 1-2 tinggalkan
-- ============================================================================
--
--  Jalankan SETELAH sql/identitas-uuid.sql.
--
--  Tahap 1-2 hanya memetakan nama yang cocok PERSIS dengan tepat satu akun.
--  Itu keputusan yang benar, dan sisanya bukan kegagalan - laporannya adalah
--  peta seberapa kacau penulisan nama selama ini. Berkas ini mengejar sisa itu
--  dengan tiga cara, diurutkan dari yang paling pasti ke yang paling longgar:
--
--    BAGIAN 1  Lewat tautan baris, BUKAN lewat nama sama sekali. Sebuah Form
--              Review tahu reminder asalnya; sebuah lokasi Project Progress
--              tahu reminder yang melahirkannya. Identitasnya tinggal disalin.
--              Ini bukan tebakan - ini baris yang sama.
--
--    BAGIAN 2  Nama yang sama tapi ditulis beda huruf besar-kecil atau
--              kelebihan spasi. Hanya diterapkan bila setelah disamakan pun
--              namanya tetap dimiliki TEPAT SATU akun.
--
--    BAGIAN 3  Nilainya ternyata username, bukan nama. Di Ticketing ini nyata:
--              kolom sales_name pernah diisi username, nama depan, dan nama
--              lengkap - itulah kenapa kodenya dulu punya "SAFETY NET" yang
--              mencocokkan ke tiga hal sekaligus. Hanya diterapkan bila
--              nilainya TIDAK cocok dengan nama akun siapa pun, supaya tidak
--              ada baris yang punya dua calon pemilik.
--
--  Yang TIDAK dikerjakan berkas ini: menebak ejaan yang berbeda ("Rafii" vs
--  "Ashila Rafi Muhammadi") dan memilih di antara dua akun bernama sama. Itu
--  keputusan tentang orang, bukan tentang data, dan hanya Anda yang tahu
--  jawabannya. BAGIAN 4 mendaftarkan sisanya lengkap dengan alasannya.
--
--  Satu tautan sengaja TIDAK dipakai: tickets.reminder_id. Tautan itu berarti
--  "ticket ini tentang project yang sama", bukan "Sales-nya orang yang sama" -
--  ticket Troubleshooting bisa diajukan Sales lain atas project yang sama.
--  Menyalin identitas lewat situ akan mengikat pekerjaan seseorang ke orang
--  lain, persis kesalahan yang sedang dibereskan. Kalau nama keduanya memang
--  sama, BAGIAN 2 sudah menanganinya tanpa perlu menebak.
--
--  AMAN diulang. Setiap UPDATE hanya menyentuh baris yang uuid-nya MASIH
--  KOSONG, jadi menjalankannya dua kali tidak mengubah apa pun di putaran
--  kedua, dan tidak ada pemetaan yang sudah benar yang bisa tertimpa.
-- ============================================================================


-- ─── BAGIAN 1. Lewat tautan baris - tanpa menyentuh nama sama sekali ────────
--  Kolom source_reminder_id dan reminder_id adalah tautan sungguhan ke baris
--  asalnya. Menyalin identitas lewat jalur ini tidak mungkin salah orang.

--  Form Review lahir dari sebuah reminder; Sales-nya orang yang sama.
UPDATE form_reviews f SET sales_user_id = r.sales_user_id
  FROM reminders r
  WHERE f.reminder_id = r.id AND f.sales_user_id IS NULL AND r.sales_user_id IS NOT NULL;

--  Guest yang diminta mengisi review = Sales yang tercatat di reminder itu.
UPDATE form_reviews f SET guest_user_id = r.sales_user_id
  FROM reminders r
  WHERE f.reminder_id = r.id AND f.guest_user_id IS NULL AND r.sales_user_id IS NOT NULL;

--  Proyek & lokasi Project Progress yang lahir otomatis dari reminder.
UPDATE progress_projects p SET sales_user_id = r.sales_user_id
  FROM reminders r
  WHERE p.source_reminder_id = r.id AND p.sales_user_id IS NULL AND r.sales_user_id IS NOT NULL;

UPDATE progress_locations l SET sales_user_id = r.sales_user_id
  FROM reminders r
  WHERE l.source_reminder_id = r.id AND l.sales_user_id IS NULL AND r.sales_user_id IS NOT NULL;

--  PIC lokasi = orang yang di-assign di reminder-nya.
UPDATE progress_locations l SET pic_user_id = r.assign_user_id
  FROM reminders r
  WHERE l.source_reminder_id = r.id AND l.pic_user_id IS NULL AND r.assign_user_id IS NOT NULL;


-- ─── BAGIAN 2 & 3. Lewat nama yang dilonggarkan, dan lewat username ─────────
--
--  akun_nama_longgar : nama disamakan huruf besar-kecilnya & dirapikan
--                      spasinya. HAVING count(*) = 1 memastikan hasilnya tetap
--                      menunjuk satu orang - dua akun "Reka Destiandi" dan
--                      "reka destiandi" justru saling membatalkan di sini, dan
--                      itu memang yang diinginkan: keduanya dibiarkan kosong
--                      sampai Anda memutuskan mana yang dipakai.
--
--  akun_username     : username selalu unik, tapi tetap dijaga count(*) = 1
--                      supaya perbedaan huruf besar-kecil tidak diam-diam
--                      menyatukan dua akun.
--
--  (array_agg(id))[1], bukan min(id): Postgres tidak punya min() untuk uuid.
--  Aman karena HAVING sudah memastikan grupnya berisi tepat satu baris.

CREATE OR REPLACE VIEW akun_nama_longgar AS
  SELECT lower(btrim(full_name)) AS kunci, (array_agg(id))[1] AS id
  FROM users
  WHERE full_name IS NOT NULL AND btrim(full_name) <> ''
  GROUP BY 1 HAVING count(*) = 1;

CREATE OR REPLACE VIEW akun_username AS
  SELECT lower(btrim(username)) AS kunci, (array_agg(id))[1] AS id
  FROM users
  WHERE username IS NOT NULL AND btrim(username) <> ''
  GROUP BY 1 HAVING count(*) = 1;

--  Kunci yang dipakai nama akun MANA PUN - termasuk nama yang dimiliki dua
--  orang. Dipakai sebagai penjaga di BAGIAN 3: kalau sebuah nilai sudah
--  terpakai sebagai nama seseorang, ia TIDAK boleh dipetakan lewat username,
--  karena berarti ada dua calon pemilik dan kita tidak tahu yang mana.
CREATE OR REPLACE VIEW kunci_nama_terpakai AS
  SELECT DISTINCT lower(btrim(full_name)) AS kunci
  FROM users WHERE full_name IS NOT NULL AND btrim(full_name) <> '';

-- BAGIAN 2 - nama longgar
UPDATE tickets t SET sales_user_id = a.id FROM akun_nama_longgar a
  WHERE lower(btrim(t.sales_name)) = a.kunci AND t.sales_user_id IS NULL;
UPDATE tickets t SET assign_user_id = a.id FROM akun_nama_longgar a
  WHERE lower(btrim(t.assign_name)) = a.kunci AND t.assign_user_id IS NULL;

UPDATE reminders r SET sales_user_id = a.id FROM akun_nama_longgar a
  WHERE lower(btrim(r.sales_name)) = a.kunci AND r.sales_user_id IS NULL;

UPDATE project_requests p SET sales_user_id = a.id FROM akun_nama_longgar a
  WHERE lower(btrim(p.sales_name)) = a.kunci AND p.sales_user_id IS NULL;
UPDATE project_requests p SET assign_user_id = a.id FROM akun_nama_longgar a
  WHERE lower(btrim(p.assign_name)) = a.kunci AND p.assign_user_id IS NULL;

UPDATE form_reviews f SET sales_user_id = a.id FROM akun_nama_longgar a
  WHERE lower(btrim(f.sales_name)) = a.kunci AND f.sales_user_id IS NULL;

UPDATE progress_projects pp SET sales_user_id = a.id FROM akun_nama_longgar a
  WHERE lower(btrim(pp.sales_name)) = a.kunci AND pp.sales_user_id IS NULL;
UPDATE progress_locations pl SET sales_user_id = a.id FROM akun_nama_longgar a
  WHERE lower(btrim(pl.sales_name)) = a.kunci AND pl.sales_user_id IS NULL;
UPDATE progress_locations pl SET pic_user_id = a.id FROM akun_nama_longgar a
  WHERE lower(btrim(pl.pic) ) = a.kunci AND pl.pic_user_id IS NULL;

-- BAGIAN 3 - nilainya ternyata username
--  Kolom guest_username & assigned_to memang berisi username, jadi tidak perlu
--  penjagaan nama: yang dijaga hanya kolom yang SEHARUSNYA berisi nama.
UPDATE form_reviews f SET guest_user_id = a.id FROM akun_username a
  WHERE lower(btrim(f.guest_username)) = a.kunci AND f.guest_user_id IS NULL;

UPDATE reminders r SET assign_user_id = a.id FROM akun_username a
  WHERE lower(btrim(r.assigned_to)) = a.kunci AND r.assign_user_id IS NULL;

--  Sisanya kolom nama yang ternyata diisi username - wajib lewat penjagaan.
UPDATE tickets t SET sales_user_id = a.id FROM akun_username a
  WHERE lower(btrim(t.sales_name)) = a.kunci AND t.sales_user_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM kunci_nama_terpakai k WHERE k.kunci = lower(btrim(t.sales_name)));
UPDATE tickets t SET assign_user_id = a.id FROM akun_username a
  WHERE lower(btrim(t.assign_name)) = a.kunci AND t.assign_user_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM kunci_nama_terpakai k WHERE k.kunci = lower(btrim(t.assign_name)));

UPDATE reminders r SET sales_user_id = a.id FROM akun_username a
  WHERE lower(btrim(r.sales_name)) = a.kunci AND r.sales_user_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM kunci_nama_terpakai k WHERE k.kunci = lower(btrim(r.sales_name)));

UPDATE project_requests p SET sales_user_id = a.id FROM akun_username a
  WHERE lower(btrim(p.sales_name)) = a.kunci AND p.sales_user_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM kunci_nama_terpakai k WHERE k.kunci = lower(btrim(p.sales_name)));
UPDATE project_requests p SET assign_user_id = a.id FROM akun_username a
  WHERE lower(btrim(p.assign_name)) = a.kunci AND p.assign_user_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM kunci_nama_terpakai k WHERE k.kunci = lower(btrim(p.assign_name)));

UPDATE form_reviews f SET sales_user_id = a.id FROM akun_username a
  WHERE lower(btrim(f.sales_name)) = a.kunci AND f.sales_user_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM kunci_nama_terpakai k WHERE k.kunci = lower(btrim(f.sales_name)));

UPDATE progress_locations pl SET pic_user_id = a.id FROM akun_username a
  WHERE lower(btrim(pl.pic)) = a.kunci AND pl.pic_user_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM kunci_nama_terpakai k WHERE k.kunci = lower(btrim(pl.pic)));

--  BAGIAN 1 diulang sekali lagi: reminders baru saja bertambah yang terpetakan
--  di BAGIAN 2 & 3, jadi tautan yang tadi belum punya sumber sekarang punya.
UPDATE form_reviews f SET sales_user_id = r.sales_user_id
  FROM reminders r
  WHERE f.reminder_id = r.id AND f.sales_user_id IS NULL AND r.sales_user_id IS NOT NULL;
UPDATE form_reviews f SET guest_user_id = r.sales_user_id
  FROM reminders r
  WHERE f.reminder_id = r.id AND f.guest_user_id IS NULL AND r.sales_user_id IS NOT NULL;
UPDATE progress_projects p SET sales_user_id = r.sales_user_id
  FROM reminders r
  WHERE p.source_reminder_id = r.id AND p.sales_user_id IS NULL AND r.sales_user_id IS NOT NULL;
UPDATE progress_locations l SET sales_user_id = r.sales_user_id
  FROM reminders r
  WHERE l.source_reminder_id = r.id AND l.sales_user_id IS NULL AND r.sales_user_id IS NOT NULL;
UPDATE progress_locations l SET pic_user_id = r.assign_user_id
  FROM reminders r
  WHERE l.source_reminder_id = r.id AND l.pic_user_id IS NULL AND r.assign_user_id IS NOT NULL;

DROP VIEW akun_nama_longgar;
DROP VIEW akun_username;
DROP VIEW kunci_nama_terpakai;


-- ─── BAGIAN 4. LAPORAN: apa yang tersisa, dan kenapa ────────────────────────
--  Query terakhir, supaya sekali Run langsung terlihat hasilnya.
--
--  Kolom `sebab` memberi tahu apa yang harus Anda kerjakan:
--
--    dimiliki lebih dari satu akun   Dua akun bernama sama. Putuskan mana yang
--                                    dipakai, gabungkan/nonaktifkan yang lain,
--                                    lalu jalankan ulang berkas ini.
--    tidak cocok dengan akun mana pun  Ejaannya berbeda, atau orangnya sudah
--                                    tidak punya akun. Betulkan ejaannya di
--                                    baris itu, atau biarkan - baris tanpa
--                                    uuid tetap bekerja lewat nama.
--
--  Kolom `paling_mirip` menunjukkan akun yang namanya memuat potongan nilai
--  itu. Ini PETUNJUK, bukan jawaban - pencocokannya kasar dan sengaja tidak
--  diterapkan otomatis.
SELECT tabel, kolom, nilai, jumlah_baris, sebab, paling_mirip
FROM (
  SELECT tabel, kolom, nilai, count(*)::bigint AS jumlah_baris,
         CASE WHEN (SELECT count(*) FROM users u
                    WHERE lower(btrim(u.full_name)) = lower(btrim(nilai))) > 1
              THEN 'dimiliki lebih dari satu akun'
              ELSE 'tidak cocok dengan akun mana pun' END AS sebab,
         (SELECT string_agg(DISTINCT u.full_name, ' | ')
            FROM users u
           WHERE length(btrim(nilai)) >= 4
             AND (u.full_name ILIKE '%' || btrim(nilai) || '%'
                  OR btrim(nilai) ILIKE '%' || u.full_name || '%')) AS paling_mirip
  FROM (
    SELECT 'tickets' AS tabel, 'sales_name' AS kolom, sales_name AS nilai FROM tickets
      WHERE sales_user_id IS NULL AND sales_name IS NOT NULL AND btrim(sales_name) <> ''
    UNION ALL SELECT 'tickets', 'assign_name', assign_name FROM tickets
      WHERE assign_user_id IS NULL AND assign_name IS NOT NULL AND btrim(assign_name) <> ''
    UNION ALL SELECT 'reminders', 'sales_name', sales_name FROM reminders
      WHERE sales_user_id IS NULL AND sales_name IS NOT NULL AND btrim(sales_name) <> ''
    UNION ALL SELECT 'reminders', 'assigned_to', assigned_to FROM reminders
      WHERE assign_user_id IS NULL AND assigned_to IS NOT NULL AND btrim(assigned_to) <> ''
    UNION ALL SELECT 'project_requests', 'sales_name', sales_name FROM project_requests
      WHERE sales_user_id IS NULL AND sales_name IS NOT NULL AND btrim(sales_name) <> ''
    UNION ALL SELECT 'project_requests', 'assign_name', assign_name FROM project_requests
      WHERE assign_user_id IS NULL AND assign_name IS NOT NULL AND btrim(assign_name) <> ''
    UNION ALL SELECT 'form_reviews', 'sales_name', sales_name FROM form_reviews
      WHERE sales_user_id IS NULL AND sales_name IS NOT NULL AND btrim(sales_name) <> ''
    UNION ALL SELECT 'form_reviews', 'guest_username', guest_username FROM form_reviews
      WHERE guest_user_id IS NULL AND guest_username IS NOT NULL AND btrim(guest_username) <> ''
    UNION ALL SELECT 'progress_projects', 'sales_name', sales_name FROM progress_projects
      WHERE sales_user_id IS NULL AND sales_name IS NOT NULL AND btrim(sales_name) <> ''
    UNION ALL SELECT 'progress_locations', 'sales_name', sales_name FROM progress_locations
      WHERE sales_user_id IS NULL AND sales_name IS NOT NULL AND btrim(sales_name) <> ''
    UNION ALL SELECT 'progress_locations', 'pic', pic FROM progress_locations
      WHERE pic_user_id IS NULL AND pic IS NOT NULL AND btrim(pic) <> ''
  ) sisa
  GROUP BY tabel, kolom, nilai
) r
ORDER BY jumlah_baris DESC, tabel, kolom, nilai;
