'use client';

import type { TablesUpdate } from '@/types/database';
import { User, ProjectRequest, RoomDetail, sendWANotif } from './shared';
import { supabase } from '@/lib/supabase';
import { notifyProjectStatusChange } from '@/lib/notifications';
import { appLink } from '@/lib/app-url';
import { logAudit } from '@/lib/audit';

export interface UbahStatusRequestKonteks {
  currentUser: User;
  fetchMessages: (requestId: string) => Promise<void>;
  fetchRequests: () => Promise<void>;
  notify: (type: "success" | "error" | "info", msg: string) => void;
  selectedRequest: ProjectRequest | null;
  setSelectedRequest: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
  statusUpdatingRef: import("react").RefObject<Set<string>>;
}

export function useUbahStatusRequest(k: UbahStatusRequestKonteks) {
  const { currentUser, fetchMessages, fetchRequests, notify, selectedRequest, setSelectedRequest, statusUpdatingRef } = k;
  const handleStatusUpdate = async (req: ProjectRequest, newStatus: string, roomIdx: number = 0) => {
    if (statusUpdatingRef.current.has(req.id)) return;
    statusUpdatingRef.current.add(req.id);
    try {
    let updatedRooms: RoomDetail[] | undefined;
    const updatePayload: TablesUpdate<'project_requests'> = roomIdx === 0
      ? { status: newStatus }
      : (() => {
          const rooms = [...(req.rooms || [])];
          const i = roomIdx - 1;
          if (rooms[i]) rooms[i] = { ...rooms[i], status: newStatus as RoomDetail['status'] };
          updatedRooms = rooms;
          return { rooms };
        })();
    const { data: terubah, error } = await supabase.from('project_requests')
      .update(updatePayload).eq('id', req.id).select('id');
    if (error || !terubah || terubah.length === 0) { notify('error', 'Gagal update status: ' + (error?.message ?? 'akses ditolak database.')); return; }
    notify('success', `Status → ${newStatus}`);
    fetchRequests();
    if (selectedRequest?.id === req.id) {
      setSelectedRequest(roomIdx === 0
        ? { ...selectedRequest, status: newStatus as ProjectRequest['status'] }
        : { ...selectedRequest, rooms: updatedRooms });
    }
    await supabase.from('project_messages').insert([{ request_id: req.id, sender_id: currentUser.id, sender_name: currentUser.full_name, sender_role: currentUser.role ?? '', message: `🔄 Status diupdate menjadi: ${newStatus.replace('_', ' ').toUpperCase()}` }]);
    if (selectedRequest?.id === req.id) fetchMessages(req.id);
    try {
      if (req.requester_id) {
        notifyProjectStatusChange(req.requester_id, req.id, req.project_name, newStatus, currentUser.full_name).catch(() => {});
      }
    } catch {  }

    try {
      const selesai = newStatus === 'completed';
      const nama = [req.sales_name, req.assign_name, req.ivp_assignee].filter(Boolean) as string[];
      const idOrang = [req.requester_id].filter(Boolean) as string[];
      const [resNama, resId] = await Promise.all([
        nama.length ? supabase.from('users').select('id,full_name,username,phone_number').in('full_name', nama)
                    : Promise.resolve({ data: [] as any[] }),
        idOrang.length ? supabase.from('users').select('id,full_name,username,phone_number').in('id', idOrang)
                       : Promise.resolve({ data: [] as any[] }),
      ]);
      const penerima = new Map<string, any>();
      for (const u of [...(resNama.data ?? []), ...(resId.data ?? [])]) if (u?.id) penerima.set(u.id, u);

      const garis = '━━━━━━━━━━━━━━━━━━';
      const ringkas = [
        `📌 *Project :* ${req.project_name}`,
        `👤 *Sales   :* ${req.sales_name || '-'}`,
        `🙋 *Dikerjakan:* ${req.assign_name || req.ivp_assignee || '-'}`,
      ].join('\n');

      for (const u of penerima.values()) {
        const dia = u.id === currentUser.id;
        const pesan = (selesai && dia)
          ? ['🎉 *Terima Kasih!*', garis,
             `Halo *${u.full_name}*, request design ini sudah kamu tandai *Selesai*.`,
             ringkas, garis, 'Terima kasih atas kerja kerasnya! 🙌',
             `🔗 ${appLink()}`].join('\n')
          : [selesai ? '✅ *REQUEST DESIGN SELESAI*' : '🔄 *STATUS REQUEST DESIGN DIPERBARUI*', garis,
             `Halo *${u.full_name}*, status request berubah menjadi *${newStatus}* oleh *${currentUser.full_name}*:`,
             ringkas, garis,
             `🔗 ${appLink()}`].join('\n');
        if (u.phone_number) void sendWANotif({ type: 'reminder_wa', target: u.phone_number, message: pesan , event: 'project.updated' });
      }
    } catch {  }
    logAudit({ user_id: currentUser.id, user_name: currentUser.full_name, action: 'status_change', module: 'project', target_id: req.id, target_name: req.project_name, old_value: req.status, new_value: newStatus }).catch(() => {});
    } finally {
      statusUpdatingRef.current.delete(req.id);
    }
  };
  return { handleStatusUpdate };
}
