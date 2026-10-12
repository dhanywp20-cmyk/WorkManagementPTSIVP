'use client';

/** useBuatTicket - dipecah dari app/(portal)/ticketing/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { compressImage } from '@/lib/image-compress';
import { supabase } from '@/lib/supabase';
import { resolveBrandInternals, type Brand } from '@/lib/brand-routing';
import { idDariNama, tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';
import { logAudit } from '@/lib/audit';
import { penerimaAdmin } from '@/lib/penerima-admin';
import { KUNCI_PENGATURAN } from '@/lib/kunci-pengaturan';
import { appLink } from '@/lib/app-url';
import { sendWANotif, fetchWACCTargets, User, TeamMember } from './shared';
import { createNotification } from '@/lib/notifications';
import { type NewTicketForm } from './NewTicketModal';

export interface BuatTicketKonteks {
  currentUser: User | null;
  fetchData: (userOverride?: User | null, silent?: boolean) => Promise<void>;
  getJakartaDateString: () => string;
  isManagerPTS: boolean;
  newTicket: NewTicketForm;
  notify: (type: "success" | "error", msg: string) => void;
  setLoadingMessage: import("react").Dispatch<import("react").SetStateAction<string>>;
  setNewTicket: import("react").Dispatch<import("react").SetStateAction<NewTicketForm>>;
  setShowLoadingPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowNewTicket: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setUploading: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  teamMembers: TeamMember[];
  users: User[];
}

export function useBuatTicket(k: BuatTicketKonteks) {
  const { currentUser, fetchData, getJakartaDateString, isManagerPTS, newTicket, notify, setLoadingMessage, setNewTicket, setShowLoadingPopup, setShowNewTicket, setUploading, teamMembers, users } = k;
  const createTicket = async () => {
    if (!newTicket.project_name || !newTicket.issue_case) { notify("error", "Project name and Issue case must be filled!"); return; }
    // admin/superadmin & MANAGER PTS: ticket langsung masuk (tanpa approval), wajib
    // tentukan penanganan (assign ke team, route ke Supervisor, atau kerjakan sendiri).
    const isElevated = currentUser?.role === "admin" || currentUser?.role === "superadmin" || isManagerPTS;
    if (isElevated && !newTicket.assign_name) { notify("error", "Tentukan penanganan: pilih Team PTS, Supervisor, atau kerjakan sendiri!"); return; }
    try {
      setUploading(true);
      setShowLoadingPopup(true);
      setLoadingMessage("Saving new ticket...");
      let photoUrl = "", photoName = "";
      if (newTicket.photo) {
        const ALLOWED_IMG = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const MAX_IMG_MB = 5;
        if (!ALLOWED_IMG.includes(newTicket.photo.type)) { notify("error", "Foto hanya boleh format JPG, PNG, atau WebP."); setUploading(false); setShowLoadingPopup(false); return; }
        if (newTicket.photo.size > MAX_IMG_MB * 1024 * 1024) { notify("error", `Ukuran foto maksimal ${MAX_IMG_MB}MB.`); setUploading(false); setShowLoadingPopup(false); return; }
        setLoadingMessage("Uploading photo...");
        try {
          const compressed = await compressImage(newTicket.photo);
          const ext = compressed.name.split('.').pop()?.toLowerCase() ?? 'jpg';
          const fileName = `${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from("ticket-photos").upload(`photos/${fileName}`, compressed, { cacheControl: '31536000' });
          if (error) throw error;
          const { data } = supabase.storage.from("ticket-photos").getPublicUrl(`photos/${fileName}`);
          photoUrl = data.publicUrl;
          photoName = newTicket.photo.name;
        } catch (uploadErr: any) { throw new Error(`Failed to upload photo: ${uploadErr.message}`); }
      }
      setLoadingMessage("Saving new ticket...");
      // Resolusi penanganan saat elevated (admin/Manager). Nilai assign_name di form:
      //   "SUP::<id>::<nama>" = route ke Supervisor (SPV yg assign lanjut ke tim),
      //   "SELF"              = kerjakan sendiri (assign ke diri sendiri),
      //   nama lain           = assign langsung ke anggota Team PTS.
      const rawAssign = isElevated ? (newTicket.assign_name || "") : "";
      const isRoute = rawAssign.startsWith("SUP::");
      const routeSup = isRoute ? rawAssign.split("::") : null; // [_, id, nama]
      const resolvedAssignName = !isElevated ? "" : (isRoute ? "" : (rawAssign === "SELF" ? (currentUser?.full_name ?? "") : rawAssign));
      // Ticket dari guest/team biasa  Waiting Approval; dari elevated  langsung Pending.
      const ticketStatus = isElevated ? "Pending" : "Waiting Approval";
      // SBU: Sales Internal (guest) yg pilih Sales External  ticket diatasnamakan
      // External tsb. created_by tetap Sales Internal (jejak pembuat).
      const meInternalSales = !!users.find((u) => u.id === currentUser?.id)?.is_internal_sales;
      const guestSBU = currentUser?.role === "guest" && meInternalSales && !!newTicket.sales_name?.trim();
      // Brand: Sales External pilih brand  resolve Sales Internal utk CC + visibility
      // (ticket = CC saja, tanpa gerbang approval). Kalau brand tak ter-mapping, ticket
      // tetap dibuat (fast-track) - cuma tanpa CC brand.
      const ticketBrand: Brand | null = (currentUser?.role === "guest" && !meInternalSales) ? ((newTicket.brand as Brand | undefined) ?? null) : null;
      let brandInternalId: string | null = null;
      let brandInternalId2: string | null = null;
      const effDivForBrand = (currentUser?.sales_division || newTicket.sales_division || "").trim();
      if (ticketBrand && effDivForBrand) {
        try {
          const rb = await resolveBrandInternals(effDivForBrand, ticketBrand);
          brandInternalId = (rb.mvi ?? rb.ivp)?.id ?? null;
          if (ticketBrand === "BOTH" && rb.mvi && rb.ivp && rb.mvi.id !== rb.ivp.id) brandInternalId2 = rb.ivp.id;
        } catch { /* brand mapping opsional utk ticket */ }
      }
      const ticketData: Record<string, unknown> = {
        project_name: newTicket.project_name,
        address: newTicket.address || null,
        customer_phone: newTicket.customer_phone || null,
        sales_name: guestSBU ? newTicket.sales_name.trim() : (currentUser?.role === "guest" ? (currentUser.full_name || newTicket.sales_name || null) : (newTicket.sales_name || null)),
        sales_division: guestSBU ? (newTicket.sales_division?.trim() || null) : (currentUser?.role === "guest" ? (currentUser.sales_division || newTicket.sales_division || null) : (newTicket.sales_division || null)),
        sn_unit: newTicket.sn_unit || null,
        product: newTicket.product || null,
        issue_case: newTicket.issue_case,
        description: newTicket.description || null,
        assign_name: resolvedAssignName,
        date: newTicket.date,
        status: ticketStatus,
        current_team: "Team PTS IVP",
        services_status: null,
        created_by: currentUser?.username || null,
        // Identitas: uuid menjawab SIAPA, nama menjawab tercatat sebagai siapa.
        // Keduanya ditulis bersamaan - baris baru yang lahir hanya berbekal nama
        // akan mengulang cacat data lama yang sedang dibereskan.
        // Guest membuat ticket untuk dirinya sendiri, jadi id-nya sudah pasti.
        // Selain itu id datang dari SalesPicker; kalau namanya diketik manual
        // dan tidak bisa dipastikan milik siapa, dibiarkan kosong - bukan ditebak.
        sales_user_id: guestSBU
          ? (newTicket.sales_user_id ?? idDariNama(users, newTicket.sales_name))
          : (currentUser?.role === "guest"
              ? (currentUser.id ?? null)
              : (newTicket.sales_user_id ?? idDariNama(users, newTicket.sales_name))),
        assign_user_id: idDariNama(users, resolvedAssignName),
        photo_url: photoUrl || null,
        photo_name: photoName || null,
        reminder_id: (newTicket as any).reminder_id || null,
      };
      // Kolom brand hanya ditulis kalau Sales External pilih brand - supaya create
      // ticket lain tetap jalan walau sql/brand-multi-internal.sql belum di-run.
      if (ticketBrand) {
        ticketData.brand = ticketBrand;
        ticketData.internal_sales_id = brandInternalId;
        ticketData.internal_sales_id_2 = brandInternalId2;
      }
      // Route ke Supervisor  tandai supervisor_assign (SPV yg lanjut assign ke tim).
      if (isRoute && routeSup) {
        ticketData.routing_status = "supervisor_assign";
        ticketData.assigned_supervisor_id = routeSup[1];
      }
      const { data: insertedTicket, error } = await cobaIdentitas(async pakaiUuid => await supabase.from("tickets").insert([pakaiUuid ? ticketData : tanpaIdentitas(ticketData)]).select("id").single());
      if (error) throw error;

      // Catat pembuatan ke audit trail supaya riwayat ticket punya pangkal.
      // Saat Sales Internal mengajukan atas nama Sales External (SBU), keduanya
      // disebut supaya jelas siapa penginput dan atas nama siapa.
      if (insertedTicket?.id) {
        const atasNama = (ticketData.sales_name as string | null) ?? "";
        const bedaPenginput = atasNama && atasNama !== currentUser?.full_name;
        logAudit({
          user_id: currentUser?.id ?? "", user_name: currentUser?.full_name ?? "",
          action: "create", module: "ticket",
          target_id: insertedTicket.id, target_name: newTicket.project_name,
          notes: bedaPenginput
            ? `Diinput ${currentUser?.full_name} atas nama Sales ${atasNama}`
            : `Issue: ${newTicket.issue_case}`,
        }).catch(() => {});
      }

      // Kirim WA notifikasi ke semua admin & superadmin jika butuh approval
      // Hanya role guest dan team yang butuh approval  trigger WA ke admin
      if (!isElevated) {
        // Pesan menyebut STATUS ticket-nya, bukan mekanisme internal (WA ke siapa) -
        // yang ditunggu user adalah kabar tiketnya, bukan detail cara sistem memberi tahu.
        setLoadingMessage("Ticket sedang diproses & menunggu approval...");
        try {
          // Admin + pemegang Full Access dari satu sumber (lib/penerima-admin.ts),
          // ditambah app_settings.manager_user_id (override lama, tetap didukung).
          const approvers: { id: string; phone_number: string; full_name: string }[] =
            // SEMUA penerima (bukan hanya yang bernomor): daftar ini juga dipakai
            // untuk notifikasi in-app di bawah. WA sendiri sudah menyaring nomor kosong.
            (await penerimaAdmin()).map(u => ({ id: u.id, phone_number: u.phone_number ?? "", full_name: u.full_name }));
          try {
            const { data: mgrSetting } = await supabase.from("app_settings").select("value").eq("key", KUNCI_PENGATURAN.MANAGER).maybeSingle();
            const managerId = mgrSetting?.value ? String(mgrSetting.value).replace(/^"|"$/g, "") : "";
            if (managerId && !approvers.find(a => a.id === managerId)) {
              const { data: mgr } = await supabase.from("users").select("id, phone_number, full_name").eq("id", managerId).maybeSingle();
              if (mgr) approvers.push(mgr as any);
            }
          } catch { }
          if (approvers.length > 0) {
            const waMsg = [
              "🔔 *Request Ticket Baru \u2014 Menunggu Approval*",
              "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
              `📌 *Project  :* ${newTicket.project_name}`,
              `⚠️ *Issue    :* ${newTicket.issue_case}`,
              `👤 *Requester:* ${currentUser?.full_name || "-"} (${currentUser?.username || "-"})`,
              `📅 *Tanggal  :* ${newTicket.date || "-"}`,
              "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
              "Silakan buka dashboard untuk *Approve / Reject*.",
              `🔗 ${appLink()}`,
            ].join("\n");
            await Promise.allSettled(
              approvers.filter(a => a.phone_number).map((a) =>
                sendWANotif({ type: "reminder_wa", event: "ticket.approval_needed", target: a.phone_number, message: waMsg })
              )
            );
            // Badge in-app ke Admin & Manager
            if (insertedTicket?.id) {
              approvers.forEach(a => { if (a.id) void createNotification({ user_id: a.id, type: 'ticket', title: '🔔 Ticket baru menunggu approval', body: `${newTicket.project_name} — ${newTicket.issue_case}`, action_url: '/ticketing', ref_id: insertedTicket.id, created_by: currentUser?.full_name || '' }); });
            }
          }
        } catch { }
        // CC ke atasan + IVP berdasarkan divisi user yang submit
        try {
          const ccDiv = (ticketData.sales_division as string | null) ?? currentUser?.sales_division ?? "";
          if (ccDiv && ccDiv !== "IVP" && currentUser?.id) {
            const ccTargets = await fetchWACCTargets(currentUser.id, ccDiv);
            if (ccTargets.length > 0) {
              const ccMsg = [
                `🔔 *[CC] Ticket Baru — Divisi ${ccDiv}*`,
                "━━━━━━━━━━━━━━━━━━",
                `📌 *Project  :* ${newTicket.project_name}`,
                `⚠️ *Issue    :* ${newTicket.issue_case}`,
                `👤 *Sales    :* ${currentUser?.full_name || "-"} (${ccDiv})`,
                `📅 *Tanggal  :* ${newTicket.date || "-"}`,
                "━━━━━━━━━━━━━━━━━━",
                `📋 *CC ke   :* ${ccTargets.map(t => t.name + (t.relation === "ivp_handler" ? " (IVP)" : "")).join(", ")}`,
                `🔗 ${appLink()}`,
              ].join("\n");
              await Promise.allSettled(ccTargets.map(t => sendWANotif({ type: "reminder_wa", event: "ticket.approval_needed", target: t.phone, message: ccMsg })));
            }
          }
        } catch { }
      }

      // Route ke Supervisor saat create (Manager/Admin)  WA + badge ke Supervisor
      if (isRoute && routeSup && insertedTicket?.id) {
        try {
          const supId = routeSup[1], supName = routeSup[2] ?? "";
          const supMember = teamMembers.find(m => m.id === supId);
          const { data: supUser } = supMember?.username
            ? await supabase.from("users").select("id, phone_number, full_name").eq("username", supMember.username).maybeSingle()
            : { data: null };
          if (supUser?.id) void createNotification({ user_id: supUser.id, type: 'ticket', title: '🎯 Ticket perlu kamu assign', body: `${newTicket.project_name} — ${newTicket.issue_case}`, action_url: '/ticketing', ref_id: insertedTicket.id, created_by: currentUser?.full_name || '' });
          if (supUser?.phone_number) {
            const waMsg = ["🎯 *Ticket Perlu Di-assign ke Tim*", "━━━━━━━━━━━━━━━━━━", `Halo *${supUser.full_name || supName}*, ${currentUser?.full_name} meneruskan ticket — silakan assign ke anggota tim / kerjakan sendiri:`, `📌 *Project :* ${newTicket.project_name}`, `⚠️ *Issue   :* ${newTicket.issue_case}`, "━━━━━━━━━━━━━━━━━━", `🔗 ${appLink()}`].join("\n");
            await sendWANotif({ type: "reminder_wa", event: "ticket.routed_supervisor", target: supUser.phone_number, message: waMsg });
          }
        } catch { }
      }

      // Kirim WA ke handler jika ticket langsung di-assign ke anggota tim (bukan self/route)
      if (resolvedAssignName && rawAssign !== "SELF") {
        setLoadingMessage("Ticket sedang diproses...");
        try {
          const eTM = teamMembers.find(m => m.name === resolvedAssignName);
          const { data: handlerInfo } = eTM?.username ? await supabase
            .from("users").select("phone_number, full_name")
            .eq("username", eTM.username).maybeSingle() : { data: null };
          if (handlerInfo?.phone_number) {
            const waMsg = [
              "🎫 *Ticket Baru Assigned ke Kamu*",
              "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
              `Halo *${handlerInfo.full_name}*, ada ticket baru untukmu:`,
              "",
              `📌 *Project :* ${newTicket.project_name}`,
              `⚠️ *Issue   :* ${newTicket.issue_case}`,
              `📝 *Deskripsi:* ${newTicket.description || "-"}`,
              `🔢 *SN Unit :* ${newTicket.sn_unit || "-"}`,
              `📱 *Customer:* ${newTicket.customer_phone || "-"}`,
              `👤 *Sales   :* ${newTicket.sales_name || "-"}`,
              `📅 *Tanggal :* ${newTicket.date || "-"}`,
              "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
              "Mohon segera ditangani. Semangat! 💪",
              `🔗 ${appLink()}`,
            ].join("\n");
            await sendWANotif({ type: "reminder_wa", event: "ticket.assigned", target: handlerInfo.phone_number, message: waMsg });
          }
        } catch (err: any) {
          console.warn('[ticket] WA to handler (new ticket) failed:', err?.message);
          notify('error', 'WA ke handler gagal dikirim. Ticket berhasil disimpan.');
        }
      }

      setNewTicket({
        project_name: "", address: "", customer_phone: "", sales_name: "", sales_division: "", sales_user_id: null, sn_unit: "", product: "", issue_case: "", description: "", assign_name: "", date: getJakartaDateString(), status: "Pending", current_team: "Team PTS IVP", photo: null, reminder_id: null, brand: undefined
      });
      setShowNewTicket(false);
      await fetchData();
      const successMsg = isElevated ? "✅ Ticket saved successfully!" : "✅ Ticket submitted! Waiting for Admin approval.";
      setLoadingMessage(successMsg);
      setTimeout(() => { setShowLoadingPopup(false); setUploading(false); }, 1500);
    } catch (err: any) {
      setShowLoadingPopup(false);
      setUploading(false);
      notify("error", "Error: " + err.message);
    }
  };
  return { createTicket };
}
