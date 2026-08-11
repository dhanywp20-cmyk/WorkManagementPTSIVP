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
/** Asal entri: dibuat orang lewat UI, atau otomatis dari Reminder Schedule. */
export type ProgressOrigin = 'manual' | 'auto_reminder';

export interface ProgressProject {
  id: string;
  name: string;
  client: string | null;
  description: string | null;
  status: ProjectStatus;
  share_token: string | null;
  share_enabled: boolean;
  /** Jadwal proyek. Nullable — proyek lama tetap jalan tanpa tanggal. */
  start_date: string | null;
  target_date: string | null;
  /** Snapshot dari reminder saat proyek dibuat otomatis; bisa disunting admin. */
  sales_name: string | null;
  sales_division: string | null;
  origin: ProgressOrigin;
  source_reminder_id: string | null;
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
  /** Jadwal per lokasi — tiap site bisa mulai & selesai di waktu berbeda. */
  start_date: string | null;
  target_date: string | null;
  /**
   * Snapshot Sales dari reminder yang melahirkan lokasi ini. Sengaja disimpan
   * per lokasi: satu proyek bisa berisi lokasi dari beberapa sales berbeda.
   */
  sales_name: string | null;
  sales_division: string | null;
  origin: ProgressOrigin;
  /** Reminder asal. Tetap NULL untuk entri manual. */
  source_reminder_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProgressComponent {
  id: string;
  location_id: string;
  label: string;
  state: ComponentState;
  /** Foto bukti opsional — terpasang (Done) atau kendala (Stuck). Ukuran penuh. */
  photo_url: string | null;
  /**
   * Versi kecil (~320px) untuk dirender di daftar komponen. Selalu pakai ini
   * untuk <img>; photo_url hanya dibuka saat thumbnail diklik. Tanpa ini,
   * menggambar kotak 28px berarti mengunduh foto utuh dan menghabiskan egress.
   */
  photo_thumb_url: string | null;
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

/**
 * Satu baris riwayat perubahan (audit_trail). Bentuknya sama dengan AuditEntry
 * di components/shared/AuditTrailPanel — didefinisikan ulang di sini supaya
 * berkas tipe murni ini tidak perlu bergantung pada modul komponen UI.
 */
export interface ProgressAuditEntry {
  id: string;
  target_id: string;
  user_name: string | null;
  action: string;
  target_name: string | null;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  created_at: string;
}

/** Bundel lengkap 1 proyek — dipakai modal detail & halaman share view-only. */
export interface ProjectDetail {
  project: ProgressProject;
  locations: ProgressLocation[];
  components: ProgressComponent[];
  issues: ProgressIssue[];
  /**
   * Riwayat status lokasi & state komponen se-proyek — dipakai alur mendatar
   * di ProjectDetailView (lewat prop `data` AuditTrailPanel, BUKAN fetch
   * sendiri, karena komponen itu juga dirender di halaman share publik).
   * Opsional: DetailEditor tidak mengisi ini, masih pakai fetch langsung.
   */
  auditTrail?: ProgressAuditEntry[];
}

// ─── Konfigurasi tampilan ────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  in_progress: { label: 'In Progress', color: '#92400e', bg: '#fef3c7', border: '#f59e0b', icon: '⏳' },
  done:        { label: 'Done',         color: '#065f46', bg: '#d1fae5', border: '#10b981', icon: '✅' },
  blocked:     { label: 'Blocked',      color: '#9f1239', bg: '#ffe4e6', border: '#f43f5e', icon: '⛔' },
};

/**
 * Bobot tiap status untuk perhitungan progres.
 * Selesai = penuh, Proses = setengah, Pending & Stuck = belum berkontribusi.
 */
export const COMPONENT_STATE_CONFIG: Record<ComponentState, {
  label: string; dot: string; text: string; weight: number;
}> = {
  done:     { label: 'Done',        dot: '#10b981', text: '#334155', weight: 1 },
  progress: { label: 'In Progress', dot: '#0ea5e9', text: '#0369a1', weight: 0.5 },
  pending:  { label: 'Pending',     dot: '#f59e0b', text: '#b45309', weight: 0 },
  stuck:    { label: 'Stuck',       dot: '#f43f5e', text: '#be123c', weight: 0 },
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

// ─── Timeline & overtime ─────────────────────────────────────────────────────

export type TimelineState =
  | 'no_date'    // belum dijadwalkan
  | 'not_started'// tanggal mulai masih di depan
  | 'on_track'   // berjalan, target belum lewat
  | 'due_soon'   // target <= 3 hari lagi
  | 'overdue'    // target sudah lewat & belum selesai
  | 'done';      // sudah selesai

export interface TimelineInfo {
  state: TimelineState;
  label: string;
  color: string;
  bg: string;
  /** Sisa hari ke target. Negatif = sudah lewat sekian hari. Null bila tak ada target. */
  daysLeft: number | null;
  /** Berapa hari berjalan sejak mulai. Null bila belum mulai / tak ada tanggal. */
  daysElapsed: number | null;
  /** Posisi hari ini pada rentang mulai→target, 0-100. Null bila rentang tak lengkap. */
  elapsedPercent: number | null;
}

/** Tanggal lokal hari ini sebagai YYYY-MM-DD — hindari pergeseran zona waktu dari toISOString(). */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Selisih hari kalender antara dua tanggal YYYY-MM-DD (b - a). */
function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  // Date.UTC menghindari efek DST yang bisa membuat selisih meleset 1 hari.
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/**
 * Status jadwal sebuah proyek/lokasi. Dihitung saat tampil, bukan disimpan —
 * status "overtime" berubah sendiri seiring hari berjalan, jadi menyimpannya
 * di kolom akan selalu basi kecuali ada job harian.
 *
 * `status === 'done'` menang atas segalanya: pekerjaan yang sudah selesai tidak
 * pantas ditandai terlambat walau tanggal targetnya sudah lewat.
 */
export function timelineInfo(
  item: { start_date: string | null; target_date: string | null; status: ProjectStatus },
  today: string = todayStr(),
): TimelineInfo {
  const { start_date: start, target_date: target, status } = item;

  const daysLeft    = target ? diffDays(today, target) : null;
  const daysElapsed = start && diffDays(start, today) >= 0 ? diffDays(start, today) : null;

  let elapsedPercent: number | null = null;
  if (start && target) {
    const span = diffDays(start, target);
    elapsedPercent = span <= 0
      ? 100
      : Math.max(0, Math.min(100, Math.round((diffDays(start, today) / span) * 100)));
  }

  const base = { daysLeft, daysElapsed, elapsedPercent };

  if (status === 'done')  return { ...base, state: 'done',        label: 'Selesai',        color: '#065f46', bg: '#d1fae5' };
  if (!start && !target)  return { ...base, state: 'no_date',     label: 'Belum dijadwalkan', color: '#64748b', bg: '#f1f5f9' };
  if (start && diffDays(today, start) > 0)
                          return { ...base, state: 'not_started', label: `Mulai ${diffDays(today, start)} hari lagi`, color: '#475569', bg: '#f1f5f9' };
  if (daysLeft === null)  return { ...base, state: 'on_track',    label: 'Berjalan',       color: '#0369a1', bg: '#e0f2fe' };
  if (daysLeft < 0)       return { ...base, state: 'overdue',     label: `Overtime ${Math.abs(daysLeft)} hari`, color: '#9f1239', bg: '#ffe4e6' };
  if (daysLeft === 0)     return { ...base, state: 'due_soon',    label: 'Jatuh tempo hari ini', color: '#b45309', bg: '#fef3c7' };
  if (daysLeft <= 3)      return { ...base, state: 'due_soon',    label: `${daysLeft} hari lagi`, color: '#b45309', bg: '#fef3c7' };
  return { ...base, state: 'on_track', label: `${daysLeft} hari lagi`, color: '#0369a1', bg: '#e0f2fe' };
}

/** Lokasi yang sudah lewat target dan belum selesai. */
export function overdueLocations(locations: ProgressLocation[]): ProgressLocation[] {
  return locations.filter(l => timelineInfo(l).state === 'overdue');
}

/** Warna & urutan tampil tiap status jadwal untuk pie chart. */
export const TIMELINE_PIE: { state: TimelineState; label: string; color: string }[] = [
  { state: 'done',        label: 'Selesai',           color: '#10b981' },
  { state: 'on_track',    label: 'Sesuai Jadwal',     color: '#0ea5e9' },
  { state: 'due_soon',    label: 'Segera Jatuh Tempo',color: '#f59e0b' },
  { state: 'overdue',     label: 'Overtime',          color: '#f43f5e' },
  { state: 'not_started', label: 'Belum Mulai',       color: '#a78bfa' },
  { state: 'no_date',     label: 'Belum Dijadwalkan', color: '#94a3b8' },
];

/**
 * Sebaran status jadwal seluruh lokasi — menjawab "berapa yang selesai tepat
 * waktu dan berapa yang sudah lewat target" dalam satu pandang.
 * Status yang tidak terpakai tidak ikut ditampilkan agar legenda tetap ringkas.
 */
export function timelineBreakdown(locations: ProgressLocation[]): PieSlice[] {
  return TIMELINE_PIE
    .map(cfg => ({
      label: cfg.label,
      value: locations.filter(l => timelineInfo(l).state === cfg.state).length,
      color: cfg.color,
    }))
    .filter(d => d.value > 0);
}

/** Palet slice untuk pie yang kategorinya dinamis (nama PIC / nama komponen). */
export const PIE_PALETTE = [
  '#0891b2', '#7c3aed', '#10b981', '#f59e0b', '#e11d48',
  '#6366f1', '#14b8a6', '#f97316', '#ec4899', '#84cc16',
];

export interface PieSlice { label: string; value: number; color: string }

/**
 * Progres tiap PIC — RATA-RATA progres seluruh lokasi yang dia pegang (bukan
 * jumlah lokasinya), diurutkan dari yang tertinggi. PIC dengan beberapa lokasi
 * dirata-ratakan supaya yang memegang banyak site tidak otomatis terlihat lebih
 * besar.
 *
 * Catatan: nilainya persentase, jadi MENJUMLAHKAN slice tidak bermakna — pemakai
 * komponen wajib mengisi centerValue sendiri (lihat ProjectDetailView).
 * Lokasi tanpa PIC dikelompokkan "Belum ada PIC" agar tidak hilang diam-diam.
 */
export function picBreakdown(locations: ProgressLocation[]): PieSlice[] {
  const group = new Map<string, number[]>();
  for (const l of locations) {
    const key = l.pic?.trim() || 'Belum ada PIC';
    if (!group.has(key)) group.set(key, []);
    group.get(key)!.push(l.progress ?? 0);
  }
  return [...group.entries()]
    .map(([label, vals]) => ({
      label,
      value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
      count: vals.length,
    }))
    .sort((a, b) => b.value - a.value)
    .map((r, i) => ({
      label: r.count > 1 ? `${r.label} (${r.count} lokasi)` : r.label,
      value: r.value,
      color: r.label === 'Belum ada PIC' ? '#94a3b8' : PIE_PALETTE[i % PIE_PALETTE.length],
    }));
}

/**
 * Komponen bermasalah — hanya yang Stuck atau Pending — dikelompokkan menurut
 * NAMA komponen. Menjawab "jenis komponen apa yang paling sering menahan
 * progres", karena nama yang sama berulang di banyak lokasi (mis. OCS Sensor).
 * Dibatasi 8 teratas agar legenda pie tetap terbaca; sisanya digabung.
 */
export function problemComponentBreakdown(
  components: ProgressComponent[], limit = 8,
): PieSlice[] {
  const tally = new Map<string, number>();
  for (const c of components) {
    if (c.state !== 'stuck' && c.state !== 'pending') continue;
    const key = c.label.trim() || '(tanpa nama)';
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, limit).map(([label, value], i) => ({
    label, value, color: PIE_PALETTE[i % PIE_PALETTE.length],
  }));
  const restTotal = sorted.slice(limit).reduce((s, [, v]) => s + v, 0);
  if (restTotal > 0) head.push({ label: `+${sorted.length - limit} lainnya`, value: restTotal, color: '#94a3b8' });
  return head;
}

/** Ringkasan agregat 1 proyek untuk halaman listing. */
export interface ProjectAgg { total: number; avg: number; issues: number }

/** Distribusi status seluruh proyek — pie halaman utama. */
export function projectStatusBreakdown(projects: ProgressProject[]): PieSlice[] {
  return (['done', 'in_progress', 'blocked'] as ProjectStatus[])
    .map(s => ({
      label: STATUS_CONFIG[s].label,
      value: projects.filter(p => p.status === s).length,
      color: STATUS_PIE_COLOR[s],
    }))
    .filter(d => d.value > 0);
}

/**
 * Progres tiap proyek — nilainya persentase, jadi pemakai wajib mengisi
 * centerValue sendiri (jumlah persentase tidak bermakna).
 */
export function projectProgressBreakdown(
  projects: ProgressProject[], agg: Record<string, ProjectAgg>, limit = 8,
): PieSlice[] {
  return projects
    .map(p => ({ label: p.name, value: agg[p.id]?.avg ?? 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((r, i) => ({ ...r, color: PIE_PALETTE[i % PIE_PALETTE.length] }));
}

/** Sebaran isu terbuka per proyek — menunjukkan proyek mana yang paling bermasalah. */
export function projectIssueBreakdown(
  projects: ProgressProject[], agg: Record<string, ProjectAgg>, limit = 8,
): PieSlice[] {
  return projects
    .map(p => ({ label: p.name, value: agg[p.id]?.issues ?? 0 }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((r, i) => ({ ...r, color: PIE_PALETTE[i % PIE_PALETTE.length] }));
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
 * Hak edit PENUH Project Progress: buat/hapus proyek & lokasi, sunting rekap
 * isu. Hanya admin & superadmin.
 */
export function canEditProjectProgress(role: string | null | undefined): boolean {
  return ['admin', 'superadmin'].includes((role ?? '').toLowerCase());
}

/**
 * Cakupan data yang boleh DITERIMA seorang user.
 *
 * 'all'       → admin, superadmin, dan team PTS internal.
 * 'own_sales' → role sales/guest: HANYA proyek yang mencatat namanya.
 *
 * Penting: pembatasan ini WAJIB diterapkan di level query (lihat
 * fetchProjects), bukan sekadar menyembunyikan baris saat render. Menyaring di
 * render berarti data sales lain tetap terkirim ke browser dan bisa dibaca dari
 * DevTools — padahal daftar proyek bersifat rahasia antar-sales.
 */
export type Visibility =
  | { scope: 'all' }
  | { scope: 'own_sales'; salesName: string };

export function resolveVisibility(
  role: string | null | undefined, fullName: string | null | undefined,
): Visibility {
  const r = (role ?? '').toLowerCase();
  if (['admin', 'superadmin', 'team'].includes(r)) return { scope: 'all' };
  return { scope: 'own_sales', salesName: (fullName ?? '').trim() };
}

/**
 * Apakah user ini adalah Sales yang tercatat pada lokasi tersebut.
 *
 * Sebelumnya role `sales` sepenuhnya read-only di Project Progress. Karena Item
 * Komponen kini sengaja dikosongkan saat auto-insert dan harus diisi menyusul,
 * Sales diberi akses tulis TERBATAS: hanya komponen, dan hanya pada lokasi yang
 * mencatat namanya. Jadwal, status lokasi, PIC, struktur proyek, dan rekap isu
 * tetap milik admin.
 */
export function isSalesOfLocation(
  location: { sales_name: string | null }, fullName: string | null | undefined,
): boolean {
  const me = (fullName ?? '').trim().toLowerCase();
  if (!me) return false;
  return (location.sales_name ?? '').trim().toLowerCase() === me;
}

/** Apakah user ini di-tag sebagai PIC lokasi tersebut. */
export function isPicOfLocation(
  location: { pic: string | null }, fullName: string | null | undefined,
): boolean {
  const me = (fullName ?? '').trim().toLowerCase();
  if (!me) return false;
  return (location.pic ?? '').trim().toLowerCase() === me;
}

/**
 * Lokasi yang boleh disunting user ini.
 * - Admin/superadmin: semua lokasi.
 * - Anggota team: hanya lokasi yang men-tag namanya sebagai PIC, dan hanya
 *   bagian PROGRES-nya (status komponen, catatan, foto) — lihat EditorMode.
 */
export function editableLocationIds(
  locations: ProgressLocation[], role: string | null | undefined, fullName: string | null | undefined,
): Set<string> {
  if (canEditProjectProgress(role)) return new Set(locations.map(l => l.id));
  // PIC (team) maupun Sales yang tercatat sama-sama boleh menyentuh lokasinya.
  return new Set(
    locations
      .filter(l => isPicOfLocation(l, fullName) || isSalesOfLocation(l, fullName))
      .map(l => l.id),
  );
}

/**
 * 'full' = admin/superadmin (seluruh struktur proyek).
 * 'pic'  = anggota team yang jadi PIC ATAU Sales yang tercatat pada minimal 1
 *          lokasi — keduanya hanya boleh memperbarui progres lokasinya sendiri
 *          (status komponen, item komponen, foto, catatan).
 * null   = hanya boleh melihat.
 */
export type EditorMode = 'full' | 'pic';

export function resolveEditorMode(
  locations: ProgressLocation[], role: string | null | undefined, fullName: string | null | undefined,
): EditorMode | null {
  if (canEditProjectProgress(role)) return 'full';
  const punyaLokasi = locations.some(
    l => isPicOfLocation(l, fullName) || isSalesOfLocation(l, fullName),
  );
  return punyaLokasi ? 'pic' : null;
}
