import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  role: 'pic' | 'support' | 'installer' | 'supervisor' | 'manager';
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
  role: 'pic' | 'support' | 'installer' | 'supervisor' | 'manager';
  user_id: string;
  user_name: string;
  percentage: number;
  amount: number;
}

// ─── Calculation Engine ───────────────────────────────────────────────────────

// Determine which supervisor team a PIC belongs to based on their name.
// Tim Wahyu: Wahyu (supervisor), Ade, Pandu
// Tim Yoga : Yoga (supervisor), Farhan, Ferdinan/Ferdinand, Deni
export function getSupervisorTeamForPic(picName: string): 'wahyu' | 'yoga' | null {
  const n = (picName || '').toLowerCase();
  if (n.includes('wahyu') || n.includes('ade') || n.includes('pandu')) return 'wahyu';
  if (n.includes('yoga') || n.includes('farhan') || n.includes('ferdin') || n.includes('deni')) return 'yoga';
  return null;
}

// StandardScheme: PIC 65% / Support 15% / Supervisor 10% / Manager 10%
// Forfeiture: if PIC IS the supervisor → supervisor 0%, manager 20%
// Fallback no support: PIC absorbs 15% → PIC 80%
// Remote: all roles ×0.85, Installer 15% (T3 carve-out, paid upfront)
export function calculateStandardScheme(
  pool: number,
  modePenyelesaian: 'onsite' | 'remote' | null,
  picUserId: string,
  picUserName: string,
  managerUserId: string,
  managerUserName: string,
  supervisorUserId: string,
  supervisorUserName: string,
  assignedSupports: { user_id: string; user_name: string }[],
): SplitResult[] {
  const results: SplitResult[] = [];
  const f = modePenyelesaian === 'remote' ? 0.85 : 1.0; // tranche factor

  // Forfeiture: PIC is the supervisor → supervisor share goes to manager
  const isForfeit = supervisorUserId !== '' && picUserId === supervisorUserId;
  const supervisorShare = isForfeit ? 0 : pool * 0.10 * f;
  const managerShare    = pool * (isForfeit ? 0.20 : 0.10) * f;
  const picBase         = pool * 0.65 * f;
  const supportPool     = pool * 0.15 * f;

  // PIC
  const hasSupport = assignedSupports.length > 0;
  results.push({
    role: 'pic',
    user_id: picUserId,
    user_name: picUserName,
    percentage: hasSupport ? 65 * f : 80 * f,
    amount: Math.round(hasSupport ? picBase : picBase + supportPool),
  });

  // Support (divided equally among assigned)
  if (hasSupport) {
    const supportEach = supportPool / assignedSupports.length;
    const supportPct  = (15 * f) / assignedSupports.length;
    for (const s of assignedSupports) {
      results.push({ role: 'support', user_id: s.user_id, user_name: s.user_name, percentage: supportPct, amount: Math.round(supportEach) });
    }
  }

  // Supervisor (skip if forfeiture)
  if (!isForfeit && supervisorUserId) {
    results.push({ role: 'supervisor', user_id: supervisorUserId, user_name: supervisorUserName, percentage: 10 * f, amount: Math.round(supervisorShare) });
  }

  // Manager (Dhany)
  results.push({ role: 'manager', user_id: managerUserId, user_name: managerUserName, percentage: isForfeit ? 20 * f : 10 * f, amount: Math.round(managerShare) });

  // Installer (Remote only — T3 carve-out 15%, paid upfront)
  if (modePenyelesaian === 'remote') {
    results.push({ role: 'installer', user_id: '', user_name: 'Installer Cabang', percentage: 15, amount: Math.round(pool * 0.15) });
  }

  return results;
}

// ManagerPicScheme: Dhany 100% onsite / Dhany 85% + Installer 15% remote
// No supervisor, no manager slot
export function calculateManagerPicScheme(
  pool: number,
  modePenyelesaian: 'onsite' | 'remote' | null,
  dhanyUserId: string,
  dhanyUserName: string,
): SplitResult[] {
  if (modePenyelesaian === 'remote') {
    return [
      { role: 'pic', user_id: dhanyUserId, user_name: dhanyUserName, percentage: 85, amount: Math.round(pool * 0.85) },
      { role: 'installer', user_id: '', user_name: 'Installer Cabang', percentage: 15, amount: Math.round(pool * 0.15) },
    ];
  }
  return [{ role: 'pic', user_id: dhanyUserId, user_name: dhanyUserName, percentage: 100, amount: pool }];
}

export function calculateIncentiveSplits(
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
    return calculateManagerPicScheme(pool, project.mode_penyelesaian, managerUserId, managerUserName);
  }

  return calculateStandardScheme(
    pool, project.mode_penyelesaian,
    project.pic_id || '', project.assign_name || '',
    managerUserId, managerUserName,
    supervisorUserId, supervisorUserName,
    assignedSupports,
  );
}

export function validateSplitTotal(splits: SplitResult[], pool: number): { valid: boolean; diff: number } {
  const total = splits.reduce((s, r) => s + r.amount, 0);
  const diff = Math.abs(total - pool);
  return { valid: diff <= 1, diff };
}

// ─── Tranche Generation ──────────────────────────────────────────────────────

export function generateTranches(
  projectId: string,
  bastDate: string,
  modePenyelesaian?: 'onsite' | 'remote' | null,
): { tranche_number: number; percentage: number; payment_year: number }[] {
  const baseYear = new Date(bastDate).getFullYear();
  const isRemote = modePenyelesaian === 'remote';
  return [
    { tranche_number: 1, percentage: 50, payment_year: baseYear + 1 },
    { tranche_number: 2, percentage: 35, payment_year: baseYear + 2 },
    // Remote: T3 = Installer carve-out, paid upfront at same year as T1 (N+1), not N+3
    { tranche_number: 3, percentage: 15, payment_year: isRemote ? baseYear + 1 : baseYear + 3 },
  ];
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

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

export async function fetchSupportFromTickets(projectName: string): Promise<{ data: { user_id: string; user_name: string }[]; error: unknown }> {
  const { data, error } = await supabase
    .from('reminders')
    .select('assigned_to, assign_name')
    .eq('category', 'Troubleshooting')
    .eq('project_name', projectName)
    .eq('status', 'done');
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

export async function insertTranches(projectId: string, bastDate: string, modePenyelesaian?: 'onsite' | 'remote' | null) {
  const tranches = generateTranches(projectId, bastDate, modePenyelesaian);
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

  // Pre-fetch Wahyu and Yoga for supervisor lookup
  const { data: supUsers } = await supabase.from('users').select('id, full_name').or('full_name.ilike.%wahyu%,full_name.ilike.%yoga%');
  const wahyu = supUsers?.find(u => (u.full_name || '').toLowerCase().includes('wahyu'));
  const yoga  = supUsers?.find(u => (u.full_name || '').toLowerCase().includes('yoga'));

  let processed = 0;
  const errors: string[] = [];

  for (const tranche of dueTranches) {
    const project = tranche.project as unknown as IncentiveProjectRow;
    if (!project) { errors.push(`Tranche ${tranche.id}: project not found`); continue; }
    if (!project.mode_penyelesaian) { errors.push(`Project "${project.project_name}": mode_penyelesaian kosong`); continue; }

    // Determine supervisor based on PIC's team (reporting line)
    const supTeam = getSupervisorTeamForPic(project.assign_name);
    const supUser = supTeam === 'wahyu' ? wahyu : supTeam === 'yoga' ? yoga : null;
    const supervisorUserId   = (supUser?.id   || '') as string;
    const supervisorUserName = (supUser?.full_name || 'Supervisor') as string;

    const { data: supports } = await fetchSupportFromTickets(project.project_name);
    const splits = calculateIncentiveSplits(
      project, managerUserId, managerUserName,
      supervisorUserId, supervisorUserName,
      (supports || []).map(s => ({ user_id: s.user_id, user_name: s.user_name || '' })),
    );

    const pool = project.incentive_value || 0;
    const isRemote = project.mode_penyelesaian === 'remote';
    const tranchePool = pool * (tranche.percentage / 100);

    let trancheSplits: SplitResult[];
    if (isRemote && tranche.tranche_number === 3) {
      // T3 Remote: Installer carve-out only, paid upfront
      trancheSplits = [{
        role: 'installer', user_id: '',
        user_name: project.installer_name || 'Installer Cabang',
        percentage: 15, amount: Math.round(pool * 0.15),
      }];
    } else if (isRemote) {
      // T1/T2 Remote: exclude installer, scale within the 85% base
      trancheSplits = splits
        .filter(s => s.role !== 'installer')
        .map(s => ({ ...s, amount: Math.round(s.amount * (tranche.percentage / 85)) }));
    } else {
      // Onsite: all splits (no installer) scaled by tranche %
      trancheSplits = splits.map(s => ({ ...s, amount: Math.round(s.amount * (tranche.percentage / 100)) }));
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

// ─── Formatting ───────────────────────────────────────────────────────────────

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
