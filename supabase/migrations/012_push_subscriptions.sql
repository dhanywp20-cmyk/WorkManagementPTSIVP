-- Perangkat (browser/HP) yang mendaftar untuk menerima push notification asli
-- (notifikasi sistem + bunyi walau app/tab sedang tertutup) - satu baris per
-- kombinasi akun+browser, karena satu orang bisa login dari beberapa HP/tab
-- sekaligus dan semuanya harus tetap kebagian notifikasi.
--
-- TIDAK ada policy RLS untuk anon/authenticated - pola yang sama seperti
-- rahasia_integrasi: satu-satunya jalan masuk lewat route server (/api/push/*)
-- yang dijaga pastikanMasuk(), memakai service_role. Peramban tidak pernah
-- bicara langsung ke tabel ini.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
