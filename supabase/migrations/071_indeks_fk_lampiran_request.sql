-- Index untuk foreign key tanpa index (Supabase performance advisor: unindexed_foreign_keys).
-- Aman dijalankan ulang. Batal: DROP INDEX public.<nama index> untuk keempatnya.
create index if not exists request_screen_connection_dilampirkan_oleh_idx on public.request_screen_connection (dilampirkan_oleh);
create index if not exists request_screen_connection_led_id_idx on public.request_screen_connection (led_id);
create index if not exists request_sld_dilampirkan_oleh_idx on public.request_sld (dilampirkan_oleh);
create index if not exists request_sld_versi_id_idx on public.request_sld (versi_id);
