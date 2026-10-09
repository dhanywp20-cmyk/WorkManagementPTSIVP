'use client';

/** useTambahAktivitas - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { SERVICES_STATUSES, User, TeamMember, Ticket, OverdueSetting } from './shared';
import { supabase, supabaseServices } from '@/lib/supabase';
import { compressImage } from '@/lib/image-compress';

export interface TambahAktivitasKonteks {
  currentUser: User | null;
  fetchData: (userOverride?: User | null, silent?: boolean) => Promise<void>;
  fetchOverdueSettings: () => Promise<void>;
  getOverdueSetting: (ticketId: string) => OverdueSetting | undefined;
  kabarkanTicketSelesai: (t: Ticket, catatan: string) => Promise<void>;
  newActivity: { handler_name: string; action_taken: string; notes: string; new_status: string; sn_unit: string; file: File | null; photo: File | null; assign_to_services: boolean; services_assignee: string; onsite_use_schedule: boolean; onsite_schedule_date: string; onsite_schedule_hour: string; onsite_schedule_minute: string; extend_days: string; };
  notify: (type: "success" | "error", msg: string) => void;
  selectedTicket: Ticket | null;
  setLoadingMessage: import("react").Dispatch<import("react").SetStateAction<string>>;
  setNewActivity: import("react").Dispatch<import("react").SetStateAction<{ handler_name: string; action_taken: string; notes: string; new_status: string; sn_unit: string; file: File | null; photo: File | null; assign_to_services: boolean; services_assignee: string; onsite_use_schedule: boolean; onsite_schedule_date: string; onsite_schedule_hour: string; onsite_schedule_minute: string; extend_days: string; }>>;
  setSelectedTicket: import("react").Dispatch<import("react").SetStateAction<Ticket | null>>;
  setShowLoadingPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowUpdateForm: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setTickets: import("react").Dispatch<import("react").SetStateAction<Ticket[]>>;
  setUploading: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  teamMembers: TeamMember[];
  tutupJadwalTicket: (t: Ticket, jadi: "done" | "cancelled") => Promise<void>;
}

export function useTambahAktivitas(k: TambahAktivitasKonteks) {
  const { currentUser, fetchData, fetchOverdueSettings, getOverdueSetting, kabarkanTicketSelesai, newActivity, notify, selectedTicket, setLoadingMessage, setNewActivity, setSelectedTicket, setShowLoadingPopup, setShowUpdateForm, setTickets, setUploading, teamMembers, tutupJadwalTicket } = k;
  const addActivity = async () => {
    const SERVICES_SIMPLE = ["Warranty", "Out Of Warranty", "Waiting PO from Sales", "Submit RMA", "Waiting sparepart"];
    const isSimpleStatus = newActivity.new_status === "Call" || newActivity.new_status === "Onsite";
    const isSvcSimple = teamMembers.find((m) => (m.username || "").toLowerCase() === (currentUser?.username || "").toLowerCase())?.team_type === "Team Services" && SERVICES_SIMPLE.includes(newActivity.new_status);
    // "In Progress" boleh tanpa notes/action/foto (ganti status saja). "Pending
    // Action" TETAP wajib notes (alasan kendala).
    const noteOptional = isSimpleStatus || isSvcSimple || newActivity.new_status === "In Progress";
    if (!noteOptional && !newActivity.notes) { notify("error", "Notes must be filled!"); return; }
    if (!selectedTicket) { notify("error", "No ticket selected!"); return; }
    const member = teamMembers.find((m) => (m.username || "").toLowerCase() === (currentUser?.username || "").toLowerCase());
    const teamType = member?.team_type || "Team PTS IVP";
    const isServicesTeam = teamType === "Team Services";
    const validStatusesPTS = ["Waiting Approval", "Pending", "Call", "Onsite", "In Progress", "Pending Action", "Solved"];
    if (isServicesTeam) {
      if (!(SERVICES_STATUSES as readonly string[]).includes(newActivity.new_status)) { notify("error", "Status tidak valid untuk Team Services!"); return; }
    } else {
      if (!validStatusesPTS.includes(newActivity.new_status)) { notify("error", "Invalid status!"); return; }
    }
    // services_assignee no longer required - admin Services will assign internally
    try {
      setUploading(true);
      setShowLoadingPopup(true);
      setLoadingMessage("Updating ticket status...");
      let fileUrl = "", fileName = "", photoUrl = "", photoName = "";
      const ALLOWED_IMG = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const MAX_IMG_MB = 5;
      const MAX_PDF_MB = 10;
      if (newActivity.file) {
        if (newActivity.file.type !== 'application/pdf') { notify("error", "File laporan hanya boleh format PDF."); setUploading(false); setShowLoadingPopup(false); return; }
        if (newActivity.file.size > MAX_PDF_MB * 1024 * 1024) { notify("error", `Ukuran PDF maksimal ${MAX_PDF_MB}MB.`); setUploading(false); setShowLoadingPopup(false); return; }
      }
      if (newActivity.photo) {
        if (!ALLOWED_IMG.includes(newActivity.photo.type)) { notify("error", "Foto bukti hanya boleh format JPG, PNG, atau WebP."); setUploading(false); setShowLoadingPopup(false); return; }
        if (newActivity.photo.size > MAX_IMG_MB * 1024 * 1024) { notify("error", `Ukuran foto maksimal ${MAX_IMG_MB}MB.`); setUploading(false); setShowLoadingPopup(false); return; }
      }
      const uploadFileToBucket = async (file: File, folder: string, useServicesDb: boolean = false) => {
        const client = useServicesDb ? supabaseServices : supabase;
        const toUpload = file.type.startsWith('image/') ? await compressImage(file) : file;
        const ext = toUpload.name.split('.').pop()?.toLowerCase() ?? 'bin';
        const filePath = `${folder}/${Date.now()}.${ext}`;
        const { error } = await client.storage.from("ticket-photos").upload(filePath, toUpload, { cacheControl: '31536000' });
        if (error) throw error;
        const { data } = client.storage.from("ticket-photos").getPublicUrl(filePath);
        return { url: data.publicUrl, name: file.name };
      };
      if (newActivity.file) {
        setLoadingMessage("Uploading PDF file...");
        try { const result = await uploadFileToBucket(newActivity.file, "reports", isServicesTeam); fileUrl = result.url; fileName = result.name; } catch (uploadErr: any) { throw new Error(`Failed to upload PDF: ${uploadErr.message}`); }
      }
      if (newActivity.photo) {
        setLoadingMessage("Uploading photo...");
        try { const result = await uploadFileToBucket(newActivity.photo, "photos", isServicesTeam); photoUrl = result.url; photoName = result.name; } catch (uploadErr: any) { throw new Error(`Failed to upload photo: ${uploadErr.message}`); }
      }
      setLoadingMessage("Saving activity log...");
      const SVCSS = ["Warranty", "Out Of Warranty", "Waiting PO from Sales", "Submit RMA", "Waiting sparepart"];
      const isSimpleStatusCalc = newActivity.new_status === "Call" || newActivity.new_status === "Onsite";
      const isSvcSimpleCalc = isServicesTeam && SVCSS.includes(newActivity.new_status);
      const onsiteHasSchedule = newActivity.new_status === "Onsite" && newActivity.onsite_use_schedule && newActivity.onsite_schedule_date;
      const svcSimpleNotes: Record<string, string> = {
        Warranty: "Unit masih dalam masa garansi.",
        "Out Of Warranty": "Unit sudah di luar masa garansi.",
        "Waiting PO from Sales": "Menunggu Purchase Order dari Sales.",
        "Submit RMA": "RMA telah disubmit ke vendor.",
        "Waiting sparepart": "Menunggu kedatangan sparepart.",
      };
      let autoNotes = "";
      if (newActivity.new_status === "Call") autoNotes = "Sedang melakukan Call ke customer.";
      else if (newActivity.new_status === "Onsite") {
        if (onsiteHasSchedule) autoNotes = `Dijadwalkan Onsite pada ${newActivity.onsite_schedule_date} pukul ${newActivity.onsite_schedule_hour}:${newActivity.onsite_schedule_minute} WIB.`;
        else autoNotes = "Tim sedang Onsite ke lokasi customer.";
      } else if (isSvcSimpleCalc) autoNotes = svcSimpleNotes[newActivity.new_status] || newActivity.new_status;
      // Onsite + punya jadwal  status ticket = "Onsite" (bukan Pending)
      // Activity log juga dicatat sebagai "Onsite"
      const effectiveStatus = newActivity.new_status;
      const useAutoNotes = isSimpleStatusCalc || isSvcSimpleCalc;
      const activityData: any = {
        ticket_id: selectedTicket.id,
        handler_name: newActivity.handler_name,
        handler_username: currentUser?.username || "",
        action_taken: useAutoNotes ? "" : newActivity.action_taken || "",
        notes: useAutoNotes ? autoNotes : newActivity.notes,
        new_status: effectiveStatus,
        team_type: teamType,
        assigned_to_services: newActivity.assign_to_services || false,
        file_url: fileUrl || "",
        file_name: fileName || "",
        photo_url: photoUrl || "",
        photo_name: photoName || "",
      };
      const activeClient = isServicesTeam ? supabaseServices : supabase;
      const { error: activityError } = await activeClient.from("activity_logs").insert([activityData]).select();
      if (activityError) throw new Error(`Database error: ${activityError.message}`);
      setLoadingMessage("Updating ticket status...");
      const updateData: any = {};
      if (newActivity.sn_unit) updateData.sn_unit = newActivity.sn_unit;
      if (isServicesTeam) {
        updateData.services_status = effectiveStatus;
        const { error: svcErr } = await supabaseServices.from("tickets").update(updateData).eq("id", selectedTicket.id);
        if (svcErr) throw new Error(`Gagal memperbarui ticket di basis data Services: ${svcErr.message}`);
        // Salin status ke basis data PTS supaya kedua sisi tidak berbeda. Gagal
        // di sini tidak membatalkan pekerjaan Services yang sudah tercatat,
        // tapi harus terlihat - bukan hilang tanpa jejak.
        const { error: ptsErr } = await supabase.from("tickets").update({ services_status: effectiveStatus }).eq("id", selectedTicket.id);
        if (ptsErr) notify("error", `Status tersimpan di Services, tapi gagal disalin ke PTS: ${ptsErr.message}. Refresh lalu ulangi.`);
        // M1 (docs/UX-WORKFLOW-AUDIT.md): dulu HANYA jalur PTS IVP yang kabari
        // semua pihak saat "Solved" - jalur Services (di sini) tidak mengirim
        // apa pun, padahal konsepnya sama-sama "ticket selesai". Sales, handler
        // PTS yang menyerahkan ke Services, dan Supervisor tidak pernah tahu
        // kapan Team Services benar-benar selesai.
        if (effectiveStatus === "Solved") {
          void kabarkanTicketSelesai(selectedTicket, useAutoNotes ? autoNotes : (newActivity.notes || ""));
        }
      } else {
        updateData.status = effectiveStatus;
        if (newActivity.assign_to_services) {
          // ASSIGN TO TEAM SERVICES
          // Dua basis data terpisah, tanpa transaksi bersama. Penyalinan ke
          // basis data Services WAJIB dikerjakan lebih dulu, dan serah
          // terimanya hanya ditulis kalau salinan itu berhasil. Kalau urutannya
          // dibalik, satu penyalinan yang gagal membuat ticket hilang dari
          // kedua sisi: PTS menganggap bukan urusannya lagi, Services tidak
          // pernah menerimanya.
          let mirrorBerhasil = true;
          let mirrorPesan = "";
          try {
            const { data: existSvc, error: cekErr } = await supabaseServices.from("tickets").select("id").eq("id", selectedTicket.id).maybeSingle();
            if (cekErr) throw cekErr;
            if (!existSvc) {
              const { error: insErr } = await supabaseServices.from("tickets").insert([{
                id: selectedTicket.id,
                pts_ticket_id: selectedTicket.id,
                project_name: selectedTicket.project_name,
                address: selectedTicket.address || null,
                customer_phone: selectedTicket.customer_phone || null,
                sales_name: selectedTicket.sales_name || null,
                sales_division: selectedTicket.sales_division || null,
                sn_unit: selectedTicket.sn_unit || null,
                product: selectedTicket.product || null,
                issue_case: selectedTicket.issue_case,
                description: selectedTicket.description || null,
                assign_name: "Admin Team Services", // akan di-assign ulang oleh admin Services
                date: selectedTicket.date,
                status: "Waiting Approval",
                services_status: "Waiting Approval",
                current_team: "Team Services",
                created_by: selectedTicket.created_by || null,
              }]);
              if (insErr) throw insErr;
            } else {
              const { error: updErr } = await supabaseServices.from("tickets").update({
                services_status: "Waiting Approval",
                current_team: "Team Services",
              }).eq("id", selectedTicket.id);
              if (updErr) throw updErr;
            }
          } catch (e: any) {
            mirrorBerhasil = false;
            mirrorPesan = e?.message ?? "penyebab tidak diketahui";
          }

          if (mirrorBerhasil) {
            // current_team pindah ke Team Services, services_status = Waiting Approval.
            // assign_name TETAP handler PTS terakhir - admin Services yang akan
            // meneruskannya ke anggota mereka sendiri.
            updateData.current_team = "Team Services";
            updateData.services_status = "Waiting Approval";

            // Kabari admin Team Services lewat WA. Pembacaan nomor mereka dan
            // penyusunan pesannya dikerjakan di server (/api/services/notify-admins)
            // supaya kontak organisasi lain tidak ikut terunduh ke browser.
            try {
              await fetch("/api/services/notify-admins", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  project_name:   selectedTicket.project_name,
                  issue_case:     selectedTicket.issue_case,
                  product:        selectedTicket.product,
                  sn_unit:        selectedTicket.sn_unit,
                  customer_phone: selectedTicket.customer_phone,
                  sales_name:     selectedTicket.sales_name,
                  catatan:        newActivity.notes,
                }),
              });
            } catch { /* WA gagal tidak boleh membatalkan serah terima */ }
          } else {
            notify("error", `Catatan tersimpan, tapi ticket GAGAL dikirim ke Team Services (${mirrorPesan}). Ticket masih di PTS — coba assign ulang.`);
          }
        }

        const { error: updateError } = await supabase.from("tickets").update(updateData).eq("id", selectedTicket.id);
        if (updateError) throw new Error(`Failed to update ticket: ${updateError.message}`);

        //  Kabar penyelesaian - baru dikirim SESUDAH ticketnya benar-benar
        //  tersimpan sebagai Solved, bukan sebelum. Mengabari lebih dulu lalu
        //  penyimpanannya gagal berarti orang diberi tahu sesuatu yang tidak
        //  terjadi.
        if (effectiveStatus === "Solved") {
          void kabarkanTicketSelesai(selectedTicket, useAutoNotes ? autoNotes : (newActivity.notes || ""));
          //  Jadwal Onsite yang lahir dari ticket ini ikut ditutup, supaya tim
          //  tidak perlu menandai selesai dua kali di dua layar berbeda -
          //  pekerjaannya memang satu, cuma tercatat di dua tempat.
          void tutupJadwalTicket(selectedTicket, 'done');
        }

        // PENDING ACTION: perpanjang deadline Overdue sesuai hari yg dipilih
        // Kendala bisa dari sisi user  team boleh menggeser deadline supaya
        // ticket tidak dihitung overdue. Pakai tabel overdue_settings yg sudah ada
        // (due_date absolut = sekarang + N hari).
        if (newActivity.new_status === "Pending Action") {
          const extDays = parseInt(newActivity.extend_days || "0", 10);
          if (extDays > 0) {
            try {
              const newDeadline = new Date(Date.now() + extDays * 86400000).toISOString();
              const existing = getOverdueSetting(selectedTicket.id);
              if (existing) {
                await supabase.from("overdue_settings").update({ due_date: newDeadline, due_hours: null, set_by: currentUser?.username || "" }).eq("id", existing.id);
              } else {
                await supabase.from("overdue_settings").insert([{ ticket_id: selectedTicket.id, due_date: newDeadline, due_hours: null, set_by: currentUser?.username || "" }]);
              }
              await fetchOverdueSettings();
            } catch { /* jangan gagalkan update status kalau perpanjangan gagal */ }
          }
        }

        // AUTO-CREATE REMINDER saat status Onsite
        // Jika team update status ke Onsite, otomatis buat reminder di tabel
        // reminders sebagai kategori Troubleshooting.
        // Jika ada jadwal (onsite_use_schedule + date), gunakan tanggal tersebut.
        // Jika tidak ada jadwal, gunakan tanggal hari ini.
        if (newActivity.new_status === "Onsite") {
          try {
            /*
              Penjaga duplikat. Sebelum ini tidak ada: setiap kali status
              diubah ke Onsite - termasuk saat tim mengoreksi catatan lalu
              menyimpan ulang - satu reminder BARU dibuat lagi untuk ticket
              yang sama. Akibatnya jadwal yang sudah dikerjakan muncul dua
              kali di Reminder Schedule dan harus ditutup satu per satu.

              Yang diperiksa hanya reminder yang MASIH TERBUKA: kunjungan
              onsite kedua untuk ticket yang sama memang sah punya jadwal
              sendiri, jadi kalau yang lama sudah selesai, yang baru tetap
              boleh dibuat.
            */
            const { data: sudahAda } = await supabase.from('reminders')
              .select('id').eq('ticket_id', selectedTicket.id).neq('status', 'done').limit(1);
            if (sudahAda && sudahAda.length > 0) throw new Error('sudah ada jadwal terbuka');

            const assignedUsername = currentUser?.username || "";
            // Cari full_name user
            const { data: userData } = await supabase
              .from("users")
              .select("full_name, username")
              .eq("username", assignedUsername)
              .single();
            const assignedName = userData?.full_name || assignedUsername;

            const onsiteDueDate = (newActivity.onsite_use_schedule && newActivity.onsite_schedule_date)
              ? newActivity.onsite_schedule_date
              : new Date().toISOString().split("T")[0]; // fallback: hari ini
            const onsiteDueTime = (newActivity.onsite_use_schedule && newActivity.onsite_schedule_date)
              ? `${newActivity.onsite_schedule_hour}:${newActivity.onsite_schedule_minute}`
              : `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;

            const reminderPayload = {
              project_name: selectedTicket.project_name,
              description: `[AUTO dari Ticketing] Issue: ${selectedTicket.issue_case}${selectedTicket.product ? ` | Product: ${selectedTicket.product}` : ""}`,
              // assigned_to = username (FK ke users.username) - wajib untuk filter notif
              assigned_to: assignedUsername,
              // assign_name = full name untuk display
              assign_name: assignedName,
              due_date: onsiteDueDate,
              due_time: onsiteDueTime,
              priority: "high",
              status: "pending",
              repeat: "none",
              category: "Troubleshooting",
              sales_name: selectedTicket.sales_name || "",
              sales_division: selectedTicket.sales_division || "",
              address: selectedTicket.address || "",
              pic_name: selectedTicket.customer_phone || "",
              pic_phone: "",
              product: selectedTicket.product || selectedTicket.sn_unit || "",
              created_by: assignedUsername,
              //  Kaitan sungguhan ke ticketnya. Catatan teks di bawah tetap
              //  ditulis supaya terbaca manusia, tapi yang dipakai program
              //  untuk menutup reminder ini nanti adalah kolom ini.
              ticket_id: selectedTicket.id,
              // ticket_id sebagai link reference ke Ticketing
              notes: `Ticket ID: ${selectedTicket.id} | Project: ${selectedTicket.project_name} | Dibuat otomatis dari Platform Ticketing saat status Onsite dijadwalkan`,
            };
            const { error: reminderErr } = await supabase.from("reminders").insert([reminderPayload]);
          } catch { }
        }
      }
      // Refresh OPTIMIS: update selectedTicket + list saat itu juga supaya
      // status baru langsung terlihat tanpa perlu refresh manual (fix keluhan).
      const optimisticLog = { ...activityData, id: `tmp-${Date.now()}`, created_at: new Date().toISOString() } as any;
      setSelectedTicket(prev => prev && prev.id === selectedTicket.id ? {
        ...prev,
        status: isServicesTeam ? prev.status : effectiveStatus,
        services_status: isServicesTeam ? effectiveStatus : prev.services_status,
        sn_unit: newActivity.sn_unit || prev.sn_unit,
        activity_logs: [optimisticLog, ...(prev.activity_logs || [])],
      } : prev);
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? {
        ...t,
        status: isServicesTeam ? t.status : effectiveStatus,
        services_status: isServicesTeam ? effectiveStatus : t.services_status,
      } : t));
      setNewActivity({
        handler_name: newActivity.handler_name,
        action_taken: "",
        notes: "",
        new_status: isServicesTeam ? "Pending" : "Pending",
        sn_unit: "",
        file: null,
        photo: null,
        assign_to_services: false,
        services_assignee: "",
        onsite_use_schedule: false,
        onsite_schedule_date: "",
        onsite_schedule_hour: "08",
        onsite_schedule_minute: "00",
        extend_days: "",
      });
      await fetchData();
      setLoadingMessage("✅ Status updated successfully!");
      setTimeout(() => { setShowLoadingPopup(false); setUploading(false); setShowUpdateForm(false); }, 1500);
    } catch (err: any) {
      setShowLoadingPopup(false);
      setUploading(false);
      notify("error", "Error: " + err.message);
    }
  };
  return { addActivity };
}
