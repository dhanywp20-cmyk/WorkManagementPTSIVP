'use client';

/** useAksiPersetujuan - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { supabase } from '@/lib/supabase';
import { User, ProjectRequest, ProjectAttachment, sendWANotif } from './shared';
import { logAudit } from '@/lib/audit';
import { penerimaAdminBernomor } from '@/lib/penerima-admin';
import { appLink } from '@/lib/app-url';
import { notifyProjectStatusChange, createNotification } from '@/lib/notifications';
import { type ConfirmState } from '@/components/shared';

export interface AksiPersetujuanKonteks {
  currentUser: User;
  deleteModal: { open: boolean; req: ProjectRequest | null; };
  displayFileName: (fileName: string) => string;
  fetchMessages: (requestId: string) => Promise<void>;
  fetchRequests: () => Promise<void>;
  filteredRequests: ProjectRequest[];
  notify: (type: "success" | "error" | "info", msg: string) => void;
  rejectModal: { open: boolean; req: ProjectRequest | null; };
  rejectNote: string;
  rejectSaving: boolean;
  selectedIds: Set<string>;
  selectedRequest: ProjectRequest | null;
  setAssignModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; roomIdx: number; }>>;
  setAttachments: import("react").Dispatch<import("react").SetStateAction<ProjectAttachment[]>>;
  setBulkDeleting: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setConfirmState: import("react").Dispatch<import("react").SetStateAction<ConfirmState | null>>;
  setDeleteConfirmText: import("react").Dispatch<import("react").SetStateAction<string>>;
  setDeleteModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; }>>;
  setDeleting: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setInternalApproveSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setInternalApproveTarget: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
  setRejectModal: import("react").Dispatch<import("react").SetStateAction<{ open: boolean; req: ProjectRequest | null; }>>;
  setRejectNote: import("react").Dispatch<import("react").SetStateAction<string>>;
  setRejectSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setRequests: import("react").Dispatch<import("react").SetStateAction<ProjectRequest[]>>;
  setSelectedIds: import("react").Dispatch<import("react").SetStateAction<Set<string>>>;
  setSelectedRequest: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
  setShowDetailModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
}

export function useAksiPersetujuan(k: AksiPersetujuanKonteks) {
  const { currentUser, deleteModal, displayFileName, fetchMessages, fetchRequests, filteredRequests, notify, rejectModal, rejectNote, rejectSaving, selectedIds, selectedRequest, setAssignModal, setAttachments, setBulkDeleting, setConfirmState, setDeleteConfirmText, setDeleteModal, setDeleting, setInternalApproveSaving, setInternalApproveTarget, setRejectModal, setRejectNote, setRejectSaving, setRequests, setSelectedIds, setSelectedRequest, setShowDetailModal } = k;
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmState({
      message: `Hapus ${selectedIds.size} request terpilih?`,
      danger: true,
      confirmLabel: 'Hapus',
      onConfirm: async () => {
        setBulkDeleting(true);
        const { error } = await supabase.from('project_requests').delete().in('id', Array.from(selectedIds));
        if (!error) { setRequests(p => p.filter(r => !selectedIds.has(r.id))); setSelectedIds(new Set()); }
        else notify('error', 'Gagal hapus: ' + error.message);
        setBulkDeleting(false);
      },
    });
  };
  const toggleSelectId = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleSelectAll = () => setSelectedIds(
    prev => prev.size === filteredRequests.length ? new Set() : new Set(filteredRequests.map(r => r.id))
  );

  const handleApprove = async (req: ProjectRequest) => {
    // Hanya admin/superadmin yang bisa approve, selalu via AssignPTSModal untuk pilih PTS handler
    setAssignModal({ open: true, req, roomIdx: 0 });
  };

  // Handler: Sales Internal approve & teruskan ke Admin
  const handleInternalApproveProject = async (req: ProjectRequest) => {
    setInternalApproveSaving(true);
    try {
      await jalankanInternalApprove(req);
    } finally {
      setInternalApproveSaving(false);
      setInternalApproveTarget(null);
    }
  };

  const jalankanInternalApprove = async (req: ProjectRequest) => {
    const now = new Date().toISOString();
    // Brand BOTH = 2 reviewer (MVI + IVP), WAJIB keduanya approve baru lanjut ke Admin.
    const isSecondReviewer = !!req.internal_sales_id_2 && req.internal_sales_id_2 === currentUser.id;
    const patch: Record<string, unknown> = {};
    if (isSecondReviewer) patch.internal_approved_at_2 = now;
    else { patch.internal_approved_by = currentUser.id; patch.internal_approved_at = now; }
    const needBoth = !!req.internal_sales_id_2;
    const otherDone = isSecondReviewer ? !!req.internal_approved_at : !!req.internal_approved_at_2;
    const allApproved = !needBoth || otherDone;
    if (allApproved) patch.routing_status = 'admin_review';
    const { error } = await supabase.from('project_requests').update(patch).eq('id', req.id);
    if (error) { notify('error', 'Gagal approve: ' + error.message); return; }
    if (!allApproved) {
      notify('success', 'Approve kamu tersimpan. Menunggu approve Sales Internal brand satunya (Kedua Brand).');
      logAudit({ user_id: currentUser.id, user_name: currentUser.full_name, action: 'approve', module: 'project', target_id: req.id, target_name: req.project_name, notes: 'Internal review approved (menunggu reviewer kedua)' }).catch(() => {});
      fetchRequests();
      if (selectedRequest?.id === req.id) setSelectedRequest({ ...req, ...patch });
      return;
    }
    notify('success', 'Request diteruskan ke Admin!');
    logAudit({ user_id: currentUser.id, user_name: currentUser.full_name, action: 'approve', module: 'project', target_id: req.id, target_name: req.project_name, notes: 'Internal review approved' }).catch(() => {});
    fetchRequests();
    if (selectedRequest?.id === req.id) setSelectedRequest({ ...req, routing_status: 'admin_review' });
    // WA + badge in-app ke Admin - actionable, sudah lolos review Sales Internal.
    try {
      const admins = await penerimaAdminBernomor();
      const msg =
        `✅ *REQUEST DESIGN LOLOS REVIEW SALES INTERNAL*\n\n` +
        `Request dari *${req.sales_name}* untuk *${req.project_name}* sudah di-review oleh *${currentUser.full_name}* — silakan diproses/di-assign.\n` +
        `🔗 ${appLink()}`;
      await Promise.allSettled((admins ?? []).filter((a: any) => a.phone_number).map((a: any) => sendWANotif({ type: 'reminder_wa', target: a.phone_number, message: msg, event: 'project.approval_needed' })));
      (admins ?? []).forEach((a: any) => { if (a.id) void createNotification({ user_id: a.id, type: 'project', title: '✅ Request lolos review Sales Internal', body: `${req.sales_name} — ${req.project_name}`, action_url: '/form-require-project', ref_id: req.id, created_by: currentUser.full_name }); });
    } catch { }
  };

  const handleReject = (req: ProjectRequest) => { setRejectNote(''); setRejectModal({ open: true, req }); };

  const handleResubmit = async (req: ProjectRequest) => {
    const { error } = await supabase.from('project_requests').update({ status: 'pending', rejection_reason: null }).eq('id', req.id);
    if (error) { notify('error', 'Gagal re-submit: ' + error.message); return; }
    notify('success', 'Request berhasil di-submit ulang!');
    await supabase.from('project_messages').insert([{ request_id: req.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role, message: `🔄 Request di-submit ulang oleh ${currentUser.full_name}.` }]);
    fetchRequests();
    if (selectedRequest?.id === req.id) fetchMessages(req.id);
    logAudit({ user_id: currentUser.id, user_name: currentUser.full_name, action: 'resubmit', module: 'project', target_id: req.id, target_name: req.project_name }).catch(() => {});

    /*
      Pengajuan ulang MASUK LAGI ke antrean approval, tapi sebelumnya tidak
      mengabari siapa pun - jadi request yang sudah diperbaiki Sales bisa
      mengendap tanpa ada yang tahu gilirannya kembali. Penerimanya lewat
      penerimaAdminBernomor() supaya pemegang Full Access ikut, bukan hanya
      role admin.
    */
    try {
      const penerima = await penerimaAdminBernomor();
      const pesan = [
        '🔁 *REQUEST DESIGN DIAJUKAN ULANG*',
        '━━━━━━━━━━━━━━━━━━',
        `👤 *Sales   :* ${req.sales_name || currentUser.full_name}`,
        `📌 *Project :* ${req.project_name}`,
        '━━━━━━━━━━━━━━━━━━',
        'Sudah diperbaiki dan menunggu approval kembali.',
        `🔗 ${appLink()}`,
      ].join('\n');
      for (const u of penerima) {
        //  sendWANotif mengirim ke WhatsApp DAN Telegram sekaligus.
        if (u.phone_number) void sendWANotif({ type: 'reminder_wa', target: u.phone_number, message: pesan , event: 'project.updated' });
      }
    } catch { /* kabar gagal tidak boleh membatalkan pengajuan ulangnya */ }
  };

  const handleRejectConfirm = async () => {
    const req = rejectModal.req;
    if (!req || rejectSaving) return;
    if (!rejectNote.trim()) { notify('error', 'Alasan penolakan wajib diisi!'); return; }
    setRejectSaving(true);
    const { error } = await supabase.from('project_requests').update({ status: 'rejected', rejection_reason: rejectNote.trim() }).eq('id', req.id);
    setRejectSaving(false);
    if (error) { notify('error', 'Gagal reject: ' + error.message); return; }
    notify('info', 'Request ditolak.');
    setRejectModal({ open: false, req: null });
    setRejectNote('');
    fetchRequests();
    const noteMsg = rejectNote.trim() ? ` Alasan: ${rejectNote.trim()}` : '';
    await supabase.from('project_messages').insert([{ request_id: req.id, sender_id: currentUser.id, sender_name: 'System', sender_role: 'system', message: `❌ Request telah ditolak oleh ${currentUser.full_name}.${noteMsg}` }]);
    if (selectedRequest?.id === req.id) fetchMessages(req.id);
    // WA ke requester saat ditolak
    try {
      const { data: requesterUser } = await supabase.from('users').select('phone_number').eq('id', req.requester_id).single();
      if (requesterUser?.phone_number) {
        await sendWANotif({
          type: 'reminder_wa',
          target: requesterUser.phone_number,
          message: `❌ *Request Design — Request Ditolak*

Halo *${req.requester_name}*, request kamu ditolak:

📋 *Project:* ${req.project_name}
${noteMsg ? `📝 *Alasan:* ${rejectNote.trim()}
` : ''}
Hubungi Admin untuk info lebih lanjut.
🔗 ${appLink()}`,
        });
      }
    } catch { /* ignore WA error */ }
    // In-app notification for rejection
    if (req.requester_id) {
      notifyProjectStatusChange(req.requester_id, req.id, req.project_name, 'rejected', currentUser.full_name).catch(() => {});
    }
    logAudit({ user_id: currentUser.id, user_name: currentUser.full_name, action: 'reject', module: 'project', target_id: req.id, target_name: req.project_name }).catch(() => {});
  };

  const handleDeleteConfirm = async () => {
    const req = deleteModal.req; if (!req) return;
    setDeleting(true);
    const { data: attachData } = await supabase.from('project_attachments').select('file_url').eq('request_id', req.id);
    if (attachData && attachData.length > 0) {
      const filePaths = (attachData as { file_url: string }[]).map(a => {
        const match = a.file_url.match(/project-files\/.+/);
        return match ? match[0] : null;
      }).filter(Boolean) as string[];
      if (filePaths.length > 0) await supabase.storage.from('project-files').remove(filePaths);
    }
    await supabase.from('project_attachments').delete().eq('request_id', req.id);
    await supabase.from('project_messages').delete().eq('request_id', req.id);
    //  select('id') supaya RLS yang diam-diam menolak (0 baris, tanpa galat)
    //  ikut terlihat - lampiran & pesannya sudah kadung terhapus di atas,
    //  jadi kalau request-nya sendiri gagal terhapus, "berhasil dihapus"
    //  akan menyembunyikan request yatim tanpa riwayat sama sekali.
    const { data: terhapus, error } = await supabase.from('project_requests').delete().eq('id', req.id).select('id');
    setDeleting(false);
    if (error || !terhapus || terhapus.length === 0) {
      notify('error', error ? 'Gagal menghapus: ' + error.message : 'Request gagal dihapus (tidak punya akses). Lampiran & pesannya sudah terhapus - hubungi admin.');
      return;
    }
    notify('success', `Request "${req.project_name}" berhasil dihapus.`);
    setDeleteModal({ open: false, req: null });
    setDeleteConfirmText('');
    if (selectedRequest?.id === req.id) { setShowDetailModal(false); setSelectedRequest(null); }
    fetchRequests();
  };

  /**
   * Hapus satu file attachment - dulu tidak ada tombolnya sama sekali, jadi
   * Admin/Full Access terpaksa hapus lewat Supabase langsung tiap ada file
   * salah upload/salah kategori. Admin/Full Access = bisaKelolaRequest (sama
   * dengan syarat "Re-assign Tim PTS" di panel ini), BUKAN role admin
   * hardcode, supaya konsisten dengan Full Access yang di-toggle lewat Admin
   * Panel per akun Team.
   */
  const handleDeleteAttachment = (att: ProjectAttachment) => {
    setConfirmState({
      message: `Hapus file "${displayFileName(att.file_name)}"? Tindakan ini tidak dapat dibatalkan.`,
      danger: true,
      confirmLabel: 'Hapus',
      onConfirm: async () => {
        const match = att.file_url.match(/project-files\/.+/);
        if (match) await supabase.storage.from('project-files').remove([match[0]]);
        const { data, error } = await supabase.from('project_attachments').delete().eq('id', att.id).select('id');
        if (error || !data || data.length === 0) {
          notify('error', error ? 'Gagal menghapus: ' + error.message : 'File gagal dihapus (tidak punya akses).');
          return;
        }
        setAttachments(prev => prev.filter(a => a.id !== att.id));
        notify('success', 'File berhasil dihapus.');
      },
    });
  };
  return { handleBulkDelete, toggleSelectId, toggleSelectAll, handleApprove, handleInternalApproveProject, jalankanInternalApprove, handleReject, handleResubmit, handleRejectConfirm, handleDeleteConfirm, handleDeleteAttachment };
}
