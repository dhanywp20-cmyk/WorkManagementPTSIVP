'use client';

/** useMuatJadwal - dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { Reminder, TeamUser } from './shared';
import { ambilReminderUntuk } from './data-reminder';
import { getSession } from '@/lib/auth';

export interface MuatJadwalKonteks {
  currentUser: TeamUser | null;
  managerUserId: string;
  setFetchError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setListLoading: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setReminders: import("react").Dispatch<import("react").SetStateAction<Reminder[]>>;
}

export function useMuatJadwal(k: MuatJadwalKonteks) {
  const { currentUser, managerUserId, setFetchError, setListLoading, setReminders } = k;
  const fetchRemindersForUser = (activeUser: TeamUser | null): Promise<Reminder[]> => ambilReminderUntuk(activeUser, managerUserId);

  const fetchRemindersQuiet = async (user?: TeamUser | null) => {
    let activeUser: TeamUser | null = user ?? currentUser;
    if (!activeUser) activeUser = getSession<TeamUser>();
    const data = await fetchRemindersForUser(activeUser);
    setReminders(data);
  };

  const fetchReminders = async () => {
    setListLoading(true);
    setFetchError(null);
    let activeUser: TeamUser | null = currentUser;
    if (!activeUser) activeUser = getSession<TeamUser>();
    try {
      const data = await fetchRemindersForUser(activeUser);
      setReminders(data);
    } catch (err: any) {
      setFetchError(err?.message ?? 'Gagal memuat data');
    }
    setListLoading(false);
  };
  return { fetchRemindersForUser, fetchRemindersQuiet, fetchReminders };
}
