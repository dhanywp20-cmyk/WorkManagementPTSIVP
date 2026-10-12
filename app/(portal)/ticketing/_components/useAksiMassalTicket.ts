'use client';

/** useAksiMassalTicket - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { ActivityLog, Ticket } from './shared';
import { eksporExcel } from './ekspor-excel';
import { cetakTicket } from './cetak-ticket';
import { supabase } from '@/lib/supabase';

export interface AksiMassalTicketKonteks {
  currentUserTeamType: string;
  denganLogPenuh: (ticket: Ticket) => Promise<Ticket>;
  filteredTickets: Ticket[];
  isTicketOverdue: (ticket: Ticket) => boolean;
  muatLogPenuh: (idTiket: string[]) => Promise<Record<string, ActivityLog[]>>;
  notify: (type: "success" | "error", msg: string) => void;
  selectedIds: Set<string>;
  setBulkConfirm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setBulkDeleting: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSelectMode: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSelectedIds: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
  setTickets: import("react").Dispatch<import("react").SetStateAction<Ticket[]>>;
  stats: { total: number; pending: number; processing: number; solved: number; overdue: number; solvedOverdue: number; statusData: { name: string; value: number; color: string; }[]; handlerData: { name: string; tickets: number; team: string; }[]; };
  tickets: Ticket[];
}

export function useAksiMassalTicket(k: AksiMassalTicketKonteks) {
  const { currentUserTeamType, denganLogPenuh, filteredTickets, isTicketOverdue, muatLogPenuh, notify, selectedIds, setBulkConfirm, setBulkDeleting, setSelectMode, setSelectedIds, setTickets, stats, tickets } = k;
  const toggleSelectId = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const toggleSelectAll = () => setSelectedIds(prev =>
    prev.size === filteredTickets.length ? new Set() : new Set(filteredTickets.map(t => t.id))
  );

  /*
    Ekspor Excel memuat log PENUH dulu - sheet "Activity Log"-nya menuliskan
    notes dan action_taken tiap langkah, dan itu justru kolom yang sengaja
    tidak dibawa daftar. Tanpa langkah ini file ekspornya tetap jadi, tapi
    kolom catatannya kosong semua: rusak yang tidak terlihat rusak.

    Dimuat hanya untuk tiket yang benar-benar diekspor (filteredTickets), dan
    hanya saat tombolnya ditekan.
  */
  const jalankanEksporExcel = async () => {
    notify('success', 'Menyiapkan data ekspor...');
    let ticketsPenuh = tickets;
    let terfilterPenuh = filteredTickets;
    try {
      const peta = await muatLogPenuh(filteredTickets.map(t => t.id));
      const lengkapi = (t: Ticket) => (peta[t.id] ? { ...t, activity_logs: peta[t.id] } : t);
      terfilterPenuh = filteredTickets.map(lengkapi);
      ticketsPenuh = tickets.map(lengkapi);
    } catch {
      //  Gagal memuat log bukan alasan membatalkan ekspor - datanya masih
      //  berguna, cuma catatan per langkahnya yang tidak selengkap biasanya.
    }
    eksporExcel({ tickets: ticketsPenuh, filteredTickets: terfilterPenuh, currentUserTeamType, stats, isTicketOverdue, notify });
  };

  /** Cetak satu tiket - log penuhnya dimuat dulu, alasannya sama dgn ekspor. */
  const jalankanCetakTicket = async (ticket: Ticket) => {
    cetakTicket(await denganLogPenuh(ticket));
  };

  const jalankanBulkDelete = async () => {
    setBulkConfirm(false); setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("tickets").delete().in("id", ids);
    if (!error) { setTickets(prev => prev.filter(t => !selectedIds.has(t.id))); setSelectedIds(new Set()); setSelectMode(false); }
    else notify("error", "Gagal: " + error.message);
    setBulkDeleting(false);
  };
  return { toggleSelectId, toggleSelectAll, jalankanEksporExcel, jalankanCetakTicket, jalankanBulkDelete };
}
