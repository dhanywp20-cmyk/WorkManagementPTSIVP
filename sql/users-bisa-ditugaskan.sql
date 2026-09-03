-- =====================================================================
-- Toggle "Bisa ditugaskan pekerjaan" per akun
-- =====================================================================
--
-- GEJALA
--
-- Supervisor meng-assign sebuah Request Design ke Manager PTS IVP. Bukan
-- karena ia lancang - namanya memang MUNCUL di dropdown penerima tugas,
-- sejajar dengan staf biasa, tanpa tanda apa pun bahwa ia tidak seharusnya
-- dipilih. Dari sisi Supervisor tidak ada yang salah dengan pilihannya.
--
-- Platformnya sendiri tidak konsisten soal ini:
--
--   Ticketing         : Manager DIKECUALIKAN, lewat `jabatan !== 'Manager'`
--   Design Project    : Manager IKUT muncul (assign)
--   Design Project    : Manager dikecualikan di dropdown re-route, lagi-lagi
--                       lewat `jabatan !== 'Manager'` yang dipaku
--   Reminder Schedule : Manager IKUT muncul (hanya admin/superadmin dikecualikan)
--
-- KENAPA BUKAN SEKADAR MENYALIN FILTER TICKETING KE MODUL LAIN
--
-- Filter itu memaku jabatan 'Manager' di dalam kode. Untuk perusahaan lain
-- yang memakai platform ini, Manager-nya bisa saja memang ikut mengerjakan -
-- dan mereka tidak punya cara mengubahnya selain menyuruh orang menyunting
-- kode lalu deploy ulang. Persis alasan Full Access dibuat sebagai toggle di
-- Admin Panel, bukan disimpulkan dari jabatan.
--
-- Menyalin filter itu juga menyamakan dua pertanyaan yang berbeda:
--   "tim ini mengerjakan pekerjaan?"   -> team_type (isAssignablePTSTeam)
--   "orang ini ikut mengerjakan?"      -> per akun, keputusan admin
--
-- PERBAIKAN
--
-- Kolom users.bisa_ditugaskan, diatur admin per akun lewat Admin Panel ->
-- Kelola Akun -> Penerima Tugas.
--
-- BAWAANNYA TRUE untuk semua akun yang sudah ada, jadi memasang migrasi ini
-- TIDAK mengubah perilaku siapa pun sampai admin benar-benar mematikannya
-- untuk seseorang. Kode pembacanya pun menganggap NULL/undefined sebagai
-- "boleh", supaya pemasangan yang belum menjalankan migrasi ini tidak
-- mendadak mengosongkan seluruh dropdown - kegagalan yang jauh lebih merusak
-- daripada satu nama yang kelebihan.
--
-- Dibekukan dari tulisan langsung anon/authenticated seperti kolom hak akses
-- lain: tanpa itu siapa pun bisa mengeluarkan dirinya sendiri dari antrean
-- kerja lewat REST dengan anon key.
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
-- =====================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bisa_ditugaskan boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.bisa_ditugaskan IS
  'Muncul di dropdown penerima tugas (Ticketing / Reminder Schedule / Design Project). Bawaan true; dimatikan admin untuk akun yang perannya menyetujui, bukan mengerjakan.';

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
    NEW.piket_akses           := NULL;
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
    NEW.telegram_chat_id      := OLD.telegram_chat_id;
    NEW.bisa_ditugaskan       := OLD.bisa_ditugaskan;
    RETURN NEW;
  END IF;

  RETURN NEW;
END $function$;

-- Contoh pemakaian di basis data ini: Manager PTS IVP dikeluarkan dari
-- antrean kerja. Ia tetap bisa approve, re-route, dan melihat semuanya -
-- yang hilang hanya namanya dari dropdown "assign ke siapa".
--
--   UPDATE public.users SET bisa_ditugaskan = false
--    WHERE full_name = 'Dhany Wahyu' AND team_type = 'Team PTS IVP';

-- =====================================================================
-- YANG IKUT BERUBAH DI KODE
-- =====================================================================
--
-- lib/teams.ts        : bolehDitugaskan(user) - dua syarat sekaligus,
--                       team_type yang ditugaskan DAN toggle per akun.
-- app/ticketing       : `jabatan !== 'Manager'` yang dipaku DIHAPUS,
--                       diganti bolehDitugaskan.
-- app/reminder-schedule: dropdown assign kini ikut menyaring.
-- app/form-require-project (Modals & re-route): dua-duanya ikut menyaring;
--                       `jabatan !== 'Manager'` yang kedua juga dihapus.
-- Admin Panel (modal-akun): pilihan "Penerima Tugas" di form Kelola Akun.
-- /api/admin/users    : 'bisa_ditugaskan' masuk whitelist, sebab kolomnya
--                       dibekukan trigger dan hanya boleh ditulis service-role.
-- =====================================================================
