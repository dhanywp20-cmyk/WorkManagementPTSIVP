-- ═══════════════════════════════════════════════════════════════════════════
-- 05. FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════
-- Jalankan SEBELUM 04_rls.sql (policies memanggil jwt_claim/lingkup_semua/dst).
--
-- Extension yang dibutuhkan fungsi-fungsi di bawah - di Supabase, aktifkan
-- lewat Dashboard → Database → Extensions (bukan CREATE EXTENSION manual,
-- kecuali pgcrypto/uuid-ossp yang sudah dibuat di 01_tables.sql):
--   - moddatetime   (dipakai trigger handle_updated_at di reminders)
--   - pg_net        (dipakai net.http_post di check_pending_tickets/handle_ticket_assignment)
--   - pg_cron       (dipakai cron.schedule di update_reminder_cron - HANYA kalau
--                     Anda mau fitur jadwal reminder WA otomatis; boleh dilewati)
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- ⚠️ KEAMANAN - BACA SEBELUM MENJALANKAN BERKAS INI ⚠️
--
-- Dua fungsi di bawah (check_pending_tickets, handle_ticket_assignment) di
-- database SUMBER menyimpan RAHASIA ASLI tertulis langsung di badan fungsi -
-- service_role JWT Supabase dan token API Fonnte. Nilainya SUDAH DIHAPUS
-- (diganti '<GANTI_...>') di berkas ini SEBELUM di-commit ke git - JANGAN
-- pernah menaruh rahasia sungguhan di file yang masuk version control.
--
-- Sebelum kedua fungsi ini dipakai di instalasi baru:
--   1. Ganti '<GANTI_SERVICE_ROLE_KEY>' dengan service_role key project
--      Supabase yang BARU (Project Settings → API).
--   2. Ganti '<GANTI_FONNTE_TOKEN>' dengan token akun Fonnte (WA gateway) Anda
--      sendiri - JANGAN pakai punya instalasi lama.
--   3. Idealnya, pindahkan kedua nilai ini ke tabel rahasia_integrasi (lihat
--      update_reminder_cron di bawah - itu contoh pola yang benar: baca dari
--      rahasia_integrasi, bukan hardcode) - trigger tolak_rahasia_di_pengaturan
--      sendiri menegaskan aturan ini untuk app_settings.
--   4. Jika berkas ASLI (bukan salinan yang diedit ini) sempat ter-commit ke
--      repository manapun, ANGGAP KEDUA RAHASIA ITU BOCOR - rotate/regenerate
--      service_role key di Supabase Dashboard dan token Fonnte SEGERA, jangan
--      hanya mengganti teksnya di sini.

CREATE OR REPLACE FUNCTION public.batalkan_tandai(nama_berkas text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE sql_diterapkan SET diterapkan_pada = NULL WHERE berkas = nama_berkas;
  RETURN nama_berkas || ': penandaan dibatalkan.';
END $function$;


CREATE OR REPLACE FUNCTION public.jwt_claim(nama text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::json ->> nama, '');
$function$;

CREATE OR REPLACE FUNCTION public.jwt_full_name()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jwt_claim('full_name');
$function$;

CREATE OR REPLACE FUNCTION public.jwt_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT NULLIF(jwt_claim('sub'), '')::uuid;
$function$;

CREATE OR REPLACE FUNCTION public.lingkup_semua()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jwt_claim('user_role') IN ('admin', 'superadmin', 'team');
$function$;

CREATE OR REPLACE FUNCTION public.lingkup_divisi()
 RETURNS text[]
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN u.is_internal_sales IS NOT TRUE THEN ARRAY[]::text[]
    ELSE ARRAY(
      SELECT DISTINCT d FROM (
        SELECT m.sales_division AS d
        FROM division_ivp_mappings m
        WHERE m.ivp_id = u.id
        UNION
        SELECT u.sales_division
      ) x
      WHERE d IS NOT NULL AND d <> ''
    )
  END
  FROM users u
  WHERE u.id = jwt_user_id();
$function$;

CREATE OR REPLACE FUNCTION public.boleh_hapus_reminder()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    jwt_claim('user_role') IN ('admin', 'superadmin')
    OR jwt_claim('access_level') = 'full'
    OR EXISTS (
      SELECT 1 FROM app_settings s
      WHERE s.key = 'manager_user_id' AND s.value #>> '{}' = jwt_claim('sub')
    );
$function$;

CREATE OR REPLACE FUNCTION public.boleh_lihat_baris(sales_uuid uuid, nama_sales text, divisi text, dibuat_oleh text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jwt_claim('sub') <> '' AND (
    lingkup_semua()
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
    OR nama_sales   = jwt_full_name()
    OR dibuat_oleh  = jwt_claim('username')
    OR (divisi IS NOT NULL AND divisi = ANY (lingkup_divisi()))
  );
$function$;

CREATE OR REPLACE FUNCTION public.boleh_lihat_request(req_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM project_requests pr
    WHERE pr.id = req_id
      AND (
        boleh_lihat_baris(pr.sales_user_id, pr.sales_name, pr.sales_division, NULL)
        OR pr.requester_id      = jwt_claim('sub')
        OR pr.assign_user_id    = jwt_user_id()
        OR pr.assign_name       = jwt_full_name()
        OR pr.internal_sales_id = jwt_user_id()
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.boleh_tulis_pengaturan()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT lingkup_semua();
$function$;

CREATE OR REPLACE FUNCTION public.kunci_rahasia(k text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT k ~* '(token|secret|api_?key|password|credential)';
$function$;

CREATE OR REPLACE FUNCTION public.is_progress_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jwt_claim('user_role') IN ('admin', 'superadmin', 'team');
$function$;

CREATE OR REPLACE FUNCTION public.debug_jwt_claims()
 RETURNS TABLE(username text, full_name text, user_role text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    COALESCE(current_setting('request.jwt.claims', true)::json ->> 'username',  ''),
    COALESCE(current_setting('request.jwt.claims', true)::json ->> 'full_name', ''),
    COALESCE(current_setting('request.jwt.claims', true)::json ->> 'user_role', '');
$function$;

-- ── Trigger functions ────────────────────────────────────────────────────

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
END $function$;

CREATE OR REPLACE FUNCTION public.tolak_rahasia_di_pengaturan()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF kunci_rahasia(NEW.key) THEN
    RAISE EXCEPTION
      'app_settings bukan tempat menyimpan rahasia. Kunci "%" ditolak. Simpan token/secret sebagai environment variable Edge Function atau Vercel.',
      NEW.key
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.touch_progress_projects()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_credentials_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- ⚠️ Rahasia diganti placeholder - lihat catatan KEAMANAN di atas berkas ini.
CREATE OR REPLACE FUNCTION public.handle_ticket_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_phone   text;
  v_token   text := '<GANTI_FONNTE_TOKEN>';
  v_message text;
BEGIN
  IF (
    NEW.assign_name IS NOT NULL AND (
      TG_OP = 'INSERT' OR
      OLD.assign_name IS NULL OR
      NEW.assign_name <> OLD.assign_name
    )
  ) THEN
    SELECT phone_number INTO v_phone
    FROM public.users
    WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(NEW.assign_name))
      AND phone_number IS NOT NULL AND phone_number <> ''
    LIMIT 1;

    IF v_phone IS NULL THEN
      SELECT phone_number INTO v_phone
      FROM public.users
      WHERE LOWER(TRIM(username)) = LOWER(TRIM(NEW.assign_name))
        AND phone_number IS NOT NULL AND phone_number <> ''
      LIMIT 1;
    END IF;

    IF v_phone IS NOT NULL THEN
      v_message :=
        '🎫 *Ticket Baru Assigned ke Anda*' || chr(10) ||
        '━━━━━━━━━━━━━━━━━━━━━━' || chr(10) ||
        '📌 *Project :* ' || COALESCE(NEW.project_name, '-') || chr(10) ||
        '⚠️ *Issue   :* ' || COALESCE(NEW.issue_case, '-') || chr(10) ||
        '📝 *Deskripsi:* ' || COALESCE(NEW.description, '-') || chr(10) ||
        '🔢 *SN Unit :* ' || COALESCE(NEW.sn_unit, '-') || chr(10) ||
        '📱 *Customer:* ' || COALESCE(NEW.customer_phone, '-') || chr(10) ||
        '👤 *Sales   :* ' || COALESCE(NEW.sales_name, '-') || chr(10) ||
        '✍️ *Created by:* ' || COALESCE(NEW.created_by, '-') || chr(10) ||
        '━━━━━━━━━━━━━━━━━━━━━━' || chr(10) ||
        'Mohon segera dicek dan ditangani. Semangat! 💪' || chr(10) ||
        'Link Dashboard: https://team-ticketing.vercel.app/dashboard';

      PERFORM net.http_post(
        url     := 'https://api.fonnte.com/send',
        headers := jsonb_build_object(
          'Authorization', v_token,
          'Content-Type',  'application/json'
        ),
        body    := jsonb_build_object(
          'target',      v_phone,
          'message',     v_message,
          'countryCode', '62'
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ⚠️ Rahasia diganti placeholder - lihat catatan KEAMANAN di atas berkas ini.
-- Ganti juga URL Edge Function (frxdbqcojaiosjoghdqk) ke ref project BARU Anda.
CREATE OR REPLACE FUNCTION public.check_pending_tickets()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  ticket record;
BEGIN
  FOR ticket IN
    SELECT t.id, t.project_name, t.issue_case, t.assign_name,
           u.phone_number, u.full_name
    FROM public.tickets t
    JOIN public.users u
      ON LOWER(TRIM(u.full_name)) = LOWER(TRIM(t.assign_name))
    WHERE t.status IN ('Pending', 'In Progress')
      AND u.phone_number IS NOT NULL AND u.phone_number <> ''

    UNION

    SELECT t.id, t.project_name, t.issue_case, t.assign_name,
           u.phone_number, u.full_name
    FROM public.tickets t
    JOIN public.users u
      ON LOWER(TRIM(u.username)) = LOWER(TRIM(t.assign_name))
    WHERE t.status IN ('Pending', 'In Progress')
      AND u.phone_number IS NOT NULL AND u.phone_number <> ''
  LOOP
    PERFORM net.http_post(
      url := 'https://<GANTI_PROJECT_REF>.supabase.co/functions/v1/swift-responder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <GANTI_SERVICE_ROLE_KEY>'
      ),
      body := jsonb_build_object(
        'type', 'reminder_wa',
        'target', ticket.phone_number,
        'message',
          '⏰ *Reminder Ticket Pending*' || chr(10) ||
          '━━━━━━━━━━━━━━━━━━━━━━' || chr(10) ||
          '📌 *Project :* ' || COALESCE(ticket.project_name, '-') || chr(10) ||
          '⚠️ *Issue   :* ' || COALESCE(ticket.issue_case, '-') || chr(10) ||
          '👤 *Handler :* ' || COALESCE(ticket.full_name, '-') || chr(10) ||
          '━━━━━━━━━━━━━━━━━━━━━━' || chr(10) ||
          'Mohon segera ditangani! 💪' || chr(10) ||
          'https://team-ticketing.vercel.app/dashboard'
      )
    );
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_login_attempts()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.count_failed_attempts(p_username text, p_ip text, p_window_mins integer DEFAULT 15)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM login_attempts
    WHERE (username = p_username OR ip_address = p_ip)
      AND success = FALSE
      AND attempted_at > NOW() - (p_window_mins || ' minutes')::INTERVAL
  );
END;
$function$;

-- ── Fungsi bantu identitas UUID lama (sql/identitas-uuid*.sql) - boleh
--    dilewati pada instalasi baru tanpa riwayat migrasi username→uuid ──────
CREATE OR REPLACE FUNCTION public.propagate_user_rename(p_user_id uuid, p_old_username text, p_new_username text, p_old_name text, p_new_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  m         record;
  col_ok    boolean;
  key_type  text;
  n         bigint;
  result    jsonb := '{}'::jsonb;
  gagal     jsonb := '[]'::jsonb;
  teks constant text[] := ARRAY['text','character varying','character'];
BEGIN
  FOR m IN SELECT * FROM (VALUES
      ('reminders','assign_name','assigned_to','username'),
      ('reminders','handler_name','assigned_to','username'),
      ('tickets','assign_name','handler_username','username'),
      ('tickets','handler_name','handler_username','username'),
      ('activity_logs','handler_name','handler_username','username'),
      ('form_reviews','assign_name','assigned_to','username'),
      ('form_reviews','guest_fullname','guest_username','username'),
      ('form_reviews','user_name','user_id','userid'),
      ('form_reviews','target_name','target_id','userid'),
      ('incentive_splits','user_name','user_id','userid'),
      ('incentive_tranches','user_name','user_id','userid'),
      ('kpi_snapshot_members','user_name','user_id','userid'),
      ('brand_pic_mappings','pic_user_name','pic_user_id','userid'),
      ('piket_schedules','pic_ivp_name','pic_ivp_id','userid'),
      ('piket_schedules','pic_mvi_name','pic_mvi_id','userid'),
      ('piket_schedules','pic_ump_name','pic_ump_id','userid'),
      ('picket_holidays','pic_ivp_name','pic_ivp_id','userid'),
      ('picket_holidays','pic_mvi_name','pic_mvi_id','userid'),
      ('picket_holidays','pic_ump_name','pic_ump_id','userid'),
      ('project_attachments','sender_name','sender_id','userid'),
      ('project_messages','sender_name','sender_id','userid'),
      ('project_messages','user_name','user_id','userid'),
      ('project_messages','target_name','target_id','userid'),
      ('project_requests','sender_name','sender_id','userid'),
      ('project_requests','user_name','user_id','userid'),
      ('project_requests','target_name','target_id','userid'),
      ('tech_notes','author_name','user_id','userid'),
      ('tech_notes','user_name','user_id','userid'),
      ('tech_notes','target_name','target_id','userid'),
      ('tech_note_history','user_name','user_id','userid'),
      ('tech_note_history','target_name','target_id','userid'),
      ('user_credentials','full_name','user_id','userid'),
      ('user_credentials','user_name','user_id','userid')
    ) AS t(tbl, namecol, keycol, kind)
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=m.tbl AND column_name=m.namecol
         AND data_type = ANY(teks)
    ) INTO col_ok;

    SELECT data_type INTO key_type
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name=m.tbl AND column_name=m.keycol;

    CONTINUE WHEN NOT col_ok OR key_type IS NULL;

    BEGIN
      IF m.kind = 'username' THEN
        CONTINUE WHEN NOT (key_type = ANY(teks));
        EXECUTE format(
          'UPDATE public.%I SET %I=$1 WHERE %I=$2 AND %I IS DISTINCT FROM $1',
          m.tbl, m.namecol, m.keycol, m.namecol)
          USING p_new_name, p_old_username;

      ELSIF key_type = 'uuid' THEN
        EXECUTE format(
          'UPDATE public.%I SET %I=$1 WHERE %I=$2 AND %I IS DISTINCT FROM $1',
          m.tbl, m.namecol, m.keycol, m.namecol)
          USING p_new_name, p_user_id;

      ELSIF key_type = ANY(teks) THEN
        EXECUTE format(
          'UPDATE public.%I SET %I=$1 WHERE %I=$2 AND %I IS DISTINCT FROM $1',
          m.tbl, m.namecol, m.keycol, m.namecol)
          USING p_new_name, p_user_id::text;

      ELSE
        CONTINUE;
      END IF;

      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN result := result || jsonb_build_object(m.tbl||'.'||m.namecol, n); END IF;
    EXCEPTION WHEN OTHERS THEN
      gagal := gagal || jsonb_build_object('kolom', m.tbl||'.'||m.namecol, 'pesan', SQLERRM);
    END;
  END LOOP;

  IF p_old_name IS NOT NULL AND p_old_name <> '' THEN
    FOR m IN SELECT * FROM (VALUES
        ('reminders','sales_name'),
        ('tickets','sales_name'),
        ('form_reviews','sales_name'),
        ('daily_reports','entered_by'),
        ('kpi_period_snapshots','created_by'),
        ('kpi_manual_values','updated_by'),
        ('lc_materials','created_by'),
        ('lc_questions','created_by'),
        ('lc_quiz_sessions','created_by'),
        ('tech_note_folders','author_name'),
        ('tech_note_folders','created_by'),
        ('tech_notes','performed_by_name'),
        ('tech_notes','reviewed_by_name'),
        ('tech_note_history','performed_by_name'),
        ('tech_note_history','created_by'),
        ('picket_holidays','created_by'),
        ('users','created_by')
      ) AS t(tbl, namecol)
    LOOP
      SELECT EXISTS(
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name=m.tbl AND column_name=m.namecol
           AND data_type = ANY(teks)
      ) INTO col_ok;
      CONTINUE WHEN NOT col_ok;

      BEGIN
        EXECUTE format('UPDATE public.%I SET %I=$1 WHERE %I=$2', m.tbl, m.namecol, m.namecol)
          USING p_new_name, p_old_name;
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n > 0 THEN result := result || jsonb_build_object(m.tbl||'.'||m.namecol, n); END IF;
      EXCEPTION WHEN OTHERS THEN
        gagal := gagal || jsonb_build_object('kolom', m.tbl||'.'||m.namecol, 'pesan', SQLERRM);
      END;
    END LOOP;
  END IF;

  IF p_old_username IS DISTINCT FROM p_new_username
     AND p_new_username IS NOT NULL AND p_old_username IS NOT NULL THEN
    FOR m IN SELECT * FROM (VALUES
        ('reminders','assigned_to'),
        ('tickets','handler_username'),
        ('activity_logs','handler_username'),
        ('form_reviews','assigned_to'),
        ('form_reviews','guest_username'),
        ('user_credentials','username')
      ) AS t(tbl, ucol)
    LOOP
      SELECT EXISTS(
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name=m.tbl AND column_name=m.ucol
           AND data_type = ANY(teks)
      ) INTO col_ok;
      CONTINUE WHEN NOT col_ok;

      BEGIN
        EXECUTE format('UPDATE public.%I SET %I=$1 WHERE %I=$2', m.tbl, m.ucol, m.ucol)
          USING p_new_username, p_old_username;
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n > 0 THEN result := result || jsonb_build_object(m.tbl||'.'||m.ucol, n); END IF;
      EXCEPTION WHEN OTHERS THEN
        gagal := gagal || jsonb_build_object('kolom', m.tbl||'.'||m.ucol, 'pesan', SQLERRM);
      END;
    END LOOP;
  END IF;

  IF jsonb_array_length(gagal) > 0 THEN
    result := result || jsonb_build_object('_gagal', gagal);
  END IF;
  RETURN result;
END;
$function$;

-- ── RPC admin/maintenance (dipanggil manual dari SQL Editor, bukan dari app) ──
CREATE OR REPLACE FUNCTION public.update_reminder_cron(p_hour_wib integer, p_minute integer, p_day_of_week text, p_active boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron', 'net', 'pg_temp'
AS $function$
DECLARE
  v_utc_hour  integer;
  v_cron_expr text;
  v_url       text := 'https://<GANTI_PROJECT_REF>.supabase.co/functions/v1/daily-reminder';
  v_key       text;
  v_headers   text;
BEGIN
  IF jwt_claim('user_role') NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Hanya admin yang boleh mengubah jadwal reminder.';
  END IF;

  SELECT nilai INTO v_key FROM rahasia_integrasi WHERE kunci = 'supabase.service_role_key';
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'supabase.service_role_key belum ada di rahasia_integrasi.';
  END IF;
  v_headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || v_key || '"}';

  -- WIB = UTC+7, jadi UTC = WIB - 7
  v_utc_hour := MOD(p_hour_wib - 7 + 24, 24);
  v_cron_expr := p_minute::text || ' ' || v_utc_hour::text || ' * * ' || p_day_of_week;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daily-reminder';

  IF p_active THEN
    PERFORM cron.schedule(
      'daily-reminder',
      v_cron_expr,
      'SELECT net.http_post(url:=''' || v_url || ''', headers:=''' || v_headers || '''::jsonb, body:=''{}''::jsonb);'
    );
  END IF;

  RETURN 'OK: WIB ' || p_hour_wib || ':' || LPAD(p_minute::text,2,'0') ||
         ' = UTC ' || v_utc_hour || ':' || LPAD(p_minute::text,2,'0') ||
         ' | cron: ' || v_cron_expr;
END;
$function$;

-- ── Alat diagnosa/administrasi RLS (dipakai sql/cek-*.sql, aman dijalankan
--    kapan saja - tidak mengubah data) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.buang_policy_lama(nama_tabel text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE r record; dibuang text[] := ARRAY[]::text[];
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = nama_tabel
  LOOP
    EXECUTE format('DROP POLICY %I ON %I', r.policyname, nama_tabel);
    dibuang := dibuang || r.policyname;
  END LOOP;
  RETURN CASE WHEN array_length(dibuang,1) IS NULL THEN 'tidak ada policy lama'
              ELSE 'policy lama dibuang: ' || array_to_string(dibuang, ', ') END;
END $function$;

CREATE OR REPLACE FUNCTION public.buka_app_settings()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF to_regclass('public.app_settings') IS NULL THEN
    RETURN 'app_settings tidak ada.';
  END IF;
  ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;
  RETURN 'RLS app_settings DIMATIKAN. Policy-nya dibiarkan - menyalakan lagi cukup SELECT kunci_app_settings().';
END;
$function$;

CREATE OR REPLACE FUNCTION public.kunci_app_settings()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  p record;
  dibuang text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.app_settings') IS NULL THEN
    RETURN 'app_settings tidak ada - tidak ada yang dikerjakan.';
  END IF;

  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'app_settings'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.app_settings', p.policyname);
    dibuang := dibuang || p.policyname;
  END LOOP;

  ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

  CREATE POLICY as_baca ON public.app_settings
    FOR SELECT TO anon, authenticated
    USING (NOT kunci_rahasia(key));

  CREATE POLICY as_insert ON public.app_settings
    FOR INSERT TO anon, authenticated WITH CHECK (boleh_tulis_pengaturan());
  CREATE POLICY as_update ON public.app_settings
    FOR UPDATE TO anon, authenticated
    USING (boleh_tulis_pengaturan()) WITH CHECK (boleh_tulis_pengaturan());
  CREATE POLICY as_delete ON public.app_settings
    FOR DELETE TO anon, authenticated USING (boleh_tulis_pengaturan());

  RETURN format('app_settings terkunci. Policy lama dibuang: %s',
    CASE WHEN array_length(dibuang,1) IS NULL THEN '(tidak ada)' ELSE array_to_string(dibuang,', ') END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.keadaan_app_settings()
 RETURNS TABLE(policy text, perintah text, syarat_baca text, syarat_tulis text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT policyname::text, cmd::text, coalesce(qual, '-'), coalesce(with_check, '-')
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'app_settings'
  ORDER BY cmd, policyname;
$function$;

CREATE OR REPLACE FUNCTION public.keadaan_rls()
 RETURNS TABLE(tabel text, rls_menyala boolean, jumlah_policy bigint, policy_terpasang text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT c.relname::text,
         c.relrowsecurity,
         count(p.polname),
         COALESCE(string_agg(p.polname::text, ', ' ORDER BY p.polname), '-')
  FROM pg_class c
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
  WHERE c.relname IN ('notifications','tickets','reminders','project_requests')
  GROUP BY c.relname, c.relrowsecurity
  ORDER BY c.relrowsecurity, c.relname;
$function$;

CREATE OR REPLACE FUNCTION public.matikan_rls(nama_tabel text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF nama_tabel NOT IN ('notifications','tickets','reminders','project_requests') THEN
    RAISE EXCEPTION 'Tabel % tidak dikenal.', nama_tabel;
  END IF;
  EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', nama_tabel);
  RETURN nama_tabel || ': RLS dimatikan. Policy-nya tetap tersimpan, siap dinyalakan lagi.';
END $function$;

CREATE OR REPLACE FUNCTION public.syarat_siap()
 RETURNS TABLE(fungsi text, ada boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT f, EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'public' AND p.proname = f)
  FROM unnest(ARRAY['jwt_claim','jwt_full_name','jwt_user_id',
                    'lingkup_semua','lingkup_divisi','boleh_lihat_baris']) AS f;
$function$;

CREATE OR REPLACE FUNCTION public.syarat_tipe()
 RETURNS TABLE(kolom text, tipe_sekarang text, tipe_diharapkan text, cocok boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT h.k, COALESCE(c.data_type, '(kolomnya tidak ada)'), h.t,
         COALESCE(c.data_type, '') = h.t
  FROM (VALUES
    ('notifications.user_id',            'text'),
    ('project_requests.requester_id',    'text'),
    ('tickets.sales_user_id',            'uuid'),
    ('tickets.assign_user_id',           'uuid'),
    ('reminders.sales_user_id',          'uuid'),
    ('reminders.assign_user_id',         'uuid'),
    ('reminders.internal_sales_id',      'uuid'),
    ('reminders.internal_sales_id_2',    'uuid'),
    ('project_requests.sales_user_id',   'uuid'),
    ('project_requests.assign_user_id',  'uuid'),
    ('project_requests.internal_sales_id','uuid')
  ) AS h(k, t)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name  = split_part(h.k, '.', 1)
   AND c.column_name = split_part(h.k, '.', 2);
$function$;

CREATE OR REPLACE FUNCTION public.nyalakan_rls(nama_tabel text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE bekas text; kurang text;
BEGIN
  IF nama_tabel NOT IN ('notifications','tickets','reminders','project_requests') THEN
    RAISE EXCEPTION 'Tabel % tidak dikenal.', nama_tabel;
  END IF;
  SELECT string_agg(fungsi, ', ') INTO kurang FROM syarat_siap() WHERE NOT ada;
  IF kurang IS NOT NULL THEN
    RAISE EXCEPTION 'Fondasi belum lengkap - fungsi ini belum ada: %. TIDAK ADA yang diubah.', kurang;
  END IF;
  SELECT string_agg(kolom || ' (' || tipe_sekarang || ', diharapkan ' || tipe_diharapkan || ')', '; ')
    INTO kurang FROM syarat_tipe() WHERE NOT cocok;
  IF kurang IS NOT NULL THEN
    RAISE EXCEPTION 'Tipe kolom tidak sesuai yang diandaikan policy: %. TIDAK ADA yang diubah.', kurang;
  END IF;
  bekas := buang_policy_lama(nama_tabel);
  IF nama_tabel = 'notifications' THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    CREATE POLICY nt_own ON notifications FOR ALL TO anon, authenticated
      USING (user_id = jwt_claim('sub') OR lingkup_semua()) WITH CHECK (true);
    RETURN 'notifications: RLS menyala, nt_own dipasang. ' || bekas;
  ELSIF nama_tabel = 'tickets' THEN
    ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tk_select ON tickets FOR SELECT TO anon, authenticated
      USING (boleh_lihat_baris(sales_user_id, sales_name, sales_division, created_by)
             OR assign_user_id = jwt_user_id() OR assign_name = jwt_full_name());
    CREATE POLICY tk_insert ON tickets FOR INSERT TO anon, authenticated WITH CHECK (true);
    CREATE POLICY tk_update ON tickets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
    CREATE POLICY tk_delete ON tickets FOR DELETE TO anon, authenticated USING (true);
    RETURN 'tickets: RLS menyala, tk_select menyaring baca, menulis masih terbuka. ' || bekas;
  ELSIF nama_tabel = 'reminders' THEN
    ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
    CREATE POLICY rm_select ON reminders FOR SELECT TO anon, authenticated
      USING (boleh_lihat_baris(sales_user_id, sales_name, sales_division, created_by)
             OR assign_user_id = jwt_user_id() OR assigned_to = jwt_claim('username')
             OR internal_sales_id = jwt_user_id() OR internal_sales_id_2 = jwt_user_id());
    CREATE POLICY rm_insert ON reminders FOR INSERT TO anon, authenticated WITH CHECK (true);
    CREATE POLICY rm_update ON reminders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
    CREATE POLICY rm_delete ON reminders FOR DELETE TO anon, authenticated USING (true);
    RETURN 'reminders: RLS menyala, rm_select menyaring baca, menulis masih terbuka. ' || bekas;
  ELSIF nama_tabel = 'project_requests' THEN
    ALTER TABLE project_requests ENABLE ROW LEVEL SECURITY;
    CREATE POLICY pr_select ON project_requests FOR SELECT TO anon, authenticated
      USING (boleh_lihat_baris(sales_user_id, sales_name, sales_division, NULL)
             OR requester_id = jwt_claim('sub') OR assign_user_id = jwt_user_id()
             OR assign_name = jwt_full_name() OR internal_sales_id = jwt_user_id());
    CREATE POLICY pr_insert ON project_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
    CREATE POLICY pr_update ON project_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
    CREATE POLICY pr_delete ON project_requests FOR DELETE TO anon, authenticated USING (true);
    RETURN 'project_requests: RLS menyala, pr_select menyaring baca, menulis masih terbuka. ' || bekas;
  END IF;
END $function$;

-- ── Alat diagnosa identitas UUID (sql/identitas-uuid*.sql, sql/cek-nama-tidak-cocok.sql) ──
CREATE OR REPLACE FUNCTION public.nama_tidak_cocok(nama_tabel text)
 RETURNS TABLE(tabel text, akun text, nama_di_data text, jumlah bigint, catatan text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY EXECUTE format($f$
    WITH nol AS (
      SELECT u.id, u.full_name::text AS akun
      FROM users u
      WHERE COALESCE(u.role,'') NOT IN ('admin','superadmin','team')
        AND u.full_name IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM %I t WHERE t.sales_name = u.full_name)
    ),
    kata AS (
      SELECT n.id, n.akun, w AS potongan
      FROM nol n, unnest(string_to_array(n.akun, ' ')) w
      WHERE length(w) >= 4
    )
    SELECT %L::text, k.akun, t.sales_name::text, count(*),
           CASE WHEN lower(t.sales_name) = lower(k.akun)
                THEN 'HANYA BEDA HURUF BESAR-KECIL'
                ELSE 'ejaan berbeda' END
    FROM kata k
    JOIN %I t ON t.sales_name ILIKE '%%' || k.potongan || '%%'
    GROUP BY k.akun, t.sales_name
    UNION ALL
    SELECT %L::text, n.akun, '(tidak bisa dinilai)', 0::bigint,
           'nama terlalu pendek - tidak ada kata >= 4 huruf untuk dicocokkan'
    FROM nol n
    WHERE NOT EXISTS (SELECT 1 FROM kata k WHERE k.id = n.id)
    ORDER BY 2, 4 DESC
  $f$, nama_tabel, nama_tabel, nama_tabel, nama_tabel);
END;
$function$;

CREATE OR REPLACE FUNCTION public.periksa_lingkup(nama_tabel text)
 RETURNS TABLE(tabel text, akun text, peran text, akan_terlihat bigint, nama_mirip bigint, penilaian text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE kolom_dibuat text;
BEGIN
  kolom_dibuat := CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=nama_tabel AND column_name='created_by'
  ) THEN 't.created_by' ELSE 'NULL::text' END;

  RETURN QUERY EXECUTE format($f$
    WITH hitung AS (
      SELECT u.full_name::text AS akun, u.role::text AS peran,
        count(*) FILTER (WHERE
          u.role IN ('admin','superadmin','team')
          OR t.sales_name = u.full_name
          OR %s = u.username
          OR (t.sales_division IS NOT NULL AND t.sales_division = ANY (
                CASE WHEN u.is_internal_sales IS NOT TRUE THEN ARRAY[]::text[]
                     ELSE ARRAY(SELECT DISTINCT d FROM (
                       SELECT m.sales_division AS d FROM division_ivp_mappings m WHERE m.ivp_id=u.id
                       UNION SELECT u.sales_division) x WHERE d IS NOT NULL AND d <> '') END))
        ) AS terlihat,
        count(*) FILTER (WHERE
          t.sales_name IS DISTINCT FROM u.full_name
          AND t.sales_name ILIKE '%%' || split_part(u.full_name, ' ', 1) || '%%'
        ) AS mirip
      FROM users u CROSS JOIN %I t
      GROUP BY u.full_name, u.role, u.id, u.username, u.is_internal_sales, u.sales_division
    )
    SELECT %L::text, akun, peran, terlihat, mirip,
      CASE
        WHEN peran IN ('admin','superadmin','team') THEN 'orang dalam - lihat semua'
        WHEN terlihat > 0                           THEN 'aman'
        WHEN mirip > 0                              THEN 'PERIKSA - nol baris, tapi ada ' || mirip || ' baris bernama mirip'
        ELSE                                             'nol baris, dan memang tidak ada yang bernama mirip'
      END
    FROM hitung
    ORDER BY (CASE WHEN peran IN ('admin','superadmin','team') THEN 2
                   WHEN terlihat = 0 AND mirip > 0 THEN 0 ELSE 1 END), akun
  $f$, kolom_dibuat, nama_tabel, nama_tabel);
END;
$function$;

CREATE OR REPLACE FUNCTION public.isi_pengaturan_merek()
 RETURNS TABLE(kunci text, isi text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT key::text, coalesce(value::text, '(kosong)')
  FROM public.app_settings
  WHERE key IN ('merek', 'sales_divisions')
  ORDER BY key;
$function$;

CREATE OR REPLACE FUNCTION public.setujui(p_tabel text, p_kolom text, p_nilai text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE jml int; nama text;
BEGIN
  SELECT count(DISTINCT user_id), string_agg(DISTINCT nama_akun, ' | ')
    INTO jml, nama
  FROM identitas_calon
  WHERE tabel = p_tabel AND kolom = p_kolom AND nilai = p_nilai;

  IF jml = 0 THEN
    RETURN format('DITOLAK: %s.%s = %L tidak punya calon. Pakai setujui_ke() '
                  'kalau Anda tahu sendiri akunnya.', p_tabel, p_kolom, p_nilai);
  ELSIF jml > 1 THEN
    RETURN format('DITOLAK: %s.%s = %L punya %s calon (%s). Pakai setujui_ke() '
                  'untuk menyebut yang mana.', p_tabel, p_kolom, p_nilai, jml, nama);
  END IF;

  DELETE FROM identitas_usulan
   WHERE tabel = p_tabel AND kolom = p_kolom AND nilai = p_nilai;
  INSERT INTO identitas_usulan (tabel, kolom, nilai, jumlah_baris, user_id, nama_akun, cara)
  SELECT DISTINCT tabel, kolom, nilai, jumlah_baris, user_id, nama_akun, cara
  FROM identitas_calon
  WHERE tabel = p_tabel AND kolom = p_kolom AND nilai = p_nilai;

  RETURN format('OK: %s.%s = %L -> %s', p_tabel, p_kolom, p_nilai, nama);
END $function$;

CREATE OR REPLACE FUNCTION public.setujui(p_nilai text)
 RETURNS SETOF text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT tabel, kolom FROM identitas_calon WHERE nilai = p_nilai
  LOOP
    RETURN NEXT setujui(r.tabel, r.kolom, p_nilai);
  END LOOP;
  IF NOT FOUND THEN
    RETURN NEXT format('DITOLAK: %L tidak punya calon di tabel mana pun.', p_nilai);
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.setujui_ke(p_tabel text, p_kolom text, p_nilai text, p_username text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE u record; ada bigint;
BEGIN
  SELECT id, full_name INTO u FROM users
   WHERE lower(btrim(username)) = lower(btrim(p_username));
  IF u.id IS NULL THEN
    RETURN format('DITOLAK: tidak ada akun dengan username %L.', p_username);
  END IF;

  SELECT jumlah_baris INTO ada FROM identitas_sisa
   WHERE tabel = p_tabel AND kolom = p_kolom AND nilai = p_nilai;
  IF ada IS NULL THEN
    RETURN format('DITOLAK: %s.%s = %L tidak ada di daftar yang belum terpetakan. '
                  'Salah ketik, atau baris itu sudah punya uuid.', p_tabel, p_kolom, p_nilai);
  END IF;

  DELETE FROM identitas_usulan
   WHERE tabel = p_tabel AND kolom = p_kolom AND nilai = p_nilai;
  INSERT INTO identitas_usulan (tabel, kolom, nilai, jumlah_baris, user_id, nama_akun, cara)
  VALUES (p_tabel, p_kolom, p_nilai, ada, u.id, u.full_name, 'ditetapkan manual');

  RETURN format('OK: %s.%s = %L -> %s (%s baris)', p_tabel, p_kolom, p_nilai, u.full_name, ada);
END $function$;

-- ── Pelacak sql_diterapkan (dokumentasi, bukan migration runner) ──────────
CREATE OR REPLACE FUNCTION public.tandai(nama_berkas text, ket text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE ada boolean;
BEGIN
  SELECT true INTO ada FROM sql_diterapkan WHERE berkas = nama_berkas;
  IF ada IS NOT TRUE THEN
    INSERT INTO sql_diterapkan (berkas, urutan, golongan, diterapkan_pada, catatan)
    VALUES (nama_berkas,
            COALESCE((SELECT max(urutan) FROM sql_diterapkan), 0) + 1,
            'tambahan', now(), ket);
    RETURN nama_berkas || ': dicatat sebagai berkas tambahan, ditandai diterapkan.';
  END IF;
  IF (SELECT golongan FROM sql_diterapkan WHERE berkas = nama_berkas) = 'pembatalan' THEN
    RETURN nama_berkas || ': DITOLAK - ini berkas pembatalan darurat, bukan langkah penerapan.';
  END IF;
  UPDATE sql_diterapkan
     SET diterapkan_pada = now(), catatan = COALESCE(ket, catatan)
   WHERE berkas = nama_berkas;
  RETURN nama_berkas || ': ditandai diterapkan.';
END $function$;

CREATE OR REPLACE FUNCTION public.tandai_semua_skema()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE n int;
BEGIN
  UPDATE sql_diterapkan
     SET diterapkan_pada = now(),
         catatan = COALESCE(catatan, 'ditandai borongan - platform sudah berjalan')
   WHERE golongan = 'skema' AND diterapkan_pada IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n || ' berkas skema ditandai diterapkan.';
END $function$;

-- ── Triggers ─────────────────────────────────────────────────────────────
CREATE TRIGGER trg_tolak_rahasia_pengaturan BEFORE INSERT OR UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION tolak_rahasia_di_pengaturan();
CREATE TRIGGER trg_touch_progress_projects BEFORE UPDATE ON public.progress_projects FOR EACH ROW EXECUTE FUNCTION touch_progress_projects();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER on_ticket_assigned AFTER INSERT OR UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION handle_ticket_assignment();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_user_credentials_updated BEFORE UPDATE ON public.user_credentials FOR EACH ROW EXECUTE FUNCTION update_user_credentials_timestamp();
CREATE TRIGGER trg_guard_users_privileged BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION guard_users_privileged_columns();

-- ── Project 360: view ringkasan + RPC Mapping Center ─────────────────────
-- Cerminan supabase/migrations/014_project_360.sql. Butuh extension pg_trgm.
--
-- security_invoker WAJIB di view ini: tanpa itu view berjalan sebagai
-- pemiliknya dan RLS tabel sumber dilewati - view berubah jadi pintu belakang
-- kebocoran data lintas divisi.

CREATE OR REPLACE FUNCTION public.norm_nama_project(t text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$ SELECT lower(btrim(regexp_replace(coalesce(t,''), '\s+', ' ', 'g'))) $$;

CREATE OR REPLACE VIEW public.v_project_summary WITH (security_invoker = true) AS
SELECT p.id AS project_id, p.code, p.name, p.customer, p.location,
       p.sales_name, p.sales_division, p.status, p.created_at,
       COALESCE(s.n,0) AS schedule_count,
       COALESCE(t.n,0) AS ticket_count,
       COALESCE(d.n,0) AS design_count,
       COALESCE(f.n,0) AS review_count,
       COALESCE(s.n,0) + COALESCE(t.n,0) + COALESCE(d.n,0) + COALESCE(f.n,0) AS total_activity,
       GREATEST(s.last_at, t.last_at, d.last_at, f.last_at) AS last_activity
FROM public.projects p
LEFT JOIN (SELECT l.project_id, count(*) n, max(r.due_date) last_at
           FROM public.project_source_links l JOIN public.reminders r ON r.id = l.source_record_id
           WHERE l.source_module='reminders' AND COALESCE(r.is_deleted,false)=false
           GROUP BY l.project_id) s ON s.project_id = p.id
LEFT JOIN (SELECT l.project_id, count(*) n, max(t2.date) last_at
           FROM public.project_source_links l JOIN public.tickets t2 ON t2.id = l.source_record_id
           WHERE l.source_module='tickets' AND COALESCE(t2.is_deleted,false)=false
           GROUP BY l.project_id) t ON t.project_id = p.id
LEFT JOIN (SELECT l.project_id, count(*) n, max(d2.created_at::date) last_at
           FROM public.project_source_links l JOIN public.project_requests d2 ON d2.id = l.source_record_id
           WHERE l.source_module='project_requests' AND COALESCE(d2.is_deleted,false)=false
           GROUP BY l.project_id) d ON d.project_id = p.id
LEFT JOIN (SELECT l.project_id, count(*) n, max(f2.created_at::date) last_at
           FROM public.project_source_links l JOIN public.form_reviews f2 ON f2.id = l.source_record_id
           WHERE l.source_module='form_reviews'
           GROUP BY l.project_id) f ON f.project_id = p.id;

CREATE OR REPLACE FUNCTION public.saran_project(p_nama text, p_limit int DEFAULT 5)
RETURNS TABLE (project_id uuid, code text, name text, location text, sales_name text, skor real)
LANGUAGE sql STABLE AS
$$
  SELECT p.id, p.code, p.name, p.location, p.sales_name,
         similarity(public.norm_nama_project(p.name), public.norm_nama_project(p_nama)) AS skor
  FROM public.projects p
  WHERE similarity(public.norm_nama_project(p.name), public.norm_nama_project(p_nama)) > 0.28
  ORDER BY skor DESC, p.name
  LIMIT greatest(1, least(p_limit, 20));
$$;

-- form_reviews sengaja tidak ikut antrean: ia selalu terikat ke satu reminder
-- lewat reminder_id, jadi mengikuti pemetaan reminder-nya.
CREATE OR REPLACE FUNCTION public.record_belum_terpeta(p_limit int DEFAULT 200)
RETURNS TABLE (source_module text, source_record_id uuid, project_name text, info text, tanggal date)
LANGUAGE sql STABLE AS
$$
  (SELECT 'reminders'::text, r.id, r.project_name,
          concat_ws(' · ', nullif(r.sales_name,''), nullif(r.address,''), nullif(r.category,'')), r.due_date
   FROM public.reminders r
   WHERE COALESCE(r.is_deleted,false)=false AND btrim(COALESCE(r.project_name,'')) <> ''
     AND NOT EXISTS (SELECT 1 FROM public.project_source_links l
                     WHERE l.source_module='reminders' AND l.source_record_id=r.id))
  UNION ALL
  (SELECT 'tickets', t.id, t.project_name,
          concat_ws(' · ', nullif(t.issue_case,''), nullif(t.assign_name,''), nullif(t.address,'')), t.date
   FROM public.tickets t
   WHERE COALESCE(t.is_deleted,false)=false AND btrim(COALESCE(t.project_name,'')) <> ''
     AND NOT EXISTS (SELECT 1 FROM public.project_source_links l
                     WHERE l.source_module='tickets' AND l.source_record_id=t.id))
  UNION ALL
  (SELECT 'project_requests', d.id, d.project_name,
          concat_ws(' · ', nullif(d.requester_name,''), nullif(d.sales_name,''), nullif(d.project_location,'')), d.created_at::date
   FROM public.project_requests d
   WHERE COALESCE(d.is_deleted,false)=false AND btrim(COALESCE(d.project_name,'')) <> ''
     AND NOT EXISTS (SELECT 1 FROM public.project_source_links l
                     WHERE l.source_module='project_requests' AND l.source_record_id=d.id))
  ORDER BY 5 DESC NULLS LAST
  LIMIT greatest(1, least(p_limit, 500));
$$;

CREATE OR REPLACE FUNCTION public.ringkasan_mapping()
RETURNS TABLE (auto_mapped bigint, manual_mapped bigint, diabaikan bigint, belum_terpeta bigint, total_project bigint)
LANGUAGE sql STABLE AS
$$
  SELECT (SELECT count(*) FROM public.project_source_links WHERE mapping_type='auto'),
         (SELECT count(*) FROM public.project_source_links WHERE mapping_type='manual'),
         (SELECT count(*) FROM public.project_source_links WHERE mapping_type='ignored'),
         (SELECT count(*) FROM public.record_belum_terpeta(500)),
         (SELECT count(*) FROM public.projects);
$$;

-- ── Project 360: pemetaan otomatis record -> project (lihat supabase/migrations/015) ──
-- 1. Pemetaan satu record (inti) ------------------------------------------

create or replace function public.petakan_record_otomatis(
  p_modul text, p_id uuid, p_nama text,
  p_sales text default null, p_divisi text default null, p_lokasi text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as
$$
declare
  k text := public.norm_nama_project(p_nama);
  pid uuid;
  n int;
begin
  if k = '' or p_modul not in ('reminders','tickets','project_requests') then return null; end if;
  if exists (select 1 from public.project_source_links
             where source_module = p_modul and source_record_id = p_id) then
    return null;
  end if;

  -- Dua record baru bernama sama yang masuk bersamaan tidak boleh membuat
  -- dua project kembar.
  perform pg_advisory_xact_lock(hashtext('project360:' || k));

  select count(*), (array_agg(id))[1] into n, pid
  from public.projects
  where public.norm_nama_project(name) = k and status <> 'archived';

  if n > 1 then return null; end if;

  if n = 0 then
    insert into public.projects (name, sales_name, sales_division, location, created_by)
    values (btrim(regexp_replace(p_nama, '\s+', ' ', 'g')),
            nullif(btrim(coalesce(p_sales,'')), ''), nullif(btrim(coalesce(p_divisi,'')), ''),
            nullif(btrim(coalesce(p_lokasi,'')), ''), 'sistem (otomatis)')
    returning id into pid;
  else
    -- Lengkapi isian project yang masih kosong dari record ini.
    update public.projects set
      sales_name     = coalesce(sales_name, nullif(btrim(coalesce(p_sales,'')), '')),
      sales_division = coalesce(sales_division, nullif(btrim(coalesce(p_divisi,'')), '')),
      location       = coalesce(location, nullif(btrim(coalesce(p_lokasi,'')), ''))
    where id = pid and (sales_name is null or sales_division is null or location is null);
  end if;

  insert into public.project_source_links
    (source_module, source_record_id, project_id, mapping_type, confidence, match_reason, mapped_by)
  values (p_modul, p_id, pid, 'auto', 1,
          case when n = 0 then 'project dibuat otomatis dari nama' else 'nama project sama persis' end,
          'sistem')
  on conflict (source_module, source_record_id) do nothing;

  return pid;
end;
$$;

-- Hanya dipanggil dari trigger & backfill (keduanya berjalan sebagai pemilik).
-- Tanpa ini, siapa pun lewat PostgREST bisa membuat project sembarangan.
revoke execute on function public.petakan_record_otomatis(text, uuid, text, text, text, text)
  from public, anon, authenticated;

-- 2. Trigger record baru / nama diubah ------------------------------------

create or replace function public.trg_petakan_project_otomatis()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as
$$
declare
  r jsonb := to_jsonb(new);
begin
  if coalesce((r->>'is_deleted')::boolean, false) then return null; end if;

  if tg_op = 'UPDATE' then
    if public.norm_nama_project(old.project_name) = public.norm_nama_project(new.project_name) then
      return null;
    end if;
    -- Nama berubah: hanya pemetaan otomatis yang ikut dihitung ulang.
    delete from public.project_source_links
    where source_module = tg_table_name and source_record_id = new.id and mapping_type = 'auto';
  end if;

  perform public.petakan_record_otomatis(
    tg_table_name, new.id, new.project_name,
    r->>'sales_name', r->>'sales_division', coalesce(r->>'address', r->>'project_location'));
  return null;
exception when others then
  -- Pemetaan adalah pelengkap. Kegagalannya TIDAK BOLEH menggagalkan
  -- pembuatan jadwal/ticket/request - record tetap masuk antrean Mapping Center.
  raise warning '[project360] pemetaan otomatis % % gagal: %', tg_table_name, new.id, sqlerrm;
  return null;
end;
$$;

drop trigger if exists petakan_project_otomatis on public.reminders;
create trigger petakan_project_otomatis
  after insert or update of project_name on public.reminders
  for each row execute function public.trg_petakan_project_otomatis();

drop trigger if exists petakan_project_otomatis on public.tickets;
create trigger petakan_project_otomatis
  after insert or update of project_name on public.tickets
  for each row execute function public.trg_petakan_project_otomatis();

drop trigger if exists petakan_project_otomatis on public.project_requests;
create trigger petakan_project_otomatis
  after insert or update of project_name on public.project_requests
  for each row execute function public.trg_petakan_project_otomatis();

-- 3. Backfill: semua record yang belum terpeta ----------------------------
--
-- Urutan: Request Schedule dulu (paling lengkap isian sales & alamatnya,
-- jadi project yang dibuat mewarisi datanya), lalu Design, lalu Ticket;
-- masing-masing dari yang tertua.

create or replace function public.petakan_semua_otomatis()
returns integer
language plpgsql security definer set search_path = public, pg_temp as
$$
declare
  rec record;
  n int := 0;
begin
  -- Lewat PostgREST hanya admin; dari SQL editor/migrasi (bukan authenticator) bebas.
  if session_user = 'authenticator' and public.jwt_claim('user_role') not in ('admin','superadmin') then
    raise exception 'Hanya admin yang boleh menjalankan pemetaan otomatis massal';
  end if;

  for rec in
    select 'reminders'::text m, id, project_name, sales_name, sales_division, address lok, 1 urut, due_date::timestamptz t
      from public.reminders where coalesce(is_deleted,false) = false and btrim(coalesce(project_name,'')) <> ''
    union all
    select 'project_requests', id, project_name, sales_name, sales_division, project_location, 2, created_at
      from public.project_requests where coalesce(is_deleted,false) = false and btrim(coalesce(project_name,'')) <> ''
    union all
    select 'tickets', id, project_name, sales_name, sales_division, address, 3, coalesce(date::timestamptz, created_at)
      from public.tickets where coalesce(is_deleted,false) = false and btrim(coalesce(project_name,'')) <> ''
    order by urut, t nulls last
  loop
    if public.petakan_record_otomatis(rec.m, rec.id, rec.project_name, rec.sales_name, rec.sales_division, rec.lok) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;


-- ── Project 360: perbaikan audit (lihat supabase/migrations/016). Menimpa v_project_summary di atas. ──
-- 2 ------------------------------------------------------------------------
revoke execute on function public.petakan_semua_otomatis() from public, anon, authenticated;
revoke execute on function public.trg_petakan_project_otomatis() from public, anon, authenticated;

-- 3 ------------------------------------------------------------------------
alter function public.norm_nama_project(text) set search_path = public, pg_temp;
alter function public.saran_project(text, int) set search_path = public, pg_temp;
alter function public.record_belum_terpeta(int) set search_path = public, pg_temp;
alter function public.ringkasan_mapping() set search_path = public, pg_temp;

-- 4 ------------------------------------------------------------------------
create or replace view public.v_project_summary with (security_invoker = true) as
select p.id as project_id, p.code, p.name, p.customer, p.location,
       p.sales_name, p.sales_division, p.status, p.created_at,
       coalesce(s.n,0) as schedule_count,
       coalesce(t.n,0) as ticket_count,
       coalesce(d.n,0) as design_count,
       coalesce(f.n,0) as review_count,
       coalesce(s.n,0) + coalesce(t.n,0) + coalesce(d.n,0) + coalesce(f.n,0) as total_activity,
       greatest(s.last_at, t.last_at, d.last_at, f.last_at) as last_activity
from public.projects p
left join (select l.project_id, count(*) n, max(r.due_date) last_at
           from public.project_source_links l join public.reminders r on r.id = l.source_record_id
           where l.source_module='reminders' and coalesce(r.is_deleted,false)=false
           group by l.project_id) s on s.project_id = p.id
left join (select l.project_id, count(*) n, max(t2.date) last_at
           from public.project_source_links l join public.tickets t2 on t2.id = l.source_record_id
           where l.source_module='tickets' and coalesce(t2.is_deleted,false)=false
           group by l.project_id) t on t.project_id = p.id
left join (select l.project_id, count(*) n, max(d2.created_at::date) last_at
           from public.project_source_links l join public.project_requests d2 on d2.id = l.source_record_id
           where l.source_module='project_requests' and coalesce(d2.is_deleted,false)=false
           group by l.project_id) d on d.project_id = p.id
left join (select x.project_id, count(distinct x.review_id) n, max(x.tgl) last_at from (
             select l.project_id, f2.id review_id, f2.created_at::date tgl
             from public.project_source_links l
             join public.reminders r on r.id = l.source_record_id and coalesce(r.is_deleted,false)=false
             join public.form_reviews f2 on f2.reminder_id = r.id
             where l.source_module='reminders' and l.project_id is not null
             union all
             select l.project_id, f2.id, f2.created_at::date
             from public.project_source_links l join public.form_reviews f2 on f2.id = l.source_record_id
             where l.source_module='form_reviews' and l.project_id is not null
           ) x group by x.project_id) f on f.project_id = p.id;

-- 5 ------------------------------------------------------------------------
create or replace function public.trg_bersihkan_project_otomatis_kosong()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as
$$
begin
  if old.project_id is null then return null; end if;
  if tg_op = 'UPDATE' and new.project_id is not distinct from old.project_id then return null; end if;
  delete from public.projects p
  where p.id = old.project_id
    and p.created_by = 'sistem (otomatis)'
    and not exists (select 1 from public.project_source_links l where l.project_id = p.id);
  return null;
end;
$$;
revoke execute on function public.trg_bersihkan_project_otomatis_kosong() from public, anon, authenticated;

drop trigger if exists bersihkan_project_otomatis_kosong on public.project_source_links;
create trigger bersihkan_project_otomatis_kosong
  after delete or update of project_id on public.project_source_links
  for each row execute function public.trg_bersihkan_project_otomatis_kosong();

-- 6 ------------------------------------------------------------------------
-- Pasangan project bernama mirip (kemungkinan beda ketik). SECURITY INVOKER:
-- hanya project yang boleh dilihat pemanggil yang ikut dibandingkan.
create or replace function public.kandidat_duplikat_project(p_ambang real default 0.5, p_limit int default 100)
returns table (a_id uuid, a_code text, a_name text, a_total bigint,
               b_id uuid, b_code text, b_name text, b_total bigint, skor real)
language sql stable set search_path = public, pg_temp as
$$
  select a.project_id, a.code, a.name, a.total_activity,
         b.project_id, b.code, b.name, b.total_activity,
         similarity(public.norm_nama_project(a.name), public.norm_nama_project(b.name))
  from public.v_project_summary a
  join public.v_project_summary b
    on a.project_id < b.project_id
   and public.norm_nama_project(a.name) % public.norm_nama_project(b.name)
  where a.status <> 'archived' and b.status <> 'archived'
    and similarity(public.norm_nama_project(a.name), public.norm_nama_project(b.name)) >= greatest(p_ambang, 0.3)
  order by 9 desc, a.name
  limit greatest(1, least(p_limit, 300));
$$;

-- Gabung atomik: pindah seluruh link lalu hapus project asal, dalam satu
-- transaksi. SECURITY INVOKER - RLS psl_write/projects_write (admin) berlaku.
create or replace function public.gabungkan_project(p_asal uuid, p_tujuan uuid, p_oleh text default null)
returns integer
language plpgsql set search_path = public, pg_temp as
$$
declare n int;
begin
  if p_asal = p_tujuan then raise exception 'Project asal dan tujuan sama'; end if;
  if public.jwt_claim('user_role') not in ('admin','superadmin') and session_user = 'authenticator' then
    raise exception 'Hanya admin yang boleh menggabungkan project';
  end if;
  if not exists (select 1 from public.projects where id = p_tujuan) then
    raise exception 'Project tujuan tidak ditemukan';
  end if;
  update public.project_source_links
     set project_id = p_tujuan, mapping_type = 'manual', confidence = null,
         match_reason = 'digabung dari project lain', mapped_by = p_oleh, mapped_at = now()
   where project_id = p_asal;
  get diagnostics n = row_count;
  delete from public.projects where id = p_asal;
  return n;
end;
$$;

-- ── Audit putaran 2: rekap LC server-side, ringkasan_mapping tanpa batas 500, indeks trigram (lihat supabase/migrations/017). ──
-- 1 ------------------------------------------------------------------------
create or replace function public.rekap_lc_tahunan(p_user_ids uuid[], p_tahun int)
returns table (user_id uuid, wajib int, lulus int, gagal int, tidak_ikut int)
language plpgsql stable security definer set search_path = public, pg_temp as
$$
declare
  v_tim text; v_jab text;
begin
  -- Penjaga SELALU aktif kecuali superuser (SQL editor/migrasi) - bukan
  -- bergantung pada nama role PostgREST.
  if session_user not in ('postgres', 'supabase_admin') then
    if public.jwt_claim('sub') = '' then raise exception 'Harus login'; end if;
    if not public.admin_atau_full_access() then
      select u.team_type, u.jabatan into v_tim, v_jab from public.users u where u.id = public.jwt_user_id();
      if v_jab = 'Supervisor' and public.jwt_claim('user_role') = 'team' then
        p_user_ids := array(select u.id from public.users u where u.id = any(p_user_ids) and u.team_type = v_tim);
      else
        p_user_ids := array(select x from unnest(p_user_ids) x where x = public.jwt_user_id());
      end if;
    end if;
  end if;

  return query
  with s as (
    select q.id, q.target_user_ids, coalesce(q.allow_retake, false) boleh_ulang,
      (q.closed_at is not null
        or (q.close_at is not null and q.close_at < now())
        or (q.is_active = false and exists (
              select 1 from public.lc_quiz_attempts a2 where a2.quiz_session_id = q.id and a2.is_submitted))) selesai
    from public.lc_quiz_sessions q
    where extract(year from (coalesce(q.open_at, q.scheduled_at, q.created_at) at time zone 'Asia/Jakarta')) = p_tahun
  ), per as (
    select x uid, s.selesai, s.boleh_ulang,
      x = any(coalesce(s.target_user_ids, '{}'::uuid[])) ditargetkan,
      count(a.id) n,
      coalesce(bool_or(a.passed), false) ada_lulus,
      coalesce(bool_or(a.grading_status = 'pending_review'), false) ada_pending
    from unnest(p_user_ids) x
    cross join s
    left join public.lc_quiz_attempts a on a.quiz_session_id = s.id and a.user_id = x and a.is_submitted
    group by x, s.id, s.selesai, s.boleh_ulang, s.target_user_ids
  ), status as (
    select uid,
      case
        when n > 0 and ada_lulus then 'lulus'
        when n > 0 and ada_pending then null
        when n > 0 and boleh_ulang and not selesai then null
        when n > 0 then 'gagal'
        when ditargetkan and selesai then 'tidak_ikut'
      end st
    from per
  )
  select x,
    count(st.st)::int,
    count(*) filter (where st.st = 'lulus')::int,
    count(*) filter (where st.st = 'gagal')::int,
    count(*) filter (where st.st = 'tidak_ikut')::int
  from unnest(p_user_ids) x
  left join status st on st.uid = x
  group by x;
end;
$$;

-- 2 ------------------------------------------------------------------------
create or replace function public.ringkasan_mapping()
returns table (auto_mapped bigint, manual_mapped bigint, diabaikan bigint, belum_terpeta bigint, total_project bigint)
language sql stable set search_path = public, pg_temp as
$$
  select (select count(*) from public.project_source_links where mapping_type='auto'),
         (select count(*) from public.project_source_links where mapping_type='manual'),
         (select count(*) from public.project_source_links where mapping_type='ignored'),
         (select count(*) from public.reminders r
            where coalesce(r.is_deleted,false)=false and btrim(coalesce(r.project_name,'')) <> ''
              and not exists (select 1 from public.project_source_links l where l.source_module='reminders' and l.source_record_id=r.id))
       + (select count(*) from public.tickets t
            where coalesce(t.is_deleted,false)=false and btrim(coalesce(t.project_name,'')) <> ''
              and not exists (select 1 from public.project_source_links l where l.source_module='tickets' and l.source_record_id=t.id))
       + (select count(*) from public.project_requests d
            where coalesce(d.is_deleted,false)=false and btrim(coalesce(d.project_name,'')) <> ''
              and not exists (select 1 from public.project_source_links l where l.source_module='project_requests' and l.source_record_id=d.id)),
         (select count(*) from public.projects);
$$;

-- 3 ------------------------------------------------------------------------
create index if not exists projects_norm_name_trgm_idx
  on public.projects using gin (public.norm_nama_project(name) gin_trgm_ops);

create or replace function public.kandidat_duplikat_project(p_ambang real default 0.5, p_limit int default 100)
returns table (a_id uuid, a_code text, a_name text, a_total bigint,
               b_id uuid, b_code text, b_name text, b_total bigint, skor real)
language sql stable set search_path = public, pg_temp as
$$
  with pasangan as (
    select a.id a_id, a.code a_code, a.name a_name, b.id b_id, b.code b_code, b.name b_name,
           similarity(public.norm_nama_project(a.name), public.norm_nama_project(b.name)) skor
    from public.projects a
    join public.projects b
      on a.id < b.id
     and public.norm_nama_project(a.name) % public.norm_nama_project(b.name)
    where a.status <> 'archived' and b.status <> 'archived'
  ), tersaring as (
    select * from pasangan where skor >= greatest(p_ambang, 0.3)
    order by skor desc, a_name
    limit greatest(1, least(p_limit, 300))
  )
  select t.a_id, t.a_code, t.a_name, coalesce(va.total_activity, 0),
         t.b_id, t.b_code, t.b_name, coalesce(vb.total_activity, 0), t.skor
  from tersaring t
  left join public.v_project_summary va on va.project_id = t.a_id
  left join public.v_project_summary vb on vb.project_id = t.b_id
  order by t.skor desc, t.a_name;
$$;

