'use client';

import type { TablesUpdate } from '@/types/database';
import { Reminder, TeamUser, sendFonnteWA, fetchManagerTargets } from './shared';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { penerimaAdminBernomor } from '@/lib/penerima-admin';
import { appLink } from '@/lib/app-url';
import { createNotification } from '@/lib/notifications';

export interface TinjauInternalKonteks {
  adminRejectReason: string;
  adminRejectTarget: Reminder | null;
  currentUser: TeamUser | null;
  fetchRemindersQuiet: (user?: TeamUser | null) => Promise<void>;
  internalRejectReason: string;
  internalRejectTarget: Reminder | null;
  notify: (type: "success" | "error", msg: string) => void;
  setAdminRejectReason: import("react").Dispatch<import("react").SetStateAction<string>>;
  setAdminRejectSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setAdminRejectTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setInternalApproveSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setInternalApproveTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setInternalRejectReason: import("react").Dispatch<import("react").SetStateAction<string>>;
  setInternalRejectSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setInternalRejectTarget: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
}

export function useTinjauInternal(k: TinjauInternalKonteks) {
  const { adminRejectReason, adminRejectTarget, currentUser, fetchRemindersQuiet, internalRejectReason, internalRejectTarget, notify, setAdminRejectReason, setAdminRejectSaving, setAdminRejectTarget, setInternalApproveSaving, setInternalApproveTarget, setInternalRejectReason, setInternalRejectSaving, setInternalRejectTarget, setSaving } = k;
  const handleInternalApprove = async (r: Reminder) => {
    setSaving(true);
    setInternalApproveSaving(true);
    const now = new Date().toISOString();
    const isSecondReviewer = !!r.internal_sales_id_2 && r.internal_sales_id_2 === currentUser?.id;
    const patch: TablesUpdate<'reminders'> = {};
    if (isSecondReviewer) patch.internal_approved_at_2 = now;
    else { patch.internal_approved_by = currentUser?.id ?? null; patch.internal_approved_at = now; }
    const needBoth = !!r.internal_sales_id_2;
    const otherDone = isSecondReviewer ? !!r.internal_approved_at : !!r.internal_approved_at_2;
    const allApproved = !needBoth || otherDone;
    if (allApproved) patch.routing_status = 'admin_review';
    const { error } = await supabase.from('reminders').update(patch).eq('id', r.id);
    if (error) { notify('error', 'Gagal approve: ' + error.message); setSaving(false); setInternalApproveSaving(false); return; }
    setInternalApproveSaving(false);
    setInternalApproveTarget(null);
    if (!allApproved) {
      notify('success', 'Approve kamu tersimpan. Menunggu approve Sales Internal brand satunya (Kedua Brand).');
      logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'approve', module: 'reminder', target_id: r.id, target_name: r.project_name, notes: 'Internal review approved (menunggu reviewer kedua)' }).catch(() => {});
      fetchRemindersQuiet();
      setSaving(false);
      return;
    }
    notify('success', 'Request diteruskan ke Admin/Manager!');
    logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'approve', module: 'reminder', target_id: r.id, target_name: r.project_name, notes: 'Internal review approved' }).catch(() => {});
    fetchRemindersQuiet();

    try {
      const managerTargets = await fetchManagerTargets();
      const targets: { id: string; phone_number: string | null; full_name: string }[] = [...managerTargets];
      if (targets.length === 0) {
        const admins = await penerimaAdminBernomor();
        targets.push(...(admins ?? []));
      }
      const pesanLolos = [
        '✅ *REQUEST JADWAL LOLOS REVIEW SALES INTERNAL*',
        '━━━━━━━━━━━━━━━━━━',
        `👤 *Sales   :* ${r.sales_name}`,
        `📌 *Project :* ${r.project_name}`,
        `🏷️ *Kategori:* ${r.category ?? '-'}`,
        `📍 *Lokasi  :* ${r.address || '-'}`,
        `✍️ *Direview:* ${currentUser?.full_name ?? '-'}`,
        '━━━━━━━━━━━━━━━━━━',
        'Giliran kamu — silakan approve & tentukan pengerjaannya.',
        `🔗 ${appLink()}`,
      ].join('\n');

      for (const t of targets) {
        if (t.phone_number) void sendFonnteWA(t.phone_number, pesanLolos, undefined, 'reminder.new_schedule');
        createNotification({
          user_id: t.id,
          type: 'reminder',
          title: `✅ Request lolos review — perlu approval kamu`,
          body: `${r.sales_name} — ${r.project_name}`,
          action_url: '/reminder-schedule',
          ref_id: r.id,
          created_by: currentUser?.full_name ?? '',
        }).catch(() => {});
      }
    } catch { }
    setSaving(false);
  };

  const handleInternalReject = (r: Reminder) => { setInternalRejectReason(''); setInternalRejectTarget(r); };

  const handleInternalRejectConfirm = async () => {
    const r = internalRejectTarget;
    if (!r) return;
    if (!internalRejectReason.trim()) { notify('error', 'Alasan penolakan wajib diisi!'); return; }
    setInternalRejectSaving(true);
    const { error } = await supabase.from('reminders').update({
      status: 'cancelled',
      rejection_reason: internalRejectReason.trim(),
    }).eq('id', r.id);
    if (error) { notify('error', 'Gagal menolak: ' + error.message); setInternalRejectSaving(false); return; }
    notify('success', 'Request ditolak.');
    logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'reject', module: 'reminder', target_id: r.id, target_name: r.project_name, notes: internalRejectReason.trim() }).catch(() => {});
    setInternalRejectTarget(null);
    fetchRemindersQuiet();

    try {
      const { data: salesUser } = await supabase.from('users').select('phone_number, full_name').eq('full_name', r.sales_name).eq('role', 'guest').maybeSingle();
      if (salesUser?.phone_number) {
        const msg =
          `❌ *REQUEST JADWAL DITOLAK*\n\n` +
          `Halo *${salesUser.full_name}*, request kamu untuk *${r.project_name}* ditolak oleh *${currentUser?.full_name}* (Sales Internal).\n\n` +
          `📝 *Alasan:* ${internalRejectReason.trim()}\n\n` +
          `Silakan hubungi ${currentUser?.full_name} atau ajukan ulang jika diperlukan.`;
        await sendFonnteWA(salesUser.phone_number, msg);
      }
    } catch { }
    setInternalRejectSaving(false);
  };

  const handleAdminReject = (r: Reminder) => { setAdminRejectReason(''); setAdminRejectTarget(r); };

  const handleAdminRejectConfirm = async () => {
    const r = adminRejectTarget;
    if (!r) return;
    if (!adminRejectReason.trim()) { notify('error', 'Alasan penolakan wajib diisi!'); return; }
    setAdminRejectSaving(true);
    const { data: terubah, error } = await supabase.from('reminders').update({
      status: 'cancelled',
      rejection_reason: adminRejectReason.trim(),
    }).eq('id', r.id).select('id');
    if (error || !terubah || terubah.length === 0) {
      notify('error', error ? 'Gagal menolak: ' + error.message : 'Gagal menolak (akses ditolak database).');
      setAdminRejectSaving(false);
      return;
    }
    notify('success', 'Request ditolak.');
    logAudit({ user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '', action: 'reject', module: 'reminder', target_id: r.id, target_name: r.project_name, notes: adminRejectReason.trim() }).catch(() => {});
    setAdminRejectTarget(null);
    fetchRemindersQuiet();

    try {
      const { data: salesUser } = await supabase.from('users').select('phone_number, full_name').eq('full_name', r.sales_name).eq('role', 'guest').maybeSingle();
      if (salesUser?.phone_number) {
        const msg =
          `❌ *REQUEST JADWAL DITOLAK*\n\n` +
          `Halo *${salesUser.full_name}*, request kamu untuk *${r.project_name}* ditolak oleh *${currentUser?.full_name}*.\n\n` +
          `📝 *Alasan:* ${adminRejectReason.trim()}\n\n` +
          `Silakan ajukan ulang jika diperlukan.`;
        await sendFonnteWA(salesUser.phone_number, msg);
      }
    } catch { }
    setAdminRejectSaving(false);
  };
  return { handleInternalApprove, handleInternalReject, handleInternalRejectConfirm, handleAdminReject, handleAdminRejectConfirm };
}
