// ─── Types ────────────────────────────────────────────────────────────────────

export interface TechNoteFolder {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent_id: string | null;
  created_by: string;
  created_at: string;
  description?: string;
}

export interface TechNote {
  id: string;
  title: string;
  description: string;
  folder_id: string;
  author_id: string;
  author_name: string;
  one_drive_link: string;
  product: string;
  tags: string[];
  status: 'pending' | 'approved' | 'revision' | 'rejected';
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  review_note: string | null;
  team_type: string;
}

export interface TechNoteHistory {
  id: string;
  tech_note_id: string;
  action: 'submitted' | 'approved' | 'revision_requested' | 'rejected' | 'resubmitted';
  performed_by: string;
  performed_by_name: string;
  note: string | null;
  created_at: string;
}

// ─── Status Config ────────────────────────────────────────────────────────────

export const STATUS_CONFIG = {
  pending:  { label: 'Pending Review', color: '#d97706', bg: '#fef3c7', border: '#fcd34d', icon: '⏳' },
  approved: { label: 'Approved',       color: '#059669', bg: '#d1fae5', border: '#6ee7b7', icon: '✅' },
  revision: { label: 'Perlu Revisi',   color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', icon: '🔄' },
  rejected: { label: 'Ditolak',        color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db', icon: '❌' },
} as const;

export const ACTION_CONFIG = {
  submitted:          { label: 'Submitted',    color: '#3b82f6', icon: '📤' },
  approved:           { label: 'Approved',     color: '#10b981', icon: '✅' },
  revision_requested: { label: 'Minta Revisi', color: '#f59e0b', icon: '🔄' },
  rejected:           { label: 'Ditolak',      color: '#6b7280', icon: '❌' },
  resubmitted:        { label: 'Resubmit',     color: '#8b5cf6', icon: '📤' },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const KKM_REQUIRED = 2; // target 2 tech note approved per tahun

export function formatDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDateShort(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}
