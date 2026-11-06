import { type Akun } from '@/lib/checklist/server';
import { type KonteksAksi } from '@/lib/integrasi/bantu';


export const STATUS_TIKET = ['Waiting Approval', 'Pending', 'Call', 'Onsite', 'In Progress', 'Pending Action', 'Overdue', 'Solved', 'Rejected'];
export const STATUS_PTS = ['Waiting Approval', 'Pending', 'Call', 'Onsite', 'In Progress', 'Pending Action', 'Solved'];
export const KATEGORI_DR = ['Demo Product', 'Meeting & Survey', 'Konfigurasi', 'Konfigurasi & Training', 'Troubleshooting',
  'Training', 'Maintenance', 'Standby Event', 'Internal', 'Design Single Line Diagram', 'Research and Development'];

export const STATUS_DESAIN = ['pending', 'approved', 'in_progress', 'completed', 'rejected'];

export function statusResmi(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase();
  return STATUS_TIKET.find(x => x.toLowerCase() === s) ?? null;
}

export async function akunChecklist(k: KonteksAksi): Promise<Akun> {
  const { data: pim } = await k.admin.from('users').select('pimpinan').eq('id', k.u.id).maybeSingle();
  return { id: k.u.id, nama: (k.u.full_name || k.u.username || '').trim(), role: k.u.role ?? '',
    pimpinan: (pim as { pimpinan?: boolean } | null)?.pimpinan === true };
}
