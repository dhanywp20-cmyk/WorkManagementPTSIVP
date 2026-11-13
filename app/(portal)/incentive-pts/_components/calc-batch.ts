import { ambilPetaNominal } from '@/lib/incentive/nominal-api';
import type { TablesInsert } from '@/types/database';
import { SkemaInsentif, ambilSkema, labelSkema } from '@/lib/incentive/scheme';
import { hitungSplitTahap } from '@/lib/incentive/tahap';
import { createNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { formatRupiah } from './calc-format';
import { UUID_RE, calculateIncentiveSplits, fetchOrgUsers, findUpline, generateTranches, resolveUserId, validateSplitTotal } from './calc-pembagian';
import { fetchSupportFromTickets, idTiketLampiranTahap, jendelaSupportTahap } from './calc-support';
import { IncentiveProjectRow, SplitResult } from './calc-tipe';

export async function insertTranches(sk: SkemaInsentif, projectId: string, bastDate: string, modePenyelesaian?: 'onsite' | 'remote' | null) {
  const tranches = generateTranches(sk, projectId, bastDate, modePenyelesaian);
  const label = labelSkema(sk, new Date().toISOString(), null);
  const rows = tranches.map(t => ({
    project_id: projectId,
    tranche_number: t.tranche_number,
    percentage: t.percentage,
    payment_year: t.payment_year,
    status: 'pending',
    scheme_snapshot: sk as unknown as Record<string, unknown>,
    scheme_label: label,
  }));
  return supabase.from('incentive_tranches').insert(rows as TablesInsert<'incentive_tranches'>[]);
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
    user_id: (s.user_id && UUID_RE.test(s.user_id)) ? s.user_id : null,
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

  const nominal = await ambilPetaNominal();
  if (nominal.error) return { error: nominal.error, processed: 0 };
  if (!nominal.terbuka) {
    return { error: { message: 'Hanya pemegang akses input/penuh Incentive PTS yang boleh memproses tahapan.' }, processed: 0 };
  }

  const skTerkini = await ambilSkema();

  const orgUsers = await fetchOrgUsers();
  type PtsMap = { staff_user_id: string; supervisor_user_id: string; supervisor: { id: string; full_name: string } };
  const { data: ptsTeamData } = await supabase.from('pts_team_mappings').select('staff_user_id, supervisor_user_id, supervisor:users!supervisor_user_id(id, full_name)');

  let processed = 0;
  const errors: string[] = [];

  for (const tranche of dueTranches) {
    const project = tranche.project as unknown as IncentiveProjectRow;
    if (!project) { errors.push(`Tranche ${tranche.id}: project not found`); continue; }
    project.incentive_value = nominal.peta[project.id] ?? 0;
    if (!(project.incentive_value > 0)) {
      errors.push(`Project "${project.project_name}" tahap ${tranche.tranche_number}: nominal belum diisi - dilewati.`);
      continue;
    }

    const sk = (tranche.scheme_snapshot as SkemaInsentif | null) ?? skTerkini;
    if (!project.mode_penyelesaian) { errors.push(`Project "${project.project_name}": mode_penyelesaian kosong`); continue; }

    const picId = resolveUserId(project.pic_id || project.assigned_to, project.assign_name, orgUsers);
    const supUp = findUpline(picId, 'Supervisor', orgUsers);
    const mgrUp = findUpline(picId, 'Manager', orgUsers);
    const ptsMap = (ptsTeamData as PtsMap[] | null)?.find(m => m.staff_user_id === project.assigned_to);
    const supervisorUserId   = supUp?.id || ptsMap?.supervisor_user_id || '';
    const supervisorUserName = supUp?.full_name || ptsMap?.supervisor?.full_name || 'Supervisor';
    const projManagerId   = mgrUp?.id || managerUserId;
    const projManagerName = mgrUp?.full_name || managerUserName;

    const tahunKe = sk.tranche.find(t => t.nomor === tranche.tranche_number)?.tahunKe
      ?? Math.max(1, (tranche.payment_year || 0) - new Date(project.bast_date || '').getFullYear());
    const rentangSupport = jendelaSupportTahap(project.bast_date, tahunKe);
    const lampiran = await idTiketLampiranTahap(project.id, tranche.tranche_number);
    const { data: supports } = await fetchSupportFromTickets(project, rentangSupport, lampiran);
    const splits = calculateIncentiveSplits(
      sk, project, projManagerId, projManagerName,
      supervisorUserId, supervisorUserName,
      (supports || []).map(s => ({ user_id: s.user_id, user_name: s.user_name || '' })),
      picId,
    );

    const pool = project.incentive_value || 0;

    const trancheSplits: SplitResult[] = hitungSplitTahap({
      sk, splits, pool, nomorTahap: tranche.tranche_number, persenTahap: tranche.percentage || 0,
      namaInstaller: project.installer_name,
    });
    const tranchePool = trancheSplits.reduce((n, x) => n + x.amount, 0);

    const validation = validateSplitTotal(trancheSplits, tranchePool);
    if (!validation.valid) {
      errors.push(`Project "${project.project_name}" tranche ${tranche.tranche_number}: split total mismatch (diff: Rp ${validation.diff})`);
      continue;
    }

    const { data: claimRows, error: claimErr } = await supabase
      .from('incentive_tranches')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', tranche.id)
      .eq('status', 'pending')
      .select('id');

    if (claimErr || !claimRows || claimRows.length === 0) {
      if (claimErr) {
        errors.push(`Project "${project.project_name}" tranche ${tranche.tranche_number}: gagal mengklaim tahapan (${claimErr.message}).`);
      }
      continue;
    }

    const { error: splitErr } = await insertSplits(project.id, tranche.id, trancheSplits);
    if (splitErr) {
      const { error: revertErr } = await supabase
        .from('incentive_tranches')
        .update({ status: 'pending', processed_at: null })
        .eq('id', tranche.id);
      errors.push(revertErr
        ? `Project "${project.project_name}" tranche ${tranche.tranche_number}: gagal insert splits (${splitErr.message}) DAN gagal mengembalikan status ke pending (${revertErr.message}). Tahapan ini tersangkut 'processed' tanpa splits - perlu diperbaiki manual.`
        : `Project "${project.project_name}" tranche ${tranche.tranche_number}: gagal insert splits (${splitErr.message}). Status dikembalikan ke pending, aman dicoba lagi.`);
      continue;
    }

    void Promise.all(trancheSplits
      .filter(s => s.user_id && UUID_RE.test(s.user_id) && s.amount > 0)
      .map(s => createNotification({
        user_id: s.user_id,
        type: 'project',
        title: '💰 Tahapan insentif diproses',
        body: `${project.project_name} - tahap ${tranche.tranche_number} tahun ${tranche.payment_year}: ${formatRupiah(s.amount)}`,
        action_url: '/incentive-pts',
        ref_id: project.id,
        created_by: managerUserName,
      })));

    processed++;
  }

  return { processed, errors, total: dueTranches.length };
}
