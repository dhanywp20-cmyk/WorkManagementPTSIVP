-- MIGRATION 032: Piket Showroom - hak MENGISI/MENYUNTING jadi PENGATURAN per akun.
--
-- Aturan yang diminta pemilik: Sales / Marketing yang diberi menu Piket
-- Showroom hanya bisa MELIHAT dan EXPORT EXCEL - tidak bisa mengisi,
-- menyunting, atau menghapus kegiatan. Dan itu harus berupa pengaturan, bukan
-- aturan yang ditulis mati di kode.
--
-- SEBELUMNYA hak ubah hanya dijaga pengecekan peran di kode peramban
-- (lib/piket-akses.ts bisaIsiKegiatan = Tim PTS). Kebijakan RLS ptd_tulis
-- (FOR ALL) justru masih meloloskan Sales yang melihat barisnya: lewat API
-- langsung, Sales bisa mengubah/menghapus catatan atas namanya sendiri dan
-- menambah/menghapus produk_lain, walau tombolnya tidak tampil.
--
-- SEKARANG
--   users.piket_ubah (boolean, bawaan false) - diatur dari Kelola Akun.
--   piket_boleh_ubah() = Tim PTS (admin / superadmin / team) ATAU piket_ubah.
--   ptd_tulis (FOR ALL) dipecah jadi ptd_tambah / ptd_ubah / ptd_hapus yang
--   semuanya menuntut piket_boleh_ubah() DI ATAS lingkup lihat yang lama.
--   ppl_tambah / ppl_hapus (piket_produk_lain) juga menuntutnya.
--   Kolom piket_ubah dibekukan di trigger guard_users_privileged_columns -
--   kalau tidak, siapa pun bisa memberi dirinya hak ubah lewat REST anon.
--
-- Membaca & export TIDAK disentuh: export dibuat di peramban dari baris yang
-- memang boleh dibaca akun itu (ptd_baca).
--
-- Tidak mengubah data. Akun yang ada tetap seperti sekarang (non-PTS = lihat
-- & export saja). Jadwal piket (piket_schedules) tidak disentuh: mengatur
-- roster tetap Admin / Full Access.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS piket_ubah boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.piket_ubah IS
  'Piket Showroom: true = akun non-PTS boleh mengisi & menyunting kegiatan (bawaan false = lihat & export saja). Tim PTS selalu boleh. Dibekukan trigger; hanya Admin Panel (service-role) yang mengubah.';

-- Bekukan kolom baru untuk anon/authenticated (salinan fungsi yang berlaku
-- ditambah SATU baris di tiap cabang).
CREATE OR REPLACE FUNCTION public.guard_users_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
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
    NEW.piket_akses           := NULL;
    NEW.piket_ubah            := FALSE;
    NEW.telegram_chat_id      := NULL;
    NEW.bisa_ditugaskan       := TRUE;
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
    NEW.piket_akses           := OLD.piket_akses;
    NEW.piket_ubah            := OLD.piket_ubah;
    NEW.telegram_chat_id      := OLD.telegram_chat_id;
    NEW.bisa_ditugaskan       := OLD.bisa_ditugaskan;

    NEW.username  := OLD.username;
    NEW.full_name := OLD.full_name;
    NEW.jabatan   := OLD.jabatan;

    -- Kolom LINGKUP data (bukan role/menu) - sama kelasnya dengan yang di atas:
    -- self-update via RLS tidak boleh dipakai memperluas cakupan data yang
    -- terlihat/tergarap, hanya Admin Panel (service-role) yang boleh.
    NEW.sales_division    := OLD.sales_division;
    NEW.divisi            := OLD.divisi;
    NEW.pts_type          := OLD.pts_type;
    NEW.is_internal_sales := OLD.is_internal_sales;

    IF NOT public.admin_atau_full_access() THEN
      NEW.atasan_id   := OLD.atasan_id;
      NEW.kpi_enabled := OLD.kpi_enabled;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END $function$;

-- Siapa boleh mengisi/menyunting kegiatan piket: Tim PTS atau akun yang
-- diberi pengaturannya. SECURITY DEFINER (membaca users milik pemanggil saja,
-- lewat klaim sub) - pola yang sama dengan piket_akses_semua().
CREATE OR REPLACE FUNCTION public.piket_boleh_ubah()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT jwt_claim('sub') <> '' AND (
    public.lingkup_semua() OR COALESCE(
      (SELECT u.piket_ubah FROM public.users u WHERE u.id::text = jwt_claim('sub')),
      false
    )
  );
$$;

-- Baris yang boleh disentuh = yang boleh dilihat akun itu (ptd_baca), supaya
-- hak ubah tidak pernah lebih luas dari hak lihat.
DROP POLICY IF EXISTS ptd_tulis ON public.piket_tamu_detail;
DROP POLICY IF EXISTS ptd_tambah ON public.piket_tamu_detail;
DROP POLICY IF EXISTS ptd_ubah ON public.piket_tamu_detail;
DROP POLICY IF EXISTS ptd_hapus ON public.piket_tamu_detail;

CREATE POLICY ptd_tambah ON public.piket_tamu_detail
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.piket_boleh_ubah() AND (
      boleh_lihat_project(nama_sales, sales_division) OR lingkup_semua() OR public.piket_akses_semua()
      OR (NULLIF(btrim(COALESCE(nama_sales, '')), '') IS NULL AND NULLIF(btrim(COALESCE(tamu_instansi, '')), '') IS NULL)
    )
  );

CREATE POLICY ptd_ubah ON public.piket_tamu_detail
  FOR UPDATE TO anon, authenticated
  USING (
    public.piket_boleh_ubah() AND (
      boleh_lihat_project(nama_sales, sales_division) OR lingkup_semua() OR public.piket_akses_semua()
      OR (NULLIF(btrim(COALESCE(nama_sales, '')), '') IS NULL AND NULLIF(btrim(COALESCE(tamu_instansi, '')), '') IS NULL)
    )
  )
  WITH CHECK (
    public.piket_boleh_ubah() AND (
      boleh_lihat_project(nama_sales, sales_division) OR lingkup_semua() OR public.piket_akses_semua()
      OR (NULLIF(btrim(COALESCE(nama_sales, '')), '') IS NULL AND NULLIF(btrim(COALESCE(tamu_instansi, '')), '') IS NULL)
    )
  );

CREATE POLICY ptd_hapus ON public.piket_tamu_detail
  FOR DELETE TO anon, authenticated
  USING (
    public.piket_boleh_ubah() AND (
      boleh_lihat_project(nama_sales, sales_division) OR lingkup_semua() OR public.piket_akses_semua()
      OR (NULLIF(btrim(COALESCE(nama_sales, '')), '') IS NULL AND NULLIF(btrim(COALESCE(tamu_instansi, '')), '') IS NULL)
    )
  );

-- Produk lain per kegiatan: sebelumnya cukup "kegiatannya terlihat".
DROP POLICY IF EXISTS ppl_tambah ON public.piket_produk_lain;
DROP POLICY IF EXISTS ppl_hapus ON public.piket_produk_lain;
CREATE POLICY ppl_tambah ON public.piket_produk_lain
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.piket_boleh_ubah()
    AND EXISTS (SELECT 1 FROM public.piket_tamu_detail d WHERE d.id = piket_produk_lain.kegiatan_id)
  );
CREATE POLICY ppl_hapus ON public.piket_produk_lain
  FOR DELETE TO anon, authenticated
  USING (
    public.piket_boleh_ubah()
    AND EXISTS (SELECT 1 FROM public.piket_tamu_detail d WHERE d.id = piket_produk_lain.kegiatan_id)
  );

-- Mengembalikan: sql/piket-akses-rls.sql (ptd_baca) + kebijakan ptd_tulis lama
-- (boleh_lihat_project(nama_sales, sales_division) OR lingkup_semua()).
