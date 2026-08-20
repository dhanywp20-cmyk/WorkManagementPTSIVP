/**
 * lib/audit.ts - pencatatan audit trail.
 *
 * logAudit() menerima pelaku (user_id, user_name), aksi, modul, sasaran
 * (target_id, target_name), serta nilai lama dan baru. Fungsi ini TIDAK PERNAH
 * melempar: kegagalan pencatatan tidak boleh memutus alur utama user.
 */

import { supabase } from '@/lib/supabase';

// Types

export type AuditAction =
  | 'create'   // New record created
  | 'update'   // Record updated
  | 'delete'   // Record deleted
  | 'approve'  // Request/ticket approved
  | 'reject'   // Request/ticket rejected
  | 'assign'   // Assigned to someone
  | 'status_change'  // Status changed
  | 'login'    // User logged in
  | 'logout'   // User logged out
  | 'export'   // Data exported
  | 'view'     // Sensitive record viewed
  | 'upload'   // File uploaded
  | 'download' // File downloaded
  | 'resubmit' // Rejected request re-submitted
  | 'mark_paid'  // Incentive marked paid
  | 'mark_done'; // Task marked done

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
  old_value?: string;   // Previous value (JSON string or simple string)
  new_value?: string;   // New value
  notes?: string;
}

// Core logger

/**
 * Log an audit event.
 * Always safe to call - never throws, never blocks main flow.
 */
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

// Convenience helpers

/** Log record creation */
export const auditCreate = (
  userId: string, userName: string,
  module: AuditModule | string,
  targetId: string, targetName: string,
  notes?: string
) => logAudit({ user_id: userId, user_name: userName, action: 'create', module, target_id: targetId, target_name: targetName, notes });

/** Log record deletion */
export const auditDelete = (
  userId: string, userName: string,
  module: AuditModule | string,
  targetId: string, targetName: string
) => logAudit({ user_id: userId, user_name: userName, action: 'delete', module, target_id: targetId, target_name: targetName });

/** Log status change */
export const auditStatusChange = (
  userId: string, userName: string,
  module: AuditModule | string,
  targetId: string, targetName: string,
  oldStatus: string, newStatus: string
) => logAudit({ user_id: userId, user_name: userName, action: 'status_change', module, target_id: targetId, target_name: targetName, old_value: oldStatus, new_value: newStatus });

/** Log approval */
export const auditApprove = (
  userId: string, userName: string,
  module: AuditModule | string,
  targetId: string, targetName: string
) => logAudit({ user_id: userId, user_name: userName, action: 'approve', module, target_id: targetId, target_name: targetName });

/** Log rejection */
export const auditReject = (
  userId: string, userName: string,
  module: AuditModule | string,
  targetId: string, targetName: string,
  reason?: string
) => logAudit({ user_id: userId, user_name: userName, action: 'reject', module, target_id: targetId, target_name: targetName, notes: reason });

/** Log assignment */
export const auditAssign = (
  userId: string, userName: string,
  module: AuditModule | string,
  targetId: string, targetName: string,
  assignedTo: string
) => logAudit({ user_id: userId, user_name: userName, action: 'assign', module, target_id: targetId, target_name: targetName, new_value: assignedTo });
