import type { Json } from '@/types/database';
import type { getAdminClient } from '@/lib/supabase-admin';
import { DAFTAR_LEVEL, hitungNominalLevel, rapikanTarif, type CakupanCue, type CakupanKategori, type HasilLevel, type LevelProyek, type TarifInsentif } from './scheme-tarif';

type Db = ReturnType<typeof getAdminClient>;

export interface BarisPenetapan {
  reminder_id: string;
  level: LevelProyek;
  level_status: 'diusulkan' | 'divalidasi';
  cakupan: CakupanKategori[];
  cue: CakupanCue[];
  net_profit: number | null;
  nominal: number | null;
  nominal_dasar: string | null;
  diusulkan_oleh: string | null;
  diusulkan_pada: string | null;
  divalidasi_oleh: string | null;
  divalidasi_pada: string | null;
  net_profit_oleh: string | null;
  net_profit_pada: string | null;
}

export function levelSah(v: unknown): v is LevelProyek {
  return typeof v === 'string' && (DAFTAR_LEVEL as string[]).includes(v);
}

export function rapikanCakupan(v: unknown): CakupanKategori[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 20).map(x => {
    const r = x as Record<string, unknown>;
    const n = r.nominal == null || r.nominal === '' ? null : Number(r.nominal);
    return { kategori: String(r.kategori ?? ''), item: String(r.item ?? ''), nominal: Number.isFinite(n) ? n : null };
  }).filter(c => c.kategori && c.item);
}

export function rapikanCue(v: unknown): CakupanCue[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 20).map(x => {
    const r = x as Record<string, unknown>;
    return { item: String(r.item ?? ''), jumlah: Math.max(0, Math.floor(Number(r.jumlah) || 0)) };
  }).filter(c => c.item && c.jumlah > 0);
}

export async function bacaTarif(db: Db): Promise<TarifInsentif> {
  const { data } = await db.from('incentive_scheme_settings').select('scheme').order('updated_at', { ascending: false }).limit(1).maybeSingle();
  return rapikanTarif((data?.scheme as { tarif?: unknown } | null)?.tarif);
}

export function hitungDari(tarif: TarifInsentif, p: Pick<BarisPenetapan, 'level' | 'cakupan' | 'cue' | 'net_profit'>): HasilLevel {
  return hitungNominalLevel(tarif, { level: p.level, cakupan: p.cakupan, cue: p.cue, netProfit: p.net_profit });
}

export async function idSebatch(db: Db, reminderId: string): Promise<{ ids: string[]; bast: string | null; brand: string | null } | null> {
  const { data: acuan } = await db.from('reminders').select('id, batch_id, brand, bast_date').eq('id', reminderId).maybeSingle();
  if (!acuan) return null;
  let ids = [reminderId];
  if (acuan.batch_id) {
    const { data } = await db.from('reminders').select('id').eq('batch_id', acuan.batch_id);
    ids = [...new Set([...(data ?? []).map(r => r.id), reminderId])];
  }
  return { ids, bast: acuan.bast_date ?? null, brand: acuan.brand ?? null };
}

export async function tahapSudahDiproses(db: Db, ids: string[]): Promise<boolean> {
  const { data } = await db.from('incentive_tranches').select('id').in('project_id', ids).neq('status', 'pending').limit(1);
  return (data ?? []).length > 0;
}

export async function tulisNominal(db: Db, ids: string[], nominal: number | null, oleh: string): Promise<string | null> {
  if (nominal == null || !(nominal > 0)) {
    const { error } = await db.from('incentive_nominal').delete().in('reminder_id', ids);
    return error?.message ?? null;
  }
  const sekarang = new Date().toISOString();
  const { error } = await db.from('incentive_nominal').upsert(
    ids.map(id => ({ reminder_id: id, nominal, diubah_oleh: oleh, diubah_pada: sekarang })),
    { onConflict: 'reminder_id' },
  );
  return error?.message ?? null;
}

export async function catatLog(db: Db, ids: string[], aksi: string, dari: unknown, ke: unknown, alasan: string | null, oleh: string) {
  await db.from('incentive_penetapan_log').insert(ids.map(id => ({
    reminder_id: id, aksi, dari: (dari ?? null) as Json, ke: (ke ?? null) as Json, alasan, oleh,
  })));
}

export function ringkas(p: Pick<BarisPenetapan, 'level' | 'level_status' | 'cakupan' | 'cue' | 'nominal'> & { net_profit?: number | null }) {
  return { level: p.level, level_status: p.level_status, cakupan: p.cakupan, cue: p.cue, nominal: p.nominal, net_profit: p.net_profit ?? null };
}
