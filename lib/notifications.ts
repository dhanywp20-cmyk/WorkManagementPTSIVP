/**
 * lib/notifications.ts - notifikasi in-app.
 *
 * createNotification() untuk satu user (butuh user_id, type, title, body, dan
 * opsional action_url + ref_id); createNotificationForAdmins() menyebar ke
 * seluruh admin dengan bentuk yang sama tanpa user_id.
 */

import { supabase } from '@/lib/supabase';

// Types

export type NotifType = 'ticket' | 'reminder' | 'project' | 'user' | 'kpi' | 'system';

export interface NotifPayload {
  user_id: string;       // Recipient user ID
  type: NotifType;
  title: string;
  body?: string;
  action_url?: string;   // Which module URL to navigate to on click
  ref_id?: string;       // ID of the referenced record
  created_by?: string;   // Full name of who triggered this
}

// Core helpers

/**
 * Create a notification for a single user.
 * Fails silently - never throws. Safe to call from any event handler.
 */
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
    if (error) console.warn('[notifications] insert error:', error.message);
  } catch (e) {
    console.warn('[notifications] createNotification failed:', e);
  }
}

/**
 * Create notifications for all users with role admin/superadmin, PLUS akun
 * Team PTS dengan toggle "Full Access" aktif (mis. Manager PTS - lihat
 * lib/constants.ts hasFullAccess & sql/user-full-access-toggle.sql). Full
 * Access dimaksudkan supaya notifikasi yang masuk ke admin juga masuk ke
 * Manager pada saat yang sama, bukan menyusul terpisah.
 * Fails silently.
 */
export async function createNotificationForAdmins(
  payload: Omit<NotifPayload, 'user_id'>
): Promise<void> {
  try {
    const [{ data: admins }, { data: fullAccessTeam }] = await Promise.all([
      supabase.from('users').select('id').in('role', ['admin', 'superadmin']),
      supabase.from('users').select('id').eq('role', 'team').eq('access_level', 'full'),
    ]);
    const targets = [...(admins ?? []), ...(fullAccessTeam ?? [])] as { id: string }[];
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
    if (error) console.warn('[notifications] admin insert error:', error.message);
  } catch (e) {
    console.warn('[notifications] createNotificationForAdmins failed:', e);
  }
}

/**
 * Mark a single notification as read.
 */
export async function markNotifRead(notifId: string): Promise<void> {
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
  } catch { /* silent */ }
}

/**
 * Mark ALL notifications for a user as read.
 */
export async function markAllNotifsRead(userId: string): Promise<void> {
  try {
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  } catch { /* silent */ }
}

/**
 * Fetch unread notifications for a user.
 * Returns empty array on any error.
 */
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

// Preset notification factories
// Use these instead of constructing payloads manually.

/** Notify when a new user registers and waits for approval */
/**
 * DIPINDAH ke /api/auth/register.
 *
 * Versi lamanya dipanggil dari peramban sesudah registrasi, jadi ia harus
 * membaca tabel `users` TANPA token untuk mencari siapa saja adminnya -
 * pembacaan yang justru sedang ditutup karena membuka seluruh daftar akun
 * beserta nomor teleponnya kepada siapa pun yang memegang anon key.
 *
 * Sengaja tidak disisakan sebagai pembungkus tipis: pemanggil lama
 * membungkusnya dengan catch kosong, jadi kalau ia tetap ada dan diam-diam
 * mengembalikan nol admin, tidak akan ada yang menyadarinya.
 */

/** Notify when a ticket is assigned to someone */
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

/** Notify when a reminder/jadwal request is approved */
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

/** Notify when a design project request status changes */
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

/** Notify team member about KPI concern */
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
