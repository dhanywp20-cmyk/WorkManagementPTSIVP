import type { Reminder, TeamUser } from './shared';

export type PerluAksi = { r: Reminder; alasan: string; warna: string };

export function hitungPerluAksi(reminders: Reminder[], currentUser: TeamUser | null, isAdmin: boolean, isManager: boolean,
  isMyReviewStage: (r: Reminder) => boolean): PerluAksi[] {
  if (!currentUser) return [];
  const hasil: PerluAksi[] = [];
  const sudah = new Set<string>();
  const tambah = (r: Reminder, alasan: string, warna: string) => {
    if (sudah.has(r.id)) return;
    sudah.add(r.id);
    hasil.push({ r, alasan, warna });
  };
  for (const r of reminders) {
    if (r.status === 'done' || r.status === 'cancelled') continue;
    if (r.routing_status === 'supervisor_assign' && r.assigned_supervisor_id === currentUser.id) {
      tambah(r, 'Perlu kamu tugaskan ke tim', '#f59e0b');
    } else if (r.routing_status === 'admin_review' && (isAdmin || isManager)) {
      tambah(r, 'Menunggu persetujuan kamu', '#dc2626');
    } else if (isMyReviewStage(r)) {
      tambah(r, 'Perlu review kamu', '#8b5cf6');
    } else if (r.assigned_to === currentUser.username) {
      tambah(r, 'Dikerjakan kamu', '#0891b2');
    }
  }
  return hasil;
}
