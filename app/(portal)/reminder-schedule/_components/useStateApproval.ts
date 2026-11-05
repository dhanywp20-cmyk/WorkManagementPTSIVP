'use client';

import { useState } from 'react';
import { Reminder, type SupervisorCandidate } from './shared';

export function useStateApproval() {
  const [approveTarget, setApproveTarget] = useState<Reminder | null>(null);
  const [approveBatchSiblings, setApproveBatchSiblings] = useState<Reminder[]>([]);
  const [approveAssignTo, setApproveAssignTo] = useState('');
  const [approveDate, setApproveDate] = useState('');
  const [approveTime, setApproveTime] = useState('');
  const [showRiwayat, setShowRiwayat] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches);
  const [approveStart,  setApproveStart]  = useState('');
  const [approveTarget2, setApproveTarget2] = useState('');
  const [approveSaving, setApproveSaving] = useState(false);
  const [internalRejectTarget, setInternalRejectTarget] = useState<Reminder | null>(null);
  const [internalApproveTarget, setInternalApproveTarget] = useState<Reminder | null>(null);
  const [internalApproveSaving, setInternalApproveSaving] = useState(false);
  const [internalRejectReason, setInternalRejectReason] = useState('');
  const [internalRejectSaving, setInternalRejectSaving] = useState(false);
  const [adminRejectTarget, setAdminRejectTarget] = useState<Reminder | null>(null);
  const [adminRejectReason, setAdminRejectReason] = useState('');
  const [adminRejectSaving, setAdminRejectSaving] = useState(false);
  const [approveSupervisors, setApproveSupervisors] = useState<SupervisorCandidate[]>([]);
  const [approveRouteSaving, setApproveRouteSaving] = useState(false);
  const [supervisorAssignTarget, setSupervisorAssignTarget] = useState<Reminder | null>(null);
  const [supervisorAssignBatchSiblings, setSupervisorAssignBatchSiblings] = useState<Reminder[]>([]);
  const [supervisorAssignTo, setSupervisorAssignTo] = useState('');
  const [supervisorAssignSaving, setSupervisorAssignSaving] = useState(false);
  return { approveTarget, setApproveTarget, approveBatchSiblings, setApproveBatchSiblings, approveAssignTo, setApproveAssignTo, approveDate, setApproveDate, approveTime, setApproveTime, showRiwayat, setShowRiwayat, approveStart, setApproveStart, approveTarget2, setApproveTarget2, approveSaving, setApproveSaving, internalRejectTarget, setInternalRejectTarget, internalApproveTarget, setInternalApproveTarget, internalApproveSaving, setInternalApproveSaving, internalRejectReason, setInternalRejectReason, internalRejectSaving, setInternalRejectSaving, adminRejectTarget, setAdminRejectTarget, adminRejectReason, setAdminRejectReason, adminRejectSaving, setAdminRejectSaving, approveSupervisors, setApproveSupervisors, approveRouteSaving, setApproveRouteSaving, supervisorAssignTarget, setSupervisorAssignTarget, supervisorAssignBatchSiblings, setSupervisorAssignBatchSiblings, supervisorAssignTo, setSupervisorAssignTo, supervisorAssignSaving, setSupervisorAssignSaving };
}
