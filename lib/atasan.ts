import type { SupabaseClient } from '@supabase/supabase-js';
import { JABATAN_CC_RULES, JABATAN_TIER } from './jabatan';

export const GRUP_INTERNAL = ['PTS', 'IVP', 'MVI', 'MLDS'];

export interface PemetaanAtasan { user_id: string; supervisor_id: string }
export interface OrangAtasan { id: string; jabatan?: string | null; sales_division?: string | null }
export interface TargetCC { phone: string; name: string; relation: string }

export const tierJabatan = (j?: string | null) => (j ? (JABATAN_TIER[j] ?? 0) : 0);

export function atasanEfektif(perUser: string[], perGrup: string[]): { ids: string[]; sumber: 'user' | 'grup' | 'kosong' } {
  if (perUser.length) return { ids: perUser, sumber: 'user' };
  if (perGrup.length) return { ids: perGrup, sumber: 'grup' };
  return { ids: [], sumber: 'kosong' };
}

export function kelompokkanPerUser(peta: PemetaanAtasan[]): Map<string, string[]> {
  const hasil = new Map<string, string[]>();
  for (const m of peta) hasil.set(m.user_id, [...(hasil.get(m.user_id) ?? []), m.supervisor_id]);
  return hasil;
}

export function terpisahDariGrup(viewerId: string, tierViewer: number, peta: PemetaanAtasan[], tierDari: (id: string) => number): Set<string> {
  const hasil = new Set<string>();
  for (const [userId, atasan] of kelompokkanPerUser(peta)) {
    if (atasan.includes(viewerId)) continue;
    if (tierViewer <= Math.max(...atasan.map(tierDari))) hasil.add(userId);
  }
  return hasil;
}

export function pilihBawahan(p: { viewer: OrangAtasan; divisi: string[]; orang: OrangAtasan[]; peta: PemetaanAtasan[] }): Set<string> {
  const tierViewer = tierJabatan(p.viewer.jabatan);
  const tierById = new Map(p.orang.map(o => [o.id, tierJabatan(o.jabatan)]));
  const terpisah = terpisahDariGrup(p.viewer.id, tierViewer, p.peta, id => tierById.get(id) ?? 0);
  const langsung = new Set(p.peta.filter(m => m.supervisor_id === p.viewer.id).map(m => m.user_id));
  const hasil = new Set<string>();
  for (const o of p.orang) {
    if (o.id === p.viewer.id) continue;
    if (langsung.has(o.id)) { hasil.add(o.id); continue; }
    const diGrup = !!o.sales_division && p.divisi.includes(o.sales_division);
    if (diGrup && tierJabatan(o.jabatan) < tierViewer && !terpisah.has(o.id)) hasil.add(o.id);
  }
  return hasil;
}

export async function ambilBawahan(db: SupabaseClient, viewer: OrangAtasan, divisiTambahan: string[] = []): Promise<{ id: string; username: string | null; full_name: string | null }[]> {
  const [{ data: grup }, { data: peta }, { data: orang }] = await Promise.all([
    db.from('division_supervisor_mappings').select('sales_division').eq('supervisor_id', viewer.id),
    db.from('user_supervisor_mappings').select('user_id, supervisor_id'),
    db.from('users').select('id, username, full_name, jabatan, sales_division').eq('role', 'guest'),
  ]);
  const divisi = [...new Set([...((grup ?? []) as { sales_division: string }[]).map(g => g.sales_division), ...divisiTambahan])];
  const semua = (orang ?? []) as (OrangAtasan & { username: string | null; full_name: string | null })[];
  const ids = pilihBawahan({ viewer, divisi, orang: semua, peta: (peta ?? []) as PemetaanAtasan[] });
  return semua.filter(o => ids.has(o.id)).map(o => ({ id: o.id, username: o.username, full_name: o.full_name }));
}

export async function cariTargetCC(db: SupabaseClient, userId: string, salesDiv: string): Promise<TargetCC[]> {
  const targets: TargetCC[] = [];
  const tambah = (s: { full_name: string; phone_number: string }, relation: string) => {
    if (!targets.some(t => t.phone === s.phone_number)) targets.push({ phone: s.phone_number, name: s.full_name, relation });
  };
  try {
    const [{ data: pengguna }, { data: perUser }, { data: perGrup }] = await Promise.all([
      db.from('users').select('jabatan').eq('id', userId).maybeSingle(),
      db.from('user_supervisor_mappings').select('supervisor_id').eq('user_id', userId),
      salesDiv ? db.from('division_supervisor_mappings').select('supervisor_id').eq('sales_division', salesDiv) : Promise.resolve({ data: [] }),
    ]);
    const jabatan = (pengguna as { jabatan?: string | null } | null)?.jabatan ?? '';
    const aturan: string[] = (JABATAN_CC_RULES as Record<string, string[]>)[jabatan] ?? [];
    const idDari = (r: unknown) => ((r ?? []) as { supervisor_id: string }[]).map(m => m.supervisor_id);
    const pilihan = atasanEfektif(idDari(perUser), aturan.length ? idDari(perGrup) : []);
    if (pilihan.ids.length) {
      const { data: sups } = await db.from('users').select('full_name, phone_number, jabatan')
        .in('id', pilihan.ids).not('phone_number', 'is', null).neq('phone_number', '');
      for (const s of (sups ?? []) as { full_name: string; phone_number: string; jabatan: string | null }[]) {
        if (pilihan.sumber === 'user' || (s.jabatan && aturan.includes(s.jabatan))) tambah(s, 'supervisor');
      }
    }
    if (salesDiv && salesDiv !== 'IVP') {
      const { data: ivpRes } = await db.from('division_ivp_mappings').select('ivp_id').eq('sales_division', salesDiv);
      if (ivpRes?.length) {
        const { data: ivps } = await db.from('users').select('full_name, phone_number')
          .in('id', (ivpRes as { ivp_id: string }[]).map(s => s.ivp_id)).not('phone_number', 'is', null).neq('phone_number', '');
        for (const s of (ivps ?? []) as { full_name: string; phone_number: string }[]) tambah(s, 'ivp_handler');
      }
    }
  } catch (e) { console.warn('[cariTargetCC]', e); }
  return targets;
}
