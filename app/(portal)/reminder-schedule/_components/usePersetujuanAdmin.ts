'use client';

/** usePersetujuanAdmin - dipecah dari app/(portal)/reminder-schedule/_components/useAlurPersetujuan.ts (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { Reminder, TeamUser, formatDate, sendFonnteWA, type SupervisorCandidate, cleanRequestNotes } from './shared';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { appLink } from '@/lib/app-url';
import { notifyReminderApproved, createNotification } from '@/lib/notifications';
import { triggersProjectProgress, type ReminderSnapshot } from '@/lib/project-progress-sync';
import { tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';

export interface PersetujuanAdminKonteks {
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
  notify: (type: "success" | "error", msg: string) => void;
  setApproveAssignTo: import("react").Dispatch<import("react").SetStateAction<string>>;
  setApproveBatchSiblings: import("react").Dispatch<import("react").SetStateAction<Reminder[]>>;
  setApproveDate: import("react").Dispatch<import("react").SetStateAction<string>>;
  setApproveRouteSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setApproveSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setApproveSupervisors: import("react").Dispatch<import("react").SetStateAction<SupervisorCandidate[]>>;
  setApproveTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setApproveTime: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDetailReminder: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  syncNewRemindersToProgress: (rows: ReminderSnapshot[]) => Promise<void>;
  teamUsers: TeamUser[];
}

export function usePersetujuanAdmin(k: PersetujuanAdminKonteks) {
  const { approveAssignTo, approveBatchSiblings, approveDate, approveStart, approveSupervisors, approveTarget, approveTarget2, approveTime, currentUser, fetchRemindersQuiet, notify, setApproveAssignTo, setApproveBatchSiblings, setApproveDate, setApproveRouteSaving, setApproveSaving, setApproveSupervisors, setApproveTarget, setApproveTime, setDetailReminder, syncNewRemindersToProgress, teamUsers } = k;
  const handleApproveRoute = async () => {
    if (!approveTarget || approveSupervisors.length === 0) return;
    setApproveRouteSaving(true);

    const cleanNotes = cleanRequestNotes(approveTarget.notes);
    const primarySupervisor = approveSupervisors[0];
    const { error } = await supabase.from('reminders').update({
      routing_status: 'supervisor_assign',
      assigned_supervisor_id: primarySupervisor.id,
      due_date: approveDate || approveTarget.due_date,
      due_time: approveTime || approveTarget.due_time,
      notes: cleanNotes,
    }).eq('id', approveTarget.id);

    if (error) { notify('error', 'Gagal route ke supervisor: ' + error.message); setApproveRouteSaving(false); return; }

    if (approveBatchSiblings.length > 0) {
      const siblingResults: { error: { message: string } | null }[] = await Promise.all(approveBatchSiblings.map(sib => {
        const sibNotes = cleanRequestNotes(sib.notes);
        const patch: Record<string, unknown> = { routing_status: 'supervisor_assign', assigned_supervisor_id: primarySupervisor.id, notes: sibNotes };
        if (approveTime) patch.due_time = approveTime;
        return supabase.from('reminders').update(patch).eq('id', sib.id);
      }));
      const siblingErr = siblingResults.find(res => res.error)?.error ?? null;
      if (siblingErr) notify('error', 'Sebagian tanggal di batch gagal ter-route: ' + siblingErr.message);
    }

    const allApprovedDates = Array.from(new Set([approveDate || approveTarget.due_date, ...approveBatchSiblings.map(s => s.due_date)])).sort();
    const jadwalLineRoute = allApprovedDates.length > 1
      ? `🕐 *Jadwal (${allApprovedDates.length} hari):* ${allApprovedDates.map(d => formatDate(d)).join(', ')}${approveTime ? ' · ' + approveTime : ''}`
      : `🕐 Jadwal: *${formatDate(approveDate || approveTarget.due_date)}${(approveTime || approveTarget.due_time) ? ' · ' + (approveTime || approveTarget.due_time) : ''}*`;

    const teamLabel = Array.from(new Set(approveSupervisors.map(s => s.team_type))).join(' & ');
    notify('success', `Request diarahkan ke ${teamLabel} (Supervisor: ${approveSupervisors.map(s => s.full_name).join(', ')})!`);
    logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'approve', module: 'reminder', target_id: approveTarget.id, target_name: approveTarget.project_name, notes: `Routed to supervisor: ${approveSupervisors.map(s => s.full_name).join(', ')}` }).catch(() => {});

    // WA ke SEMUA supervisor yang cocok - actionable, wajib assign lanjut.
    const supMsg =
      `🎯 *REQUEST PERLU DI-ASSIGN — ${teamLabel}*\n\n` +
      `Request dari Sales *${approveTarget.sales_name}* sudah disetujui Admin/Manager, silakan assign ke anggota tim kamu atau kerjakan sendiri:\n\n` +
      `📋 *Project: ${approveTarget.project_name}*\n` +
      `🏷️ Kategori: ${approveTarget.category}\n` +
      `📦 Product: ${approveTarget.product || '-'}\n` +
      `📍 Lokasi: ${approveTarget.address || '-'}\n` +
      `${jadwalLineRoute}\n\n` +
      `🔗 ${appLink()}`;
    for (const sup of approveSupervisors) {
      if (sup.phone_number) await sendFonnteWA(sup.phone_number, supMsg, undefined, 'reminder.routed_supervisor');
      createNotification({
        user_id: sup.id,
        type: 'reminder',
        title: `🎯 Request perlu kamu assign`,
        body: `${approveTarget.sales_name} — ${approveTarget.project_name}`,
        action_url: '/reminder-schedule',
        ref_id: approveTarget.id,
        created_by: currentUser?.full_name ?? '',
      }).catch(() => {});
    }

    // WA ke sales requester - kasih tau statusnya diteruskan ke tim.
    try {
      const { data: salesUser } = await supabase.from('users').select('phone_number, full_name').eq('full_name', approveTarget.sales_name).eq('role', 'guest').maybeSingle();
      if (salesUser?.phone_number) {
        const msg = `✅ *REQUEST DISETUJUI — SEDANG DIARAHKAN KE TIM*\n\nHalo *${salesUser.full_name}*! Request kamu untuk *${approveTarget.project_name}* sudah disetujui dan sedang diarahkan ke tim *${teamLabel}*. Kamu akan diberi tahu begitu ada yang di-assign menangani.`;
        await sendFonnteWA(salesUser.phone_number, msg);
      }
    } catch { }

    setApproveTarget(null); setApproveBatchSiblings([]); setApproveSupervisors([]); setApproveDate(''); setApproveTime('');
    setApproveRouteSaving(false);
    fetchRemindersQuiet();
  };

  // Handler: Admin Approve & Assign request dari Sales
  const handleApproveAssign = async () => {
    if (!approveTarget || !approveAssignTo) return;
    // 'SELF_MANAGER' = Admin/Manager kerjakan sendiri (mis. Supervisor & tim
    // sama-sama penuh). Akun admin sengaja dikecualikan dari teamUsers, jadi
    // resolve langsung dari currentUser supaya tetap bisa dipilih.
    const assignee = approveAssignTo === 'SELF_MANAGER' ? currentUser : teamUsers.find(u => u.username === approveAssignTo);
    if (!assignee) return;
    setApproveSaving(true);

    // Update reminder: assign ke team, clear REQUEST SALES note prefix.
    // Kalau ini bagian dari batch multi-tanggal (request Sales beberapa hari
    // sekaligus), semua tanggal lain di batch ikut di-approve & di-assign ke
    // handler yang sama - tiap tanggal tetap pakai due_date-nya sendiri
    // (hanya due_date milik approveTarget yang bisa di-override via field Tanggal).
    const cleanNotes = cleanRequestNotes(approveTarget.notes);
    const patchApprove = {
      assigned_to: assignee.username,
      assign_name: assignee.full_name,
      assign_user_id: assignee.id,
      due_date: approveDate || approveTarget.due_date,
      due_time: approveTime || approveTarget.due_time,
      notes: cleanNotes,
      routing_status: null,
      ...(triggersProjectProgress(approveTarget.category) ? {
        progress_start_date:  approveStart   || null,
        progress_target_date: approveTarget2 || null,
      } : {}),
    };
    const { error, data } = await cobaIdentitas(async pakaiUuid => await supabase.from('reminders')
      .update(pakaiUuid ? patchApprove : tanpaIdentitas(patchApprove)).eq('id', approveTarget.id).select('id'));

    if (error || !data || data.length === 0) {
      notify('error', error ? 'Gagal approve: ' + error.message : 'Gagal approve: perubahan ditolak sistem (RLS). Hubungi admin.');
      setApproveSaving(false);
      return;
    }

    // Draft Project Progress dibuat DI SINI, bukan saat request diajukan
    // Request Sales berstatus pending sampai di-assign; kalau draft dibuat sejak
    // pengajuan, request yang ditolak akan meninggalkan lokasi kosong yang harus
    // dibersihkan manual. Saat assign, pekerjaannya sudah pasti berjalan.
    //
    // Sengaja HANYA approveTarget, bukan sibling-nya: satu batch multi-tanggal
    // adalah lokasi yang SAMA dikunjungi beberapa hari, bukan beberapa lokasi.
    // Menyertakan sibling akan melahirkan lokasi kembar sebanyak jumlah hari.
    void syncNewRemindersToProgress([{
      id:                   approveTarget.id,
      project_name:         approveTarget.project_name,
      address:              approveTarget.address,
      sales_name:           approveTarget.sales_name,
      sales_division:       approveTarget.sales_division,
      assign_name:          assignee.full_name,
      due_date:             approveDate || approveTarget.due_date,
      category:             approveTarget.category,
      progress_start_date:  approveStart   || null,
      progress_target_date: approveTarget2 || null,
    }]);

    if (approveBatchSiblings.length > 0) {
      const siblingResults: { error: { message: string } | null }[] = await Promise.all(approveBatchSiblings.map(sib => {
        const sibNotes = cleanRequestNotes(sib.notes);
        const patch: Record<string, unknown> = {
          assigned_to: assignee.username,
          assign_name: assignee.full_name,
          assign_user_id: assignee.id,
          notes: sibNotes,
          routing_status: null,
        };
        if (approveTime) patch.due_time = approveTime;
        return cobaIdentitas(async pakaiUuid => await supabase.from('reminders')
          .update(pakaiUuid ? patch : tanpaIdentitas(patch)).eq('id', sib.id));
      }));
      const siblingErr = siblingResults.find(res => res.error)?.error ?? null;
      if (siblingErr) notify('error', 'Sebagian tanggal di batch gagal ter-assign: ' + siblingErr.message);
    }

    const allApprovedDates = Array.from(new Set([approveDate || approveTarget.due_date, ...approveBatchSiblings.map(s => s.due_date)])).sort();
    const jadwalLineApprove = allApprovedDates.length > 1
      ? `🕐 *Jadwal (${allApprovedDates.length} hari):* ${allApprovedDates.map(d => formatDate(d)).join(', ')}${approveTime ? ' · ' + approveTime : ''}`
      : `🕐 Jadwal: *${formatDate(approveDate || approveTarget.due_date)}${(approveTime || approveTarget.due_time) ? ' · ' + (approveTime || approveTarget.due_time) : ''}*`;

    notify('success', `Request disetujui & di-assign ke ${assignee.full_name}${allApprovedDates.length > 1 ? ` (${allApprovedDates.length} hari)` : ''}!`);

    // WA ke team yang di-assign
    if (assignee.phone_number) {
      const msg =
        `🗓️ *JADWAL BARU — PTS IVP*

` +
        `Halo *${assignee.full_name}*, kamu mendapat jadwal baru dari request Sales:

` +
        `*Nama Project: ${approveTarget.project_name}*
` +
        `🏷️ Kategori: ${approveTarget.category}
` +
        `📦 Product: ${approveTarget.product || '-'}
` +
        `📍 Lokasi: ${approveTarget.address || '-'}
` +
        `👤 Sales: ${approveTarget.sales_name}${approveTarget.sales_division ? ' - ' + approveTarget.sales_division : ''}
` +
        `${jadwalLineApprove}
` +
        (approveTarget.pic_name ? `🙋 PIC: ${approveTarget.pic_name}${approveTarget.pic_phone ? ' - ' + approveTarget.pic_phone : ''}
` : '') +
        `
jangan lupa peralatan & Semangat💪🏼
` +
        `🔗 ${appLink()}`;
      await sendFonnteWA(assignee.phone_number, msg, undefined, 'reminder.assigned');
    }

    // WA ke sales yang request - konfirmasi approved
    try {
      const { data: salesUser } = await supabase
        .from('users').select('phone_number, full_name')
        .eq('full_name', approveTarget.sales_name).eq('role', 'guest').maybeSingle();
      if (salesUser?.phone_number) {
        const salesMsg =
          `✅ *REQUEST JADWAL DISETUJUI — PTS IVP*

` +
          `Halo *${salesUser.full_name}*!

` +
          `Request jadwal kamu untuk project:
` +
          `📋 *${approveTarget.project_name}*
` +
          `🏷️ Kategori: ${approveTarget.category}
` +
          `📍 ${approveTarget.address || '-'}

` +
          `telah *disetujui* dan akan dikerjakan oleh:
` +
          `👷 *${assignee.full_name}*
` +
          `${jadwalLineApprove}

` +
          `Terima kasih! 🙏
` +
          `🔗 ${appLink()}`;
        await sendFonnteWA(salesUser.phone_number, salesMsg);
      }
    } catch { /* ignore WA error */ }

    // In-app notification to the sales requester
    try {
      if (approveTarget.notes?.includes('[REQUEST SALES]')) {
        // Find the sales user by name to get their id
        const { data: salesUserFull } = await supabase
          .from('users').select('id, full_name')
          .eq('full_name', approveTarget.sales_name)
          .in('role', ['guest', 'sales']).maybeSingle();
        if (salesUserFull?.id) {
          notifyReminderApproved(
            salesUserFull.id, salesUserFull.full_name,
            approveTarget.id, approveTarget.project_name,
            approveDate || approveTarget.due_date,
            currentUser?.full_name ?? 'Admin'
          ).catch(() => {});
        }
      }
    } catch { /* ignore */ }

    // Audit log
    logAudit({
      user_id: currentUser?.id ?? '',
      user_name: currentUser?.full_name ?? '',
      action: 'approve',
      module: 'reminder',
      target_id: approveTarget.id,
      target_name: approveTarget.project_name,
      new_value: assignee.full_name,
    }).catch(() => {});

    setApproveTarget(null);
    setApproveBatchSiblings([]);
    setApproveAssignTo('');
    setApproveDate('');
    setApproveTime('');
    setApproveSaving(false);
    setDetailReminder(null);
    fetchRemindersQuiet();
  };
  return { handleApproveRoute, handleApproveAssign };
}
