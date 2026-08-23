-- ============================================================================
--  TABEL RAHASIA INTEGRASI - token disimpan di basis data, TANPA bisa dibaca
--  dari peramban
-- ============================================================================
--
--  MASALAH YANG DIJAWAB
--
--  Token gateway (Fonnte untuk WhatsApp, bot Telegram) perlu bisa diatur dari
--  Admin Panel supaya tidak ada lagi langkah manual di dashboard Supabase atau
--  Vercel. Tapi ia TIDAK BOLEH tersimpan di app_settings.
--
--  Kenapa tidak boleh, walau Admin Panel hanya tampil untuk admin:
--
--      Menu yang disembunyikan bukan penjagaan. app_settings dibaca lewat
--      PostgREST memakai anon key, dan anon key itu ikut ter-bundle ke setiap
--      peramban yang membuka platform. Siapa pun bisa mengambilnya dari
--      DevTools lalu memanggil PostgREST LANGSUNG - tanpa lewat halaman,
--      tanpa lewat menu, tanpa perlu jadi admin. Persis begitulah token
--      WhatsApp sebelumnya terbaca.
--
--  CARA BERKAS INI MENJAWABNYA
--
--  Tabel di bawah menyalakan RLS TANPA SATU PUN POLICY. Di Postgres itu
--  berarti tertutup rapat: setiap perintah dari role anon maupun
--  authenticated ditolak, karena tidak ada policy yang mengizinkannya.
--  Yang bisa masuk hanya service_role, yang melewati RLS - dan kunci
--  service_role hanya ada di sisi server (SUPABASE_SERVICE_ROLE_KEY), tidak
--  pernah dikirim ke peramban.
--
--  Jadi jalurnya: Admin Panel -> route server (/api/integrasi/rahasia) ->
--  penjaga admin -> service_role -> tabel ini. Peramban tidak pernah
--  menerima nilainya; yang dikirim balik ke layar cuma penyamaran seperti
--  "sudah diisi - berakhiran 4f2a".
--
--  AMAN diulang.
-- ============================================================================

CREATE TABLE IF NOT EXISTS rahasia_integrasi (
  kunci            text PRIMARY KEY,
  nilai            text NOT NULL,
  diperbarui_pada  timestamptz NOT NULL DEFAULT now(),
  diperbarui_oleh  text
);

COMMENT ON TABLE rahasia_integrasi IS
  'Token & kredensial integrasi. TIDAK punya policy - hanya service_role lewat route server yang boleh menyentuhnya. Jangan pernah menambahkan policy untuk anon di sini.';

ALTER TABLE rahasia_integrasi ENABLE ROW LEVEL SECURITY;

--  Membuang policy apa pun yang mungkin tertinggal. Satu saja policy
--  permissive di tabel ini membatalkan seluruh maksudnya - dan karena policy
--  permissive di-OR-kan, ia tidak akan terlihat sebagai "penurunan" di
--  daftar policy, hanya sebagai satu baris tambahan yang tampak wajar.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'rahasia_integrasi'
  LOOP
    EXECUTE format('DROP POLICY %I ON rahasia_integrasi', r.policyname);
    RAISE NOTICE 'policy dibuang: %', r.policyname;
  END LOOP;
END $$;

--  Hak tabel dicabut juga, bukan hanya diserahkan ke RLS. Sabuk dan bretel:
--  kalau suatu hari RLS tidak sengaja dimatikan (ALTER TABLE ... DISABLE),
--  pencabutan GRANT ini masih menahan anon. Tanpa ini, mematikan RLS
--  seketika membuka seluruh isinya.
REVOKE ALL ON rahasia_integrasi FROM anon, authenticated;


-- ─── Pemeriksaan ─────────────────────────────────────────────────────────────
--  Yang diharapkan: rls_aktif = true, jumlah_policy = 0.
--  jumlah_policy selain 0 berarti ada yang membuka kembali - periksa.
SELECT c.relname AS tabel,
       c.relrowsecurity AS rls_aktif,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS jumlah_policy,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_boleh_select
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname = 'rahasia_integrasi';
