import type { RingkasanProject } from '@/lib/summary-project';

/*
  Warna aksen tiap kategori aktivitas mengikuti warna PageHeader modul
  ASLINYA persis, supaya "Buka Detail" terasa menyambung ke modul yang
  dituju, bukan warna baru yang diputuskan sendiri di sini.
*/
export type AktivitasTipe = 'schedule' | 'ticket' | 'design' | 'review';

export const TIPE_CFG: Record<AktivitasTipe, { label: string; pendek: string; color: string; bg: string; icon: string }> = {
  schedule: { label: 'REQUEST SCHEDULE', pendek: 'Schedule', color: '#0891b2', bg: '#ecfeff', icon: '🗓️' },
  ticket:   { label: 'TROUBLESHOOTING',  pendek: 'Ticket',   color: '#dc2626', bg: '#fef2f2', icon: '🎫' },
  design:   { label: 'DESIGN PROJECT',   pendek: 'Design',   color: '#7c3aed', bg: '#f5f3ff', icon: '🏗️' },
  review:   { label: 'FORM REVIEW',      pendek: 'Review',   color: '#b45309', bg: '#fffbeb', icon: '⭐' },
};

export const STATUS_PROJECT: Record<RingkasanProject['status'], string> = {
  active: 'Aktif', done: 'Selesai', archived: 'Diarsipkan',
};

export const STATUS_PROJECT_WARNA: Record<RingkasanProject['status'], { color: string; bg: string }> = {
  active: { color: '#4f46e5', bg: '#eef2ff' },
  done: { color: '#059669', bg: '#ecfdf5' },
  archived: { color: '#64748b', bg: '#f1f5f9' },
};

const STATUS_WARNA: Record<string, string> = {
  done: '#10b981', paid: '#10b981', approved: '#10b981', Solved: '#10b981', Done: '#10b981',
  pending: '#f59e0b', Pending: '#f59e0b', processed: '#3b82f6',
  cancelled: '#6b7280', rejected: '#ef4444', Rejected: '#ef4444',
};
export const warnaStatus = (s: string): string => STATUS_WARNA[s] ?? '#3b82f6';

export function fmtTgl(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
