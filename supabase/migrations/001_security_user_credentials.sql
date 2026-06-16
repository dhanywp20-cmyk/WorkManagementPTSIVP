-- ============================================================
-- MIGRATION 001: Pisahkan password dari tabel users
-- Jalankan di Supabase SQL Editor → Run
-- ============================================================

-- 1. Buat tabel baru untuk menyimpan credential terpisah
CREATE TABLE IF NOT EXISTS user_credentials (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  algorithm    TEXT NOT NULL DEFAULT 'bcrypt',
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

-- 2. Migrasikan password yang sudah ada dari users ke user_credentials
-- (hanya jika kolom password ada dan tidak null)
INSERT INTO user_credentials (user_id, password_hash, algorithm)
SELECT id, password, 'bcrypt'
FROM users
WHERE password IS NOT NULL
  AND password != ''
  AND NOT EXISTS (
    SELECT 1 FROM user_credentials WHERE user_credentials.user_id = users.id
  );

-- 3. Trigger: updated_at otomatis diperbarui
CREATE OR REPLACE FUNCTION update_user_credentials_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_credentials_updated ON user_credentials;
CREATE TRIGGER trg_user_credentials_updated
  BEFORE UPDATE ON user_credentials
  FOR EACH ROW EXECUTE FUNCTION update_user_credentials_timestamp();

-- CATATAN: Setelah aplikasi berjalan stabil dengan user_credentials,
-- kolom 'password' di tabel users bisa di-drop:
-- ALTER TABLE users DROP COLUMN IF EXISTS password;
-- (Jangan drop sekarang — tunggu konfirmasi semua login berjalan via user_credentials)
