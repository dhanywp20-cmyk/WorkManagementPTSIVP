-- ============================================================================
-- LOCK kolom HAK AKSES di tabel users — cegah eskalasi hak via anon key
-- ============================================================================
--
--  Masalah: tabel users ditulis pakai anon key dari browser. Tanpa proteksi,
--  siapa pun bisa `UPDATE users SET role='admin'` langsung via REST → jadi admin.
--
--  Solusi: trigger membekukan kolom role / team_type / allow_incentive_input /
--  allowed_menus untuk role publik (anon/authenticated). Hanya server
--  (service_role, lewat /api/admin/users) atau dashboard (postgres) yang boleh
--  mengubahnya. Kolom non-hak-akses (nama, phone, jabatan, atasan_id) tetap
--  bebas diubah dari klien.
--
--  ⚠️ URUTAN (DB dipakai bersama preview & production):
--    1) Merge branch ini ke main & PASTIKAN production sudah deploy (route
--       /api/admin/users + semua tombol admin sudah memakainya).
--    2) Test di production: Tambah Akun, Approve user, Edit role, toggle
--       "izin input incentive" — semua harus berhasil (lewat route server).
--    3) BARU jalankan SQL ini.
--    4) Test lagi langkah 2 (sekarang via service_role) + coba ubah role lewat
--       REST anon → harus gagal/diabaikan.
--
--  Jangan jalankan SEBELUM langkah 1–2, atau tombol admin akan berhenti
--  berfungsi di production (kolom dibekukan, tapi belum lewat route server).
-- ============================================================================

CREATE OR REPLACE FUNCTION guard_users_privileged_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Role tepercaya (server service_role, owner/postgres, dashboard) → lewati.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Registrasi publik selalu jadi guest yang menunggu approval.
    NEW.role                 := 'guest';
    NEW.team_type            := 'Pending Approval';
    NEW.allow_incentive_input := COALESCE(NEW.allow_incentive_input, FALSE) AND FALSE; -- paksa FALSE
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Bekukan kolom hak akses ke nilai lama (anon tak boleh mengubahnya).
    NEW.role                  := OLD.role;
    NEW.team_type             := OLD.team_type;
    NEW.allow_incentive_input := OLD.allow_incentive_input;
    NEW.allowed_menus         := OLD.allowed_menus;
    RETURN NEW;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_users_privileged ON users;
CREATE TRIGGER trg_guard_users_privileged
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION guard_users_privileged_columns();

-- Verifikasi trigger terpasang:
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trg_guard_users_privileged';
