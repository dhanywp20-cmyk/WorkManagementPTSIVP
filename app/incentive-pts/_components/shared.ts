import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IncentiveProject {
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
  execution_mode: 'onsite' | 'remote' | null;
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
  project?: IncentiveProject;
}

export interface IncentiveSplit {
  id: string;
  project_id: string;
  tranche_id: string | null;
  role: 'pic' | 'support' | 'installer' | 'manager' | 'supervisor';
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
  role: 'pic' | 'support' | 'installer' | 'manager' | 'supervisor';
  user_id: string;
  user_name: string;
  percentage: number;
  amount: number;
}

// ─── Calculation Engine ───────────────────────────────────────────────────────

// 4-role standard scheme: PIC 65% / Support 15% / Supervisor 10% / Manager 10%
export function calculateStandardScheme(
  pool: number,
  executionMode: 'onsite' | 'remote' | null,
  picUserId: string,
  picUserName: string,
  supervisorUserId: string,
  supervisorUserName: string,
  managerUserId: string,
  managerUserName: string,
  assignedSupports: { user_id: string; user_name: string }[],
): SplitResult[] {
  const results: SplitResult[] = [];
  const trancheFactor = executionMode === 'remote' ? 0.85 : 1.0;

  const hasSupervisor = !!supervisorUserId;
  const supervisorPct = hasSupervisor ? 10 : 0;
  const supportBasePct = 15;
  const picBasePct = 100 - 10 - supervisorPct - supportBasePct; // 65 with sup, 80 without

  const managerShare = pool * 0.10 * trancheFactor;
  const supervisorShare = pool * (supervisorPct / 100) * trancheFactor;
  const supportPool = pool * (supportBasePct / 100) * trancheFactor;
  const picPool = pool * (picBasePct / 100) * trancheFactor;

  // Manager
  results.push({
    role: 'manager',
    user_id: managerUserId,
    user_name: managerUserName,
    percentage: 10 * trancheFactor,
    amount: Math.round(managerShare),
  });

  // Supervisor (only if assigned)
  if (hasSupervisor) {
    results.push({
      role: 'supervisor',
      user_id: supervisorUserId,
      user_name: supervisorUserName,
      percentage: supervisorPct * trancheFactor,
      amount: Math.round(supervisorShare),
    });
  }

  if (assignedSupports.length > 0) {
    results.push({
      role: 'pic',
      user_id: picUserId,
      user_name: picUserName,
      percentage: picBasePct * trancheFactor,
      amount: Math.round(picPool),
    });
    const supportEach = supportPool / assignedSupports.length;
    const supportPctEach = (supportBasePct * trancheFactor) / assignedSupports.length;
    for (const s of assignedSupports) {
      results.push({
        role: 'support',
        user_id: s.user_id,
        user_name: s.user_name,
        percentage: supportPctEach,
        amount: Math.round(supportEach),
      });
    }
  } else {
    // No support — PIC absorbs support pool
    results.push({
      role: 'pic',
      user_id: picUserId,
      user_name: picUserName,
      percentage: (picBasePct + supportBasePct) * trancheFactor,
      amount: Math.round(picPool + supportPool),
    });
  }

  // Installer (remote only)
  if (executionMode === 'remote') {
    results.push({
      role: 'installer',
      user_id: '',
      user_name: 'Installer Cabang',
      percentage: 15,
      amount: Math.round(pool * 0.15),
    });
  }

  return results;
}

export function calculateManagerPicScheme(
  pool: number,
  executionMode: 'onsite' | 'remote' | null,
  dhanyUserId: string,
  dhanyUserName: string,
): SplitResult[] {
  const results: SplitResult[] = [];

  if (executionMode === 'remote') {
    // Dhany gets 85%, Installer gets 15%
    results.push({
      role: 'pic',
      user_id: dhanyUserId,
      user_name: dhanyUserName,
      percentage: 85,
      amount: Math.round(pool * 0.85),
    });
    results.push({
      role: 'installer',
      user_id: '',
      user_name: 'Installer Cabang',
      percentage: 15,
      amount: Math.round(pool * 0.15),
    });
  } else {
    // Onsite: Dhany gets 100%
    results.push({
      role: 'pic',
      user_id: dhanyUserId,
      user_name: dhanyUserName,
      percentage: 100,
      amount: pool,
    });
  }

  return results;
}

export function calculateIncentiveSplits(
  project: IncentiveProject,
  supervisorUserId: string,
  supervisorUserName: string,
  managerUserId: string,
  managerUserName: string,
  assignedSupports: { user_id: string; user_name: string }[],
): SplitResult[] {
  const pool = project.incentive_value || 0;
  if (pool <= 0) return [];

  const picUserId = project.pic_id || '';
  const picUserName = project.assign_name || '';

  if (project.pic_type === 'manager_pic') {
    return calculateManagerPicScheme(pool, project.execution_mode, managerUserId, managerUserName);
  }

  return calculateStandardScheme(pool, project.execution_mode, picUserId, picUserName, supervisorUserId, supervisorUserName, managerUserId, managerUserName, assignedSupports);
}

// Validate total splits = pool (tolerance Rp 1)
export function validateSplitTotal(splits: SplitResult[], pool: number): { valid: boolean; diff: number } {
  const total = splits.reduce((s, r) => s + r.amount, 0);
  const diff = Math.abs(total - pool);
  return { valid: diff <= 1, diff };
}

// ─── Tranche Generation ──────────────────────────────────────────────────────

export function generateTranches(projectId: string, bastDate: string): { tranche_number: number; percentage: number; payment_year: number }[] {
  const baseYear = new Date(bastDate).getFullYear();
  return [
    { tranche_number: 1, percentage: 50, payment_year: baseYear + 1 },
    { tranche_number: 2, percentage: 35, payment_year: baseYear + 2 },
    { tranche_number: 3, percentage: 15, payment_year: baseYear + 3 },
  ];
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

export async function fetchIncentiveProjects() {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .gt('incentive_value', 0)
    .order('created_at', { ascending: false });
  return { data: (data || []) as IncentiveProject[], error };
}

export async function fetchTranches(filters?: { payment_year?: number; status?: string }) {
  let q = supabase.from('incentive_tranches').select('*, project:reminders(*)').order('payment_year');
  if (filters?.payment_year) q = q.eq('payment_year', filters.payment_year);
  if (filters?.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  return { data: (data || []) as (IncentiveTranche & { project: IncentiveProject })[], error };
}

export async function fetchSplits(projectId?: string) {
  let q = supabase.from('incentive_splits').select('*').order('created_at');
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  return { data: (data || []) as IncentiveSplit[], error };
}

export async function fetchSupportAssignments(projectId: string) {
  const { data, error } = await supabase
    .from('ticket_support_assignment')
    .select('*')
    .eq('project_id', projectId);
  return { data: (data || []) as SupportAssignment[], error };
}

export async function fetchLateTickets(parentProjectId?: string) {
  let q = supabase.from('late_ticket_links').select('*').order('attached_at', { ascending: false });
  if (parentProjectId) q = q.eq('parent_project_id', parentProjectId);
  const { data, error } = await q;
  return { data: (data || []) as LateTicketLink[], error };
}

export async function insertTranches(projectId: string, bastDate: string) {
  const tranches = generateTranches(projectId, bastDate);
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

export async function processYearlyBatch(
  processingYear: number,
  managerUserId: string,
  managerUserName: string,
  supervisorUserId: string,
  supervisorUserName: string,
) {
  const { data: dueTranches, error: fetchErr } = await supabase
    .from('incentive_tranches')
    .select('*, project:reminders(*)')
    .eq('payment_year', processingYear)
    .eq('status', 'pending');

  if (fetchErr || !dueTranches) return { error: fetchErr, processed: 0 };

  let processed = 0;
  const errors: string[] = [];

  for (const tranche of dueTranches) {
    const project = tranche.project as unknown as IncentiveProject;
    if (!project) { errors.push(`Tranche ${tranche.id}: project not found`); continue; }
    if (!project.execution_mode) { errors.push(`Project "${project.project_name}": execution_mode kosong`); continue; }

    const { data: supports } = await fetchSupportAssignments(project.id);
    const splits = calculateIncentiveSplits(
      project, supervisorUserId, supervisorUserName, managerUserId, managerUserName,
      (supports || []).map(s => ({ user_id: s.user_id, user_name: s.user_name || '' })),
    );

    // Apply tranche percentage
    const tranchePool = (project.incentive_value || 0) * (tranche.percentage / 100);
    const trancheSplits = splits.map(s => ({
      ...s,
      amount: Math.round(s.amount * (tranche.percentage / 100)),
    }));

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
  supervisor: { label: 'Supervisor', color: '#0369a1', bg: 'rgba(3,105,161,0.12)'   },
  manager:    { label: 'Manager',    color: '#059669', bg: 'rgba(5,150,105,0.12)'   },
  installer:  { label: 'Installer',  color: '#d97706', bg: 'rgba(217,119,6,0.12)'   },
};

export const TRANCHE_STATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'Pending', color: '#92400e', bg: '#fef3c7', icon: '⏳' },
  processed: { label: 'Processed', color: '#1e40af', bg: '#dbeafe', icon: '📋' },
  paid: { label: 'Paid', color: '#065f46', bg: '#d1fae5', icon: '✅' },
};
