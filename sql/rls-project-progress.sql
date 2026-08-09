-- ============================================================================
--  RLS untuk Project Progress — isolasi Sales ditegakkan di basis data
-- ============================================================================
--
--  ⚠️  JANGAN JALANKAN SEBELUM SYARAT DI BAWAH TERPENUHI
--
--  Berkas ini menutup empat tabel progress_* dan hanya membukanya lewat klaim
--  JWT. Bila klien belum mengirim token, seluruh klaim kosong, semua policy
--  menolak, dan Project Progress akan tampak kosong bagi SEMUA ORANG.
--
--  Syarat wajib, berurutan:
--    1. SUPABASE_JWT_SECRET sudah diset di environment aplikasi.
--       Ambil dari Supabase → Settings → JWT Keys → tab "Legacy JWT Secret".
--       BUKAN Key ID yang tampil di daftar JWT Signing Keys.
--       Environment variable baru berlaku setelah aplikasi di-deploy ulang.
--    2. Kode penerbit token sudah ter-deploy (lib/db-token.ts + lib/supabase.ts).
--    3. Anda sudah logout lalu login ulang, supaya token benar-benar terbit.
--    4. Query verifikasi di bagian 0 mengembalikan nama Anda — bukan kosong.
--
--  Kalau langkah 4 mengembalikan kosong, HENTIKAN. Sisa berkas ini akan
--  mengunci modul dari semua pengguna.
--
--  Cara membatalkan bila terlanjur: lihat bagian 5 di paling bawah.
-- ============================================================================


-- ─── 0. VERIFIKASI — jalankan ini LEBIH DULU, sendirian ─────────────────────
--  Verifikasi TIDAK BISA dilakukan dari SQL Editor — editor memakai
--  service_role yang melewati RLS, jadi selalu lolos dan tidak membuktikan
--  apa pun.
--
--  Caranya: buat dulu fungsi di bawah, lalu buka sebagai admin —
--
--      /api/auth/db-token-check
--
--  Endpoint itu menerbitkan token lalu memakainya memanggil PostgREST
--  sungguhan, sehingga yang diuji adalah apakah rahasia di aplikasi cocok
--  dengan rahasia di Supabase. Balasannya:
--
--      siap: false, tahap 'rahasia'  → SUPABASE_JWT_SECRET salah
--      siap: false, tahap 'fungsi'   → rahasia benar, fungsi ini belum dibuat
--      siap: true                    → aman lanjut ke bagian 1 dan seterusnya
CREATE OR REPLACE FUNCTION debug_jwt_claims()
RETURNS TABLE (username text, full_name text, user_role text)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(current_setting('request.jwt.claims', true)::json ->> 'username',  ''),
    COALESCE(current_setting('request.jwt.claims', true)::json ->> 'full_name', ''),
    COALESCE(current_setting('request.jwt.claims', true)::json ->> 'user_role', '');
$$;


-- ─── 1. Pembaca klaim ───────────────────────────────────────────────────────
--  current_setting(..., true) mengembalikan NULL bila setelan tidak ada,
--  sehingga fungsi ini aman dipanggil di luar konteks permintaan HTTP.
--  Dibungkus supaya policy di bawah tetap terbaca sebagai kalimat.
CREATE OR REPLACE FUNCTION jwt_claim(nama text)
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::json ->> nama, '');
$$;

--  Siapa yang boleh melihat segalanya. Sengaja fungsi terpisah supaya definisi
--  "orang dalam" hanya ada di SATU tempat — mengubahnya cukup di sini.
CREATE OR REPLACE FUNCTION is_progress_admin()
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT jwt_claim('user_role') IN ('admin', 'superadmin', 'team');
$$;

--  Nama yang dipakai untuk mencocokkan kepemilikan.
--  PENTING: kolom sales_name & pic menyimpan FULL NAME, bukan username —
--  itu sebabnya klaim yang dibandingkan full_name, bukan username.
CREATE OR REPLACE FUNCTION jwt_full_name()
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT jwt_claim('full_name');
$$;


-- ─── 2. Nyalakan RLS ────────────────────────────────────────────────────────
ALTER TABLE progress_projects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_locations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_issues     ENABLE ROW LEVEL SECURITY;

--  Keempat tabel ini belum pernah punya policy, jadi tidak ada yang perlu
--  di-DROP. Kalau berkas ini dijalankan ulang, policy lama dibuang dulu supaya
--  tidak menumpuk — policy permissive di Postgres di-OR-kan, sehingga sisa
--  policy lama yang longgar akan membatalkan yang ketat.
DROP POLICY IF EXISTS pp_select   ON progress_projects;
DROP POLICY IF EXISTS pp_write    ON progress_projects;
DROP POLICY IF EXISTS pl_select   ON progress_locations;
DROP POLICY IF EXISTS pl_write    ON progress_locations;
DROP POLICY IF EXISTS pl_insert   ON progress_locations;
DROP POLICY IF EXISTS pl_update   ON progress_locations;
DROP POLICY IF EXISTS pl_delete   ON progress_locations;
DROP POLICY IF EXISTS pc_select   ON progress_components;
DROP POLICY IF EXISTS pc_write    ON progress_components;
DROP POLICY IF EXISTS pi_select   ON progress_issues;
DROP POLICY IF EXISTS pi_write    ON progress_issues;


-- ─── 3. Proyek & lokasi ─────────────────────────────────────────────────────
--  Sebuah proyek terlihat oleh seorang Sales bila namanya tercatat di proyek
--  itu ATAU di salah satu lokasinya — satu proyek bisa berisi lokasi milik
--  beberapa sales, dan masing-masing berhak melihat proyeknya.
CREATE POLICY pp_select ON progress_projects
  FOR SELECT TO anon, authenticated
  USING (
    is_progress_admin()
    OR sales_name = jwt_full_name()
    OR EXISTS (
      SELECT 1 FROM progress_locations l
      WHERE l.project_id = progress_projects.id
        AND l.sales_name = jwt_full_name()
    )
  );

--  Struktur proyek tetap milik admin/team. Sales boleh memperbarui progres
--  komponen (lihat bagian 4), bukan membuat atau menghapus proyek.
CREATE POLICY pp_write ON progress_projects
  FOR ALL TO anon, authenticated
  USING (is_progress_admin()) WITH CHECK (is_progress_admin());

CREATE POLICY pl_select ON progress_locations
  FOR SELECT TO anon, authenticated
  USING (
    is_progress_admin()
    OR sales_name = jwt_full_name()
    OR pic        = jwt_full_name()
  );

--  Menambah & menghapus lokasi tetap milik admin/team.
CREATE POLICY pl_insert ON progress_locations
  FOR INSERT TO anon, authenticated
  WITH CHECK (is_progress_admin());

CREATE POLICY pl_delete ON progress_locations
  FOR DELETE TO anon, authenticated
  USING (is_progress_admin());

--  MEMPERBARUI lokasi sendiri boleh, karena mode PIC di aplikasi memang
--  menulis catatan & persentase progres ke baris ini (lihat DetailEditor —
--  payload {note, note_flag, progress}). Tanpa policy ini, PIC dan Sales tidak
--  bisa lagi memperbarui progres lapangan mereka.
--
--  WITH CHECK memakai syarat yang sama, sehingga mengalihkan kepemilikan ke
--  orang lain otomatis tertolak: baris hasil suntingan harus tetap miliknya.
CREATE POLICY pl_update ON progress_locations
  FOR UPDATE TO anon, authenticated
  USING (
    is_progress_admin()
    OR sales_name = jwt_full_name()
    OR pic        = jwt_full_name()
  )
  WITH CHECK (
    is_progress_admin()
    OR sales_name = jwt_full_name()
    OR pic        = jwt_full_name()
  );


-- ─── 4. Komponen & isu ──────────────────────────────────────────────────────
--  Komponen mewarisi keterlihatan lokasinya. Di sinilah Sales & PIC boleh
--  MENULIS — mengisi item komponen dan memperbarui statusnya — tapi hanya
--  pada lokasi yang mencatat namanya.
CREATE POLICY pc_select ON progress_components
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM progress_locations l
      WHERE l.id = progress_components.location_id
        AND (is_progress_admin() OR l.sales_name = jwt_full_name() OR l.pic = jwt_full_name())
    )
  );

CREATE POLICY pc_write ON progress_components
  FOR ALL TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM progress_locations l
      WHERE l.id = progress_components.location_id
        AND (is_progress_admin() OR l.sales_name = jwt_full_name() OR l.pic = jwt_full_name())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM progress_locations l
      WHERE l.id = progress_components.location_id
        AND (is_progress_admin() OR l.sales_name = jwt_full_name() OR l.pic = jwt_full_name())
    )
  );

--  Rekap isu mengikuti keterlihatan proyeknya; penyuntingannya milik admin.
CREATE POLICY pi_select ON progress_issues
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM progress_projects p
      WHERE p.id = progress_issues.project_id
        AND (
          is_progress_admin()
          OR p.sales_name = jwt_full_name()
          OR EXISTS (
            SELECT 1 FROM progress_locations l
            WHERE l.project_id = p.id AND l.sales_name = jwt_full_name()
          )
        )
    )
  );

CREATE POLICY pi_write ON progress_issues
  FOR ALL TO anon, authenticated
  USING (is_progress_admin()) WITH CHECK (is_progress_admin());


-- ============================================================================
--  5. MEMBATALKAN — bila ada yang tidak beres
-- ============================================================================
--  Menonaktifkan RLS mengembalikan keadaan seperti semula (terbuka penuh).
--  Tempelkan blok ini ke SQL Editor bila modul terlanjur terkunci:
--
--    ALTER TABLE progress_projects   DISABLE ROW LEVEL SECURITY;
--    ALTER TABLE progress_locations  DISABLE ROW LEVEL SECURITY;
--    ALTER TABLE progress_components DISABLE ROW LEVEL SECURITY;
--    ALTER TABLE progress_issues     DISABLE ROW LEVEL SECURITY;
--
--  Halaman share publik TIDAK terpengaruh berkas ini — ia dibaca lewat
--  /api/project-progress/share/[token] yang memakai service_role, dan
--  service_role memang melewati RLS.
-- ============================================================================
