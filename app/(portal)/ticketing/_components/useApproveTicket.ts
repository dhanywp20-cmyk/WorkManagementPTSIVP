'use client';

/** useApproveTicket - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { sendWANotif, fetchWACCTargets, User, TeamMember, Ticket } from './shared';
import { supabase } from '@/lib/supabase';
import { notifyTicketAssigned, createNotification } from '@/lib/notifications';
import { appLink } from '@/lib/app-url';
import { logAudit } from '@/lib/audit';

export interface ApproveTicketKonteks {
  approvalAssignee: string;
  approvalAssignees: Record<string, string>;
  approvalTicket: Ticket | null;
  currentUser: User | null;
  fetchData: (userOverride?: User | null, silent?: boolean) => Promise<void>;
  notify: (type: "success" | "error", msg: string) => void;
  selesaikanSatuApproval: (ticketId: string) => void;
  setApprovingId: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setUploading: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  teamMembers: TeamMember[];
  users: User[];
}

export function useApproveTicket(k: ApproveTicketKonteks) {
  const { approvalAssignee, approvalAssignees, approvalTicket, currentUser, fetchData, notify, selesaikanSatuApproval, setApprovingId, setUploading, teamMembers, users } = k;
  const approveTicket = async (ticketArg?: Ticket | null, assigneeArg?: string) => {
    const tk = ticketArg ?? approvalTicket;
    const asg = assigneeArg ?? approvalAssignee;
    if (!tk || !asg) { notify("error", "Please select a Team PTS IVP member to assign!"); return; }
    try {
      setApprovingId(tk.id);
      setUploading(true);
      // Route ke Supervisor: approve tapi belum assign ke handler. Supervisor
      //    yang lanjut assign ke anggota tim (atau kerjakan sendiri).
      if (asg.startsWith("SUP::")) {
        const [, supId, supName] = asg.split("::");
        // .eq('status','Waiting Approval') + cek baris: kalau admin lain
        // sudah lebih dulu meng-approve ticket yang sama (2 tab/2 admin
        // bersamaan), update ini sengaja tidak menyentuh baris apa pun -
        // tanpa pengecekan ini WA & notifikasi di bawah tetap terkirim ganda
        // walau approval kedua sebenarnya tidak pernah benar-benar tersimpan.
        const { data: routeRows, error: routeErr } = await supabase.from("tickets").update({
          status: "Pending", assign_name: "",
          routing_status: "supervisor_assign", assigned_supervisor_id: supId,
        }).eq("id", tk.id).eq("status", "Waiting Approval").select("id");
        if (routeErr) throw routeErr;
        if (!routeRows || routeRows.length === 0) {
          notify("error", "Ticket ini sudah diproses lebih dulu (mungkin oleh admin lain). Silakan refresh.");
          return;
        }
        try {
          const supMember = teamMembers.find(m => m.id === supId);
          const { data: supUser } = supMember?.username
            ? await supabase.from("users").select("id, phone_number, full_name").eq("username", supMember.username).maybeSingle()
            : { data: null };
          if (supUser?.id) createNotification({ user_id: supUser.id, type: 'ticket', title: '🎯 Ticket perlu kamu assign', body: `${tk.project_name} — ${tk.issue_case}`, action_url: '/ticketing', ref_id: tk.id, created_by: currentUser?.full_name || '' }).catch(() => {});
          if (supUser?.phone_number) {
            const waMsg = [
              "🎯 *Ticket Perlu Di-assign ke Tim*",
              "━━━━━━━━━━━━━━━━━━",
              `Halo *${supUser.full_name || supName}*, ticket sudah diapprove Admin — silakan assign ke anggota tim / kerjakan sendiri:`,
              `📌 *Project :* ${tk.project_name}`,
              `⚠️ *Issue   :* ${tk.issue_case}`,
              "━━━━━━━━━━━━━━━━━━",
              `🔗 ${appLink()}`,
            ].join("\n");
            await sendWANotif({ type: "reminder_wa", event: "ticket.routed_supervisor", target: supUser.phone_number, message: waMsg });
          }
        } catch { }
        logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'approve', module: 'ticket', target_id: tk.id, target_name: tk.project_name, notes: `Routed to supervisor: ${supName}` }).catch(() => {});
        selesaikanSatuApproval(tk.id);
        await fetchData();
        notify("success", `Ticket diteruskan ke Supervisor ${supName} untuk di-assign`);
        return;
      }
      // Assign langsung (bukan route). Kolom routing TIDAK ditulis di sini supaya
      // tetap jalan walau migrasi supervisor belum di-run (ticket "Waiting Approval"
      // yg di-approve langsung tak pernah punya routing_status).
      // .eq('status','Waiting Approval') + cek baris: sama seperti cabang
      // route-ke-supervisor di atas - mencegah 2 admin men-approve ticket
      // yang sama ke 2 handler berbeda tanpa saling tahu (yang terakhir
      // menang diam-diam, WA terkirim ke keduanya).
      const { data: rows, error } = await supabase.from("tickets")
        .update({ status: "Pending", assign_name: asg }).eq("id", tk.id).eq("status", "Waiting Approval").select("id");
      if (error) throw error;
      if (!rows || rows.length === 0) {
        notify("error", "Ticket ini sudah diproses lebih dulu (mungkin oleh admin lain). Silakan refresh.");
        return;
      }
      if (tk.created_by) {
        const creatorUser = users.find((u) => u.username === tk.created_by);
        if (creatorUser && creatorUser.role === "guest" && creatorUser.id) {
          // Notify guest/sales bahwa ticket mereka sudah diproses
          void createNotification({ user_id: creatorUser.id, type: 'ticket', title: `🎫 Ticket disetujui`, body: `${tk.project_name} — ditugaskan ke ${asg}`, action_url: '/ticketing', ref_id: tk.id, created_by: currentUser?.full_name || '' });
        }
      }
      // WA ke handler yang di-assign
      try {
        // Cari handler dari teamMembers state (sudah load dari users)
        const tm = teamMembers.find(m => m.name === asg);
        const { data: handlerUser } = tm?.username ? await supabase
          .from("users").select("phone_number, full_name")
          .eq("username", tm.username).maybeSingle() : { data: null };
        // In-app notification (using notifications table)
        if (handlerUser) {
          const { data: handlerFull } = await supabase.from('users').select('id').eq('username', tm!.username).maybeSingle();
          if (handlerFull?.id) {
            notifyTicketAssigned(
              handlerFull.id, asg, tk.id,
              tk.project_name, currentUser?.full_name ?? 'Admin'
            ).catch(() => {});
          }
        }
        // Audit log
        logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'assign', module: 'ticket', target_id: tk.id, target_name: tk.project_name, new_value: asg }).catch(() => {});
        if (handlerUser?.phone_number) {
          const waMsg = [
            "🎫 *Ticket Assigned ke Kamu*",
            "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
            `Halo *${handlerUser?.full_name || "Handler"}*, ada ticket untukmu:`,
            "",
            `📌 *Project :* ${tk.project_name}`,
            `⚠️ *Issue   :* ${tk.issue_case}`,
            `📅 *Tanggal :* ${tk.date || "-"}`,
            "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
            "Mohon segera ditangani. Semangat! 💪",
            `🔗 ${appLink()}`,
          ].join("\n");
          await sendWANotif({ type: "reminder_wa", event: "ticket.assigned", target: handlerUser.phone_number, message: waMsg });
        }
      } catch (err: any) {
        console.warn('[ticket] WA to handler (approval) failed:', err?.message);
        notify('error', 'WA ke handler gagal dikirim. Ticket berhasil di-approve.');
      }
      // CC ke atasan + IVP berdasarkan divisi creator ticket
      try {
        const creatorUser = tk.created_by ? users.find((u) => u.username === tk.created_by) : null;
        const ccDiv = (tk as any).sales_division ?? creatorUser?.sales_division ?? "";
        if (ccDiv && ccDiv !== "IVP" && creatorUser?.id) {
          const ccTargets = await fetchWACCTargets(creatorUser.id, ccDiv);
          if (ccTargets.length > 0) {
            const ccMsg = [
              `✅ *[CC] Ticket Diapprove — Divisi ${ccDiv}*`,
              "━━━━━━━━━━━━━━━━━━",
              `📌 *Project  :* ${tk.project_name}`,
              `⚠️ *Issue    :* ${tk.issue_case}`,
              `👷 *Handler  :* ${asg}`,
              "━━━━━━━━━━━━━━━━━━",
              `📋 *CC ke   :* ${ccTargets.map(t => t.name + (t.relation === "ivp_handler" ? " (IVP)" : "")).join(", ")}`,
              `🔗 ${appLink()}`,
            ].join("\n");
            await Promise.allSettled(ccTargets.map(t => sendWANotif({ type: "reminder_wa", event: "ticket.approval_needed", target: t.phone, message: ccMsg })));
          }
        }
      } catch { }
      selesaikanSatuApproval(tk.id);
      await fetchData();
      notify("success", `Ticket approved & assigned to ${asg}`);
    } catch (err: any) { notify("error", "Error: " + err.message); } finally { setUploading(false); setApprovingId(null); }
  };

  // Ticket & handler baris INI dikirim eksplisit — bukan lewat state bersama —
  // supaya yang diproses tidak mungkin tertukar dengan baris lain di modal
  // Approval yang sama.
  const jalankanApproveTicket = async (ticket: Ticket) => {
    const pilihan = approvalAssignees[ticket.id];
    if (!pilihan) { notify("error", "Pilih handler atau Supervisor terlebih dahulu!"); return; }
    await approveTicket(ticket, pilihan);
  };
  return { approveTicket, jalankanApproveTicket };
}
