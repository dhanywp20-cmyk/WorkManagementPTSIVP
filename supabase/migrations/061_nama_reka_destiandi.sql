-- 061: "Reka" -> "Reka Destiandi" (orang yang sama, akun Reka_PTSIVP) - permintaan pemilik 30 Okt 2026.
--
-- 4 ticket Januari tercatat assign_name 'Reka' dan assign_user_id kosong: tidak cocok dengan nama akun, jadi
-- RLS tickets (assign_name = nama lengkap / assign_user_id = akun) tidak pernah memperlihatkannya ke Reka sendiri.
-- Ikut dibetulkan: 6 activity log & 1 baris team_members lama. identitas_calon / identitas_sisa TIDAK diubah -
-- itu catatan kerja pemetaan nama -> UUID yang memang mencatat nilai mentah yang ditemukan.

with akun as (select id, full_name from public.users where username = 'Reka_PTSIVP'),
diubah as (
  update public.tickets t
     set assign_name = akun.full_name, assign_user_id = coalesce(t.assign_user_id, akun.id)
    from akun
   where trim(t.assign_name) = 'Reka'
  returning t.id, t.project_name
)
insert into public.audit_trail (user_id, user_name, action, module, target_id, target_name, old_value, new_value, notes)
select 'system', 'Sistem (migrasi 061)', 'update', 'ticket', diubah.id::text, diubah.project_name, 'Reka', 'Reka Destiandi',
       'Nama handler disamakan dengan akun Reka_PTSIVP atas permintaan pemilik; assign_user_id diisi.'
  from diubah;

update public.activity_logs
   set handler_name = (select full_name from public.users where username = 'Reka_PTSIVP')
 where trim(handler_name) = 'Reka' and handler_username = 'Reka_PTSIVP';

update public.team_members set name = 'Reka Destiandi' where trim(name) = 'Reka' and username = 'Reka_PTSIVP';
