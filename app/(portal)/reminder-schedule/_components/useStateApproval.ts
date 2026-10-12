'use client';

/** useStateApproval - dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { useState } from 'react';
import { Reminder, type SupervisorCandidate } from './shared';

export function useStateApproval() {
  const [approveTarget, setApproveTarget] = useState<Reminder | null>(null);
  const [approveBatchSiblings, setApproveBatchSiblings] = useState<Reminder[]>([]); // tanggal lain di batch yang sama, ikut di-approve bareng
  const [approveAssignTo, setApproveAssignTo] = useState('');
  const [approveDate, setApproveDate] = useState('');
  const [approveTime, setApproveTime] = useState('');
  /** Panel riwayat di samping modal detail. Default terbuka supaya langsung terlihat. */
  const [showRiwayat, setShowRiwayat] = useState(true);
  // Timeline pengerjaan saat approve - terisi dari usulan Sales, boleh diubah.
  const [approveStart,  setApproveStart]  = useState('');
  const [approveTarget2, setApproveTarget2] = useState('');
  const [approveSaving, setApproveSaving] = useState(false);
  const [internalRejectTarget, setInternalRejectTarget] = useState<Reminder | null>(null); // request yg mau di-Tolak Sales Internal
  const [internalApproveTarget, setInternalApproveTarget] = useState<Reminder | null>(null); // konfirmasi Approve Sales Internal (detail dulu, jangan instan)
  const [internalApproveSaving, setInternalApproveSaving] = useState(false);
  const [internalRejectReason, setInternalRejectReason] = useState('');
  const [internalRejectSaving, setInternalRejectSaving] = useState(false);
  // M4 (docs/UX-WORKFLOW-AUDIT.md): dulu tahap admin_review cuma punya Approve
  // atau Hapus permanen (tanpa alasan tercatat, tanpa notif ke Sales) - tidak
  // ada jalur Tolak resmi seperti yang sudah ada di tahap internal_review.
  const [adminRejectTarget, setAdminRejectTarget] = useState<Reminder | null>(null);
  const [adminRejectReason, setAdminRejectReason] = useState('');
  const [adminRejectSaving, setAdminRejectSaving] = useState(false);
  // Admin/Manager approve  route ke Supervisor tim (by tipe produk, product_team_map)
  const [approveSupervisors, setApproveSupervisors] = useState<SupervisorCandidate[]>([]);
  const [approveRouteSaving, setApproveRouteSaving] = useState(false);
  // Supervisor assign ke anggota tim ATAU diri sendiri (tim penuh - keputusan manual)
  const [supervisorAssignTarget, setSupervisorAssignTarget] = useState<Reminder | null>(null);
  const [supervisorAssignBatchSiblings, setSupervisorAssignBatchSiblings] = useState<Reminder[]>([]);
  const [supervisorAssignTo, setSupervisorAssignTo] = useState(''); // username anggota, atau 'SELF'
  const [supervisorAssignSaving, setSupervisorAssignSaving] = useState(false);
  return { approveTarget, setApproveTarget, approveBatchSiblings, setApproveBatchSiblings, approveAssignTo, setApproveAssignTo, approveDate, setApproveDate, approveTime, setApproveTime, showRiwayat, setShowRiwayat, approveStart, setApproveStart, approveTarget2, setApproveTarget2, approveSaving, setApproveSaving, internalRejectTarget, setInternalRejectTarget, internalApproveTarget, setInternalApproveTarget, internalApproveSaving, setInternalApproveSaving, internalRejectReason, setInternalRejectReason, internalRejectSaving, setInternalRejectSaving, adminRejectTarget, setAdminRejectTarget, adminRejectReason, setAdminRejectReason, adminRejectSaving, setAdminRejectSaving, approveSupervisors, setApproveSupervisors, approveRouteSaving, setApproveRouteSaving, supervisorAssignTarget, setSupervisorAssignTarget, supervisorAssignBatchSiblings, setSupervisorAssignBatchSiblings, supervisorAssignTo, setSupervisorAssignTo, supervisorAssignSaving, setSupervisorAssignSaving };
}
