-- ============================================================
-- MIGRATION 005: Escalation via pg_cron + pg_net (Supabase Pro)
-- Jalankan SETELAH deploy aplikasi ke Vercel
-- Ganti YOUR_VERCEL_URL dan YOUR_CRON_SECRET
-- ============================================================

-- Cek apakah pg_cron tersedia:
-- SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Jika pg_cron & pg_net tersedia (Supabase Pro), aktifkan:
/*
SELECT cron.schedule(
  'escalate-stuck-tickets',
  '0 */6 * * *',    -- Setiap 6 jam
  $$
  SELECT net.http_post(
    url     := 'https://YOUR_VERCEL_URL/api/cron/escalate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', 'YOUR_CRON_SECRET'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Cleanup sessions expired tiap hari jam 02:00 WIB
SELECT cron.schedule(
  'cleanup-sessions',
  '0 19 * * *',
  'SELECT cleanup_expired_sessions()'
);

-- Cleanup login attempts tiap hari
SELECT cron.schedule(
  'cleanup-login-attempts',
  '30 19 * * *',
  'SELECT cleanup_login_attempts()'
);
*/

-- Jika TIDAK pakai pg_cron, gunakan Vercel Cron di vercel.json:
-- "crons": [{"path": "/api/cron/escalate", "schedule": "0 */6 * * *"}]
-- Dan tambahkan CRON_SECRET ke environment variables Vercel
