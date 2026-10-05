-- 034 - Akun Pimpinan (mis. Direktur): MELIHAT SEMUA data, TIDAK BOLEH mengubah apa pun.
--
-- Kebutuhan: atasan tertinggi dibuat sebagai akun Marketing (role 'guest'), tidak
-- di bawah manager mana pun dan tidak ikut KPI, tetapi di setiap menu melihat
-- SELURUH daftar - tanpa filter "milik saya" seperti Sales/Marketing lain - dan
-- hanya baca (tidak bisa menambah, menyunting, atau menghapus).
--
-- Dibuat sebagai PENGATURAN PER AKUN (users.pimpinan), bukan dikodekan ke
-- jabatan/nama: Kelola Akun -> edit akun -> "Pimpinan (lihat semua, hanya baca)".
-- Mengikuti pola piket_akses (031-033): dijaga di basis data, bukan hanya
-- menyembunyikan tombol.
--
-- Tiga bagian:
--   A. Kolom + fungsi pimpinan_lihat_semua() (membaca DB, bukan klaim JWT, jadi
--      perubahan pengaturan langsung berlaku tanpa login ulang).
--   B. BACA: boleh_lihat_baris / boleh_lihat_project (tickets, reminders,
--      projects, project_requests, ...) dan kebijakan baca yang memakai
--      lingkup_semua()/is_progress_admin() (tech_notes, form_reviews,
--      progress_*, checklist_*) ikut meloloskan pimpinan.
--   C. TULIS: kebijakan RESTRICTIVE per tabel bisnis - INSERT/UPDATE/DELETE
--      ditolak untuk pimpinan APA PUN kebijakan permissive-nya (termasuk "baris
--      milik sendiri"). Tabel pribadi (notifications, audit, sesi, kuis belajar)
--      sengaja tidak disentuh.
--
-- Tidak ada data yang diubah. Kembali ke semula: DROP kebijakan pimpinan_*, lalu
-- ALTER TABLE users DROP COLUMN pimpinan (fungsi di bawah bisa dibiarkan).

-- ── A. Kolom + fungsi ─────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pimpinan boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.pimpinan_lihat_semua()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT jwt_claim('sub') <> '' AND COALESCE(
    (SELECT u.pimpinan FROM public.users u WHERE u.id::text = jwt_claim('sub')),
    false
  );
$$;

-- Kolom hak akses: dibekukan untuk anon/authenticated (hanya service-role lewat
-- /api/admin/users yang boleh mengubah), sama seperti piket_ubah.
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
    NEW.pimpinan              := FALSE;
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
    NEW.pimpinan              := OLD.pimpinan;
    NEW.telegram_chat_id      := OLD.telegram_chat_id;
    NEW.bisa_ditugaskan       := OLD.bisa_ditugaskan;

    NEW.username  := OLD.username;
    NEW.full_name := OLD.full_name;
    NEW.jabatan   := OLD.jabatan;

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

-- ── B. BACA ───────────────────────────────────────────────────────────────
-- Pembantu baca yang dipakai tickets/reminders/projects/project_requests/...
CREATE OR REPLACE FUNCTION public.boleh_lihat_baris(sales_uuid uuid, nama_sales text, divisi text, dibuat_oleh text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jwt_claim('sub') <> '' AND (
    lingkup_semua()
    OR (SELECT pimpinan_lihat_semua())
    OR (sales_uuid IS NOT NULL AND sales_uuid = jwt_user_id())
    OR nama_sales  = jwt_full_name()
    OR dibuat_oleh = jwt_claim('username')
    OR (divisi IS NOT NULL AND divisi = ANY (lingkup_divisi()))
  );
$function$;

CREATE OR REPLACE FUNCTION public.boleh_lihat_project(nama_sales text, divisi text, dibuat_oleh text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jwt_claim('sub') <> '' AND (
    lingkup_semua()
    OR (SELECT pimpinan_lihat_semua())
    OR nama_sales   = jwt_full_name()
    OR dibuat_oleh  = jwt_claim('username')
    OR (divisi IS NOT NULL AND divisi = ANY (lingkup_divisi()))
  );
$function$;

-- Checklist: pembantu baca (hanya dipakai kebijakan SELECT checklist_*).
CREATE OR REPLACE FUNCTION public.checklist_boleh_lihat_daftar(p_daftar uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select is_progress_admin()
      or (SELECT pimpinan_lihat_semua())
      or checklist_saya_anggota(p_daftar)
      or exists (select 1 from checklist_daftar d join checklist_proyek p on p.id = d.proyek_id
                 where d.id = p_daftar and p.sales_name is not null and p.sales_name = jwt_full_name());
$function$;

CREATE OR REPLACE FUNCTION public.checklist_boleh_lihat_proyek(p_proyek uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select is_progress_admin()
      or (SELECT pimpinan_lihat_semua())
      or exists (select 1 from checklist_proyek p where p.id = p_proyek and p.sales_name is not null and p.sales_name = jwt_full_name())
      or exists (select 1 from checklist_daftar d join checklist_anggota a on a.daftar_id = d.id
                 where d.proyek_id = p_proyek and a.user_id = jwt_user_id());
$function$;

-- (SELECT fungsi()) = dihitung sekali per query, bukan per baris.
-- Kebijakan BACA yang memeriksa peran langsung (bukan lewat pembantu di atas):
-- ekspresinya dibaca dari katalog lalu cabang is_progress_admin()/lingkup_semua()
-- diperluas. Dibuat idempotent (dilewati bila sudah memuat pimpinan_lihat_semua).
DO $$
DECLARE
  r record;
  baru text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'SELECT'
      AND (tablename, policyname) IN (
        ('tech_notes',        'tn_baca'),
        ('form_reviews',      'fr_baca'),
        ('progress_projects', 'pp_select'),
        ('progress_locations','pl_select'),
        ('progress_issues',   'pi_select'),
        ('progress_components','pc_select'),
        ('progress_actions',  'pa_select')
      )
  LOOP
    IF r.qual LIKE '%pimpinan_lihat_semua%' THEN CONTINUE; END IF;
    baru := replace(replace(r.qual,
      'is_progress_admin()', '(is_progress_admin() OR (SELECT pimpinan_lihat_semua()))'),
      'lingkup_semua()',     '(lingkup_semua() OR (SELECT pimpinan_lihat_semua()))');
    IF baru = r.qual THEN
      RAISE EXCEPTION 'Kebijakan %.% tidak memuat is_progress_admin()/lingkup_semua() - periksa manual', r.tablename, r.policyname;
    END IF;
    EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)', r.policyname, r.schemaname, r.tablename, baru);
  END LOOP;
END $$;

-- Learning Center tampil seperti admin untuk pimpinan (Laporan, Team, Analytics membaca
-- jawaban & percobaan SEMUA peserta). Kebijakan lca_milik/lcj_milik hanya meloloskan pemilik
-- atau admin, jadi pimpinan perlu jalur BACA sendiri (permissive, hanya SELECT).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lc_quiz_attempts','lc_answers'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS pimpinan_baca ON public.%I', t);
    EXECUTE format('CREATE POLICY pimpinan_baca ON public.%I FOR SELECT USING ((SELECT public.pimpinan_lihat_semua()))', t);
  END LOOP;
END $$;

-- ── C. TULIS: hanya baca, ditegakkan RESTRICTIVE ──────────────────────────
-- Kebijakan RESTRICTIVE di-AND-kan dengan semua kebijakan permissive, jadi
-- pimpinan tetap ditolak walau barisnya "miliknya" (mis. tiket buatan sendiri).
DO $$
DECLARE
  t text;
  tabel text[] := ARRAY[
    'tickets','reminders','projects','project_requests','project_messages','project_attachments',
    'form_reviews','progress_projects','progress_locations','progress_issues','progress_components','progress_actions',
    'tech_notes','tech_note_folders','tech_note_history',
    'daily_reports','daily_report_team_entries','movement_logs',
    'piket_tamu_detail','piket_schedules','picket_holidays',
    'checklist_proyek','checklist_daftar','checklist_bagian','checklist_item','checklist_anggota',
    'kpi_manual_values','kpi_period_snapshots','kpi_global_settings',
    'lc_materials','lc_questions','lc_quiz_sessions','lc_quiz_attempts','lc_answers'
  ];
BEGIN
  FOREACH t IN ARRAY tabel LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS pimpinan_hanya_lihat_tambah ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS pimpinan_hanya_lihat_ubah   ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS pimpinan_hanya_lihat_hapus  ON public.%I', t);
    EXECUTE format('CREATE POLICY pimpinan_hanya_lihat_tambah ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK ((SELECT NOT public.pimpinan_lihat_semua()))', t);
    EXECUTE format('CREATE POLICY pimpinan_hanya_lihat_ubah   ON public.%I AS RESTRICTIVE FOR UPDATE USING ((SELECT NOT public.pimpinan_lihat_semua())) WITH CHECK ((SELECT NOT public.pimpinan_lihat_semua()))', t);
    EXECUTE format('CREATE POLICY pimpinan_hanya_lihat_hapus  ON public.%I AS RESTRICTIVE FOR DELETE USING ((SELECT NOT public.pimpinan_lihat_semua()))', t);
  END LOOP;
END $$;
