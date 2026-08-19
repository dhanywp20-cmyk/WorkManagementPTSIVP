// app/bpkp-progress/_components/shared.ts
// Types & konstanta modul BPKP Progress — ikut pola shared.ts modul lain.

export interface User {
  id: string; username: string;
  full_name: string; role: string; team_type?: string;
}

export type SiteStatus = 'done' | 'progress' | 'blocked';
export type CheckState = 'ok' | 'bad' | 'hold';
export type Severity = 'Tinggi' | 'Sedang' | 'Rendah';

export interface Site {
  id: string;
  name: string;
  pic: string;
  status: SiteStatus;
  progress: number;
  note: string;
  note_critical: boolean;
  sort_order: number;
  created_by?: string | null;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  site_id: string;
  text: string;
  state: CheckState;
  sort_order: number;
}

export interface Issue {
  id: string;
  site: string;
  issue: string;
  severity: Severity;
  description: string;
  sort_order: number;
}

// Warna modul — dipakai di PageHeader & aksen tombol/pill.
export const MODULE_COLOR = '#ea580c'; // orange-600, belum dipakai modul lain

export const STATUS_META: Record<SiteStatus, { label: string; badge: string }> = {
  done:     { label: 'Selesai',      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  progress: { label: 'Dalam Proses', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  blocked:  { label: 'Terhambat',    badge: 'bg-red-50 text-red-700 border-red-200' },
};

export const DOT_COLOR: Record<CheckState, string> = {
  ok: 'bg-emerald-500', bad: 'bg-red-500', hold: 'bg-amber-500',
};

export const SEV_BADGE: Record<Severity, string> = {
  Tinggi: 'bg-red-50 text-red-700 border-red-200',
  Sedang: 'bg-amber-50 text-amber-700 border-amber-200',
  Rendah: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const NEXT_STATE: Record<CheckState, CheckState> = { ok: 'bad', bad: 'hold', hold: 'ok' };

/** Role yang boleh EDIT (team ke atas). Guest & sales hanya lihat. */
export function canEditBpkp(user: User | null): boolean {
  if (!user) return false;
  const r = (user.role ?? '').toLowerCase();
  return r === 'team' || r === 'team_pts' || r === 'admin' || r === 'superadmin';
}
