'use client';

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
    }
    eksporExcel({ tickets: ticketsPenuh, filteredTickets: terfilterPenuh, currentUserTeamType, stats, isTicketOverdue, notify });
  };

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
