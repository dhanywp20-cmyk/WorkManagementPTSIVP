
import { supabase } from '@/lib/supabase';
import { penerimaAdmin } from '@/lib/penerima-admin';

function pushSetelahNotif(userIds: string[], title: string, body?: string, actionUrl?: string): void {
  try {
    void fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids: userIds, title, body, url: actionUrl }),
    }).catch(() => {  });
  } catch {  }
}

export type NotifType = 'ticket' | 'reminder' | 'project' | 'user' | 'kpi' | 'system';

export interface NotifPayload {
  user_id: string;
  type: NotifType;
  title: string;
  body?: string;
  action_url?: string;
  ref_id?: string;
  created_by?: string;
}

export async function createNotification(payload: NotifPayload): Promise<void> {
  try {
    const { error } = await supabase.from('notifications').insert([{
      user_id:    payload.user_id,
      type:       payload.type,
      title:      payload.title,
      body:       payload.body ?? null,
      action_url: payload.action_url ?? null,
      ref_id:     payload.ref_id ?? null,
      created_by: payload.created_by ?? null,
      is_read:    false,
      created_at: new Date().toISOString(),
    }]);
    if (error) { console.warn('[notifications] insert error:', error.message); return; }
    pushSetelahNotif([payload.user_id], payload.title, payload.body, payload.action_url);
  } catch (e) {
    console.warn('[notifications] createNotification failed:', e);
  }
}

export async function createNotificationForAdmins(
  payload: Omit<NotifPayload, 'user_id'>
): Promise<void> {
  try {
    const targets = await penerimaAdmin();
    if (!targets.length) return;

    const rows = targets.map(a => ({
      user_id:    a.id,
      type:       payload.type,
      title:      payload.title,
      body:       payload.body ?? null,
      action_url: payload.action_url ?? null,
      ref_id:     payload.ref_id ?? null,
      created_by: payload.created_by ?? null,
      is_read:    false,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('notifications').insert(rows);
    if (error) { console.warn('[notifications] admin insert error:', error.message); return; }
    pushSetelahNotif(targets.map(t => t.id), payload.title, payload.body, payload.action_url);
  } catch (e) {
    console.warn('[notifications] createNotificationForAdmins failed:', e);
  }
}

export async function markNotifRead(notifId: string): Promise<void> {
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
  } catch {  }
}

export async function markAllNotifsRead(userId: string): Promise<void> {
  try {
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  } catch {  }
}

export async function fetchUnreadNotifs(userId: string): Promise<{
  id: string; type: NotifType; title: string; body: string | null;
  action_url: string | null; ref_id: string | null; created_by: string | null;
  created_at: string;
}[]> {
  try {
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, action_url, ref_id, created_by, created_at')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []) as any;
  } catch {
    return [];
  }
}

export async function notifyTicketAssigned(
  assigneeId: string, assigneeName: string,
  ticketId: string, projectName: string,
  assignedBy: string
): Promise<void> {
  await createNotification({
    user_id: assigneeId,
    type: 'ticket',
    title: `🎫 Tiket baru ditugaskan ke ${assigneeName}`,
    body: `Project: ${projectName}`,
    action_url: '/ticketing',
    ref_id: ticketId,
    created_by: assignedBy,
  });
}

export async function notifyReminderApproved(
  requesterId: string, requesterName: string,
  reminderId: string, projectName: string,
  dueDate: string, approvedBy: string
): Promise<void> {
  await createNotification({
    user_id: requesterId,
    type: 'reminder',
    title: `✅ Jadwal disetujui`,
    body: `${projectName} — ${dueDate}. Ditangani oleh ${approvedBy}.`,
    action_url: '/reminder-schedule',
    ref_id: reminderId,
    created_by: approvedBy,
  });
}

export async function notifyProjectStatusChange(
  requesterId: string,
  projectId: string, projectName: string,
  newStatus: string, changedBy: string
): Promise<void> {
  const statusLabels: Record<string, string> = {
    approved: '✅ Disetujui',
    rejected: '❌ Ditolak',
    in_progress: '🔄 Sedang Diproses',
    completed: '🎉 Selesai',
  };
  await createNotification({
    user_id: requesterId,
    type: 'project',
    title: `🏗️ ${projectName} — ${statusLabels[newStatus] ?? newStatus}`,
    body: `Status diperbarui oleh ${changedBy}`,
    action_url: '/form-require-project',
    ref_id: projectId,
    created_by: changedBy,
  });
}

export async function notifyKPIAlert(
  userId: string, userName: string, score: number
): Promise<void> {
  await createNotification({
    user_id: userId,
    type: 'kpi',
    title: `📊 Perhatian: KPI Score rendah`,
    body: `Score KPI kamu saat ini ${score.toFixed(1)}%. Tingkatkan aktivitas untuk memperbaiki score.`,
    action_url: '/kpi-team',
    created_by: 'System',
  });
}
