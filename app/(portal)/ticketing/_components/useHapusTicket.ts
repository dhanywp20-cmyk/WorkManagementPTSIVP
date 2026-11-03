'use client';

import { hasFullAccess } from '@/lib/constants';
import { supabase, supabaseServices } from '@/lib/supabase';
import { User, Ticket, OverdueSetting } from './shared';

export interface HapusTicketKonteks {
  currentUser: User | null;
  deleteTargetTicket: Ticket | null;
  fetchData: (userOverride?: User | null, silent?: boolean) => Promise<void>;
  fetchOverdueSettings: () => Promise<void>;
  getOverdueSetting: (ticketId: string) => OverdueSetting | undefined;
  notify: (type: "success" | "error", msg: string) => void;
  setDeleteConfirmText: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDeleteTargetTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setLoadingMessage: import("react").Dispatch<import("react").SetStateAction<string>>;
  setShowDeleteModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowLoadingPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setUploading: import("react").Dispatch<import("react").SetStateAction<boolean>>;
}

export function useHapusTicket(k: HapusTicketKonteks) {
  const { currentUser, deleteTargetTicket, fetchData, fetchOverdueSettings, getOverdueSetting, notify, setDeleteConfirmText, setDeleteTargetTicket, setLoadingMessage, setShowDeleteModal, setShowLoadingPopup, setUploading } = k;
  const deleteTicket = async () => {
    if (!deleteTargetTicket) return;
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin' && !hasFullAccess(currentUser)) { notify("error", "Tidak ada akses untuk menghapus ticket."); return; }
    try {
      setUploading(true);
      setShowLoadingPopup(true);
      setLoadingMessage("Menghapus activity logs...");
      await supabase.from("activity_logs").delete().eq("ticket_id", deleteTargetTicket.id);
      try { await supabaseServices.from("activity_logs").delete().eq("ticket_id", deleteTargetTicket.id); } catch { }
      const existingOverdue = getOverdueSetting(deleteTargetTicket.id);
      if (existingOverdue) await supabase.from("overdue_settings").delete().eq("id", existingOverdue.id);
      setLoadingMessage("Menghapus ticket...");
      const { data: terhapus, error: galatHapus } = await supabase.from("tickets")
        .delete().eq("id", deleteTargetTicket.id).select("id");
      if (galatHapus || !terhapus || terhapus.length === 0) {
        setShowLoadingPopup(false);
        setUploading(false);
        notify("error", "Ticket gagal dihapus. Riwayat aktivitasnya sudah terhapus - hubungi admin untuk memeriksa data ini.");
        await fetchData();
        return;
      }
      await fetchData();
      await fetchOverdueSettings();
      setLoadingMessage("✅ Ticket berhasil dihapus!");
      setTimeout(() => {
        setShowLoadingPopup(false);
        setUploading(false);
        setShowDeleteModal(false);
        setDeleteTargetTicket(null);
        setDeleteConfirmText("");
      }, 1500);
    } catch (err: any) {
      setShowLoadingPopup(false);
      setUploading(false);
      notify("error", "Gagal hapus ticket: " + err.message);
    }
  };
  return { deleteTicket };
}
