import { supabase } from '@/lib/supabase';
import {
  SkemaInsentif, PenerimaPeran, hitungPembagian, hitungManagerSebagaiPic, ambilSkema,
  persenInstaller, bagikanTepat,
} from '@/lib/incentive-scheme';

export type { SkemaInsentif };
export { ambilSkema, persenInstaller, bagikanTepat };

// Types

export interface IncentiveProjectRow {
  id: string;
  project_name: string;
  category: string;
  assigned_to: string;
  assign_name: string;
  status: string;
  requires_controller_automation: boolean;
  controller_automation_brand: string | null;
  pic_type: 'standard' | 'manager_pic';
  pic_id: string | null;
  domain_owner: string | null;
  mode_penyelesaian: 'onsite' | 'remote' | null;
  installer_name: string | null;
  installer_daerah: string | null;
  bast_date: string | null;
  incentive_value: number;
  sales_name: string;
  sales_division: string;
  address: string;
  product: string;
  created_at: string;
  due_date: string;
}

export interface IncentiveTranche {
  id: string;
  project_id: string;
  tranche_number: number;
  percentage: number;
  payment_year: number;
  status: 'pending' | 'processed' | 'paid';
  processed_at: string | null;
  paid_at: string | null;
  created_at: string;
  project?: IncentiveProjectRow;
}

export interface IncentiveSplit {
  id: string;
  project_id: string;
  tranche_id: string | null;
  /** Kunci peran; bebas karena peran baru bisa ditambah lewat Pengaturan. */
  role: string;
  user_id: string;
  user_name: string;
  percentage: number;
  amount: number;
  source_ticket_id: string | null;
  created_at: string;
}

export interface SupportAssignment {
  id: string;
  ticket_id: string | null;
  project_id: string;
  user_id: string;
  user_name: string;
  domain: string;
  assigned_by: string | null;
  assigned_at: string;
}

export interface LateTicketLink {
  id: string;
  late_ticket_id: string;
  parent_project_id: string;
  attached_tranche_number: number;
  attached_at: string;
  note: string | null;
  ticket_value: number;
  is_sunset: boolean;
}

export interface SplitResult {
  /** Kunci peran; bukan union tertutup karena peran baru bisa ditambah admin. */
  role: string;
  user_id: string;
  user_name: string;
  percentage: number;
  amount: number;
}

// Calculation Engine

// Org hierarchy lookup - baca dari Struktur Organisasi (users.atasan_id + jabatan)
// JANGAN hardcode nama di code. Manager & Supervisor ditentukan dari pohon atasan
// yang dikelola di Admin Panel  User Management  Struktur Organisasi.
export interface OrgUser { id: string; full_name?: string | null; jabatan?: string | null; atasan_id?: string | null }

// Telusuri rantai atasan ke atas (TERMASUK node awal)  user pertama dengan jabatan cocok.
// Untuk PIC staff: Supervisor = atasan langsung yg ber-jabatan Supervisor; Manager = di atasnya lagi.
// Kalau PIC sendiri ber-jabatan Supervisor, ia dikembalikan sebagai supervisor (memicu forfeiture).
export function findUpline(startId: string, targetJabatan: string, users: OrgUser[]): OrgUser | null {
  let cur: OrgUser | undefined = users.find(u => u.id === startId);
  let guard = 0;
  while (cur && guard < 60) {
    if ((cur.jabatan || '') === targetJabatan) return cur;
    cur = cur.atasan_id ? users.find(u => u.id === cur!.atasan_id) : undefined;
    guard++;
  }
  return null;
}

// Tahan-error: kalau kolom atasan_id belum ada (migration belum jalan), kembalikan [].
export async function fetchOrgUsers(): Promise<OrgUser[]> {
  const { data } = await supabase.from('users').select('id, full_name, jabatan, atasan_id');
  return (data || []) as OrgUser[];
}

// Resolve user id dari kandidat id ATAU nama. reminders.assigned_to belum tentu
// UUID user - fallback cocokkan via full_name (assign_name) supaya walk-up atasan jalan.
export function resolveUserId(idCandidate: string | null | undefined, nameCandidate: string | null | undefined, users: OrgUser[]): string {
  if (idCandidate && users.some(u => u.id === idCandidate)) return idCandidate;
  const nm = (nameCandidate || '').toLowerCase().trim();
  if (nm) {
    const byName = users.find(u => (u.full_name || '').toLowerCase().trim() === nm);
    if (byName) return byName.id;
  }
  return idCandidate || '';
}

// Deprecated - name-based fallback lama. Hanya dipakai bila Struktur Organisasi belum diisi.
export function getSupervisorTeamForPic(picName: string): 'wahyu' | 'yoga' | null {
  const n = (picName || '').toLowerCase();
  if (n.includes('wahyu') || n.includes('ade') || n.includes('pandu')) return 'wahyu';
  if (n.includes('yoga') || n.includes('farhan') || n.includes('ferdin') || n.includes('deni')) return 'yoga';
  return null;
}

/**
 * Pembagian mengikuti SKEMA yang diatur admin. Angka porsinya tidak ditulis di
 * sini melainkan dibaca dari lib/incentive-scheme.ts (tabel
 * incentive_scheme_settings), supaya perubahan kebijakan cukup dilakukan lewat
 * layar Pengaturan.
 */
export function calculateStandardScheme(
  sk: SkemaInsentif,
  pool: number,
  modePenyelesaian: 'onsite' | 'remote' | null,
  picUserId: string,
  picUserName: string,
  managerUserId: string,
  managerUserName: string,
  supervisorUserId: string,
  supervisorUserName: string,
  assignedSupports: { user_id: string; user_name: string }[],
  installerName?: string | null,
): SplitResult[] {
  // Supervisor merangkap PIC - porsinya dialihkan, bukan dibayar dua kali.
  const supervisorJadiPic = supervisorUserId !== '' && picUserId === supervisorUserId;

  const penerima: PenerimaPeran[] = [{ peran: 'pic', user_id: picUserId, user_name: picUserName }];
  for (const s of assignedSupports) penerima.push({ peran: 'support', user_id: s.user_id, user_name: s.user_name });
  if (supervisorUserId && !supervisorJadiPic) {
    penerima.push({ peran: 'supervisor', user_id: supervisorUserId, user_name: supervisorUserName });
  }
  penerima.push({ peran: 'manager', user_id: managerUserId, user_name: managerUserName });

  return hitungPembagian(
    sk, pool, modePenyelesaian === 'remote', penerima,
    assignedSupports.length > 0, supervisorJadiPic, installerName,
  ) as SplitResult[];
}

/** Manager sendiri yang menjadi PIC - tanpa slot Supervisor & Manager terpisah. */
export function calculateManagerPicScheme(
  sk: SkemaInsentif,
  pool: number,
  modePenyelesaian: 'onsite' | 'remote' | null,
  dhanyUserId: string,
  dhanyUserName: string,
  installerName?: string | null,
): SplitResult[] {
  return hitungManagerSebagaiPic(
    sk, pool, modePenyelesaian === 'remote', dhanyUserId, dhanyUserName, installerName,
  ) as SplitResult[];
}

export function calculateIncentiveSplits(
  sk: SkemaInsentif,
  project: IncentiveProjectRow,
  managerUserId: string,
  managerUserName: string,
  supervisorUserId: string,
  supervisorUserName: string,
  assignedSupports: { user_id: string; user_name: string }[],
): SplitResult[] {
  const pool = project.incentive_value || 0;
  if (pool <= 0) return [];

  if (project.pic_type === 'manager_pic') {
    return calculateManagerPicScheme(sk, pool, project.mode_penyelesaian, managerUserId, managerUserName, project.installer_name);
  }

  return calculateStandardScheme(
    sk, pool, project.mode_penyelesaian,
    project.pic_id || '', project.assign_name || '',
    managerUserId, managerUserName,
    supervisorUserId, supervisorUserName,
    assignedSupports, project.installer_name,
  );
}

export function validateSplitTotal(splits: SplitResult[], pool: number): { valid: boolean; diff: number } {
  const total = splits.reduce((s, r) => s + r.amount, 0);
  const diff = Math.abs(total - pool);
  return { valid: diff <= 1, diff };
}

// Tranche Generation

/**
 * Tahapan pencairan diambil dari skema, bukan dipatok di sini.
 *
 * Pengecualian yang tetap ada: bila Installer Cabang memang diberi porsi DAN
 * disetel dibayar di muka, tahap terakhir dipindah ke tahun pertama - sebab
 * itulah tahap yang menampung porsinya. Bila porsi Installer 0 (keadaan saat
 * ini), tidak ada yang perlu dipindah dan seluruh tahap berjalan normal.
 */
export function generateTranches(
  sk: SkemaInsentif,
  projectId: string,
  bastDate: string,
  modePenyelesaian?: 'onsite' | 'remote' | null,
): { tranche_number: number; percentage: number; payment_year: number }[] {
  const baseYear = new Date(bastDate).getFullYear();
  const installerDiMuka =
    persenInstaller(sk, modePenyelesaian === 'remote') > 0 && sk.installerBayarDiMuka;
  const terakhir = sk.tranche.length ? Math.max(...sk.tranche.map(t => t.nomor)) : 0;
  return sk.tranche.map(t => ({
    tranche_number: t.nomor,
    percentage: t.persen,
    payment_year: baseYear + (installerDiMuka && t.nomor === terakhir ? 1 : t.tahunKe),
  }));
}

// DB Helpers

export const INCENTIVE_CATEGORIES = ['Konfigurasi', 'Konfigurasi & Training', 'Training'] as const;

export async function fetchIncentiveProjects() {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .in('category', ['Konfigurasi', 'Konfigurasi & Training', 'Training'])
    .eq('status', 'done')
    .order('due_date', { ascending: false });
  return { data: (data || []) as IncentiveProjectRow[], error };
}

export async function fetchTranches(filters?: { payment_year?: number; status?: string }) {
  let q = supabase.from('incentive_tranches').select('*, project:reminders(*)').order('payment_year');
  if (filters?.payment_year) q = q.eq('payment_year', filters.payment_year);
  if (filters?.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  return { data: (data || []) as (IncentiveTranche & { project: IncentiveProjectRow })[], error };
}

export async function fetchSplits(projectId?: string) {
  let q = supabase.from('incentive_splits').select('*').order('created_at');
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  return { data: (data || []) as IncentiveSplit[], error };
}

/**
 * Baca splits lewat server route dengan filter privasi (admin/allow_incentive_input
 * lihat semua; selain itu hanya jatahnya sendiri). Dipakai UI menggantikan
 * fetchSplits setelah RLS incentive_splits dikunci dari anon.
 */
export async function fetchVisibleSplits(projectId?: string): Promise<{ data: IncentiveSplit[]; error: unknown }> {
  try {
    const url = projectId
      ? `/api/incentive/splits?projectId=${encodeURIComponent(projectId)}`
      : '/api/incentive/splits';
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { data: [], error: { message: json.error || 'Gagal memuat data incentive' } };
    return { data: (json.data || []) as IncentiveSplit[], error: null };
  } catch (e) {
    return { data: [], error: e };
  }
}

/**
 * Siapa saja yang tercatat membantu troubleshooting proyek ini. Yang dibaca
 * tetap catatan Troubleshooting di Reminder Schedule; hanya rentang waktunya
 * yang disaring.
 *
 * @param bastDate     tanggal BAST, awal jendela penilaian
 * @param jendelaBulan lama jendela penilaian dalam bulan, diatur admin di
 *                     layar Skema Pembagian. Bantuan setelah jendela lewat
 *                     tidak lagi mengubah porsi. 0 = tanpa batas waktu.
 */
export async function fetchSupportFromTickets(
  projectName: string,
  bastDate?: string | null,
  jendelaBulan = 0,
): Promise<{ data: { user_id: string; user_name: string }[]; error: unknown }> {
  let q = supabase
    .from('reminders')
    .select('assigned_to, assign_name')
    .eq('category', 'Troubleshooting')
    .eq('project_name', projectName)
    .eq('status', 'done');

  if (bastDate && jendelaBulan > 0) {
    const batas = new Date(bastDate);
    batas.setMonth(batas.getMonth() + jendelaBulan);
    q = q.lte('due_date', batas.toISOString().slice(0, 10));
  }

  const { data, error } = await q;
  const seen = new Set<string>();
  const rows = (data || []) as { assigned_to: string | null; assign_name: string | null }[];
  const unique = rows
    .filter(r => r.assigned_to && !seen.has(r.assigned_to) && seen.add(r.assigned_to))
    .map(r => ({ user_id: r.assigned_to as string, user_name: r.assign_name || '' }));
  return { data: unique, error };
}

export async function fetchLateTickets(parentProjectId?: string) {
  let q = supabase.from('late_ticket_links').select('*').order('attached_at', { ascending: false });
  if (parentProjectId) q = q.eq('parent_project_id', parentProjectId);
  const { data, error } = await q;
  return { data: (data || []) as LateTicketLink[], error };
}

export async function insertTranches(sk: SkemaInsentif, projectId: string, bastDate: string, modePenyelesaian?: 'onsite' | 'remote' | null) {
  const tranches = generateTranches(sk, projectId, bastDate, modePenyelesaian);
  const rows = tranches.map(t => ({
    project_id: projectId,
    tranche_number: t.tranche_number,
    percentage: t.percentage,
    payment_year: t.payment_year,
    status: 'pending',
  }));
  return supabase.from('incentive_tranches').insert(rows);
}

export async function insertSplits(
  projectId: string,
  trancheId: string | null,
  splits: SplitResult[],
  sourceTicketId?: string | null,
) {
  const rows = splits.map(s => ({
    project_id: projectId,
    tranche_id: trancheId,
    role: s.role,
    user_id: s.user_id || null,
    user_name: s.user_name,
    percentage: s.percentage,
    amount: s.amount,
    source_ticket_id: sourceTicketId || null,
  }));
  return supabase.from('incentive_splits').insert(rows);
}

export async function processYearlyBatch(processingYear: number, managerUserId: string, managerUserName: string) {
  const { data: dueTranches, error: fetchErr } = await supabase
    .from('incentive_tranches')
    .select('*, project:reminders(*)')
    .eq('payment_year', processingYear)
    .eq('status', 'pending');

  if (fetchErr || !dueTranches) return { error: fetchErr, processed: 0 };

  // Skema dibaca SEKALI di depan: seluruh proyek dalam satu batch harus dihitung
  // dengan aturan yang sama persis. Membacanya per proyek membuka celah setengah
  // batch memakai aturan lama bila admin menyimpan perubahan di tengah proses.
  const sk = await ambilSkema();

  // Baca hierarki dari Struktur Organisasi (users.atasan_id + jabatan).
  // Fallback transisi: pts_team_mappings bila atasan_id belum dipetakan.
  const orgUsers = await fetchOrgUsers();
  type PtsMap = { staff_user_id: string; supervisor_user_id: string; supervisor: { id: string; full_name: string } };
  const { data: ptsTeamData } = await supabase.from('pts_team_mappings').select('staff_user_id, supervisor_user_id, supervisor:users!supervisor_user_id(id, full_name)');

  let processed = 0;
  const errors: string[] = [];

  for (const tranche of dueTranches) {
    const project = tranche.project as unknown as IncentiveProjectRow;
    if (!project) { errors.push(`Tranche ${tranche.id}: project not found`); continue; }
    if (!project.mode_penyelesaian) { errors.push(`Project "${project.project_name}": mode_penyelesaian kosong`); continue; }

    // Manager & Supervisor dari pohon atasan PIC (Struktur Organisasi)
    const picId = resolveUserId(project.pic_id || project.assigned_to, project.assign_name, orgUsers);
    const supUp = findUpline(picId, 'Supervisor', orgUsers);
    const mgrUp = findUpline(picId, 'Manager', orgUsers);
    const ptsMap = (ptsTeamData as PtsMap[] | null)?.find(m => m.staff_user_id === project.assigned_to);
    const supervisorUserId   = supUp?.id || ptsMap?.supervisor_user_id || '';
    const supervisorUserName = supUp?.full_name || ptsMap?.supervisor?.full_name || 'Supervisor';
    const projManagerId   = mgrUp?.id || managerUserId;
    const projManagerName = mgrUp?.full_name || managerUserName;

    const { data: supports } = await fetchSupportFromTickets(project.project_name, project.bast_date, sk.jendelaSupportBulan);
    const splits = calculateIncentiveSplits(
      sk, project, projManagerId, projManagerName,
      supervisorUserId, supervisorUserName,
      (supports || []).map(s => ({ user_id: s.user_id, user_name: s.user_name || '' })),
    );

    const pool = project.incentive_value || 0;

    // Porsi Installer & tahapan pencairan
    // Bila Installer Cabang diberi porsi DAN disetel dibayar di muka, tahap
    // terakhir menampung porsinya utuh dan porsi Tim PTS dibagi ke tahap
    // sisanya sebanding dengan persentase tahap itu. Cara ini membuat jumlahnya
    // tetap tepat berapa pun angka yang disetel admin, bukan hanya saat porsi
    // Installer kebetulan sama dengan persentase tahap terakhir.
    const pctInstaller = persenInstaller(sk, project.mode_penyelesaian === 'remote');
    const tahapTerakhir = sk.tranche.length ? Math.max(...sk.tranche.map(t => t.nomor)) : 0;
    const installerAmbilTahapTerakhir = pctInstaller > 0 && sk.installerBayarDiMuka;
    const tahapTim = sk.tranche.filter(t => !installerAmbilTahapTerakhir || t.nomor !== tahapTerakhir);
    const totalTahapTim = tahapTim.reduce((n, t) => n + (t.persen || 0), 0) || 100;

    let trancheSplits: SplitResult[];
    let tranchePool: number;

    if (installerAmbilTahapTerakhir && tranche.tranche_number === tahapTerakhir) {
      tranchePool = Math.round((pool * pctInstaller) / 100);
      trancheSplits = [{
        role: 'installer', user_id: '',
        user_name: project.installer_name || 'Installer Cabang',
        percentage: pctInstaller, amount: tranchePool,
      }];
    } else {
      // Bagian tahap ini terhadap seluruh porsi Tim PTS.
      const bagian = (tranche.percentage || 0) / totalTahapTim;
      //  Pool tahap ini DIBULATKAN dulu. Sebelumnya ia dibiarkan pecahan
      //  (mis. 13.259.488,50) lalu dibandingkan dengan jumlah rupiah bulat -
      //  perbandingan yang tidak pernah bisa pas, dan itulah sebab separuh
      //  tranche ditolak "split total mismatch" padahal angkanya benar.
      tranchePool = Math.round(pool * ((100 - pctInstaller) / 100) * bagian);
      const timSaja = splits.filter(s => s.role !== 'installer');
      //  Dibagi habis ke sesama anggota tim: persentase dinormalkan ke porsi
      //  tim (bukan ke pool penuh) supaya jumlahnya persis tranchePool.
      const totalPctTim = timSaja.reduce((n, s) => n + s.percentage, 0) || 1;
      const rupiahTahap = bagikanTepat(tranchePool, timSaja.map(s => (s.percentage / totalPctTim) * 100));
      trancheSplits = timSaja.map((s, i) => ({ ...s, amount: rupiahTahap[i] }));
    }

    const validation = validateSplitTotal(trancheSplits, tranchePool);
    if (!validation.valid) {
      errors.push(`Project "${project.project_name}" tranche ${tranche.tranche_number}: split total mismatch (diff: Rp ${validation.diff})`);
      continue;
    }

    const { error: splitErr } = await insertSplits(project.id, tranche.id, trancheSplits);
    if (splitErr) { errors.push(`Insert splits failed: ${splitErr.message}`); continue; }

    await supabase.from('incentive_tranches').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('id', tranche.id);
    processed++;
  }

  return { processed, errors, total: dueTranches.length };
}

// Formatting

export function formatRupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export function formatPct(n: number): string {
  return n.toFixed(1) + '%';
}

export const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pic:        { label: 'PIC',        color: '#2563eb', bg: 'rgba(37,99,235,0.12)'   },
  support:    { label: 'Support',    color: '#7c3aed', bg: 'rgba(124,58,237,0.12)'  },
  supervisor: { label: 'Supervisor', color: '#0891b2', bg: 'rgba(8,145,178,0.12)'   },
  manager:    { label: 'Manager',    color: '#059669', bg: 'rgba(5,150,105,0.12)'   },
  installer:  { label: 'Installer',  color: '#d97706', bg: 'rgba(217,119,6,0.12)'   },
};

export const TRANCHE_STATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: 'Pending',   color: '#92400e', bg: '#fef3c7', icon: '⏳' },
  processed: { label: 'Processed', color: '#1e40af', bg: '#dbeafe', icon: '📋' },
  paid:      { label: 'Paid',      color: '#065f46', bg: '#d1fae5', icon: '✅' },
};
