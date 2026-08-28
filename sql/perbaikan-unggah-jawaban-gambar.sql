-- ═══════════════════════════════════════════════════════════════════════════
-- PERBAIKAN: unggahan jawaban bergambar ditolak RLS.
--
-- Gejalanya: "new row violates row-level security policy" saat peserta
-- mengunggah foto jawaban essay.
--
-- Sebabnya kebijakan tulis di bucket learning-answers memeriksa
-- jwt_claim('user_id'), dan klaim itu TIDAK ADA di token yang ditandatangani
-- aplikasi ini. Token-nya (lib/db-token.ts) hanya memuat:
--
--     sub · role · aud · iat · exp · username · user_role · full_name
--     sales_division
--
-- Klaim yang tidak ada tidak menghasilkan galat - jwt_claim() mengembalikan
-- string kosong. Jadi syaratnya selalu salah, setiap unggahan ditolak, dan
-- pesannya sama sekali tidak menyebut klaim mana yang bermasalah. Itulah
-- kenapa ia tampak seperti soal perizinan, padahal soal nama.
--
-- 61 dari 105 pemeriksaan RLS di platform ini memakai 'sub'. Yang satu ini
-- menyimpang, dan itu keliru.
--
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS jawaban_gambar_tulis ON storage.objects;

CREATE POLICY jawaban_gambar_tulis ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'learning-answers' AND jwt_claim('sub') <> '');

-- ─── Periksa hasilnya ──────────────────────────────────────────────────────
-- with_check harus berbunyi ... jwt_claim('sub'::text) <> ''::text ...
SELECT policyname, cmd, roles::text, with_check
  FROM pg_policies
 WHERE schemaname = 'storage'
   AND tablename  = 'objects'
   AND policyname LIKE 'jawaban_gambar%'
 ORDER BY policyname;
