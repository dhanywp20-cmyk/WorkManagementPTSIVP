-- 038_hapus_update_reminder_cron.sql
--
-- Tombol "Reminder" di Ticketing dulu memanggil RPC ini untuk membuat ulang job pg_cron
-- `daily-reminder` (edge function daily-reminder -> WhatsApp). Sejak Briefing pagi 06.00 WIB
-- dikirim cron Vercel /api/cron/digest, job itu justru membuat WA ganda, dan tombolnya sudah
-- diganti modal info (PR #46). Fungsi SECURITY DEFINER yang bisa dipanggil lewat
-- /rest/v1/rpc/update_reminder_cron (advisor: anon_security_definer_function_executable)
-- tidak punya pemakai lagi, jadi dihapus. Penjagaan admin di dalamnya tetap ada sampai saat ini,
-- jadi ini merapikan, bukan menutup celah yang terbuka.
--
-- Job pg_cron lama (bila masih ada) ikut dibuang supaya WA ganda tidak bisa hidup lagi.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'daily-reminder';
  end if;
end $$;

drop function if exists public.update_reminder_cron(integer, integer, text, boolean);
