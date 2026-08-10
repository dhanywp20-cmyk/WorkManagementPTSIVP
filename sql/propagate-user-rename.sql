-- ============================================================================
-- PROPAGATE USER RENAME — sebar perubahan nama/username user ke semua snapshot
-- Jalankan di Supabase SQL Editor
-- ============================================================================
-- Banyak tabel menyimpan snapshot nama/username user (denormalisasi). Saat
-- nama/username user diubah di Admin Panel, fungsi ini menyebarkan perubahan ke
-- seluruh tabel terkait dalam satu panggilan.
--
-- Strategi cocok:
--   - 'username' → cocokkan baris via kolom username (assigned_to, handler_username)
--   - 'userid'   → cocokkan via kolom id user (user_id, sender_id, pic_*_id, dst.)
--   - 'name'     → cocokkan via nilai NAMA LAMA (berisiko bila ada nama kembar,
--                  tapi disetujui untuk dipakai)
-- Mengembalikan jsonb berisi jumlah baris ter-update per kolom.
--
-- ── PERBAIKAN: "operator does not exist: text = uuid" ──────────────────────
-- Versi sebelumnya hanya memeriksa apakah kolom kunci ADA, tidak memeriksa
-- TIPE-nya, lalu selalu membandingkannya dengan p_user_id yang bertipe uuid.
-- Padahal tabel di basis data ini tidak seragam: sebagian menyimpan id user
-- sebagai uuid (mis. incentive_splits.user_id), sebagian lagi sebagai text
-- (mis. project_messages.sender_id, tech_notes.user_id). Begitu loop sampai di
-- tabel bertipe text, PostgreSQL menolak `text = uuid` dan SELURUH fungsi
-- berhenti — termasuk tabel-tabel sesudahnya yang sebenarnya tidak bermasalah.
-- Itu sebabnya pesan yang muncul adalah "Akun tersimpan, tapi sebar nama gagal":
-- akun memang sudah tersimpan lebih dulu, penyebarannya yang batal di tengah.
--
-- Sekarang tipe kolom kunci dibaca lebih dulu, lalu parameternya yang
-- disesuaikan (p_user_id::text untuk kolom text). Sengaja parameternya yang
-- di-cast, BUKAN kolomnya: meng-cast kolom text ke uuid akan meledak pada baris
-- mana pun yang isinya bukan uuid yang sah, dan juga membuat indeks tak terpakai.
--
-- Tambahan: tiap UPDATE kini punya penangkap galat sendiri. Satu tabel yang
-- bermasalah tidak lagi membatalkan sisanya; kegagalannya dikumpulkan di kunci
-- "_gagal" pada hasil, supaya tetap terlihat dan bisa ditindaklanjuti.
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
  m         record;
  col_ok    boolean;
  key_type  text;
  n         bigint;
  result    jsonb := '{}'::jsonb;
  gagal     jsonb := '[]'::jsonb;

  -- Tipe apa saja yang dihitung sebagai "teks" di information_schema.
  teks constant text[] := ARRAY['text','character varying','character'];
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

    -- Tipe kolom kunci dibaca, bukan sekadar keberadaannya. NULL = kolom tidak ada.
    SELECT data_type INTO key_type
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name=m.tbl AND column_name=m.keycol;

    CONTINUE WHEN NOT col_ok OR key_type IS NULL;

    BEGIN
      IF m.kind = 'username' THEN
        -- Username hanya masuk akal dibandingkan dengan kolom teks. Kalau kolom
        -- kuncinya ternyata uuid, pemetaannya yang salah — lewati, jangan paksa.
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
        -- Inilah kasus yang dulu meledak. Parameternya yang di-cast ke text.
        EXECUTE format(
          'UPDATE public.%I SET %I=$1 WHERE %I=$2 AND %I IS DISTINCT FROM $1',
          m.tbl, m.namecol, m.keycol, m.namecol)
          USING p_new_name, p_user_id::text;

      ELSE
        CONTINUE;  -- tipe kunci di luar dugaan (int, dsb.) — lewati diam-diam
      END IF;

      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN result := result || jsonb_build_object(m.tbl||'.'||m.namecol, n); END IF;
    EXCEPTION WHEN OTHERS THEN
      gagal := gagal || jsonb_build_object('kolom', m.tbl||'.'||m.namecol, 'pesan', SQLERRM);
    END;
  END LOOP;

  -- ── 2. Kolom NAMA tanpa kunci → cocokkan via NAMA LAMA ────────────────────
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

  -- ── 3. Kolom USERNAME → update nilai username (bila username berubah) ─────
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
$$;

-- Izinkan dipanggil via anon key (RLS tetap berlaku di tabel masing-masing).
GRANT EXECUTE ON FUNCTION propagate_user_rename(uuid, text, text, text, text) TO anon, authenticated;

-- ============================================================================
-- SUSULAN untuk rename yang SUDAH TERLANJUR gagal
-- ============================================================================
-- Fungsi berjalan dalam satu transaksi. Ketika versi lama meledak di tengah,
-- SELURUH penyebaran dibatalkan — jadi tidak ada tabel yang setengah jalan.
-- Tapi nama di tabel users SUDAH berubah lebih dulu (disimpan sebelum fungsi
-- ini dipanggil), sehingga nama LAMA-nya tidak lagi tersimpan di mana pun yang
-- bisa dibaca aplikasi. Menyimpan ulang dari Admin Panel pun tidak menolong:
-- aplikasi hanya menyebarkan bila mendeteksi nama berubah, dan sekarang tidak.
--
-- Karena itu penyebarannya perlu dipanggil sekali secara manual, dengan nama
-- lama disebut eksplisit. Cari dulu id user-nya:
--
--   SELECT id, username, full_name FROM users WHERE full_name ILIKE '%sebagian nama%';
--
-- Lalu jalankan (ganti keempat nilai di bawah; kalau username tidak ikut
-- berubah, isi kolom lama dan baru dengan username yang sama):
--
--   SELECT jsonb_pretty(propagate_user_rename(
--     'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid,  -- users.id
--     'username_lama', 'username_baru',
--     'Nama Lama',     'Nama Baru'
--   ));
--
-- Hasilnya berupa jumlah baris yang berubah per kolom. Bila muncul kunci
-- "_gagal", isinya daftar kolom yang tetap bermasalah beserta pesannya —
-- sisanya tetap sudah tersebar.
-- ============================================================================
