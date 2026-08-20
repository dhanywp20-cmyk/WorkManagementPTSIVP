-- ============================================================================
--  IDENTITAS UUID - mengikat baris ke ORANGNYA, bukan ke tulisan namanya
-- ============================================================================
--
--  Sampai sekarang kepemilikan sebuah baris ditentukan teks: sales_name harus
--  sama persis dengan full_name akun. Itu rapuh dengan tiga cara sekaligus:
--
--    1. Satu kantor bisa punya dua orang bernama sama. Teks tidak bisa
--       membedakan mereka.
--    2. Satu orang bisa tercatat dalam beberapa ejaan. Di basis data ini nyata:
--       satu akun ditemukan tercatat sebagai "Rafii", "Rafi'i", dan
--       "Rafi Muhammadi" sekaligus, sementara nama akunnya sendiri tidak
--       pernah muncul persis.
--    3. Orang ganti nama atau resign, dan catatannya ikut terputus.
--
--  Bukti paling terang ada di kode: app/ticketing/page.tsx mencocokkan
--  sales_name terhadap TIGA hal berbeda - username, nama lengkap, dan nama
--  depan - lalu menamainya "SAFETY NET". Jaring itu ada justru karena
--  pencocokan teks tidak bisa dipercaya.
--
--  Berkas ini menambahkan kolom UUID di samping kolom nama. Keduanya hidup
--  berdampingan dan punya tugas berbeda:
--
--    UUID  menjawab SIAPA        - dipakai pencocokan, assign, notifikasi, RLS
--    nama  menjawab TERCATAT     - dipakai tampilan, riwayat, laporan cetak
--          SEBAGAI SIAPA
--
--  Nama TIDAK dibuang, dan itu disengaja. Nama tersimpan adalah potret siapa
--  orang itu saat baris dibuat. Kalau tampilan riwayat di-JOIN ke akun,
--  mengganti nama seseorang akan menulis ulang seluruh sejarahnya - dan audit
--  trail yang berubah sendiri bukan lagi bukti.
--
--  AMAN dijalankan kapan saja: kolomnya nullable, dan tidak ada satu pun kode
--  yang membacanya sampai tahap berikutnya di-deploy. Menambah kolom kosong
--  tidak mengubah perilaku apa pun.
-- ============================================================================


-- ─── BAGIAN 1. Tambah kolom ─────────────────────────────────────────────────
--  Nullable, tanpa nilai bawaan, tanpa foreign key. Sengaja TANPA foreign key:
--  baris milik orang yang akunnya kelak dihapus harus tetap ada, bukan ikut
--  terhapus atau menghalangi penghapusan akun.
ALTER TABLE tickets           ADD COLUMN IF NOT EXISTS sales_user_id  uuid;
ALTER TABLE tickets           ADD COLUMN IF NOT EXISTS assign_user_id uuid;
ALTER TABLE reminders         ADD COLUMN IF NOT EXISTS sales_user_id  uuid;
ALTER TABLE reminders         ADD COLUMN IF NOT EXISTS assign_user_id uuid;
ALTER TABLE project_requests  ADD COLUMN IF NOT EXISTS sales_user_id  uuid;
ALTER TABLE project_requests  ADD COLUMN IF NOT EXISTS assign_user_id uuid;
ALTER TABLE form_reviews      ADD COLUMN IF NOT EXISTS sales_user_id  uuid;
ALTER TABLE form_reviews      ADD COLUMN IF NOT EXISTS guest_user_id  uuid;
ALTER TABLE progress_projects  ADD COLUMN IF NOT EXISTS sales_user_id uuid;
ALTER TABLE progress_locations ADD COLUMN IF NOT EXISTS sales_user_id uuid;
ALTER TABLE progress_locations ADD COLUMN IF NOT EXISTS pic_user_id   uuid;

CREATE INDEX IF NOT EXISTS idx_tickets_sales_user           ON tickets(sales_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assign_user          ON tickets(assign_user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_sales_user         ON reminders(sales_user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_assign_user        ON reminders(assign_user_id);
CREATE INDEX IF NOT EXISTS idx_preq_sales_user              ON project_requests(sales_user_id);
CREATE INDEX IF NOT EXISTS idx_preq_assign_user             ON project_requests(assign_user_id);
CREATE INDEX IF NOT EXISTS idx_freviews_sales_user          ON form_reviews(sales_user_id);
CREATE INDEX IF NOT EXISTS idx_freviews_guest_user          ON form_reviews(guest_user_id);
CREATE INDEX IF NOT EXISTS idx_pprojects_sales_user         ON progress_projects(sales_user_id);
CREATE INDEX IF NOT EXISTS idx_plocations_sales_user        ON progress_locations(sales_user_id);
CREATE INDEX IF NOT EXISTS idx_plocations_pic_user          ON progress_locations(pic_user_id);


-- ─── BAGIAN 2. Backfill - HANYA yang tidak ambigu ───────────────────────────
--  Aturannya sengaja ketat: sebuah baris hanya dipetakan bila namanya cocok
--  persis dengan TEPAT SATU akun. Kalau dua orang bernama sama, atau namanya
--  ditulis berbeda, UUID-nya dibiarkan kosong.
--
--  Membiarkan kosong itu pilihan sadar. Menebak akan mengikat pekerjaan
--  seseorang ke orang lain, dan kesalahan seperti itu tidak akan pernah
--  ketahuan dari layar. Baris yang UUID-nya kosong tetap bekerja seperti
--  sekarang lewat pencocokan nama.

--  Nama unik: hanya nama yang dimiliki tepat satu akun.
--  (array_agg(id))[1], bukan min(id): Postgres tidak punya min() untuk uuid.
--  Aman karena HAVING sudah memastikan grupnya berisi tepat satu baris.
CREATE OR REPLACE VIEW nama_unik AS
  SELECT full_name, (array_agg(id))[1] AS id
  FROM users
  WHERE full_name IS NOT NULL AND full_name <> ''
  GROUP BY full_name
  HAVING count(*) = 1;

--  Username selalu unik, jadi pemetaan lewat username tidak perlu penjagaan.
UPDATE tickets t SET sales_user_id = n.id
  FROM nama_unik n WHERE t.sales_name = n.full_name AND t.sales_user_id IS NULL;
UPDATE tickets t SET assign_user_id = n.id
  FROM nama_unik n WHERE t.assign_name = n.full_name AND t.assign_user_id IS NULL;

UPDATE reminders r SET sales_user_id = n.id
  FROM nama_unik n WHERE r.sales_name = n.full_name AND r.sales_user_id IS NULL;
UPDATE reminders r SET assign_user_id = u.id
  FROM users u WHERE r.assigned_to = u.username AND r.assign_user_id IS NULL;

UPDATE project_requests p SET sales_user_id = n.id
  FROM nama_unik n WHERE p.sales_name = n.full_name AND p.sales_user_id IS NULL;
UPDATE project_requests p SET assign_user_id = n.id
  FROM nama_unik n WHERE p.assign_name = n.full_name AND p.assign_user_id IS NULL;

UPDATE form_reviews f SET sales_user_id = n.id
  FROM nama_unik n WHERE f.sales_name = n.full_name AND f.sales_user_id IS NULL;
UPDATE form_reviews f SET guest_user_id = u.id
  FROM users u WHERE f.guest_username = u.username AND f.guest_user_id IS NULL;

UPDATE progress_projects pp SET sales_user_id = n.id
  FROM nama_unik n WHERE pp.sales_name = n.full_name AND pp.sales_user_id IS NULL;
UPDATE progress_locations pl SET sales_user_id = n.id
  FROM nama_unik n WHERE pl.sales_name = n.full_name AND pl.sales_user_id IS NULL;
UPDATE progress_locations pl SET pic_user_id = n.id
  FROM nama_unik n WHERE pl.pic = n.full_name AND pl.pic_user_id IS NULL;

DROP VIEW nama_unik;


-- ─── LAPORAN ────────────────────────────────────────────────────────────────
--  Query terakhir, supaya sekali Run langsung terlihat hasilnya.
--
--  `belum_terpetakan` yang besar BUKAN kegagalan - itu ukuran seberapa kacau
--  penulisan nama selama ini, dan justru alasan perubahan ini dikerjakan.
--  Baris itu tetap bekerja lewat nama sampai seseorang membetulkannya.
SELECT tabel, kolom, terpetakan, belum_terpetakan,
       CASE WHEN terpetakan + belum_terpetakan = 0 THEN '-'
            ELSE round(100.0 * terpetakan / (terpetakan + belum_terpetakan)) || '%'
       END AS persen_terpetakan
FROM (
  SELECT 'tickets' AS tabel, 'sales_name' AS kolom,
         count(*) FILTER (WHERE sales_user_id IS NOT NULL) AS terpetakan,
         count(*) FILTER (WHERE sales_user_id IS NULL AND sales_name IS NOT NULL AND sales_name <> '') AS belum_terpetakan
  FROM tickets
  UNION ALL SELECT 'tickets', 'assign_name',
         count(*) FILTER (WHERE assign_user_id IS NOT NULL),
         count(*) FILTER (WHERE assign_user_id IS NULL AND assign_name IS NOT NULL AND assign_name <> '')
  FROM tickets
  UNION ALL SELECT 'reminders', 'sales_name',
         count(*) FILTER (WHERE sales_user_id IS NOT NULL),
         count(*) FILTER (WHERE sales_user_id IS NULL AND sales_name IS NOT NULL AND sales_name <> '')
  FROM reminders
  UNION ALL SELECT 'reminders', 'assigned_to',
         count(*) FILTER (WHERE assign_user_id IS NOT NULL),
         count(*) FILTER (WHERE assign_user_id IS NULL AND assigned_to IS NOT NULL AND assigned_to <> '')
  FROM reminders
  UNION ALL SELECT 'project_requests', 'sales_name',
         count(*) FILTER (WHERE sales_user_id IS NOT NULL),
         count(*) FILTER (WHERE sales_user_id IS NULL AND sales_name IS NOT NULL AND sales_name <> '')
  FROM project_requests
  UNION ALL SELECT 'project_requests', 'assign_name',
         count(*) FILTER (WHERE assign_user_id IS NOT NULL),
         count(*) FILTER (WHERE assign_user_id IS NULL AND assign_name IS NOT NULL AND assign_name <> '')
  FROM project_requests
  UNION ALL SELECT 'form_reviews', 'sales_name',
         count(*) FILTER (WHERE sales_user_id IS NOT NULL),
         count(*) FILTER (WHERE sales_user_id IS NULL AND sales_name IS NOT NULL AND sales_name <> '')
  FROM form_reviews
  UNION ALL SELECT 'form_reviews', 'guest_username',
         count(*) FILTER (WHERE guest_user_id IS NOT NULL),
         count(*) FILTER (WHERE guest_user_id IS NULL AND guest_username IS NOT NULL AND guest_username <> '')
  FROM form_reviews
  UNION ALL SELECT 'progress_projects', 'sales_name',
         count(*) FILTER (WHERE sales_user_id IS NOT NULL),
         count(*) FILTER (WHERE sales_user_id IS NULL AND sales_name IS NOT NULL AND sales_name <> '')
  FROM progress_projects
  UNION ALL SELECT 'progress_locations', 'sales_name',
         count(*) FILTER (WHERE sales_user_id IS NOT NULL),
         count(*) FILTER (WHERE sales_user_id IS NULL AND sales_name IS NOT NULL AND sales_name <> '')
  FROM progress_locations
  UNION ALL SELECT 'progress_locations', 'pic',
         count(*) FILTER (WHERE pic_user_id IS NOT NULL),
         count(*) FILTER (WHERE pic_user_id IS NULL AND pic IS NOT NULL AND pic <> '')
  FROM progress_locations
) r
ORDER BY belum_terpetakan DESC, tabel, kolom;
