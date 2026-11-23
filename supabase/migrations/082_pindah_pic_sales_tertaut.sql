-- Data lama ikut orangnya (lingkup atasan dihitung dari PIC sales). Saat PIC sales jadwal kategori
-- Konfigurasi diganti (mis. dialihkan ke PIC lain di grup lama setelah sales pindah grup), tiket
-- troubleshooting dan request design yang TERTAUT ikut berganti PIC sales:
--   * tiket: tickets.reminder_id = jadwal ini, atau reminders.ticket_id,
--   * tiket & request design yang dipetakan ke project yang sama di Project 360 (project_source_links).
-- Hanya baris yang PIC sales-nya masih PIC lama yang diubah; PIC sales lain di project yang sama tidak disentuh.
-- Aman dijalankan ulang. Batal: drop trigger pindah_pic_sales_tertaut on public.reminders;
--   drop function public.pindah_pic_sales_tertaut();

create or replace function public.pindah_pic_sales_tertaut()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  proyek uuid[];
begin
  if coalesce(new.category, '') not ilike 'Konfigurasi%' then
    return new;
  end if;
  if new.sales_name is not distinct from old.sales_name and new.sales_user_id is not distinct from old.sales_user_id then
    return new;
  end if;

  select coalesce(array_agg(distinct l.project_id), '{}'::uuid[]) into proyek
  from project_source_links l
  where l.source_module = 'reminders' and l.source_record_id = new.id and l.mapping_type <> 'ignored';

  update tickets t
  set sales_name = new.sales_name,
      sales_user_id = new.sales_user_id,
      sales_division = coalesce(new.sales_division, t.sales_division)
  where (t.sales_name is not distinct from old.sales_name or (old.sales_user_id is not null and t.sales_user_id = old.sales_user_id))
    and (
      t.reminder_id = new.id
      or t.id = new.ticket_id
      or t.id in (select l.source_record_id from project_source_links l
                  where l.source_module = 'tickets' and l.mapping_type <> 'ignored' and l.project_id = any (proyek))
    );

  update project_requests r
  set sales_name = new.sales_name,
      sales_user_id = new.sales_user_id,
      sales_division = coalesce(new.sales_division, r.sales_division)
  where (r.sales_name is not distinct from old.sales_name or (old.sales_user_id is not null and r.sales_user_id = old.sales_user_id))
    and r.id in (select l.source_record_id from project_source_links l
                 where l.source_module = 'project_requests' and l.mapping_type <> 'ignored' and l.project_id = any (proyek));

  return new;
end $$;

revoke execute on function public.pindah_pic_sales_tertaut() from anon, authenticated;

drop trigger if exists pindah_pic_sales_tertaut on public.reminders;
create trigger pindah_pic_sales_tertaut
  after update of sales_name, sales_user_id on public.reminders
  for each row execute function public.pindah_pic_sales_tertaut();
