import { tempelkanNominal } from '@/lib/incentive-nominal';
import { ambilPetaNominal, lengkapiNominal } from '@/lib/incentive-nominal-api';
import { kategoriInsentif, muatKategoriInsentif } from '@/lib/incentive-scheme';
import { gabungkanProyek } from '@/lib/kelompok-insentif';
import { supabase } from '@/lib/supabase';
import { IncentiveProjectRow, IncentiveSplit, IncentiveTranche } from './calc-tipe';

let kolomKeluarkanAda: boolean | null = null;

export async function satukanProyek(
  anggota: { id: string; batch_id?: string | null }[],
): Promise<{ error: { message: string } | null; grup: string }> {
  const grup = crypto.randomUUID();
  const batchIds = [...new Set(anggota.map(a => a.batch_id).filter(Boolean))] as string[];
  const idLepas = anggota.filter(a => !a.batch_id).map(a => a.id);

  const hasil: { error: { message: string } | null }[] = [];
  if (batchIds.length > 0) {
    hasil.push(await supabase.from('reminders')
      .update({ incentive_group_id: grup }).in('batch_id', batchIds));
  }
  if (idLepas.length > 0) {
    hasil.push(await supabase.from('reminders')
      .update({ incentive_group_id: grup }).in('id', idLepas));
  }
  const gagal = hasil.find(r => r.error)?.error ?? null;
  return { error: gagal, grup };
}

export async function pisahkanProyek(grup: string) {
  return await supabase.from('reminders')
    .update({ incentive_group_id: null }).eq('incentive_group_id', grup);
}

export async function fetchIncentiveProjects() {
  await muatKategoriInsentif();
  const dasar = () => supabase
    .from('reminders')
    .select('*')
    .in('category', kategoriInsentif())
    .eq('status', 'done')
    .order('due_date', { ascending: false });

  if (kolomKeluarkanAda !== false) {
    const r = await dasar().not('incentive_excluded', 'is', true);
    if (!r.error) {
      kolomKeluarkanAda = true;
      return { data: await lengkapiNominal(gabungkanProyek((r.data || []) as IncentiveProjectRow[])), error: r.error };
    }
    if (!/does not exist/i.test(r.error.message)) {
      return { data: [] as IncentiveProjectRow[], error: r.error };
    }
    kolomKeluarkanAda = false;
    console.warn(
      '[incentive] kolom incentive_excluded belum ada - daftar ditampilkan utuh. ' +
      'Jalankan sql/incentive-keluarkan-proyek.sql untuk mengaktifkan fitur "keluarkan dari Incentive".');
  }

  const r2 = await dasar();
  return { data: await lengkapiNominal(gabungkanProyek((r2.data || []) as IncentiveProjectRow[])), error: r2.error };
}

export async function setProyekDikeluarkan(ids: string[], keluar: boolean) {
  if (!ids.length) return { error: null };
  const { error } = await supabase
    .from('reminders')
    .update({ incentive_excluded: keluar })
    .in('id', ids);
  if (error) return { error };
  if (!keluar) return { error: null };

  const { data: tr, error: bacaErr } = await supabase
    .from('incentive_tranches').select('id').in('project_id', ids).eq('status', 'pending');
  if (bacaErr) return { error: bacaErr };
  const trancheIds = (tr ?? []).map((t: { id: string }) => t.id);
  if (trancheIds.length === 0) return { error: null };

  const rollback = await hapusSplitsServer({ trancheIds });
  if (rollback.error) return { error: rollback.error };
  const { error: hapusErr } = await supabase.from('incentive_tranches').delete().in('id', trancheIds);
  return { error: hapusErr ?? null };
}

export async function tahapanSudahJalan(projectIds: string[]) {
  if (!projectIds.length) return { data: [] as { project_id: string; status: string }[], error: null };
  const { data, error } = await supabase
    .from('incentive_tranches')
    .select('project_id, status')
    .in('project_id', projectIds)
    .in('status', ['processed', 'paid']);
  return { data: (data || []) as { project_id: string; status: string }[], error };
}

export async function fetchTranches(filters?: { payment_year?: number; status?: string }) {
  let q = supabase.from('incentive_tranches').select('*, project:reminders(*)').order('payment_year');
  if (filters?.payment_year) q = q.eq('payment_year', filters.payment_year);
  if (filters?.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  const baris = (data || []) as (IncentiveTranche & { project: IncentiveProjectRow })[];
  const { peta } = baris.length ? await ambilPetaNominal() : { peta: {} as Record<string, number> };
  return {
    data: baris.map(t => (t.project ? { ...t, project: tempelkanNominal([t.project], peta)[0] } : t)),
    error,
  };
}

export async function fetchSplits(projectId?: string) {
  let q = supabase.from('incentive_splits').select('*').order('created_at');
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  return { data: (data || []) as IncentiveSplit[], error };
}

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

export async function hapusSplitsServer(
  target: { trancheIds: string[] } | { projectId: string },
): Promise<{ dihapus: number; error: { message: string } | null }> {
  const qs = 'trancheIds' in target
    ? `trancheIds=${encodeURIComponent(target.trancheIds.join(','))}`
    : `projectId=${encodeURIComponent(target.projectId)}`;
  try {
    const res = await fetch(`/api/incentive/splits?${qs}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { dihapus: 0, error: { message: json.error || 'Gagal menghapus baris pembagian.' } };
    return { dihapus: Number(json.dihapus ?? 0), error: null };
  } catch (e) {
    return { dihapus: 0, error: { message: (e as Error).message } };
  }
}
