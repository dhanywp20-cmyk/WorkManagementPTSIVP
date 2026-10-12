'use client';

/** useTolakBukaUlang - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { sendWANotif, User, TeamMember, Ticket } from './shared';
import { supabase, supabaseServices } from '@/lib/supabase';
import { appLink } from '@/lib/app-url';

export interface TolakBukaUlangKonteks {
  currentUser: User | null;
  currentUserTeamType: string;
  fetchData: (userOverride?: User | null, silent?: boolean) => Promise<void>;
  notify: (type: "success" | "error", msg: string) => void;
  rejectReason: string;
  rejectTargetTicket: Ticket | null;
  reopenAssignee: string;
  reopenNotes: string;
  reopenServicesTarget: Ticket | null;
  reopenTargetTicket: Ticket | null;
  setLoadingMessage: import("react").Dispatch<import("react").SetStateAction<string>>;
  setRejectReason: import("react").Dispatch<import("react").SetStateAction<string>>;
  setRejectTargetTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setReopenAssignee: import("react").Dispatch<import("react").SetStateAction<string>>;
  setReopenNotes: import("react").Dispatch<import("react").SetStateAction<string>>;
  setReopenServicesTarget: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setReopenTargetTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setReopeningServices: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSelectedTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setShowLoadingPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowRejectModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowReopenModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowTicketDetailPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setUploading: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  teamMembers: TeamMember[];
  tutupJadwalTicket: (t: Ticket, jadi: "done" | "cancelled") => Promise<void>;
  users: User[];
}

export function useTolakBukaUlang(k: TolakBukaUlangKonteks) {
  const { currentUser, currentUserTeamType, fetchData, notify, rejectReason, rejectTargetTicket, reopenAssignee, reopenNotes, reopenServicesTarget, reopenTargetTicket, setLoadingMessage, setRejectReason, setRejectTargetTicket, setReopenAssignee, setReopenNotes, setReopenServicesTarget, setReopenTargetTicket, setReopeningServices, setSelectedTicket, setShowLoadingPopup, setShowRejectModal, setShowReopenModal, setShowTicketDetailPopup, setUploading, teamMembers, tutupJadwalTicket, users } = k;
  const rejectTicket = (ticket: Ticket) => {
    setRejectTargetTicket(ticket);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!rejectTargetTicket) return;
    if (!rejectReason.trim()) { notify("error", "Mohon isi alasan penolakan!"); return; }
    try {
      setUploading(true);
      const { error } = await supabase
        .from("tickets")
        .update({ status: "Rejected", rejection_reason: rejectReason.trim() })
        .eq("id", rejectTargetTicket.id);
      if (error) throw error;

      // Notifikasi ke pembuat tiket
      if (rejectTargetTicket.created_by) {
        const creatorUser = users.find((u) => u.username === rejectTargetTicket.created_by);
        if (creatorUser?.id) {
          try {
            const { createNotification } = await import('@/lib/notifications');
            void createNotification({
              user_id: creatorUser.id,
              type: 'ticket',
              title: `❌ Ticket ditolak`,
              body: `${rejectTargetTicket.project_name} — ${rejectReason.trim().slice(0, 80)}`,
              action_url: '/ticketing',
              ref_id: rejectTargetTicket.id,
              created_by: currentUser?.full_name || 'Admin',
            });
          } catch { }
          /*
            Penolakan dulu HANYA badge in-app. Artinya Sales yang melaporkan
            masalah baru tahu tiketnya ditolak kalau kebetulan membuka
            platform - padahal penolakan justru kabar yang paling perlu
            segera sampai, karena dialah yang harus menindaklanjuti.
            sendWANotif mengirim ke WhatsApp DAN Telegram sekaligus.
          */
          if (creatorUser.phone_number) {
            void sendWANotif({
              type: 'reminder_wa',
              target: creatorUser.phone_number,
              message: [
                '❌ *TICKET DITOLAK*',
                '━━━━━━━━━━━━━━━━━━',
                `Halo *${creatorUser.full_name}*, ticket kamu ditolak oleh *${currentUser?.full_name || 'Admin'}*:`,
                `📌 *Project :* ${rejectTargetTicket.project_name}`,
                `⚠️ *Issue   :* ${rejectTargetTicket.issue_case}`,
                `📝 *Alasan  :* ${rejectReason.trim()}`,
                '━━━━━━━━━━━━━━━━━━',
                'Silakan perbaiki datanya lalu ajukan ulang bila masih diperlukan.',
                `🔗 ${appLink()}`,
              ].join('\n'),
            });
          }
        }
      }

      //  Ticket ditolak berarti pekerjaannya tidak jadi - jadwal onsite yang
      //  terlanjur dibuat harus ikut dibatalkan, bukan dibiarkan menggantung
      //  di Reminder Schedule seolah masih akan dikerjakan.
      void tutupJadwalTicket(rejectTargetTicket, 'cancelled');

      await fetchData();
      setShowRejectModal(false);
      setRejectTargetTicket(null);
      setRejectReason("");
      notify("success", "Ticket ditolak. Sales dapat melihat alasan penolakan.");
    } catch (err: any) { notify("error", "Error: " + err.message); } finally { setUploading(false); }
  };

  const reopenTicket = async () => {
    if (!reopenTargetTicket || !reopenAssignee) return;
    try {
      setUploading(true);
      setShowLoadingPopup(true);
      setLoadingMessage("Re-opening ticket...");
      const { error: ue } = await supabase.from("tickets").update({ status: "Pending", assign_name: reopenAssignee, current_team: "Team PTS IVP", services_status: null }).eq("id", reopenTargetTicket.id);
      if (ue) throw ue;
      await supabase.from("activity_logs").insert([{
        ticket_id: reopenTargetTicket.id,
        handler_name: currentUser?.full_name || "",
        handler_username: currentUser?.username || "",
        action_taken: "Re-open Ticket",
        notes: reopenNotes ? `Dibuka kembali: ${reopenNotes}` : `Ticket dibuka kembali oleh ${currentUser?.full_name}`,
        new_status: "Pending",
        team_type: "Team PTS IVP",
        assigned_to_services: false,
        file_url: "", file_name: "", photo_url: "", photo_name: ""
      }]);
      // WA ke handler saat reopen
      try {
        // Cari handler dari teamMembers state (sudah load dari users)
        const rhTM = teamMembers.find(m => m.name === reopenAssignee);
        const { data: reopenHandler } = rhTM?.username ? await supabase
          .from("users").select("phone_number, full_name")
          .eq("username", rhTM.username).maybeSingle() : { data: null };
        if (reopenHandler?.phone_number) {
          const waMsg = [
            "🔓 *Ticket Re-opened ke Kamu*",
            "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
            `Halo *${reopenHandler?.full_name || "Handler"}*, ticket dibuka kembali:`,
            "",
            `📌 *Project :* ${reopenTargetTicket.project_name}`,
            `⚠️ *Issue   :* ${reopenTargetTicket.issue_case}`,
            "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
            "Mohon segera ditangani. Semangat! 💪",
            `🔗 ${appLink()}`,
          ].join("\n");
          await sendWANotif({ type: "reminder_wa", event: "ticket.reopened", target: reopenHandler.phone_number, message: waMsg });
        }
      } catch { }
      await fetchData();
      setLoadingMessage("✅ Ticket berhasil dibuka kembali!");
      setTimeout(() => {
        setShowLoadingPopup(false);
        setUploading(false);
        setShowReopenModal(false);
        setReopenTargetTicket(null);
        setReopenAssignee("");
        setReopenNotes("");
        setShowTicketDetailPopup(false);
        setSelectedTicket(null);
      }, 1500);
    } catch (err: any) {
      setShowLoadingPopup(false);
      setUploading(false);
      notify("error", "Error: " + err.message);
    }
  };

  /**
   * C2 - buka kembali sisi SERVICES saja (services_status kembali "Pending"),
   * tanpa menyentuh status/assign_name utama PTS. Boleh dipakai Team Services
   * sendiri (membetulkan salah klik "Solved" mereka) atau Admin/Superadmin
   * sebagai pengawasan - bukan siapa pun yang login, dan bukan cuma Admin
   * (kalau cuma Admin, Team Services tetap harus minta tolong orang lain
   * untuk membetulkan kesalahannya sendiri).
   */
  const reopenServicesTicket = async () => {
    if (!reopenServicesTarget) return;
    setReopeningServices(true);
    try {
      const { error: svcErr } = await supabaseServices.from("tickets")
        .update({ services_status: "Pending" }).eq("id", reopenServicesTarget.id);
      if (svcErr) throw new Error(`Gagal membuka kembali di basis data Services: ${svcErr.message}`);
      const { error: ptsErr } = await supabase.from("tickets")
        .update({ services_status: "Pending" }).eq("id", reopenServicesTarget.id);
      if (ptsErr) notify("error", `Terbuka di Services, tapi gagal disalin ke PTS: ${ptsErr.message}. Refresh lalu ulangi.`);
      const activeClient = currentUserTeamType === "Team Services" ? supabaseServices : supabase;
      await activeClient.from("activity_logs").insert([{
        ticket_id: reopenServicesTarget.id,
        handler_name: currentUser?.full_name || "",
        handler_username: currentUser?.username || "",
        action_taken: "Re-open Services",
        notes: `Sisi Services dibuka kembali oleh ${currentUser?.full_name || "-"}.`,
        new_status: "Pending",
        team_type: "Team Services",
        assigned_to_services: false,
        file_url: "", file_name: "", photo_url: "", photo_name: "",
      }]);
      notify("success", "Sisi Services dibuka kembali - status kembali Pending.");
      await fetchData();
      setReopenServicesTarget(null);
    } catch (err: any) {
      notify("error", "Error: " + err.message);
    } finally {
      setReopeningServices(false);
    }
  };
  return { rejectTicket, confirmReject, reopenTicket, reopenServicesTicket };
}
