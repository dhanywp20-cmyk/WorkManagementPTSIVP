-- ============================================================================
--  Pemeriksaan ISI policy — lanjutan dari cek-rls.sql
-- ============================================================================
--  "RLS aktif" belum tentu "terlindungi". Pola yang dipakai di repo ini
--  sebagian besar adalah:
--
--      CREATE POLICY "Allow all for anon" ON <tabel>
--        FOR ALL USING (true) WITH CHECK (true);
--
--  Policy semacam itu MENGIZINKAN SEMUANYA. RLS-nya menyala, tapi tidak
--  menyaring apa pun — sama terbukanya dengan tanpa RLS.
--
--  Query ini menampilkan ekspresi setiap policy supaya ketahuan mana yang
--  benar-benar membatasi dan mana yang hanya formalitas.
-- ============================================================================

SELECT
  tablename                       AS tabel,
  policyname                      AS nama_policy,
  cmd                             AS perintah,
  roles                           AS untuk_role,
  COALESCE(qual, '—')             AS syarat_baca,
  COALESCE(with_check, '—')       AS syarat_tulis,
  CASE
    WHEN COALESCE(qual, 'true') = 'true' AND COALESCE(with_check, 'true') = 'true'
      THEN '⚠️  izinkan semua — tidak menyaring apa pun'
    ELSE '✅ benar-benar membatasi'
  END                             AS penilaian
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY penilaian, tablename, policyname;
