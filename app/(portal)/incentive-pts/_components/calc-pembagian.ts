import { PenerimaPeran, SkemaInsentif, hitungManagerSebagaiPic, hitungPembagian } from '@/lib/incentive-scheme';
import { supabase } from '@/lib/supabase';
import { IncentiveProjectRow, SplitResult } from './calc-tipe';

export interface OrgUser { id: string; full_name?: string | null; jabatan?: string | null; atasan_id?: string | null }

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

export async function fetchOrgUsers(): Promise<OrgUser[]> {
  const { data } = await supabase.from('users').select('id, full_name, jabatan, atasan_id');
  return (data || []) as OrgUser[];
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveUserId(idCandidate: string | null | undefined, nameCandidate: string | null | undefined, users: OrgUser[]): string {
  if (idCandidate && users.some(u => u.id === idCandidate)) return idCandidate;
  const nm = (nameCandidate || '').toLowerCase().trim();
  if (nm) {
    const byName = users.find(u => (u.full_name || '').toLowerCase().trim() === nm);
    if (byName) return byName.id;
  }
  return (idCandidate && UUID_RE.test(idCandidate)) ? idCandidate : '';
}

function orangSama(a: string | null | undefined, b: string | null | undefined): boolean {
  const rapikan = (v: string) => v.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  const x = rapikan(a ?? ''), y = rapikan(b ?? '');
  return !!x && !!y && x === y;
}

function tanpaPeranTetap(
  supports: { user_id: string; user_name: string }[],
  ...penunjuk: (string | null | undefined)[]
): { user_id: string; user_name: string }[] {
  const dipakai = penunjuk.filter(Boolean) as string[];
  return supports.filter(s => !dipakai.some(d =>
    orangSama(s.user_id, d) || orangSama(s.user_name, d)));
}

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
  installerUserId?: string | null,
): SplitResult[] {
  const supervisorJadiPic =
    orangSama(picUserId, supervisorUserId) || orangSama(picUserName, supervisorUserName);

  const support = tanpaPeranTetap(assignedSupports,
    picUserId, picUserName,
    supervisorUserId, supervisorUserName,
    managerUserId, managerUserName);

  const penerima: PenerimaPeran[] = [{ peran: 'pic', user_id: picUserId, user_name: picUserName }];
  for (const s of support) penerima.push({ peran: 'support', user_id: s.user_id, user_name: s.user_name });
  if (supervisorUserId && !supervisorJadiPic) {
    penerima.push({ peran: 'supervisor', user_id: supervisorUserId, user_name: supervisorUserName });
  }
  penerima.push({ peran: 'manager', user_id: managerUserId, user_name: managerUserName });

  return hitungPembagian(
    sk, pool, modePenyelesaian === 'remote', penerima,
    support.length > 0, supervisorJadiPic, installerName, installerUserId,
  ) as SplitResult[];
}

export function calculateManagerPicScheme(
  sk: SkemaInsentif,
  pool: number,
  modePenyelesaian: 'onsite' | 'remote' | null,
  dhanyUserId: string,
  dhanyUserName: string,
  installerName?: string | null,
  assignedSupports: { user_id: string; user_name: string }[] = [],
  installerUserId?: string | null,
): SplitResult[] {
  const support = tanpaPeranTetap(assignedSupports, dhanyUserId, dhanyUserName);

  return hitungManagerSebagaiPic(
    sk, pool, modePenyelesaian === 'remote', dhanyUserId, dhanyUserName, installerName,
    support.map(s => ({ peran: 'support', user_id: s.user_id, user_name: s.user_name })),
    installerUserId,
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
  picUserIdTerselesaikan?: string,
): SplitResult[] {
  const pool = project.incentive_value || 0;
  if (pool <= 0) return [];

  if (project.pic_type === 'manager_pic') {
    return calculateManagerPicScheme(
      sk, pool, project.mode_penyelesaian, managerUserId, managerUserName,
      project.installer_name, assignedSupports, project.installer_user_id,
    );
  }

  return calculateStandardScheme(
    sk, pool, project.mode_penyelesaian,
    picUserIdTerselesaikan || project.pic_id || '', project.assign_name || '',
    managerUserId, managerUserName,
    supervisorUserId, supervisorUserName,
    assignedSupports, project.installer_name, project.installer_user_id,
  );
}

export function validateSplitTotal(splits: SplitResult[], pool: number): { valid: boolean; diff: number } {
  const total = splits.reduce((s, r) => s + r.amount, 0);
  const diff = Math.abs(total - pool);
  return { valid: diff <= 1, diff };
}

export function generateTranches(
  sk: SkemaInsentif,
  projectId: string,
  bastDate: string,
  modePenyelesaian?: 'onsite' | 'remote' | null,
): { tranche_number: number; percentage: number; payment_year: number }[] {
  void modePenyelesaian;
  const baseYear = new Date(bastDate).getFullYear();
  return sk.tranche.map(t => ({
    tranche_number: t.nomor,
    percentage: t.persen,
    payment_year: baseYear + t.tahunKe,
  }));
}
