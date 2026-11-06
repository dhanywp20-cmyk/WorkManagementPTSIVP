'use client';

import { createContext, useContext } from 'react';
import { type TeamUser, type GuestUser } from '@/lib/jadwal/tampilan';
import { type ReminderActivity, type TicketActivity, type ManualActivity, type TeamEntry } from './shared';

export interface NilaiKonteksFormLaporan {
  nilai: {
    autoCount: number;
    currentUser: TeamUser | null;
    editingId: string | null;
    formDate: string;
    formLoading: boolean;
    formReminders: ReminderActivity[];
    formTickets: TicketActivity[];
    formUserId: string;
    galatSusun: string;
    guestUsers: GuestUser[];
    isAdmin: boolean;
    manualActs: ManualActivity[];
    menyusun: boolean;
    reminderNotes: string;
    saving: boolean;
    targetUser: TeamUser | null | undefined;
    teamEntries: TeamEntry[];
    teamUsers: TeamUser[];
  };
  ubah: {
    setEditingId: import("react").Dispatch<import("react").SetStateAction<string | null>>;
    setFormDate: import("react").Dispatch<import("react").SetStateAction<string>>;
    setFormOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
    setFormUserId: import("react").Dispatch<import("react").SetStateAction<string>>;
    setManualActs: import("react").Dispatch<import("react").SetStateAction<ManualActivity[]>>;
    setReminderNotes: import("react").Dispatch<import("react").SetStateAction<string>>;
  };
  aksi: {
    handleSave: () => Promise<void>;
    hapusDraf: () => void;
    susunDenganAI: () => Promise<void>;
    updM: (key: string, p: Partial<ManualActivity>) => void;
    updT: (key: string, p: Partial<TeamEntry>) => void;
  };
}

export const KonteksFormLaporan = createContext<NilaiKonteksFormLaporan | null>(null);

export function useKonteksFormLaporan(): NilaiKonteksFormLaporan {
  const k = useContext(KonteksFormLaporan);
  if (!k) throw new Error('useKonteksFormLaporan harus di dalam <KonteksFormLaporan.Provider>');
  return k;
}
