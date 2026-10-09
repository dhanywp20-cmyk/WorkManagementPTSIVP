'use client';

/** useServicesTicket - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { sendWANotif, User, Ticket } from './shared';
import { supabase, supabaseServices } from '@/lib/supabase';
import { appLink } from '@/lib/app-url';
import { createNotification } from '@/lib/notifications';
import { penerimaAdminBernomor } from '@/lib/penerima-admin';
import { type ConfirmState } from '@/components/shared';

export interface ServicesTicketKonteks {
  currentUser: User | null;
  fetchData: (userOverride?: User | null, silent?: boolean) => Promise<void>;
  notify: (type: "success" | "error", msg: string) => void;
  setConfirmState: import("react").Dispatch<import("react").SetStateAction<ConfirmState | null>>;
  setLoadingMessage: import("react").Dispatch<import("react").SetStateAction<string>>;
  setServicesApprovalTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setShowLoadingPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowServicesApprovalModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setUploading: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  users: User[];
}

export function useServicesTicket(k: ServicesTicketKonteks) {
  const { currentUser, fetchData, notify, setConfirmState, setLoadingMessage, setServicesApprovalTicket, setShowLoadingPopup, setShowServicesApprovalModal, setUploading, users } = k;
  const approveServicesTicket = async (ticket: Ticket) => {
    try {
      setUploading(true);
      setShowLoadingPopup(true);
      setLoadingMessage("Approving ticket untuk Team Services...");
      //  Diperiksa: ini penulisan pertama dan yang menentukan alur ini
      //  benar-benar jalan. Kalau gagal diam-diam, activity log & notifikasi
      //  "diterima Team Services" di bawah tetap terkirim walau tickenya
      //  sendiri tidak pernah pindah status.
      const { data: terubah, error: galatUtama } = await supabase.from("tickets")
        .update({ services_status: "Pending" }).eq("id", ticket.id).select("id");
      if (galatUtama || !terubah || terubah.length === 0) {
        setShowLoadingPopup(false); setUploading(false);
        notify("error", "Gagal approve ticket untuk Team Services. Coba lagi.");
        return;
      }
      try {
        const { error: svcErr } = await supabaseServices.from("tickets").update({ services_status: "Pending", status: "Pending" }).eq("id", ticket.id);
        if (svcErr) throw svcErr;
      } catch (e: any) {
        notify("error", `Status di basis data Services gagal diperbarui (${e?.message ?? "penyebab tidak diketahui"}). Kedua sisi bisa berbeda — periksa ticket ini.`);
      }
      await supabaseServices.from("activity_logs").insert([{
        ticket_id: ticket.id,
        handler_name: currentUser?.full_name || "",
        handler_username: currentUser?.username || "",
        action_taken: "Ticket Diterima oleh Team Services",
        notes: `Ticket diterima dan akan segera diproses oleh Team Services.`,
        new_status: "Pending",
        team_type: "Team Services",
        assigned_to_services: false,
        file_url: "", file_name: "", photo_url: "", photo_name: ""
      }]);
      /*
        Serah terima ke Team Services sebelumnya tidak mengabari siapa pun.
        Sales yang melaporkan dan PTS yang menyerahkan sama-sama tidak tahu
        ticketnya sudah diterima - padahal sejak titik ini penanganannya
        berpindah tangan, dan merekalah yang akan ditanyai kalau ada
        perkembangan. sendWANotif mengirim ke WhatsApp DAN Telegram sekaligus.
      */
      try {
        const pihak = [ticket.created_by, ticket.assign_name].filter(Boolean) as string[];
        const penerima = users.filter(u =>
          (!!u.username && pihak.includes(u.username)) || (!!u.full_name && pihak.includes(u.full_name)));
        const pesanTerima = [
          '🤝 *TICKET DITERIMA TEAM SERVICES*',
          '━━━━━━━━━━━━━━━━━━',
          `📌 *Project :* ${ticket.project_name}`,
          `⚠️ *Issue   :* ${ticket.issue_case}`,
          `✅ *Diterima:* ${currentUser?.full_name || 'Team Services'}`,
          '━━━━━━━━━━━━━━━━━━',
          'Penanganan berpindah ke Team Services dan akan segera diproses.',
          `🔗 ${appLink()}`,
        ].join('\n');
        for (const u of penerima) {
          if (u.phone_number) void sendWANotif({ type: 'reminder_wa', target: u.phone_number, message: pesanTerima });
          void createNotification({
            user_id: u.id, type: 'ticket',
            title: '🤝 Ticket diterima Team Services',
            body: `${ticket.project_name} — ${ticket.issue_case}`,
            action_url: '/ticketing', ref_id: ticket.id,
            created_by: currentUser?.full_name ?? '',
          });
        }
      } catch { /* kabar gagal tidak boleh membatalkan serah terimanya */ }

      await fetchData();
      setLoadingMessage("✅ Ticket diterima oleh Team Services!");
      setTimeout(() => { setShowLoadingPopup(false); setUploading(false); setShowServicesApprovalModal(false); setServicesApprovalTicket(null); }, 1500);
    } catch (err: any) { setShowLoadingPopup(false); setUploading(false); notify("error", "Error: " + err.message); }
  };

  const rejectServicesTicket = (ticket: Ticket) => {
    setConfirmState({
      message: `Tolak ticket "${ticket.project_name} - ${ticket.issue_case}"?`,
      description: 'Ticket akan dikembalikan ke Team PTS IVP.',
      danger: true,
      confirmLabel: 'Tolak',
      onConfirm: async () => {
        try {
          setUploading(true);
          setShowLoadingPopup(true);
          setLoadingMessage("Mengembalikan ticket ke Team PTS IVP...");
          //  Diperiksa - lihat catatan yang sama di approveServicesTicket.
          const { data: terubah, error: galatUtama } = await supabase.from("tickets")
            .update({ current_team: "Team PTS IVP", services_status: null, status: "In Progress" })
            .eq("id", ticket.id).select("id");
          if (galatUtama || !terubah || terubah.length === 0) {
            setShowLoadingPopup(false); setUploading(false);
            notify("error", "Gagal mengembalikan ticket ke PTS. Coba lagi.");
            return;
          }
          await supabase.from("activity_logs").insert([{
            ticket_id: ticket.id,
            handler_name: currentUser?.full_name || "",
            handler_username: currentUser?.username || "",
            action_taken: "Ticket Dikembalikan ke Team PTS IVP",
            notes: `Ticket dikembalikan ke Team PTS IVP oleh Team Services karena tidak dapat ditangani.`,
            new_status: "In Progress",
            team_type: "Team Services",
            assigned_to_services: false,
            file_url: "", file_name: "", photo_url: "", photo_name: ""
          }]);
          try {
            //  select('id') + panjangnya diperiksa: RLS yang menolak diam-diam
            //  (0 baris, tanpa galat) tidak melempar apa pun ke catch di
            //  bawah - dilempar manual di sini supaya pesan "catatan di
            //  basis data Services gagal diperbarui" benar-benar muncul.
            const { data: terubahSvc, error: galatSvc } = await supabaseServices.from("tickets")
              .update({ services_status: "Returned to PTS", current_team: "Team PTS IVP" }).eq("id", ticket.id).select("id");
            if (galatSvc) throw galatSvc;
            if (!terubahSvc || terubahSvc.length === 0) throw new Error("tidak punya akses / ticket tidak ditemukan di basis data Services");
            await supabaseServices.from("activity_logs").insert([{
              ticket_id: ticket.id,
              handler_name: currentUser?.full_name || "",
              handler_username: currentUser?.username || "",
              action_taken: "Ticket Dikembalikan ke Team PTS IVP",
              notes: `Ticket dikembalikan ke Team PTS IVP. History Services tetap tersimpan.`,
              new_status: "Returned to PTS",
              team_type: "Team Services",
              assigned_to_services: false,
              file_url: "", file_name: "", photo_url: "", photo_name: ""
            }]);
          } catch (e: any) {
            // Sisi PTS sudah mengambil ticket ini kembali, jadi tidak ada yang
            // hilang. Yang tersisa cuma catatan di basis data Services yang
            // belum ikut berubah - itu harus terlihat, bukan didiamkan.
            notify("error", `Ticket sudah kembali ke PTS, tapi catatan di basis data Services gagal diperbarui (${e?.message ?? "penyebab tidak diketahui"}).`);
          }
          /*
            Ticket kembali menjadi tanggung jawab PTS, tapi sebelumnya tidak
            ada yang diberi tahu - jadi pekerjaan yang dikembalikan bisa
            menganggur karena sisi PTS mengira masih ditangani Services.
            Dikabari ke penangan PTS, pelapor, dan admin/Manager Full Access.
          */
          try {
            const pihak = [ticket.created_by, ticket.assign_name].filter(Boolean) as string[];
            const penerima = new Map<string, any>();
            for (const u of users.filter(u =>
              (!!u.username && pihak.includes(u.username)) || (!!u.full_name && pihak.includes(u.full_name)))) {
              penerima.set(u.id, u);
            }
            for (const u of await penerimaAdminBernomor()) penerima.set(u.id, u);
            const pesanKembali = [
              '↩️ *TICKET DIKEMBALIKAN KE TEAM PTS*',
              '━━━━━━━━━━━━━━━━━━',
              `📌 *Project :* ${ticket.project_name}`,
              `⚠️ *Issue   :* ${ticket.issue_case}`,
              `↩️ *Oleh    :* ${currentUser?.full_name || 'Team Services'}`,
              '━━━━━━━━━━━━━━━━━━',
              'Team Services tidak dapat menanganinya — penanganan kembali ke PTS.',
              `🔗 ${appLink()}`,
            ].join('\n');
            for (const u of penerima.values()) {
              //  sendWANotif mengirim ke WhatsApp DAN Telegram sekaligus.
              if (u.phone_number) void sendWANotif({ type: 'reminder_wa', target: u.phone_number, message: pesanKembali });
              void createNotification({
                user_id: u.id, type: 'ticket',
                title: '↩️ Ticket dikembalikan ke PTS',
                body: `${ticket.project_name} — ${ticket.issue_case}`,
                action_url: '/ticketing', ref_id: ticket.id,
                created_by: currentUser?.full_name ?? '',
              });
            }
          } catch { /* kabar gagal tidak boleh membatalkan pengembaliannya */ }

          await fetchData();
          setLoadingMessage("✅ Ticket dikembalikan ke Team PTS IVP.");
          setTimeout(() => { setShowLoadingPopup(false); setUploading(false); setShowServicesApprovalModal(false); }, 1500);
        } catch (err: any) { setShowLoadingPopup(false); setUploading(false); notify("error", "Error: " + err.message); }
      },
    });
  };
  return { approveServicesTicket, rejectServicesTicket };
}
