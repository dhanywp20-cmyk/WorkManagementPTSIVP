-- 065: RLS reminders & audit_trail lebih cepat untuk akun tamu, hak akses tidak berubah (sudah diterapkan 5 Nov 2026).
-- Fungsi per-sesi dibungkus (select ...) agar dihitung sekali per query, dan audit_trail memakai himpunan
-- baris induk yang terlihat (subquery tanpa korelasi) alih-alih exists per baris.
-- Diuji dalam transaksi yang dibatalkan: jumlah baris identik (Dhany 1336, Sales 79, Rinaldi 302/85, akun event 0);
-- reminders tamu 1035 -> 759 ms, audit_trail tamu 1,9-3,7 s -> ~0,65 s.

alter policy rm_select on public.reminders using (
  boleh_lihat_baris(sales_user_id, sales_name, sales_division, created_by)
  or assign_user_id = (select jwt_user_id())
  or assigned_to = (select jwt_claim('username'))
  or internal_sales_id = (select jwt_user_id())
  or internal_sales_id_2 = (select jwt_user_id())
  or ((select akses_insentif()) = any (array['input','penuh']) and category = any ((select kategori_insentif_db())::text[]))
  or pernah_dapat_bagian_insentif(id)
);

alter policy audit_trail_baca on public.audit_trail using (
  (select jwt_claim('sub')) <> '' and (
    (select lingkup_semua())
    or (select admin_atau_full_access())
    or (select pimpinan_lihat_semua())
    or user_id = (select jwt_claim('sub'))
    or (module = 'project' and target_id in (select p.id::text from public.project_requests p))
    or (module in ('reminder', 'reminder-schedule') and target_id in (select r.id::text from public.reminders r))
    or (module = 'ticket' and target_id in (select t.id::text from public.tickets t))
  )
);
