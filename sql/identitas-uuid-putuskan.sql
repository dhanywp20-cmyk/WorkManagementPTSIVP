-- ============================================================================
--  IDENTITAS UUID - PUTUSKAN: menyetujui usulan secara borongan
-- ============================================================================
--
--  Jalankan SETELAH sql/identitas-uuid-usulan.sql, SEBELUM
--  sql/identitas-uuid-terapkan.sql. Tidak perlu mengetik apa pun - cukup Run.
--
--  Berkas ini menggantikan pekerjaan mengetik setujui() satu per satu. Yang
--  disetujui tetap sama persis, tapi aturannya ditulis di sini supaya bisa
--  dibaca dan dibantah, bukan disembunyikan di dalam daftar nama.
--
--  YANG TIDAK DILAKUKAN BERKAS INI, dan tidak akan pernah:
--
--    - Mengubah nama di kolom mana pun. Satu huruf pun tidak. Yang ditulis
--      cuma kolom uuid.
--    - Mengubah, menggabungkan, atau menghapus akun di tabel users.
--    - Menyentuh baris yang uuid-nya sudah terisi.
--
--  Jadi Anda TIDAK perlu merapikan nama akun lebih dulu. Dua akun untuk satu
--  orang boleh dibiarkan apa adanya - BAGIAN 2 sudah menanganinya.
-- ============================================================================


-- ─── Alat bantu: seberapa banyak pekerjaan yang menempel pada sebuah akun ───
--  Dipakai BAGIAN 2 untuk memilih di antara dua akun milik orang yang sama.
CREATE OR REPLACE FUNCTION jejak_akun(p_id uuid) RETURNS bigint
LANGUAGE sql STABLE AS $$
  SELECT (SELECT count(*) FROM tickets            WHERE sales_user_id  = p_id)
       + (SELECT count(*) FROM tickets            WHERE assign_user_id = p_id)
       + (SELECT count(*) FROM reminders          WHERE sales_user_id  = p_id)
       + (SELECT count(*) FROM reminders          WHERE assign_user_id = p_id)
       + (SELECT count(*) FROM project_requests   WHERE sales_user_id  = p_id)
       + (SELECT count(*) FROM project_requests   WHERE assign_user_id = p_id)
       + (SELECT count(*) FROM form_reviews       WHERE sales_user_id  = p_id)
       + (SELECT count(*) FROM form_reviews       WHERE guest_user_id  = p_id)
       + (SELECT count(*) FROM progress_projects  WHERE sales_user_id  = p_id)
       + (SELECT count(*) FROM progress_locations WHERE sales_user_id  = p_id)
       + (SELECT count(*) FROM progress_locations WHERE pic_user_id    = p_id);
$$;


-- ─── BAGIAN 1. Kecocokan kuat, calon tunggal ────────────────────────────────
--
--  Disetujui otomatis bila caranya `kata utuh` atau `nama akun ada di dalam
--  nilai`. Dua cara itu berarti nilainya BUKAN potongan yang dipendekkan -
--  ia kata penuh yang memang ada di nama akunnya:
--
--    "Rozaq"                          kata penuh di "Muhammad Rozaq"
--    "Dhany Wahyu (Remote Bagas POC)" memuat nama akun "Dhany Wahyu" utuh
--
--  `awalan kata` sengaja TIDAK ikut - lihat BAGIAN 4.
--
--  SATU PENGECUALIAN, dan ini ketemu justru saat mengujinya. Kalau nama
--  akunnya cuma SATU KATA, cara `nama akun ada di dalam nilai` jadi rapuh:
--
--    nilai "Perdana Rio", akun "Perdana"           -> cocok, calon tunggal
--    padahal yang dimaksud hampir pasti "Rio Putra Perdana"
--
--  Nama orang Indonesia sering ditulis terbalik, jadi nama akun satu kata yang
--  muncul di dalam nilai yang lebih panjang tidak membuktikan apa-apa - nilai
--  itu bisa saja nama lengkap orang lain. Nama akun dua kata atau lebih
--  ("Dhany Wahyu" di dalam "Dhany Wahyu (Remote Bagas POC)") jauh lebih kuat,
--  karena dua kata berurutan tidak bertemu secara kebetulan.
--
--  Jadi nama akun satu kata dikeluarkan dari jalur otomatis. Ia tetap muncul
--  di laporan usulan, tinggal disetujui sendiri kalau Anda yakin.
--
--  Aturannya umum, bukan daftar nama. Kalau datanya berubah, yang disetujui
--  ikut berubah mengikuti aturan yang sama - tidak ada nama yang dipaku.
SELECT setujui(t.tabel, t.kolom, t.nilai) AS hasil_bagian_1
FROM (
  SELECT DISTINCT c.tabel, c.kolom, c.nilai
  FROM identitas_calon c
  WHERE c.cara IN ('kata utuh', 'nama akun ada di dalam nilai')
    AND (SELECT count(DISTINCT c2.user_id) FROM identitas_calon c2
          WHERE c2.tabel = c.tabel AND c2.kolom = c.kolom AND c2.nilai = c.nilai) = 1
    AND (c.cara <> 'nama akun ada di dalam nilai'
         OR array_length(regexp_split_to_array(
              btrim(regexp_replace(lower(c.nama_akun), '[^a-z0-9]+', ' ', 'g')), ' '), 1) >= 2)
) t;


-- ─── BAGIAN 2. Calonnya lebih dari satu, TAPI orangnya sama ────────────────
--
--  Kasus "Reka": dua akun bernama "Reka Destiandi" dan "reka destiandi". Itu
--  satu orang dengan dua akun, bukan dua orang - jadi pertanyaannya bukan
--  "siapa", melainkan "akun yang mana".
--
--  Dipilih akun yang JEJAK pekerjaannya paling banyak. Bukan karena akun itu
--  lebih benar, tapi karena memilih yang lain berarti sisa pekerjaannya harus
--  ikut dipindahkan, dan tiap pemindahan adalah kesempatan baru untuk salah.
--
--  Dua penjagaan, dan keduanya penting:
--
--    - Hanya kalau SEMUA calonnya bernama sama setelah huruf besar-kecil
--      disamakan. "Perdana" dan "Rio Putra Perdana" adalah dua ORANG yang
--      berbeda - kasus itu tidak boleh masuk sini, dan memang tidak masuk.
--    - Kalau jejaknya SERI, tidak diputuskan. Seri berarti kedua akun
--      sama-sama dipakai, dan itu pertanyaan yang belum punya jawaban.
SELECT setujui_ke(p.tabel, p.kolom, p.nilai, p.username) AS hasil_bagian_2
FROM (
  SELECT c.tabel, c.kolom, c.nilai,
         (SELECT u.username FROM identitas_calon c2 JOIN users u ON u.id = c2.user_id
           WHERE c2.tabel = c.tabel AND c2.kolom = c.kolom AND c2.nilai = c.nilai
           ORDER BY jejak_akun(c2.user_id) DESC, u.username
           LIMIT 1) AS username
  FROM identitas_calon c
  GROUP BY c.tabel, c.kolom, c.nilai
  HAVING count(DISTINCT c.user_id) > 1
     --  semua calon adalah orang yang sama
     AND count(DISTINCT lower(btrim(
           (SELECT u.full_name FROM users u WHERE u.id = c.user_id)))) = 1
     --  dan salah satunya berjejak lebih banyak (tidak seri)
     AND (SELECT count(*) FROM (
            SELECT jejak_akun(c3.user_id) AS j
            FROM identitas_calon c3
            WHERE c3.tabel = c.tabel AND c3.kolom = c.kolom AND c3.nilai = c.nilai
            GROUP BY c3.user_id
            ORDER BY j DESC LIMIT 1
          ) atas
          WHERE atas.j > (SELECT COALESCE(min(j), -1) FROM (
            SELECT jejak_akun(c4.user_id) AS j
            FROM identitas_calon c4
            WHERE c4.tabel = c.tabel AND c4.kolom = c.kolom AND c4.nilai = c.nilai
            GROUP BY c4.user_id) bawah)) = 1
) p
WHERE p.username IS NOT NULL;


-- ─── BAGIAN 3. Ejaan yang sudah kita pastikan sendiri ───────────────────────
--
--  "Rafi'i" tidak punya calon karena tanda bacanya, dan alat mana pun akan
--  gagal menebaknya. Tapi ini bukan tebakan: pemeriksaan nama di awal audit
--  menemukan satu akun tercatat sebagai "Rafii", "Rafi'i", DAN
--  "Rafi Muhammadi" sekaligus, sementara nama akunnya sendiri tidak pernah
--  muncul persis. Jadi ini fakta yang sudah dipastikan, ditulis terang-terangan
--  di sini supaya bisa dibantah kalau ternyata keliru.
--
--  Kalau akunnya tidak ditemukan, baris ini tidak menghasilkan apa-apa -
--  bukan galat.
SELECT setujui_ke(s.tabel, s.kolom, s.nilai, u.username) AS hasil_bagian_3
FROM identitas_sisa s
CROSS JOIN LATERAL (
  SELECT username FROM users
   WHERE full_name ILIKE '%Rafi Muhammadi%'
   ORDER BY full_name LIMIT 1
) u
WHERE regexp_replace(lower(s.nilai), '[^a-z]', '', 'g') IN ('rafii', 'rafi');


-- ─── BAGIAN 4. `awalan kata` - SENGAJA TIDAK DIJALANKAN ────────────────────
--
--  Di data Anda ini berarti "Febri" -> Febriana Rosana dan "Adel" -> Adela
--  Diovany. Nilainya cuma AWALAN sebuah kata, dan di situlah keberatan Anda
--  berlaku penuh: "Adel" bisa potongan nama Adela, bisa juga nama lengkap
--  orang yang tidak punya akun. Banyak orang memang bernama satu kata.
--
--  Satu petunjuk yang meringankan, khusus "Febri": di tabel yang sama juga ada
--  "Febriana" yang cocok kata utuh ke Febriana Rosana. Satu orang tertulis dua
--  cara di data yang sama - pola yang sudah berulang di sini (Rafii/Rafi'i,
--  Robbin/Robin). Condong ke orang yang sama, tapi condong bukan pasti.
--
--  Kalau Anda memutuskan ini benar, hapus dua tanda minus di depan tiga baris
--  di bawah, lalu jalankan ulang berkas ini. Menjalankan ulang tidak masalah -
--  BAGIAN 1-3 hanya menulis ulang keputusan yang sama.
--
-- SELECT setujui(t.tabel, t.kolom, t.nilai) AS hasil_bagian_4
-- FROM (SELECT DISTINCT c.tabel, c.kolom, c.nilai FROM identitas_calon c
--        WHERE c.cara = 'awalan kata'
--          AND (SELECT count(DISTINCT c2.user_id) FROM identitas_calon c2
--                WHERE c2.tabel=c.tabel AND c2.kolom=c.kolom AND c2.nilai=c.nilai) = 1) t;


DROP FUNCTION jejak_akun(uuid);


-- ─── LAPORAN ────────────────────────────────────────────────────────────────
--  Query terakhir, supaya sekali Run langsung terlihat apa yang disetujui.
--
--  BACA KOLOM `nama_akun`. Ini kesempatan terakhir memeriksanya sebelum
--  ditulis. Ada yang salah orang? Buang satu baris:
--      DELETE FROM identitas_usulan WHERE nilai = 'Rozaq';
--  Sudah benar semua? Jalankan sql/identitas-uuid-terapkan.sql.
SELECT u.tabel, u.kolom, u.nilai, u.jumlah_baris,
       u.nama_akun, u.cara,
       (SELECT username FROM users WHERE id = u.user_id) AS username
FROM identitas_usulan u
ORDER BY u.jumlah_baris DESC, u.tabel, u.kolom, u.nilai;
