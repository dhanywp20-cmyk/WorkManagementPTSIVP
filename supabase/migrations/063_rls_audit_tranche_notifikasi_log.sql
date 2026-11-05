-- 063: pengetatan RLS hasil audit keamanan 5 Nov 2026.
--
-- audit_trail       : staf (admin/team/full access/pimpinan), pemilik entri, atau yang boleh melihat baris induknya
--                     (request, reminder, ticket). Sebelumnya terbaca semua akun login.
-- incentive_tranches: tahapan dari reminder yang boleh dilihat, atau akses insentif penuh.
-- notifications     : action_url hanya tautan internal ("/..." atau "admin:<tab>").
-- activity_logs     : hanya untuk ticket yang terlihat oleh penulisnya.
--
-- Diuji di produksi dalam transaksi yang dibatalkan: Admin & Full Access tidak berubah; Sales 1335 -> 302 entri
-- audit, 21 -> 3 tahapan; akun baru tanpa data 0; notifikasi tautan luar ditolak; log ke ticket tak terlihat ditolak.

alter policy audit_trail_baca on public.audit_trail using (
  jwt_claim('sub') <> '' and (
    lingkup_semua()
    or admin_atau_full_access()
    or pimpinan_lihat_semua()
    or user_id = jwt_claim('sub')
    or case
      when target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        case module
          when 'project' then exists (select 1 from public.project_requests p where p.id = target_id::uuid)
          when 'reminder' then exists (select 1 from public.reminders r where r.id = target_id::uuid)
          when 'reminder-schedule' then exists (select 1 from public.reminders r where r.id = target_id::uuid)
          when 'ticket' then exists (select 1 from public.tickets t where t.id = target_id::uuid)
          else false
        end
      else false
    end
  )
);

alter policy it_baca on public.incentive_tranches using (
  jwt_claim('sub') <> '' and (
    akses_insentif_penuh()
    or exists (select 1 from public.reminders r where r.id = incentive_tranches.project_id)
  )
);

alter policy nt_insert on public.notifications with check (
  jwt_claim('sub') <> '' and (
    action_url is null
    or (left(action_url, 1) = '/' and left(action_url, 2) <> '//')
    or action_url ~ '^admin:[A-Za-z]+$'
  )
);

alter policy al_tambah on public.activity_logs with check (
  jwt_claim('sub') <> '' and exists (select 1 from public.tickets t where t.id = activity_logs.ticket_id)
);
