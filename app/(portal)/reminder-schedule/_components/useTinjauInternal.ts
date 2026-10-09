'use client';

/** useTinjauInternal - dipecah dari app/(portal)/reminder-schedule/_components/useAlurPersetujuan.ts (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
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
    // Brand BOTH = 2 reviewer (MVI + IVP), WAJIB keduanya approve baru lanjut ke Admin.
    const isSecondReviewer = !!r.internal_sales_id_2 && r.internal_sales_id_2 === currentUser?.id;
    const patch: Record<string, unknown> = {};
    if (isSecondReviewer) patch.internal_approved_at_2 = now;
    else { patch.internal_approved_by = currentUser?.id ?? null; patch.internal_approved_at = now; }
    // Sudah lengkap kalau: bukan BOTH (1 reviewer), ATAU kedua approve sudah terisi.
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

    /*
      Kabar ke Manager/Admin bahwa request sudah lolos review Sales Internal.

      CATATAN RIWAYAT: tahap ini pernah SENGAJA dibuat badge in-app saja - WA
      "REQUEST LOLOS REVIEW" dihapus atas permintaan user waktu itu, dengan
      alasan cukup badge di sini dan WA hanya di hasil akhir. Sekarang dibalik
      lagi, juga atas permintaan user: tahap ini adalah giliran Admin/Manager
      bertindak, dan badge yang hanya terlihat kalau seseorang kebetulan
      membuka platform bukan pemberitahuan - request bisa mengendap berhari-
      hari tanpa ada yang tahu gilirannya sudah tiba.

      Penerimanya fetchManagerTargets(): pemegang Full Access (Manager PTS IVP)
      plus manager yang disetel di app_settings - BUKAN semua yang berjabatan
      Manager, supaya Manager PTS UMP yang orang luar tidak ikut terseret.
    */
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
        //  sendFonnteWA mengirim ke WhatsApp DAN Telegram sekaligus
        //  (lihat lib/wa.ts) - tidak perlu dipanggil dua kali.
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

  // Handler: Sales Internal Tolak request (wajib isi alasan)
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

    // WA ke Sales requester - kasih tau ditolak + alasannya.
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

    // WA ke Sales requester - kasih tau ditolak + alasannya (pola sama dengan
    // penolakan tahap internal_review).
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
