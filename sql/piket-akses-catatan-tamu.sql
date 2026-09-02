-- =====================================================================
-- Piket Showroom - SIAPA BOLEH MELIHAT CATATAN TAMU
-- =====================================================================
--
-- MASALAH YANG DIPERBAIKI
--
-- Catatan kegiatan tamu (piket_tamu_detail) dibatasi per-Sales lewat
-- hitungLingkupProject(): Sales biasa hanya melihat baris ATAS NAMANYA
-- SENDIRI, Sales Internal melihat divisi yang dipetakan kepadanya. Batas itu
-- benar dan tetap dipertahankan - daftar kunjungan pelanggan divisi tetangga
-- memang bukan urusan siapa-siapa.
--
-- Tapi ada satu peran yang tidak muat di aturan itu: RESEPSIONIS / front
-- desk. Ia bukan Sales - namanya tidak pernah muncul sebagai nama_sales -
-- sehingga batas itu menyisakan NOL baris untuknya. Akibatnya seluruh
-- ringkasan Piket Showroom tampil kosong: total jam pakai 0, semua pie chart
-- kosong, semua kegiatan hilang. Bukan disembunyikan dengan sengaja, tapi
-- efeknya persis seperti disembunyikan.
--
-- Menaikkannya jadi role 'team' bukan jawaban (ia akan ikut mendapat akses
-- modul-modul PTS lain), dan memakai "punya menu Piket Showroom" sebagai
-- penanda juga bukan - 8 akun non-PTS memegang menu itu dan sebagian besar
-- memang Sales sungguhan yang justru harus tetap dibatasi.
--
-- Jadi ini dijadikan SETELAN TERSENDIRI, per akun, diatur dari Kelola Akun:
--
--     lingkup  - bawaan. Hanya catatan atas namanya / divisinya sendiri.
--     semua    - melihat SELURUH catatan tamu showroom (resepsionis,
--                front desk, pengawas showroom).
--
-- Setelan ini hanya soal MELIHAT. Hak mengisi & menyunting kegiatan tetap
-- milik Team PTS - lihat lib/piket-akses.ts.
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
-- =====================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS piket_akses text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_piket_akses_check') THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_piket_akses_check
      CHECK (piket_akses IS NULL OR piket_akses IN ('lingkup', 'semua'));
  END IF;
END $$;

COMMENT ON COLUMN public.users.piket_akses IS
  'Lingkup catatan tamu Piket Showroom: lingkup (bawaan, hanya miliknya/divisinya) | semua (resepsionis/front desk). Tidak memberi hak menyunting.';

-- Kolom hak akses WAJIB ikut dibekukan untuk anon, kalau tidak siapa pun
-- bisa memberi dirinya sendiri akses 'semua' lewat REST dengan anon key.
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
    RETURN NEW;
  END IF;

  RETURN NEW;
END $function$;
