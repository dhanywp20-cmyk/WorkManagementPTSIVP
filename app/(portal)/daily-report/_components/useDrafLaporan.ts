'use client';

/** useDrafLaporan - dipecah dari app/(portal)/daily-report/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { type ManualActivity } from './shared';
import { useEffect } from 'react';
import { emptyManual } from './bantu-halaman';
import { type TeamUser } from '@/app/(portal)/reminder-schedule/_components/shared';

export interface DrafLaporanKonteks {
  currentUser: TeamUser | null;
  editingId: string | null;
  formDate: string;
  formOpen: boolean;
  formUserId: string;
  manualActs: ManualActivity[];
  notify: (type: "success" | "error", msg: string) => void;
  reminderNotes: string;
  saving: boolean;
  setManualActs: import("react").Dispatch<import("react").SetStateAction<ManualActivity[]>>;
  setReminderNotes: import("react").Dispatch<import("react").SetStateAction<string>>;
}

export function useDrafLaporan(k: DrafLaporanKonteks) {
  const { currentUser, editingId, formDate, formOpen, formUserId, manualActs, notify, reminderNotes, saving, setManualActs, setReminderNotes } = k;
  const kunciDraf = currentUser?.id ? `wm_dr_draf_${currentUser.id}` : '';
  type DrafDR = { formDate: string; formUserId: string; editingId: string | null; reminderNotes: string; manualActs: ManualActivity[]; waktu: number };
  const bacaDraf = (): DrafDR | null => {
    if (!kunciDraf) return null;
    try {
      const d = JSON.parse(localStorage.getItem(kunciDraf) ?? 'null') as DrafDR | null;
      return d && Date.now() - d.waktu < 3 * 86_400_000 ? d : null;
    } catch { return null; }
  };
  const hapusDraf = () => { try { if (kunciDraf) localStorage.removeItem(kunciDraf); } catch { /* abaikan */ } };
  const adaIsian = (acts: ManualActivity[], catatan: string) => !!catatan.trim() || acts.some(m => m.project_name.trim() || m.description.trim());
  useEffect(() => {
    if (!formOpen || !kunciDraf || !adaIsian(manualActs, reminderNotes)) return;
    try {
      localStorage.setItem(kunciDraf, JSON.stringify({ formDate, formUserId, editingId, reminderNotes, manualActs, waktu: Date.now() } satisfies DrafDR));
    } catch { /* penyimpanan perangkat penuh / diblokir: abaikan */ }
  }, [formOpen, kunciDraf, formDate, formUserId, editingId, reminderNotes, manualActs]);
  //  Jangan biarkan halaman tertutup / dimuat ulang saat penyimpanan masih berjalan.
  useEffect(() => {
    if (!saving) return;
    const tahan = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', tahan);
    return () => window.removeEventListener('beforeunload', tahan);
  }, [saving]);
  const pulihkanDraf = (cocok: (d: DrafDR) => boolean) => {
    const d = bacaDraf();
    if (!d || !cocok(d) || !adaIsian(d.manualActs, d.reminderNotes)) return false;
    setReminderNotes(d.reminderNotes);
    setManualActs(d.manualActs.length ? d.manualActs : [emptyManual(currentUser?.username ?? '')]);
    notify('success', 'Isian yang belum tersimpan dipulihkan dari perangkat ini.');
    return true;
  };
  return { kunciDraf, bacaDraf, hapusDraf, adaIsian, pulihkanDraf };
}
