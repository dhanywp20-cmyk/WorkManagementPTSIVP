'use client';

/** useAksiMassalJadwal - dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { supabase } from '@/lib/supabase';
import { Reminder } from './shared';

export interface AksiMassalJadwalKonteks {
  filteredReminders: Reminder[];
  notify: (type: "success" | "error", msg: string) => void;
  selectedIds: Set<string>;
  setBulkConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setBulkDeleting: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setReminders: import("react").Dispatch<import("react").SetStateAction<Reminder[]>>;
  setSelectMode: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSelectedIds: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
}

export function useAksiMassalJadwal(k: AksiMassalJadwalKonteks) {
  const { filteredReminders, notify, selectedIds, setBulkConfirm, setBulkDeleting, setReminders, setSelectMode, setSelectedIds } = k;
  const jalankanBulkDelete = async () => {
    setBulkConfirm(false); setBulkDeleting(true);
    const { error } = await supabase.from('reminders').delete().in('id', Array.from(selectedIds));
    if (!error) { setReminders(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); setSelectMode(false); }
    else notify('error', 'Gagal: ' + error.message);
    setBulkDeleting(false);
  };

  const toggleSelectId = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const toggleSelectAll = () => setSelectedIds(prev =>
    prev.size === filteredReminders.length ? new Set() : new Set(filteredReminders.map(r => r.id))
  );
  return { jalankanBulkDelete, toggleSelectId, toggleSelectAll };
}
