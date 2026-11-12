'use client';

import { supabase } from '@/lib/supabase';
import { User, Ticket, OverdueSetting } from './shared';
import { pesanGalat } from '@/lib/galat/pesan';

export interface PengaturanOverdueKonteks {
  currentUser: User | null;
  getOverdueSetting: (ticketId: string) => OverdueSetting | undefined;
  notify: (type: "success" | "error", msg: string) => void;
  overdueForm: { due_hours: string };
  overdueTargetTicket: Ticket | null;
  setOverdueForm: import("react").Dispatch<import("react").SetStateAction<{ due_hours: string }>>;
  setOverdueSettings: import("react").Dispatch<import("react").SetStateAction<OverdueSetting[]>>;
  setOverdueTargetTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setShowOverdueSetting: import("react").Dispatch<import("react").SetStateAction<boolean>>;
}

export function usePengaturanOverdue(k: PengaturanOverdueKonteks) {
  const { currentUser, getOverdueSetting, notify, overdueForm, overdueTargetTicket, setOverdueForm, setOverdueSettings, setOverdueTargetTicket, setShowOverdueSetting } = k;
  const fetchOverdueSettings = async () => {
    try { const { data } = await supabase.from("overdue_settings").select("id,ticket_id,due_date,due_hours,set_by,created_at"); if (data) setOverdueSettings(data); } catch { }
  };

  const saveOverdueSetting = async () => {
    if (!overdueTargetTicket) return;
    if (!overdueForm.due_hours || parseInt(overdueForm.due_hours) < 1) { notify("error", "Isi jumlah jam overdue (minimal 1 jam)!"); return; }
    try {
      const existing = getOverdueSetting(overdueTargetTicket.id);
      const payload: any = { ticket_id: overdueTargetTicket.id, set_by: currentUser?.username || "", due_date: null, due_hours: parseInt(overdueForm.due_hours) };
      let mutErr;
      if (existing) { const r = await supabase.from("overdue_settings").update(payload).eq("id", existing.id); mutErr = r.error; }
      else { const r = await supabase.from("overdue_settings").insert([payload]); mutErr = r.error; }
      if (mutErr) { notify("error", "Gagal simpan overdue setting: " + mutErr.message); return; }
      await fetchOverdueSettings();
      setShowOverdueSetting(false);
      setOverdueForm({ due_hours: "48" });
      setOverdueTargetTicket(null);
    } catch (e) { notify("error", "Error: " + pesanGalat(e)); }
  };

  const deleteOverdueSetting = async (ticketId: string) => {
    const existing = getOverdueSetting(ticketId);
    if (!existing) return;
    const { error } = await supabase.from("overdue_settings").delete().eq("id", existing.id);
    if (error) { notify("error", "Gagal hapus overdue setting: " + error.message); return; }
    await fetchOverdueSettings();
  };
  return { fetchOverdueSettings, saveOverdueSetting, deleteOverdueSetting };
}
