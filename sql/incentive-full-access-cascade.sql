-- =====================================================================
-- Incentive PTS - Full Access (Kelola Akun) SEKARANG IKUT BERLAKU DI SINI
-- =====================================================================
--
-- PERMINTAAN EKSPLISIT: "kalau Team yang diberi Full Access dia layak
-- seperti Admin, tanpa batasan dan tanpa menu yang di-hide" - berlaku di
-- SEMUA modul, termasuk Incentive PTS, lewat SATU toggle yang sama di
-- Kelola Akun (bukan dua toggle terpisah untuk maksud yang sama).
--
-- Sebelum ini, Incentive PTS punya sistem aksesnya SENDIRI
-- (users.incentive_akses: lihat/input/penuh, diatur dari tab Pengaturan
-- Akses) yang sama sekali tidak tahu-menahu soal access_level. Manager PTS
-- yang sudah Full Access di modul lain (Reminder Schedule, Ticketing, dll)
-- tetap harus diatur ULANG secara terpisah di Incentive PTS - persis
-- masalah T-5 yang sudah pernah dibereskan (Dhany diberi 'penuh' secara
-- manual), tapi memaksa admin mengingat DUA tempat setiap kali memberi
-- Full Access ke orang baru.
--
-- Jalankan sesudah sql/incentive-akses-konfigurasi.sql dan
-- sql/full-access-jwt-dan-delete-rls.sql (yang memperbaiki JWT supaya
-- klaim access_level benar-benar terkirim - tanpa itu perbaikan ini tidak
-- berarti apa-apa).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.akses_insentif()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    WHEN jwt_claim('user_role') IN ('admin', 'superadmin') THEN 'penuh'
    WHEN jwt_claim('access_level') = 'full' THEN 'penuh'
    ELSE COALESCE((SELECT CASE
                WHEN u.incentive_akses IS NOT NULL THEN u.incentive_akses
                WHEN u.allow_incentive_input IS TRUE THEN 'input'
                ELSE 'lihat' END
         FROM public.users u WHERE u.id::text = jwt_claim('sub')), 'lihat')
  END;
$$;

-- =====================================================================
-- DIVERIFIKASI (simulasi JWT langsung, akun Team biasa - BUKAN Dhany,
-- BUKAN admin):
--
--   access_level='full'  -> akses_insentif()='penuh',
--                            akses_insentif_penuh()=true,
--                            akses_insentif_input()=true
--   access_level='guest' -> akses_insentif()='lihat' (kontrol, tidak berubah)
--
-- `incentive_akses` (kolom Incentive PTS sendiri, diatur dari tab
-- Pengaturan Akses) TETAP DIPAKAI untuk GUEST (mereka tidak punya toggle
-- Full Access sama sekali, karena bukan Team) dan untuk memberi seorang
-- Team akses 'penuh' TANPA menjadikannya Full Access di modul lain -
-- kasus yang lebih sempit, tetap bisa. Layar Pengaturan Akses menandai
-- akun ber-Full Access dengan keterangan "🔓 Konfigurasi penuh · Full
-- Access" alih-alih tiga tombol pilihan, supaya tidak terlihat seperti
-- tombolnya tidak berfungsi saat diklik (Full Access selalu menang).
-- =====================================================================
