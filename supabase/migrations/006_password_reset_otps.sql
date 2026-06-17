-- B8: Tabel OTP untuk reset password via WhatsApp
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username    TEXT NOT NULL,
  otp_hash    TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk lookup cepat
CREATE INDEX IF NOT EXISTS idx_otp_username ON password_reset_otps(username);

-- Auto-cleanup OTP yang sudah expired atau dipakai (via cron atau manual)
-- Tidak perlu RLS karena diakses server-side saja
ALTER TABLE password_reset_otps DISABLE ROW LEVEL SECURITY;
