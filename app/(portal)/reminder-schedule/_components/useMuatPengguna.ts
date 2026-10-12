'use client';

/** useMuatPengguna - dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { supabase } from '@/lib/supabase';
import { TeamUser, GuestUser } from './shared';
import { bolehDitugaskanOleh } from '@/lib/teams';
import { muatIdPimpinan } from '@/lib/pimpinan';
import { namaKelompokCabang } from '@/lib/kelompok';

export interface MuatPenggunaKonteks {
  setGuestUsers: import("react").Dispatch<import("react").SetStateAction<GuestUser[]>>;
  setPtsCabangUsers: import("react").Dispatch<import("react").SetStateAction<{ id: string; full_name: string; pts_daerah: string | null; }[]>>;
  setTeamUsers: import("react").Dispatch<import("react").SetStateAction<TeamUser[]>>;
}

export function useMuatPengguna(k: MuatPenggunaKonteks) {
  const { setGuestUsers, setPtsCabangUsers, setTeamUsers } = k;
  const fetchTeamUsers = async () => {
    const { data } = await supabase.from('users').select('id, username, full_name, role, team_type, phone_number, sales_division, allowed_menus, jabatan, telegram_chat_id, bisa_ditugaskan').order('full_name');
    // Hanya team assignable (IVP/MVI - UMP dikecualikan, lihat lib/teams.ts). Ubah di satu tempat itu utk tambah/kurangi team.
    // Manager IKUT dimuat (bolehDitugaskanOleh(u, true)) - dibutuhkan untuk
    // lookup WA saat Admin meng-assign Manager. Siapa yang DITAWARKAN di
    // dropdown disaring terpisah lewat teamUsersDitawarkan di bawah.
    if (data) setTeamUsers(data.filter((u: TeamUser) => bolehDitugaskanOleh(u, true) && u.role !== 'admin' && u.role !== 'superadmin'));
  };

  const fetchGuestUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, username, full_name, role, phone_number, sales_division, is_internal_sales')
      .eq('role', 'guest')
      .order('full_name');
    if (data) {
      const idPim = await muatIdPimpinan(supabase);
      setGuestUsers((data as GuestUser[]).filter(u => !idPim.has(u.id)));
    }
  };

  /**
   * Akun kelompok "PTS Cabang" - dipakai dropdown Installer di panel Mode
   * Penyelesaian (menggantikan isian nama installer manual). Lihat catatan
   * field `cabang` di lib/kelompok.ts.
   */
  const fetchPTSCabangUsers = async () => {
    const cabang = namaKelompokCabang();
    if (cabang.length === 0) { setPtsCabangUsers([]); return; }
    const { data } = await supabase.from('users').select('id, full_name, pts_daerah')
      .in('team_type', cabang).order('full_name');
    if (data) setPtsCabangUsers(data as { id: string; full_name: string; pts_daerah: string | null }[]);
  };
  return { fetchTeamUsers, fetchGuestUsers, fetchPTSCabangUsers };
}
