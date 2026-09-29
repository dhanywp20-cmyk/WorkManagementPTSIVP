-- MIGRATION 021: RPC penutup jadwal Reminder bawaan Ticketing.
--
-- MASALAHNYA: menutup ticket Solved juga menutup reminder Onsite yang lahir
-- darinya, tapi UPDATE itu dijalankan sebagai si handler - dan RLS reminders
-- (rm_update) hanya mengizinkan PEMILIK barisnya. Reminder yang dibuat Admin
-- lalu dikerjakan handler lain tidak tersentuh: 0 baris berubah, TANPA galat,
-- sehingga layar mengira berhasil. Kejadian nyata: "Kejaksaan Negeri Kabupaten
-- Bogor" - ticket Solved 28/09, remindernya tetap Pending.
--
-- Izin di sini diturunkan dari TICKET-nya (syarat sama persis dengan policy
-- tk_update), bukan dari kepemilikan reminder: yang boleh menutup ticket boleh
-- menutup jadwal bawaannya. Cakupannya sempit - hanya baris dengan ticket_id
-- ticket itu DAN kategori Troubleshooting (kategori lain memicu Form Review &
-- insentif yang tidak boleh dilewati diam-diam).
create or replace function public.tutup_jadwal_ticket(p_ticket_id uuid, p_status text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_boleh boolean;
  v_n integer;
begin
  if p_status not in ('done', 'cancelled') then
    raise exception 'Status jadwal tidak sah: %', p_status;
  end if;

  -- Penjagaan di DALAM fungsi: SECURITY DEFINER yang bisa dipanggil lewat RPC
  -- adalah pintu terbuka kalau penjaganya cuma di layar.
  if session_user not in ('postgres', 'supabase_admin') then
    if public.jwt_claim('sub') = '' then
      raise exception 'Harus login';
    end if;
    select exists (
      select 1 from public.tickets t
      where t.id = p_ticket_id
        and (public.admin_atau_full_access()
             or t.assign_name = public.jwt_full_name()
             or t.created_by = public.jwt_claim('username')
             or t.assigned_supervisor_id = public.jwt_user_id())
    ) into v_boleh;
    if not v_boleh then
      raise exception 'Tidak berwenang atas ticket ini';
    end if;
  end if;

  update public.reminders
     set status = p_status
   where ticket_id = p_ticket_id
     and category = 'Troubleshooting'
     and status <> p_status;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
