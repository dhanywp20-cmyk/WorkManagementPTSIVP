
import { supabase } from '@/lib/supabase';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'assign'
  | 'status_change'
  | 'login'
  | 'logout'
  | 'export'
  | 'view'
  | 'upload'
  | 'download'
  | 'resubmit'
  | 'mark_paid'
  | 'mark_done';

export type AuditModule =
  | 'ticket' | 'reminder' | 'project' | 'piket' | 'kpi'
  | 'incentive' | 'movement' | 'user' | 'learning'
  | 'tech-note' | 'form-review' | 'daily-report' | 'system';

export interface AuditPayload {
  user_id: string;
  user_name: string;
  action: AuditAction;
  module: AuditModule | string;
  target_id?: string;
  target_name?: string;
  old_value?: string;
  new_value?: string;
  notes?: string;
}

export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    const { error } = await supabase.from('audit_trail').insert([{
      user_id:     payload.user_id,
      user_name:   payload.user_name,
      action:      payload.action,
      module:      payload.module,
      target_id:   payload.target_id   ?? null,
      target_name: payload.target_name ?? null,
      old_value:   payload.old_value   ?? null,
      new_value:   payload.new_value   ?? null,
      notes:       payload.notes       ?? null,
      created_at:  new Date().toISOString(),
    }]);
    if (error) console.warn('[audit] log error:', error.message);
  } catch (e) {
    console.warn('[audit] logAudit failed:', e);
  }
}

export const auditCreate = (
  userId: string, userName: string,
  module: AuditModule | string,
  targetId: string, targetName: string,
  notes?: string
) => logAudit({ user_id: userId, user_name: userName, action: 'create', module, target_id: targetId, target_name: targetName, notes });

export const auditDelete = (
  userId: string, userName: string,
  module: AuditModule | string,
  targetId: string, targetName: string
) => logAudit({ user_id: userId, user_name: userName, action: 'delete', module, target_id: targetId, target_name: targetName });

export const auditStatusChange = (
  userId: string, userName: string,
  module: AuditModule | string,
  targetId: string, targetName: string,
  oldStatus: string, newStatus: string
) => logAudit({ user_id: userId, user_name: userName, action: 'status_change', module, target_id: targetId, target_name: targetName, old_value: oldStatus, new_value: newStatus });

export const auditApprove = (
  userId: string, userName: string,
  module: AuditModule | string,
  targetId: string, targetName: string
) => logAudit({ user_id: userId, user_name: userName, action: 'approve', module, target_id: targetId, target_name: targetName });

export const auditReject = (
  userId: string, userName: string,
  module: AuditModule | string,
  targetId: string, targetName: string,
  reason?: string
) => logAudit({ user_id: userId, user_name: userName, action: 'reject', module, target_id: targetId, target_name: targetName, notes: reason });

export const auditAssign = (
  userId: string, userName: string,
  module: AuditModule | string,
  targetId: string, targetName: string,
  assignedTo: string
) => logAudit({ user_id: userId, user_name: userName, action: 'assign', module, target_id: targetId, target_name: targetName, new_value: assignedTo });
