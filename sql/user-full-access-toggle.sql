-- ============================================================================
-- Toggle "Full Access / Guest" per akun — hak akses platform independen dari
-- jabatan
-- ============================================================================
--
--  Latar: platform ini dibuat untuk TEAM PTS mengelola kerja timnya sendiri.
--  Sebelumnya hak "setara admin" (lihat & kelola seluruh data tim, bukan cuma
--  datanya sendiri) di beberapa modul (Ticketing, Reminder Schedule) dicoba
--  ditebak dari jabatan ('Manager') secara hardcode di kode. Itu rapuh: kalau
--  suatu saat ATASAN Manager itu juga perlu kendali penuh, atau strukturnya
--  berubah, kodenya harus diubah lagi.
--
--  Solusinya: satu kolom TOGGLE eksplisit yang admin atur sendiri per akun
--  lewat Admin Panel — bukan ditebak dari jabatan. 'full' = akses setara admin
--  di modul data (Piket Showroom, Learning Center, KPI Team, Form Review,
--  Ticketing, Reminder Schedule, Daily Report, Unit Movement, Project
--  Progress). 'guest' = tetap terbatas ke datanya sendiri (perilaku lama,
--  jadi DEFAULT — tidak mengubah perilaku akun yang sudah ada).
--
--  SENGAJA cuma berlaku untuk role='team' (lihat lib/constants.ts
--  hasFullAccess) — toggle ini tidak dimaksudkan untuk akun Guest/Sales/
--  Marketing, sesuai desain: platform Team PTS, bukan alat kelola tim sales.
--
--  TIDAK terkait dengan hak kelola AKUN (buat/hapus user, ubah role/password)
--  — itu tetap admin/superadmin saja lewat /api/admin/users, toggle ini hanya
--  memengaruhi visibilitas & edit DATA di tiap modul.
--
--  ⚠️ URUTAN (sama seperti sql/lock-users-privileged-columns.sql):
--    1) Deploy dulu kode yang sudah memakai kolom ini (route
--       /api/admin/users, lib/admin-users.ts, Admin Panel toggle-nya).
--    2) Jalankan SQL ini.
--    3) Test: toggle Full Access di Admin Panel utk 1 akun Team PTS, cek
--       modul-modul di atas langsung menunjukkan data penuh.
--
--  Aman dijalankan berulang.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'guest';

DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_access_level_check CHECK (access_level IN ('full', 'guest'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Kunci di trigger yang sama dengan role/team_type ─────────────────────────
-- access_level jelas kolom hak akses — anon/authenticated TIDAK boleh
-- mengubahnya sendiri, sama seperti role & team_type. Hanya service_role
-- (lewat /api/admin/users) atau dashboard (postgres) yang boleh.
CREATE OR REPLACE FUNCTION guard_users_privileged_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role                  := 'guest';
    NEW.team_type             := 'Pending Approval';
    NEW.allow_incentive_input := COALESCE(NEW.allow_incentive_input, FALSE) AND FALSE;
    NEW.access_level          := 'guest';
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.role                  := OLD.role;
    NEW.team_type             := OLD.team_type;
    NEW.allow_incentive_input := OLD.allow_incentive_input;
    NEW.allowed_menus         := OLD.allowed_menus;
    NEW.access_level          := OLD.access_level;
    RETURN NEW;
  END IF;

  RETURN NEW;
END $$;

-- Trigger itu sendiri sudah terpasang (dibuat oleh
-- sql/lock-users-privileged-columns.sql) — CREATE OR REPLACE FUNCTION di atas
-- cukup, tidak perlu DROP/CREATE TRIGGER ulang.

-- Verifikasi:
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trg_guard_users_privileged';
