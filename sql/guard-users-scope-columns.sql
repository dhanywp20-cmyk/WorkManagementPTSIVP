-- Perluasan trg_guard_users_privileged (fungsi guard_users_privileged_columns())
-- yang sudah ada sebelumnya di database production.
--
-- Trigger lama sudah mengunci role/access_level/allowed_menus/team_type/
-- allow_incentive_input/incentive_akses/incentive_brand_scope/piket_akses/
-- bisa_ditugaskan/username/full_name/jabatan/telegram_chat_id dari
-- self-update lewat RLS (hanya service-role/Admin Panel yang boleh menyentuhnya).
--
-- Empat kolom LINGKUP data berikut BELUM ikut dikunci - ditemukan saat audit
-- hardening (WORKMANAGEMENTHARDENINGPHASE): sales_division, divisi, pts_type,
-- is_internal_sales. Bukan kolom role/menu, tapi tetap bisa dipakai
-- memperluas cakupan data yang terlihat/tergarap kalau user mengubahnya
-- sendiri lewat panggilan langsung ke PostgREST (mis. Sales pindah
-- sales_division sendiri utk melihat data divisi lain). Digabung ke fungsi
-- yang sama - BUKAN trigger terpisah - supaya tidak ada dua trigger BEFORE
-- UPDATE yang tumpang-tindih pada tabel yang sama.
--
-- Sudah diverifikasi lewat simulasi (SET LOCAL ROLE anon + request.jwt.claims,
-- dibungkus transaksi yang di-ROLLBACK, tidak menyentuh data production):
--   - User biasa (role='anon' postgres, klaim guest): role/access_level/
--     full_name/sales_division/divisi/pts_type/is_internal_sales SEMUA
--     berhasil dikembalikan ke nilai lama; phone_number (satu-satunya kolom
--     self-service yang benar-benar dipakai UI, lihat modal-profil.tsx)
--     tetap bisa diubah.
--   - Admin via browser (klaim admin, role postgres tetap 'anon'):
--     kpi_enabled/atasan_id tetap bisa diubah (admin_atau_full_access()).
--   - service_role (jalur Admin Panel sungguhan, lib/admin-users.ts):
--     seluruh kolom tetap bebas diubah seperti sebelumnya - trigger keluar
--     lebih dulu untuk current_user ini, tidak ada regresi pada fitur admin.

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
