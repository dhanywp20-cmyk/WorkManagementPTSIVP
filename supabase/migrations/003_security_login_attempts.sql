-- ============================================================
-- MIGRATION 003: Rate limiting — login attempts tracking
-- Jalankan di Supabase SQL Editor → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS login_attempts (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username     TEXT NOT NULL,
  ip_address   TEXT,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  success      BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip       ON login_attempts(ip_address, attempted_at);

-- Fungsi: hitung percobaan gagal dalam window waktu tertentu
CREATE OR REPLACE FUNCTION count_failed_attempts(
  p_username    TEXT,
  p_ip          TEXT,
  p_window_mins INTEGER DEFAULT 15
) RETURNS INTEGER LANGUAGE plpgsql AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM login_attempts
    WHERE (username = p_username OR ip_address = p_ip)
      AND success = FALSE
      AND attempted_at > NOW() - (p_window_mins || ' minutes')::INTERVAL
  );
END;
$$;

-- Cleanup login attempts lama (> 24 jam)
CREATE OR REPLACE FUNCTION cleanup_login_attempts()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
