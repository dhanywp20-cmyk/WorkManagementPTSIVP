-- =====================================================================
-- Telegram personal per user: kolom telegram_chat_id
-- =====================================================================
--
-- GEJALA
--
-- "kenapa tidak ada chat di telegram yang bekerja ke nomer telegram Ferdinan?
--  yang sudah di set nomer telepon nya di Supabase users ??"
--
-- Ternyata bukan bug - Telegram memang TIDAK BISA mengirim ke nomor telepon.
-- Beda total dari WhatsApp/Fonnte (yang push ke nomor mana pun), bot
-- Telegram hanya boleh membalas Chat ID yang muncul SETELAH orang itu
-- SENDIRI memulai obrolan dengan bot - proteksi anti-spam bawaan Telegram,
-- berlaku untuk semua bot di dunia, tidak bisa dilewati siapa pun.
--
-- Reminder Schedule pun sebelum ini hanya terhubung ke WhatsApp - integrasi
-- Telegram yang baru dibangun belum dipakai satu titik kirim pun selain
-- notifikasi pendaftaran akun baru.
--
-- PERBAIKAN
--
-- Kolom baru users.telegram_chat_id, diisi HANYA lewat verifikasi nyata
-- (bot benar-benar menerima "/start <id akun>" dari orang itu di Telegram -
-- lihat app/api/notifikasi/telegram/route.ts aksi 'hubungkan'), bukan
-- diketik manual. Diketik manual dan salah ketik berarti notifikasi gagal
-- diam-diam - pola yang berulang kali ditemukan di platform ini.
--
-- Karena itu kolom ini DIBEKUKAN dari tulisan langsung anon/authenticated,
-- sama seperti kolom hak akses lain di guard_users_privileged_columns().
-- Satu-satunya jalan mengisinya adalah lewat route yang memverifikasi lebih
-- dulu ke Telegram.
--
-- Jalankan sekali di SQL Editor Supabase. Aman diulang.
-- =====================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;

COMMENT ON COLUMN public.users.telegram_chat_id IS
  'Chat ID Telegram pribadi, terisi hanya lewat verifikasi /api/notifikasi/telegram aksi hubungkan. Jangan diisi manual.';

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
    RETURN NEW;
  END IF;

  RETURN NEW;
END $function$;

-- =====================================================================
-- VERIFIKASI (JWT tersimulasi, begin/rollback - data asli tidak tersentuh)
-- =====================================================================
--
-- Anggota team biasa mencoba UPDATE telegram_chat_id miliknya sendiri
-- langsung (tanpa lewat route verifikasi) -> tetap NULL sesudahnya.
-- Trigger membekukannya persis seperti kolom access_level/incentive_akses.
-- =====================================================================

-- =====================================================================
-- CATATAN ARSITEKTUR: BUKAN SUBSTITUSI ROUTER NOTIFIKASI
-- =====================================================================
--
-- lib/notifikasi/router.ts (kirimNotifikasi) mengirim Telegram ke SATU
-- tujuan bersama yang diatur admin di Admin Panel (grup tim / chat admin).
-- lib/telegram-pribadi.ts (kirimTelegramPribadi) BERBEDA: mengirim ke Chat
-- ID PRIBADI seseorang, dan sengaja tidak melewati matriks Event -> Kanal
-- di Admin Panel (yang dirancang untuk satu tujuan bersama, bukan per
-- orang) - hanya menghormati saklar induk "Kanal Telegram" sebagai tombol
-- mati-total, dan diam saja bila orangnya belum menghubungkan akun.
--
-- Baru disambungkan ke SATU titik: assign Reminder Schedule ke anggota tim
-- (app/reminder-schedule/page.tsx, dekat sendFonnteWA assignee). Puluhan
-- titik kirim WhatsApp lain di reminder-schedule/ticketing/form-require-
-- project BELUM ikut disambungkan - menyusul bertahap, mengikuti kehati-
-- hatian yang sama yang sudah didokumentasikan di lib/notifikasi/router.ts.
-- =====================================================================
