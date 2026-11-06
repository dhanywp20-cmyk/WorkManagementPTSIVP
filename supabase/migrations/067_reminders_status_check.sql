alter table public.reminders add constraint reminders_status_check check (status in ('pending','done','cancelled'));
