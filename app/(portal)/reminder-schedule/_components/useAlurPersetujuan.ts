'use client';

/** useAlurPersetujuan - dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { type JadwalRequest } from './RequestJadwalModal';
import { supabase } from '@/lib/supabase';
import { setSession } from '@/lib/auth';
import { Reminder, TeamUser, GuestUser, formatDate, newBatchId, sendFonnteWA, type SupervisorCandidate, DEFAULT_REQUEST_NOTE, cleanRequestNotes, fetchManagerTargets } from './shared';
import { resolveBrandInternals, type Brand } from '@/lib/brand-routing';
import { idDariNama, tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';
import { adalahKategoriInsentif } from '@/lib/incentive-scheme';
import { triggersProjectProgress, type ReminderSnapshot } from '@/lib/project-progress-sync';
import { logAudit } from '@/lib/audit';
import { penerimaAdminBernomor } from '@/lib/penerima-admin';
import { appLink } from '@/lib/app-url';
import { notifyReminderApproved, createNotification, createNotificationForAdmins } from '@/lib/notifications';
import { usePersetujuanAdmin } from './usePersetujuanAdmin';
import { useTinjauInternal } from './useTinjauInternal';
import { useRequestJadwal } from './useRequestJadwal';

export interface AlurPersetujuanKonteks {
  adminRejectReason: string;
  adminRejectTarget: Reminder | null;
  approveAssignTo: string;
  approveBatchSiblings: Reminder[];
  approveDate: string;
  approveStart: string;
  approveSupervisors: SupervisorCandidate[];
  approveTarget: Reminder | null;
  approveTarget2: string;
  approveTime: string;
  currentUser: TeamUser | null;
  fetchRemindersQuiet: (user?: TeamUser | null) => Promise<void>;
  guestUsers: GuestUser[];
  internalRejectReason: string;
  internalRejectTarget: Reminder | null;
  notify: (type: "success" | "error", msg: string) => void;
  proyekLamaTerpilih: Reminder[] | null;
  resolveGrupInsentif: (sumber: Reminder[]) => Promise<string>;
  setAdminRejectReason: import("react").Dispatch<import("react").SetStateAction<string>>;
  setAdminRejectSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setAdminRejectTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setApproveAssignTo: import("react").Dispatch<import("react").SetStateAction<string>>;
  setApproveBatchSiblings: import("react").Dispatch<import("react").SetStateAction<Reminder[]>>;
  setApproveDate: import("react").Dispatch<import("react").SetStateAction<string>>;
  setApproveRouteSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setApproveSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setApproveSupervisors: import("react").Dispatch<import("react").SetStateAction<SupervisorCandidate[]>>;
  setApproveTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setApproveTime: import("react").Dispatch<import("react").SetStateAction<string>>;
  setCurrentUser: import("react").Dispatch<import("react").SetStateAction<TeamUser | null>>;
  setDetailReminder: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setInternalApproveSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setInternalApproveTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setInternalRejectReason: import("react").Dispatch<import("react").SetStateAction<string>>;
  setInternalRejectSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setInternalRejectTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setProyekLamaTerpilih: import("react").Dispatch<import("react").SetStateAction<Reminder[] | null>>;
  setSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowRequestModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSupervisorAssignBatchSiblings: import("react").Dispatch<import("react").SetStateAction<Reminder[]>>;
  setSupervisorAssignSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSupervisorAssignTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setSupervisorAssignTo: import("react").Dispatch<import("react").SetStateAction<string>>;
  supervisorAssignBatchSiblings: Reminder[];
  supervisorAssignTarget: Reminder | null;
  supervisorAssignTo: string;
  syncNewRemindersToProgress: (rows: ReminderSnapshot[]) => Promise<void>;
  teamUsers: TeamUser[];
}

export function useAlurPersetujuan(k: AlurPersetujuanKonteks) {
  const { adminRejectReason, adminRejectTarget, approveAssignTo, approveBatchSiblings, approveDate, approveStart, approveSupervisors, approveTarget, approveTarget2, approveTime, currentUser, fetchRemindersQuiet, guestUsers, internalRejectReason, internalRejectTarget, notify, proyekLamaTerpilih, resolveGrupInsentif, setAdminRejectReason, setAdminRejectSaving, setAdminRejectTarget, setApproveAssignTo, setApproveBatchSiblings, setApproveDate, setApproveRouteSaving, setApproveSaving, setApproveSupervisors, setApproveTarget, setApproveTime, setCurrentUser, setDetailReminder, setInternalApproveSaving, setInternalApproveTarget, setInternalRejectReason, setInternalRejectSaving, setInternalRejectTarget, setProyekLamaTerpilih, setSaving, setShowRequestModal, setSupervisorAssignBatchSiblings, setSupervisorAssignSaving, setSupervisorAssignTarget, setSupervisorAssignTo, supervisorAssignBatchSiblings, supervisorAssignTarget, supervisorAssignTo, syncNewRemindersToProgress, teamUsers } = k;
  const { handleRequestJadwal } = useRequestJadwal({ currentUser, fetchRemindersQuiet, guestUsers, notify, proyekLamaTerpilih, resolveGrupInsentif, setCurrentUser, setProyekLamaTerpilih, setShowRequestModal });

  // Handler: Sales Internal approve & teruskan ke Admin/Manager
  const { handleInternalApprove, handleInternalReject, handleInternalRejectConfirm, handleAdminReject, handleAdminRejectConfirm } = useTinjauInternal({ adminRejectReason, adminRejectTarget, currentUser, fetchRemindersQuiet, internalRejectReason, internalRejectTarget, notify, setAdminRejectReason, setAdminRejectSaving, setAdminRejectTarget, setInternalApproveSaving, setInternalApproveTarget, setInternalRejectReason, setInternalRejectSaving, setInternalRejectTarget, setSaving });

  // Handler: Admin/Manager approve  route ke Supervisor tim (by tipe produk)
  // Jalur UTAMA (bukan assign manual langsung). Supervisor tim yang cocok dgn
  // product_type (product_team_map, Fase 1) yang WA dan harus assign lanjut ke
  // anggota timnya / diri sendiri. "LED & LCD" bisa kena >1 tim -> semua di-WA,
  // yang assign duluan yang eksekusi (1 tim, sesuai keputusan desain).
  const { handleApproveRoute, handleApproveAssign } = usePersetujuanAdmin({ approveAssignTo, approveBatchSiblings, approveDate, approveStart, approveSupervisors, approveTarget, approveTarget2, approveTime, currentUser, fetchRemindersQuiet, notify, setApproveAssignTo, setApproveBatchSiblings, setApproveDate, setApproveRouteSaving, setApproveSaving, setApproveSupervisors, setApproveTarget, setApproveTime, setDetailReminder, syncNewRemindersToProgress, teamUsers });

  // Handler: Supervisor assign ke anggota tim ATAU diri sendiri
  // Tim penuh/sibuk = keputusan manual Supervisor (tidak ada hitungan kapasitas
  // otomatis) - dia yang menilai, tinggal pilih "Saya kerjakan sendiri".
  const openSupervisorAssign = (r: Reminder, group: Reminder[]) => {
    setSupervisorAssignTarget(r);
    setSupervisorAssignBatchSiblings(group.filter(gr => gr.id !== r.id && gr.batch_id === r.batch_id && !gr.assigned_to));
    setSupervisorAssignTo('');
  };

  const handleSupervisorAssignConfirm = async () => {
    const r = supervisorAssignTarget;
    if (!r || !supervisorAssignTo || !currentUser) return;
    const isSelf = supervisorAssignTo === 'SELF';
    const assignee = isSelf ? currentUser : teamUsers.find(u => u.username === supervisorAssignTo);
    if (!assignee) return;
    setSupervisorAssignSaving(true);

    const patchSup = {
      assigned_to: assignee.username,
      assign_name: assignee.full_name,
      assign_user_id: assignee.id,
      routing_status: null,
    };
    const { error, data } = await cobaIdentitas(async pakaiUuid => await supabase.from('reminders')
      .update(pakaiUuid ? patchSup : tanpaIdentitas(patchSup)).eq('id', r.id).select('id'));
    if (error) { notify('error', 'Gagal assign: ' + error.message); setSupervisorAssignSaving(false); return; }
    if (!data || data.length === 0) { notify('error', 'Gagal assign: perubahan ditolak sistem (RLS). Hubungi admin.'); setSupervisorAssignSaving(false); return; }

    if (supervisorAssignBatchSiblings.length > 0) {
      const siblingResults: { error: { message: string } | null }[] = await Promise.all(supervisorAssignBatchSiblings.map(sib =>
        cobaIdentitas(async pakaiUuid => await supabase.from('reminders')
          .update(pakaiUuid ? patchSup : tanpaIdentitas(patchSup)).eq('id', sib.id))
      ));
      const siblingErr = siblingResults.find(res => res.error)?.error ?? null;
      if (siblingErr) notify('error', 'Sebagian tanggal di batch gagal ter-assign: ' + siblingErr.message);
    }

    const allDates = Array.from(new Set([r.due_date, ...supervisorAssignBatchSiblings.map(s => s.due_date)])).sort();
    const jadwalLine = allDates.length > 1
      ? `🕐 *Jadwal (${allDates.length} hari):* ${allDates.map(d => formatDate(d)).join(', ')}${r.due_time ? ' · ' + r.due_time : ''}`
      : `🕐 Jadwal: *${formatDate(r.due_date)}${r.due_time ? ' · ' + r.due_time : ''}*`;

    notify('success', isSelf ? 'Kamu jadi PIC proyek ini!' : `Berhasil di-assign ke ${assignee.full_name}!`);
    logAudit({ user_id: currentUser.id, user_name: currentUser.full_name, action: 'assign', module: 'reminder', target_id: r.id, target_name: r.project_name, new_value: assignee.full_name }).catch(() => {});
    setSupervisorAssignTarget(null); setSupervisorAssignBatchSiblings([]); setSupervisorAssignTo('');
    fetchRemindersQuiet();

    // Badge in-app - TETAP dikirim walau Supervisor kerjakan sendiri (isSelf),
    // supaya ada catatan/link yang bisa dibuka lagi nanti, sama seperti assign
    // ke anggota lain. WA ke diri sendiri tetap dilewati (tidak berguna).
    createNotification({
      user_id: assignee.id, type: 'reminder',
      title: isSelf ? '🗓️ Kamu jadi PIC jadwal ini' : '🗓️ Jadwal di-assign ke kamu',
      body: `${r.project_name} — ${r.category}`,
      action_url: '/reminder-schedule', ref_id: r.id,
      created_by: currentUser.full_name,
    }).catch(() => {});
    if (!isSelf && assignee.phone_number) {
      const msg =
        `🗓️ *JADWAL BARU — PTS IVP*\n\n` +
        `Halo *${assignee.full_name}*, kamu di-assign Supervisor *${currentUser.full_name}* untuk jadwal:\n\n` +
        `*Nama Project: ${r.project_name}*\n` +
        `🏷️ Kategori: ${r.category}\n` +
        `📦 Product: ${r.product || '-'}\n` +
        `📍 Lokasi: ${r.address || '-'}\n` +
        `${jadwalLine}\n\n` +
        `jangan lupa peralatan & Semangat💪🏼\n` +
        `🔗 ${appLink()}`;
      await sendFonnteWA(assignee.phone_number, msg, undefined, 'reminder.assigned');
    }

    // WA ke sales requester - kasih tau siapa yg akan menangani.
    try {
      const { data: salesUser } = await supabase.from('users').select('phone_number, full_name').eq('full_name', r.sales_name).eq('role', 'guest').maybeSingle();
      if (salesUser?.phone_number) {
        const msg = `✅ *JADWAL DI-ASSIGN — PTS IVP*\n\nHalo *${salesUser.full_name}*! Request kamu untuk *${r.project_name}* akan ditangani oleh *${assignee.full_name}*.\n${jadwalLine}`;
        await sendFonnteWA(salesUser.phone_number, msg);
      }
    } catch { }
    setSupervisorAssignSaving(false);
  };
  return { handleRequestJadwal, handleInternalApprove, handleInternalReject, handleInternalRejectConfirm, handleAdminReject, handleAdminRejectConfirm, handleApproveRoute, handleApproveAssign, openSupervisorAssign, handleSupervisorAssignConfirm };
}
