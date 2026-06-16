-- ============================================================
-- MIGRATION 002: Session management table (httpOnly cookie support)
-- Jalankan di Supabase SQL Editor → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,  -- SHA-256 hash dari token di cookie
  ip_address    TEXT,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk cepat lookup by token_hash
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user  ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_exp   ON user_sessions(expires_at);

-- Auto-cleanup: hapus session yang sudah expired (jalankan periodik via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Schedule cleanup tiap hari jam 02:00 WIB (19:00 UTC)
-- Membutuhkan extension pg_cron (aktif di Supabase Pro)
-- Jika pg_cron tidak tersedia, cleanup dilakukan otomatis saat session baru dibuat
-- SELECT cron.schedule('cleanup-sessions', '0 19 * * *', 'SELECT cleanup_expired_sessions()');
