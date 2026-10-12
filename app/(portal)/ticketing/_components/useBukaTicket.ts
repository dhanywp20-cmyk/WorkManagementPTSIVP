'use client';

/** useBukaTicket - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { ActivityLog, Ticket, OverdueSetting } from './shared';
import { supabase, supabaseServices } from '@/lib/supabase';

export interface BukaTicketKonteks {
  fetchProjectReminders: (_ticketList?: Ticket[]) => Promise<void>;
  getOverdueSetting: (ticketId: string) => OverdueSetting | undefined;
  pendingApprovalTickets: Ticket[];
  setApprovalAssignee: import("react").Dispatch<import("react").SetStateAction<string>>;
  setApprovalAssignees: import("react").Dispatch<import("react").SetStateAction<Record<string, string>>>;
  setApprovalTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setDeleteConfirmText: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDeleteTargetTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setOverdueForm: import("react").Dispatch<import("react").SetStateAction<{ due_hours: string; }>>;
  setOverdueTargetTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setReopenAssignee: import("react").Dispatch<import("react").SetStateAction<string>>;
  setReopenNotes: import("react").Dispatch<import("react").SetStateAction<string>>;
  setReopenTargetTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setSelectedTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setShowActivitySummary: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowApprovalModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowDeleteModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowOverdueSetting: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowReopenModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowTicketDetailPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSummaryTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
}

export function useBukaTicket(k: BukaTicketKonteks) {
  const { fetchProjectReminders, getOverdueSetting, pendingApprovalTickets, setApprovalAssignee, setApprovalAssignees, setApprovalTicket, setDeleteConfirmText, setDeleteTargetTicket, setOverdueForm, setOverdueTargetTicket, setReopenAssignee, setReopenNotes, setReopenTargetTicket, setSelectedTicket, setShowActivitySummary, setShowApprovalModal, setShowDeleteModal, setShowOverdueSetting, setShowReopenModal, setShowTicketDetailPopup, setSummaryTicket } = k;
  const muatLogPenuh = async (idTiket: string[]): Promise<Record<string, ActivityLog[]>> => {
    const peta: Record<string, ActivityLog[]> = {};
    if (idTiket.length === 0) return peta;
    const ambil = async (klien: typeof supabase, ids: string[]) => {
      const keluar: ActivityLog[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await klien.from("activity_logs")
          .select("*")
          .in("ticket_id", ids.slice(i, i + 100))
          .order("created_at", { ascending: true });
        if (data) keluar.push(...(data as ActivityLog[]));
      }
      return keluar;
    };
    const [logPTS, logSvc] = await Promise.all([
      ambil(supabase, idTiket).catch(() => [] as ActivityLog[]),
      ambil(supabaseServices as typeof supabase, idTiket).catch(() => [] as ActivityLog[]),
    ]);
    for (const log of [...logPTS, ...logSvc]) {
      const kunci = log.ticket_id ?? "";
      if (!kunci) continue;
      const sudah = (peta[kunci] ??= []);
      if (!sudah.find(l => l.id === log.id)) sudah.push(log);
    }
    for (const kunci of Object.keys(peta)) {
      peta[kunci].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return peta;
  };

  /** Kembalikan satu tiket dengan log penuh; kalau gagal, tiket apa adanya. */
  const denganLogPenuh = async (ticket: Ticket): Promise<Ticket> => {
    try {
      const peta = await muatLogPenuh([ticket.id]);
      const penuh = peta[ticket.id];
      return penuh && penuh.length > 0 ? { ...ticket, activity_logs: penuh } : ticket;
    } catch { return ticket; }
  };

  const bukaDetailTicket = (ticket: Ticket) => {
    //  Popup dibuka LANGSUNG dengan data ringkas yang sudah ada, lalu
    //  diperkaya begitu log penuhnya tiba. Menunggu dulu berarti satu klik
    //  yang tidak terasa apa-apa selama beberapa ratus milidetik, dan itu
    //  jauh lebih terasa daripada catatan log yang menyusul sesaat kemudian.
    setSelectedTicket(ticket); setShowTicketDetailPopup(true);
    void denganLogPenuh(ticket).then(lengkap => {
      setSelectedTicket(prev => (prev && prev.id === lengkap.id ? lengkap : prev));
    });
  };
  const bukaRingkasanAktivitas = (ticket: Ticket) => {
    setSummaryTicket(ticket); setShowActivitySummary(true);
    void denganLogPenuh(ticket).then(lengkap => {
      setSummaryTicket(prev => (prev && prev.id === lengkap.id ? lengkap : prev));
    });
  };
  const bukaApprovalUntukTicket = (ticket: Ticket) => {
    setApprovalAssignees({}); setApprovalTicket(ticket); setApprovalAssignee("");
    fetchProjectReminders(pendingApprovalTickets); setShowApprovalModal(true);
  };
  const bukaReopenTicket = (ticket: Ticket) => { setReopenTargetTicket(ticket); setReopenAssignee(ticket.assign_name || ""); setReopenNotes(""); setShowReopenModal(true); };
  const bukaDeleteTicket = (ticket: Ticket) => { setDeleteTargetTicket(ticket); setDeleteConfirmText(""); setShowDeleteModal(true); };
  const bukaOverdueSetting = (ticket: Ticket) => {
    setOverdueTargetTicket(ticket);
    const existing = getOverdueSetting(ticket.id);
    setOverdueForm({ due_hours: existing?.due_hours ? String(existing.due_hours) : "48" });
    setShowOverdueSetting(true);
  };
  return { muatLogPenuh, denganLogPenuh, bukaDetailTicket, bukaRingkasanAktivitas, bukaApprovalUntukTicket, bukaReopenTicket, bukaDeleteTicket, bukaOverdueSetting };
}
