// ─── Project Progress — types, konstanta & helper ────────────────────────────
// Tema mengikuti Request Schedule (#0891b2 / #0e7490) agar konsisten dengan
// platform lain di Work Management.

export const THEME = {
  color: '#0891b2',
  colorLight: '#0e7490',
  gradient: 'linear-gradient(135deg,#0891b2,#0e7490)',
  shadow: 'rgba(8,145,178,0.4)',
} as const;

export type ProjectStatus = 'in_progress' | 'done' | 'blocked';
/**
 * Status komponen. Progres lokasi DIHITUNG dari komposisi status ini
 * (lihat computeProgress) — bukan diisi manual.
 */
export type ComponentState = 'done' | 'progress' | 'pending' | 'stuck';
export type Severity = 'tinggi' | 'sedang' | 'rendah';

export interface ProgressProject {
  id: string;
  name: string;
  client: string | null;
  description: string | null;
  status: ProjectStatus;
  share_token: string | null;
  share_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressLocation {
  id: string;
  project_id: string;
  name: string;
  pic: string | null;
  status: ProjectStatus;
  progress: number;
  note: string | null;
  note_flag: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProgressComponent {
  id: string;
  location_id: string;
  label: string;
  state: ComponentState;
  sort_order: number;
  created_at: string;
}

export interface ProgressIssue {
  id: string;
  project_id: string;
  location_label: string | null;
  issue: string;
  severity: Severity;
  note: string | null;
  sort_order: number;
  created_at: string;
}

/** Bundel lengkap 1 proyek — dipakai modal detail & halaman share view-only. */
export interface ProjectDetail {
  project: ProgressProject;
  locations: ProgressLocation[];
  components: ProgressComponent[];
  issues: ProgressIssue[];
}

// ─── Konfigurasi tampilan ────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  in_progress: { label: 'Dalam Proses', color: '#92400e', bg: '#fef3c7', border: '#f59e0b', icon: '⏳' },
  done:        { label: 'Selesai',      color: '#065f46', bg: '#d1fae5', border: '#10b981', icon: '✅' },
  blocked:     { label: 'Terhambat',    color: '#9f1239', bg: '#ffe4e6', border: '#f43f5e', icon: '⛔' },
};

/**
 * Bobot tiap status untuk perhitungan progres.
 * Selesai = penuh, Proses = setengah, Pending & Stuck = belum berkontribusi.
 */
export const COMPONENT_STATE_CONFIG: Record<ComponentState, {
  label: string; dot: string; text: string; weight: number;
}> = {
  done:     { label: 'Selesai', dot: '#10b981', text: '#334155', weight: 1 },
  progress: { label: 'Proses',  dot: '#0ea5e9', text: '#0369a1', weight: 0.5 },
  pending:  { label: 'Pending', dot: '#f59e0b', text: '#b45309', weight: 0 },
  stuck:    { label: 'Stuck',   dot: '#f43f5e', text: '#be123c', weight: 0 },
};

export const COMPONENT_STATES = ['done', 'progress', 'pending', 'stuck'] as const;

export const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string }> = {
  tinggi: { label: 'Tinggi', color: '#9f1239', bg: '#ffe4e6', border: '#fda4af' },
  sedang: { label: 'Sedang', color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
  rendah: { label: 'Rendah', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
};

/** Warna pie chart — sinkron dengan STATUS_CONFIG.border. */
export const STATUS_PIE_COLOR: Record<ProjectStatus, string> = {
  in_progress: '#f59e0b',
  done:        '#10b981',
  blocked:     '#f43f5e',
};

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Progres sebuah lokasi — DIHITUNG dari komposisi status komponennya, bukan
 * diisi manual. Selesai dihitung penuh, Proses setengah, Pending & Stuck nol.
 * Lokasi tanpa komponen = 0% (belum ada yang bisa diukur).
 */
export function computeProgress(components: { state: ComponentState }[]): number {
  if (components.length === 0) return 0;
  const earned = components.reduce(
    (s, c) => s + (COMPONENT_STATE_CONFIG[c.state]?.weight ?? 0), 0,
  );
  return Math.round((earned / components.length) * 100);
}

export interface StateBreakdown {
  state: ComponentState;
  label: string;
  color: string;
  count: number;
  percent: number;
}

/** Rekap jumlah & persentase komponen per status — untuk ditampilkan di kartu lokasi. */
export function stateBreakdown(components: { state: ComponentState }[]): StateBreakdown[] {
  const total = components.length;
  return COMPONENT_STATES.map(st => {
    const count = components.filter(c => c.state === st).length;
    const cfg = COMPONENT_STATE_CONFIG[st];
    return {
      state: st,
      label: cfg.label,
      color: cfg.dot,
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 100),
    };
  });
}

/**
 * Rata-rata progres seluruh lokasi. Dibulatkan ke bilangan bulat agar cocok
 * dengan angka yang ditampilkan di kartu ringkasan.
 */
export function averageProgress(locations: ProgressLocation[]): number {
  if (locations.length === 0) return 0;
  const total = locations.reduce((s, l) => s + (l.progress ?? 0), 0);
  return Math.round(total / locations.length);
}

/** Lokasi yang butuh perhatian = berstatus blocked. */
export function needsAttention(locations: ProgressLocation[]): ProgressLocation[] {
  return locations.filter(l => l.status === 'blocked');
}

/** Komponen milik satu lokasi, terurut sesuai sort_order. */
export function componentsOf(components: ProgressComponent[], locationId: string): ProgressComponent[] {
  return components
    .filter(c => c.location_id === locationId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDatetime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Token share — 32 hex char. Dipakai sebagai bagian URL publik, jadi hindari
 * karakter yang perlu di-encode.
 */
export function newShareToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padEnd(32, '0').slice(0, 32);
}

/** URL absolut halaman share — aman dipanggil hanya di browser. */
export function shareUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/project-progress/share/${token}`;
}

/**
 * Hak edit Project Progress: hanya Team admin & superadmin.
 * Role lain (team biasa, guest/sales) hanya bisa melihat.
 */
export function canEditProjectProgress(role: string | null | undefined): boolean {
  return ['admin', 'superadmin'].includes((role ?? '').toLowerCase());
}
