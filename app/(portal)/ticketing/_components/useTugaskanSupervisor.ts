'use client';

import { supabase } from '@/lib/supabase';
import { notifyTicketAssigned } from '@/lib/notifications';
import { appLink } from '@/lib/app-url';
import { sendWANotif, User, TeamMember, Ticket } from './shared';
import { logAudit } from '@/lib/audit';

export interface TugaskanSupervisorKonteks {
  currentUser: User | null;
  fetchData: (userOverride?: User | null, silent?: boolean) => Promise<void>;
  notify: (type: "success" | "error", msg: string) => void;
  setSupAssignSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSupAssignTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setSupAssignTo: import("react").Dispatch<import("react").SetStateAction<string>>;
  supAssignTicket: Ticket | null;
  supAssignTo: string;
  teamMembers: TeamMember[];
}

export function useTugaskanSupervisor(k: TugaskanSupervisorKonteks) {
  const { currentUser, fetchData, notify, setSupAssignSaving, setSupAssignTicket, setSupAssignTo, supAssignTicket, supAssignTo, teamMembers } = k;
  const handleSupervisorAssignTicket = async () => {
    if (!supAssignTicket || !supAssignTo) { notify("error", "Pilih anggota tim atau kerjakan sendiri!"); return; }
    setSupAssignSaving(true);
    try {
      const isSelf = supAssignTo === "SELF";
      const assigneeName = isSelf ? (currentUser?.full_name ?? "") : supAssignTo;
      const { error, data } = await supabase.from("tickets").update({
        status: "Pending", assign_name: assigneeName,
        routing_status: null,
      }).eq("id", supAssignTicket.id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Perubahan ditolak sistem (RLS). Hubungi admin.");
      if (isSelf) {
        if (currentUser?.id) notifyTicketAssigned(currentUser.id, assigneeName, supAssignTicket.id, supAssignTicket.project_name, currentUser?.full_name ?? 'Supervisor').catch(() => {});
      } else {
        try {
          const tm = teamMembers.find(m => m.name === assigneeName);
          const { data: handlerUser } = tm?.username
            ? await supabase.from("users").select("id, phone_number, full_name").eq("username", tm.username).maybeSingle()
            : { data: null };
          if (handlerUser?.id) notifyTicketAssigned(handlerUser.id, assigneeName, supAssignTicket.id, supAssignTicket.project_name, currentUser?.full_name ?? 'Supervisor').catch(() => {});
          if (handlerUser?.phone_number) {
            const waMsg = [
              "🎫 *Ticket Assigned ke Kamu*",
              "━━━━━━━━━━━━━━━━━━",
              `Halo *${handlerUser.full_name || assigneeName}*, kamu di-assign Supervisor *${currentUser?.full_name}*:`,
              `📌 *Project :* ${supAssignTicket.project_name}`,
              `⚠️ *Issue   :* ${supAssignTicket.issue_case}`,
              "━━━━━━━━━━━━━━━━━━",
              "Mohon segera ditangani. Semangat! 💪",
              `🔗 ${appLink()}`,
            ].join("\n");
            await sendWANotif({ type: "reminder_wa", event: "ticket.assigned", target: handlerUser.phone_number, message: waMsg });
          }
        } catch { }
      }
      logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'assign', module: 'ticket', target_id: supAssignTicket.id, target_name: supAssignTicket.project_name, new_value: assigneeName }).catch(() => {});
      setSupAssignTicket(null); setSupAssignTo("");
      await fetchData();
      notify("success", isSelf ? "Kamu jadi handler ticket ini!" : `Ticket di-assign ke ${assigneeName}`);
    } catch (err: any) { notify("error", "Error: " + err.message); }
    finally { setSupAssignSaving(false); }
  };
  return { handleSupervisorAssignTicket };
}
