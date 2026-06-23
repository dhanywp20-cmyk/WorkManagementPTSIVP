-- ============================================================================
-- PROPAGATE USER RENAME — sebar perubahan nama/username user ke semua snapshot
-- Run this in Supabase SQL Editor
-- ============================================================================
-- Banyak tabel menyimpan snapshot nama/username user (denormalisasi). Saat
-- nama/username user diubah di Admin Panel, fungsi ini menyebarkan perubahan ke
-- seluruh tabel terkait dalam satu transaksi.
--
-- DEFENSIF: tiap (tabel, kolom) dicek dulu via information_schema — kalau kolom
-- tidak ada, di-skip (tidak error). Jadi aman walau ada kolom yang meleset.
--
-- Strategi cocok:
--   - 'username' → cocokkan baris via kolom username (assigned_to, handler_username)
--   - 'userid'   → cocokkan via kolom UUID (user_id, sender_id, pic_*_id, dst.)
--   - 'name'     → cocokkan via nilai NAMA LAMA (opsi b: komprehensif; berisiko
--                  bila ada nama kembar, tapi disetujui untuk dipakai)
-- Mengembalikan jsonb berisi jumlah baris ter-update per kolom.
-- ============================================================================

CREATE OR REPLACE FUNCTION propagate_user_rename(
  p_user_id      uuid,
  p_old_username text,
  p_new_username text,
  p_old_name     text,
  p_new_name     text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  m        record;
  col_ok   boolean;
  key_ok   boolean;
  n        bigint;
  result   jsonb := '{}'::jsonb;
BEGIN
  -- ── 1. Kolom NAMA yang punya kunci (user_id / username) → set ke nama baru ──
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
      ('piket_schedules','pic_mlds_name','pic_mlds_id','userid'),
      ('piket_schedules','pic_ump_name','pic_ump_id','userid'),
      ('picket_holidays','pic_ivp_name','pic_ivp_id','userid'),
      ('picket_holidays','pic_mlds_name','pic_mlds_id','userid'),
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
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=m.tbl AND column_name=m.namecol AND data_type IN ('text','character varying','character')) INTO col_ok;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=m.tbl AND column_name=m.keycol)  INTO key_ok;
    IF col_ok AND key_ok THEN
      IF m.kind = 'username' THEN
        EXECUTE format('UPDATE public.%I SET %I=$1 WHERE %I=$2 AND %I IS DISTINCT FROM $1', m.tbl, m.namecol, m.keycol, m.namecol)
          USING p_new_name, p_old_username;
      ELSE
        EXECUTE format('UPDATE public.%I SET %I=$1 WHERE %I=$2 AND %I IS DISTINCT FROM $1', m.tbl, m.namecol, m.keycol, m.namecol)
          USING p_new_name, p_user_id;
      END IF;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN result := result || jsonb_build_object(m.tbl||'.'||m.namecol, n); END IF;
    END IF;
  END LOOP;

  -- ── 2. Kolom NAMA tanpa kunci → cocokkan via NAMA LAMA (opsi b) ───────────
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
      SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=m.tbl AND column_name=m.namecol AND data_type IN ('text','character varying','character')) INTO col_ok;
      IF col_ok THEN
        EXECUTE format('UPDATE public.%I SET %I=$1 WHERE %I=$2', m.tbl, m.namecol, m.namecol)
          USING p_new_name, p_old_name;
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n > 0 THEN result := result || jsonb_build_object(m.tbl||'.'||m.namecol, n); END IF;
      END IF;
    END LOOP;
  END IF;

  -- ── 3. Kolom USERNAME → update nilai username (bila username berubah) ─────
  IF p_old_username IS DISTINCT FROM p_new_username AND p_new_username IS NOT NULL AND p_old_username IS NOT NULL THEN
    FOR m IN SELECT * FROM (VALUES
        ('reminders','assigned_to'),
        ('tickets','handler_username'),
        ('activity_logs','handler_username'),
        ('form_reviews','assigned_to'),
        ('form_reviews','guest_username'),
        ('user_credentials','username')
      ) AS t(tbl, ucol)
    LOOP
      SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=m.tbl AND column_name=m.ucol AND data_type IN ('text','character varying','character')) INTO col_ok;
      IF col_ok THEN
        EXECUTE format('UPDATE public.%I SET %I=$1 WHERE %I=$2', m.tbl, m.ucol, m.ucol)
          USING p_new_username, p_old_username;
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n > 0 THEN result := result || jsonb_build_object(m.tbl||'.'||m.ucol, n); END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN result;
END;
$$;

-- Izinkan dipanggil via anon key (RLS tetap berlaku di tabel masing-masing).
GRANT EXECUTE ON FUNCTION propagate_user_rename(uuid, text, text, text, text) TO anon, authenticated;
