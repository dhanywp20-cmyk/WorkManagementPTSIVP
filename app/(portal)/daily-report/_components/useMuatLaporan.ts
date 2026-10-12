'use client';

/** useMuatLaporan - dipecah dari app/(portal)/daily-report/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { supabase } from '@/lib/supabase';
import { namaKelompokPTSDitugaskan } from '@/lib/kelompok';
import { type TeamUser, type GuestUser } from '@/app/(portal)/reminder-schedule/_components/shared';
import { useCallback } from 'react';
import { fetchAllReminders, fetchAllTickets, fetchReports, type ReminderActivity, type TicketActivity, type DailyReport } from './shared';

export interface MuatLaporanKonteks {
  currentUser: TeamUser | null;
  filterDate: string;
  filterUser: string;
  lihatSemua: boolean;
  setGuestUsers: import("react").Dispatch<import("react").SetStateAction<GuestUser[]>>;
  setLiveLoading: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setLiveReminders: import("react").Dispatch<import("react").SetStateAction<(ReminderActivity & { handler_username?: string; report_date?: string; })[]>>;
  setLiveTickets: import("react").Dispatch<import("react").SetStateAction<(TicketActivity & { handler_username?: string; report_date?: string; })[]>>;
  setReports: import("react").Dispatch<import("react").SetStateAction<DailyReport[]>>;
  setTeamUsers: import("react").Dispatch<import("react").SetStateAction<TeamUser[]>>;
  teamUsers: TeamUser[];
}

export function useMuatLaporan(k: MuatLaporanKonteks) {
  const { currentUser, filterDate, filterUser, lihatSemua, setGuestUsers, setLiveLoading, setLiveReminders, setLiveTickets, setReports, setTeamUsers, teamUsers } = k;
  const loadTeamUsers = async () => {
    const { data } = await supabase.from('users').select('id,username,full_name,role,team_type,phone_number,sales_division,allowed_menus').order('full_name');
    if (!data) return;
    const kelompokPTS = namaKelompokPTSDitugaskan();
    setTeamUsers(data.filter((u: TeamUser) =>
      kelompokPTS.includes(u.team_type ?? '') && u.role !== 'admin' && u.role !== 'superadmin'));
  };
  const loadGuestUsers = async () => {
    const { data } = await supabase.from('users').select('id,username,full_name,role,phone_number,sales_division').eq('role', 'guest').order('full_name');
    if (data) setGuestUsers(data as GuestUser[]);
  };

  // Load live data dari kedua platform
  const loadLiveData = useCallback(async () => {
    if (!currentUser) return;
    setLiveLoading(true);
    try {
      const usernames = lihatSemua
        ? teamUsers.map(u => u.username).filter(Boolean)
        : [currentUser.username];

      const opts = {
        date: filterDate || undefined,
        // Jika admin tapi belum ada teamUsers, kirim undefined agar fetch semua
        usernames: filterUser
          ? [teamUsers.find(u => u.id === filterUser)?.username ?? ''].filter(Boolean)
          : usernames.length > 0 ? usernames : undefined,
      };

      const [rem, tick] = await Promise.all([
        fetchAllReminders(opts),
        fetchAllTickets(opts),
      ]);
      setLiveReminders(rem as any);
      setLiveTickets(tick as any);
    } catch { }
    setLiveLoading(false);
  }, [currentUser, lihatSemua, teamUsers, filterDate, filterUser]);

  // Load submitted reports
  const loadReports = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await fetchReports({ date: filterDate || undefined, userId: filterUser || undefined, isAdmin: lihatSemua, currentUserId: currentUser.id });
      setReports(data);
    } catch { }
  }, [currentUser, filterDate, filterUser, lihatSemua]);
  return { loadTeamUsers, loadGuestUsers, loadLiveData, loadReports };
}
