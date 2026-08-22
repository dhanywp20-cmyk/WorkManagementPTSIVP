-- ============================================================================
--  KUNCI TABEL LANJUTAN (3) - tujuh tabel yang belum tersentuh sama sekali
-- ============================================================================
--
--  Ditemukan lewat penyisiran: seluruh nama tabel yang dipakai kode aplikasi
--  (grep .from('...') di app/ lib/ components/) dibandingkan dengan nama tabel
--  yang muncul di berkas keamanan mana pun. Tujuh tabel di bawah tidak muncul
--  di satu pun berkas keamanan.
--
--  Enam di antaranya lahir SESUDAH scripts/enable-rls.sql ditulis, jadi RLS-nya
--  tidak pernah menyala sekali pun - keadaan bawaan Postgres, bukan sesuatu
--  yang perlu dilakukan seseorang. DDL-nya malah memasang policy
--  "Allow all for anon" FOR ALL USING (true) WITH CHECK (true) secara
--  eksplisit (sql/incentive-pts-migration.sql, sql/routing-pipeline-phase1.sql,
--  sql/piket-produk-lain.sql).
--
--  Catatan yang sama seperti berkas -2 berlaku di sini: sebagian tombol tulis
--  di aplikasi dijaga hasFullAccess() yang membaca users.access_level,
--  sementara klaim token belum membawa kolom itu. lingkup_semua() dipakai
--  sebagai pendekatan yang sedikit lebih longgar - jauh lebih ketat daripada
--  keadaan sekarang yang tanpa syarat apa pun.
-- ============================================================================

BEGIN;

DO $$
DECLARE kurang text;
BEGIN
  SELECT string_agg(f, ', ') INTO kurang
  FROM unnest(ARRAY['jwt_claim','jwt_user_id','jwt_full_name','lingkup_semua','buang_policy_lama']) AS f
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = f
  );
  IF kurang IS NOT NULL THEN
    RAISE EXCEPTION 'Fondasi belum lengkap - fungsi belum ada: %.', kurang;
  END IF;
END $$;


-- ─── 1. daily_reports ───────────────────────────────────────────────────────
--  Laporan harian per orang. Kolom pemilik: user_id (uuid).
--
--  BACA sengaja dibiarkan untuk semua yang login, TIDAK dikunci ke pemiliknya.
--  Sebabnya konkret: widget "Team Monitoring" di dashboard
--  (app/dashboard/_components/widgets/Widgets.tsx) membaca user_id SELURUH
--  baris hari ini untuk menghitung siapa yang belum lapor. Mengunci baca ke
--  user_id sendiri akan membuat widget itu selalu melaporkan "semua belum
--  lapor" - salah secara diam-diam, tanpa pesan galat. Penyaringan per orang
--  sudah dikerjakan aplikasi (fetchReports menambahkan .eq('user_id', ...)
--  untuk yang bukan full-access).
--
--  TULIS dikunci ke pemiliknya sendiri, ATAU orang dalam - admin memang boleh
--  mengisikan laporan atas nama anggota lain (targetUserId di halaman Daily
--  Report). Tidak ada jalur DELETE di aplikasi, jadi tidak dibuatkan policy:
--  perintah tanpa policy otomatis ditolak RLS.
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('daily_reports');

CREATE POLICY dr_baca ON daily_reports FOR SELECT TO anon, authenticated
  USING (jwt_claim('sub') <> '');
CREATE POLICY dr_tambah ON daily_reports FOR INSERT TO anon, authenticated
  WITH CHECK (user_id::text = jwt_claim('sub') OR lingkup_semua());
CREATE POLICY dr_ubah ON daily_reports FOR UPDATE TO anon, authenticated
  USING      (user_id::text = jwt_claim('sub') OR lingkup_semua())
  WITH CHECK (user_id::text = jwt_claim('sub') OR lingkup_semua());


-- ─── 2. brand_pic_mappings ──────────────────────────────────────────────────
--  Peta merek -> PIC. Dibaca tanpa filter oleh siapa pun yang membuka Request
--  Design Project (dipakai menghitung isBrandPic), jadi baca harus tetap
--  terbuka untuk semua yang login.
--
--  Tulis HANYA lewat Admin Panel, dan tombol Admin Panel dijaga
--  ['admin','superadmin'] - BUKAN hasFullAccess. Karena itu di sini memakai
--  daftar peran langsung, bukan lingkup_semua() yang ikut mencakup 'team'.
ALTER TABLE brand_pic_mappings ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('brand_pic_mappings');

CREATE POLICY bpm_baca ON brand_pic_mappings FOR SELECT TO anon, authenticated
  USING (jwt_claim('sub') <> '');
CREATE POLICY bpm_tulis ON brand_pic_mappings FOR ALL TO anon, authenticated
  USING      (jwt_claim('user_role') IN ('admin','superadmin'))
  WITH CHECK (jwt_claim('user_role') IN ('admin','superadmin'));


-- ─── 3. product_team_map ────────────────────────────────────────────────────
--  Peta jenis produk -> tim. Dibaca alur approve Reminder Schedule untuk
--  menentukan supervisor yang diberi tahu; kalau bacanya diblokir, fungsinya
--  mengembalikan larik kosong dan notifikasi supervisor berhenti TANPA pesan
--  galat. Jadi baca terbuka untuk semua yang login.
--
--  Tulis (upsert & delete) hanya di Admin Panel, penjaga sama seperti
--  brand_pic_mappings: admin/superadmin saja.
ALTER TABLE product_team_map ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('product_team_map');

CREATE POLICY ptm_baca ON product_team_map FOR SELECT TO anon, authenticated
  USING (jwt_claim('sub') <> '');
CREATE POLICY ptm_tulis ON product_team_map FOR ALL TO anon, authenticated
  USING      (jwt_claim('user_role') IN ('admin','superadmin'))
  WITH CHECK (jwt_claim('user_role') IN ('admin','superadmin'));


-- ─── 4. pts_team_mappings - peninggalan, hanya dibaca ───────────────────────
--  Peta staff -> supervisor versi lama. Sudah digantikan users.atasan_id
--  (sql/user-hierarchy-atasan.sql malah mengisi atasan_id DARI tabel ini).
--  Kode yang menyentuhnya menyebut dirinya sendiri "Fallback transisi", dan
--  TIDAK ADA satu pun jalur tulis di aplikasi.
--
--  Karena itu hanya SELECT yang diberi policy. Kalau suatu saat ada yang perlu
--  menulis, penolakannya akan terlihat jelas - lebih baik daripada membiarkan
--  pintu tulis terbuka untuk tabel yang tidak ada penulisnya.
ALTER TABLE pts_team_mappings ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('pts_team_mappings');

CREATE POLICY ptsm_baca ON pts_team_mappings FOR SELECT TO anon, authenticated
  USING (jwt_claim('sub') <> '');


-- ─── 5. incentive_tranches ──────────────────────────────────────────────────
--  Termin pembayaran insentif. Tidak punya kolom pemilik sama sekali -
--  kepemilikannya hanya lewat induknya, reminders.project_id.
--
--  Baca: seluruh pengunjung halaman Incentive PTS membacanya tanpa filter
--  untuk menghitung rekap, jadi dibuka untuk semua yang login.
--
--  Tambah: tombol "Generate Tranche" di aplikasi TIDAK dijaga peran sama
--  sekali - siapa pun yang bisa membuka halamannya bisa menekannya. Yang
--  ditulis di sini karena itu mengikuti keadaan sebenarnya (semua yang login),
--  bukan mengetatkan diam-diam - mengetatkannya akan mematikan tombol yang
--  hari ini berfungsi, dan itu perubahan perilaku yang perlu diputuskan
--  terpisah, bukan diselipkan ke berkas keamanan.
--
--  Ubah: menandai 'paid' dan 'processed' keduanya dijaga isAdmin() di kode
--  (admin/superadmin), jadi dikunci ke sana. Tidak ada DELETE.
ALTER TABLE incentive_tranches ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('incentive_tranches');

CREATE POLICY it_baca ON incentive_tranches FOR SELECT TO anon, authenticated
  USING (jwt_claim('sub') <> '');
CREATE POLICY it_tambah ON incentive_tranches FOR INSERT TO anon, authenticated
  WITH CHECK (jwt_claim('sub') <> '');
CREATE POLICY it_ubah ON incentive_tranches FOR UPDATE TO anon, authenticated
  USING      (jwt_claim('user_role') IN ('admin','superadmin'))
  WITH CHECK (jwt_claim('user_role') IN ('admin','superadmin'));


-- ─── 6. late_ticket_links - hanya dibaca aplikasi ───────────────────────────
--  Tiket terlambat yang ditempelkan ke sebuah project. Ditelusuri: aplikasi
--  HANYA membacanya - nol INSERT/UPDATE/DELETE di app/, lib/, maupun route
--  API. Barisnya dibuat di luar aplikasi (SQL manual).
--
--  Jadi SELECT saja yang diberi policy. Menulis tetap bisa lewat service_role
--  (yang melewati RLS), yang memang jalur satu-satunya selama ini.
ALTER TABLE late_ticket_links ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('late_ticket_links');

CREATE POLICY ltl_baca ON late_ticket_links FOR SELECT TO anon, authenticated
  USING (jwt_claim('sub') <> '');


-- ─── 7. piket_produk_lain ───────────────────────────────────────────────────
--  Tabel anak dari piket_tamu_detail lewat kegiatan_id.
--
--  Visibilitasnya diturunkan dari induknya, bukan dibuat sendiri: kalau
--  seseorang boleh melihat baris tamu-nya, ia boleh melihat produk yang
--  dicatat di baris itu. Dengan begitu penyaringan berbasis nama di
--  piket_tamu_detail (sql/kunci-tabel-lanjutan-2.sql) otomatis berlaku di
--  sini juga, tanpa perlu menyalin aturannya - menyalin aturan adalah cara
--  paling mudah membuat keduanya menyimpang diam-diam.
--
--  Menulis mengikuti syarat yang sama, sebab di kode pun tombol isi detail
--  piket tidak dijaga peran - alasan yang sama seperti ptd_tulis.
--
--  PERHATIAN saat menguji: halaman Piket sengaja MENGABAIKAN galat dari
--  tabel ini ("tabel mungkin belum ada"), jadi kalau policy di sini keliru,
--  gejalanya bukan pesan galat melainkan produk yang diam-diam tidak muncul.
ALTER TABLE piket_produk_lain ENABLE ROW LEVEL SECURITY;
SELECT buang_policy_lama('piket_produk_lain');

CREATE POLICY ppl_baca ON piket_produk_lain FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM piket_tamu_detail d WHERE d.id = piket_produk_lain.kegiatan_id));
CREATE POLICY ppl_tambah ON piket_produk_lain FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM piket_tamu_detail d WHERE d.id = piket_produk_lain.kegiatan_id));
CREATE POLICY ppl_hapus ON piket_produk_lain FOR DELETE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM piket_tamu_detail d WHERE d.id = piket_produk_lain.kegiatan_id));


-- ─── Pemeriksaan ─────────────────────────────────────────────────────────────
SELECT c.relname AS tabel, c.relrowsecurity AS rls_aktif,
       COALESCE(string_agg(DISTINCT p.cmd, ', ' ORDER BY p.cmd), '(tidak ada policy)') AS perintah_tersaring
FROM pg_class c
LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('daily_reports','brand_pic_mappings','product_team_map',
                    'pts_team_mappings','incentive_tranches','late_ticket_links',
                    'piket_produk_lain')
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

COMMIT;


-- ─── PEMBATALAN ─────────────────────────────────────────────────────────────
--    ALTER TABLE <nama_tabel> DISABLE ROW LEVEL SECURITY;
