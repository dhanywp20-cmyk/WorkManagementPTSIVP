-- =====================================================================
-- Incentive PTS - TINGKAT AKSES SEBAGAI DATA, BUKAN KODE
-- =====================================================================
--
-- MASALAH YANG DIPERBAIKI
--
-- Sebelum ini, siapa yang boleh mengatur Incentive PTS ditulis di dalam
-- kode halaman:
--
--     function isAdmin(u) { return u.role === 'admin' || u.role === 'superadmin'; }
--
-- Akibatnya Manager PTS - pimpinan modul ini - hanya melihat tab "Projects",
-- sementara Skema Pembagian dan Pengaturan Akses tertutup untuknya. Satu-
-- satunya cara membukanya adalah mengubah kode lalu deploy ulang. Untuk
-- platform yang dijual ke perusahaan lain itu tidak bisa dipakai: tiap
-- perusahaan punya struktur jabatan sendiri.
--
-- Sekarang tingkat aksesnya menjadi KOLOM yang diatur dari layar
-- "Pengaturan Akses":
--
--     penuh  - seluruh konfigurasi (Skema Pembagian, Pengaturan Akses,
--              Process Batch, set brand, hapus tahapan) - setara admin
--     input  - boleh isi nominal & kelola tahapan, TIDAK boleh mengubah
--              skema/akses
--     lihat  - hanya melihat proyek & bagiannya sendiri (bawaan)
--
-- Kolom lama `allow_incentive_input` tetap dibaca sebagai 'input' supaya
-- pengaturan yang sudah ada tidak hilang saat migrasi ini dijalankan.
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
-- =====================================================================

-- 1) Kolom tingkat akses -------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS incentive_akses text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_incentive_akses_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_incentive_akses_check
      CHECK (incentive_akses IS NULL OR incentive_akses IN ('penuh', 'input', 'lihat'));
  END IF;
END $$;

COMMENT ON COLUMN public.users.incentive_akses IS
  'Tingkat akses modul Incentive PTS: penuh | input | lihat. NULL = ikut kolom lama allow_incentive_input (input bila true, selain itu lihat).';

-- Bawa serta pengaturan lama supaya tidak ada yang kehilangan izinnya.
UPDATE public.users
   SET incentive_akses = 'input'
 WHERE incentive_akses IS NULL
   AND allow_incentive_input IS TRUE;

-- 2) Fungsi penilai akses untuk RLS -------------------------------------
--
-- SECURITY DEFINER karena ia membaca tabel users, yang RLS-nya sendiri
-- membatasi apa yang boleh dibaca pemanggil. Yang dikembalikan hanya satu
-- kata; tidak ada data user yang bocor lewat sini.
CREATE OR REPLACE FUNCTION public.akses_insentif()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    WHEN jwt_claim('user_role') IN ('admin', 'superadmin') THEN 'penuh'
    ELSE COALESCE(
      (SELECT CASE
                WHEN u.incentive_akses IS NOT NULL THEN u.incentive_akses
                WHEN u.allow_incentive_input IS TRUE THEN 'input'
                ELSE 'lihat'
              END
         FROM public.users u
        WHERE u.id::text = jwt_claim('sub')),
      'lihat')
  END;
$$;

CREATE OR REPLACE FUNCTION public.akses_insentif_penuh()
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp'
AS $$ SELECT public.akses_insentif() = 'penuh'; $$;

CREATE OR REPLACE FUNCTION public.akses_insentif_input()
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp'
AS $$ SELECT public.akses_insentif() IN ('penuh', 'input'); $$;

-- 3) Kebijakan RLS mengikuti tingkat akses ------------------------------
--
-- SKEMA PEMBAGIAN. Sebelumnya syaratnya `lingkup_semua()`, yang berarti
-- 'admin' ATAU 'superadmin' ATAU 'team' - jadi SETIAP anggota team bisa
-- menulis ulang aturan pembagian uang lewat REST dengan anon key. Itu
-- lubang, bukan kelonggaran yang disengaja: layarnya sendiri sejak dulu
-- hanya dibuka untuk admin.
DROP POLICY IF EXISTS iss_tulis ON public.incentive_scheme_settings;
CREATE POLICY iss_tulis ON public.incentive_scheme_settings
  FOR ALL TO anon, authenticated
  USING (public.akses_insentif_penuh())
  WITH CHECK (public.akses_insentif_penuh());

-- TAHAPAN PENCAIRAN. Membuat tahapan sebelumnya boleh oleh siapa pun yang
-- login; menandainya processed/paid hanya oleh admin - sehingga pemegang
-- akses 'input' bisa membuat tahapan tapi tidak pernah bisa memprosesnya,
-- dan Process Batch-nya gagal DIAM-DIAM (RLS menolak UPDATE tanpa galat).
DROP POLICY IF EXISTS it_tambah ON public.incentive_tranches;
CREATE POLICY it_tambah ON public.incentive_tranches
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.akses_insentif_input());

DROP POLICY IF EXISTS it_ubah ON public.incentive_tranches;
CREATE POLICY it_ubah ON public.incentive_tranches
  FOR UPDATE TO anon, authenticated
  USING (public.akses_insentif_input())
  WITH CHECK (public.akses_insentif_input());

-- Menghapus tahapan (Hapus Tahapan / rollback) sebelumnya TIDAK punya
-- kebijakan sama sekali, jadi selalu 0 baris terhapus tanpa galat.
DROP POLICY IF EXISTS it_hapus ON public.incentive_tranches;
CREATE POLICY it_hapus ON public.incentive_tranches
  FOR DELETE TO anon, authenticated
  USING (public.akses_insentif_penuh());

-- 4) Kolom baru ikut DIBEKUKAN untuk anon ------------------------------
--
-- Trigger guard_users_privileged_columns membekukan kolom hak akses supaya
-- tidak ada yang bisa menaikkan aksesnya sendiri lewat REST dengan anon key.
-- `incentive_akses` wajib masuk daftar itu - kalau tidak, seluruh gunanya
-- hilang. `incentive_brand_scope` ditambahkan sekalian: ia sudah ada sejak
-- lama tapi TIDAK pernah ikut dibekukan, jadi siapa pun bisa memperluas
-- lingkup brand-nya sendiri.
CREATE OR REPLACE FUNCTION public.guard_users_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role                  := 'guest';
    NEW.team_type             := 'Pending Approval';
    NEW.allow_incentive_input := COALESCE(NEW.allow_incentive_input, FALSE) AND FALSE;
    NEW.access_level          := 'guest';
    NEW.incentive_akses       := NULL;
    NEW.incentive_brand_scope := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.role                  := OLD.role;
    NEW.team_type             := OLD.team_type;
    NEW.allow_incentive_input := OLD.allow_incentive_input;
    NEW.allowed_menus         := OLD.allowed_menus;
    NEW.access_level          := OLD.access_level;
    NEW.incentive_akses       := OLD.incentive_akses;
    NEW.incentive_brand_scope := OLD.incentive_brand_scope;
    RETURN NEW;
  END IF;

  RETURN NEW;
END $function$;

-- 5) Manager PTS diberi akses penuh -------------------------------------
--
-- Dilakukan lewat jabatan+tim, bukan id yang dipaku, supaya berkas ini tetap
-- masuk akal dijalankan di basis data mana pun.
UPDATE public.users
   SET incentive_akses = 'penuh'
 WHERE role = 'team'
   AND team_type = 'Team PTS IVP'
   AND jabatan = 'Manager';

-- Samakan kolom lama supaya route/layar yang masih membacanya tidak berbeda
-- pendapat dengan kolom baru.
UPDATE public.users
   SET allow_incentive_input = TRUE
 WHERE incentive_akses IN ('penuh', 'input')
   AND allow_incentive_input IS DISTINCT FROM TRUE;
