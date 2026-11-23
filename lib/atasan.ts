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

export interface PemetaanGrup { sales_division: string; supervisor_id: string }
export interface OrangBawahan { id: string; username: string | null; full_name: string | null }

export function langkahBawahan(p: { atasanId: string; orang: OrangAtasan[]; peta: PemetaanAtasan[]; grup: PemetaanGrup[] }): Set<string> {
  const punyaPerUser = new Set(p.peta.map(m => m.user_id));
  const hasil = new Set(p.peta.filter(m => m.supervisor_id === p.atasanId).map(m => m.user_id));
  const tierAtasan = tierJabatan(p.orang.find(o => o.id === p.atasanId)?.jabatan);
  const divisi = new Set(p.grup.filter(g => g.supervisor_id === p.atasanId).map(g => g.sales_division));
  for (const o of p.orang) {
    if (o.id === p.atasanId || punyaPerUser.has(o.id) || !o.sales_division || !divisi.has(o.sales_division)) continue;
    if (tierJabatan(o.jabatan) < tierAtasan) hasil.add(o.id);
  }
  return hasil;
}

export function pilihBawahan(p: { viewerId: string; orang: OrangAtasan[]; peta: PemetaanAtasan[]; grup: PemetaanGrup[] }): Set<string> {
  const hasil = new Set<string>();
  let antrian = [p.viewerId];
  for (let tingkat = 0; tingkat < 10 && antrian.length; tingkat++) {
    const berikut: string[] = [];
    for (const atasanId of antrian) {
      for (const id of langkahBawahan({ atasanId, orang: p.orang, peta: p.peta, grup: p.grup })) {
        if (id === p.viewerId || hasil.has(id)) continue;
        hasil.add(id);
        berikut.push(id);
      }
    }
    antrian = berikut;
  }
  return hasil;
}

export async function ambilBawahan(db: SupabaseClient, viewer: { id: string }): Promise<OrangBawahan[]> {
  const [{ data: grup }, { data: peta }, { data: orang }] = await Promise.all([
    db.from('division_supervisor_mappings').select('sales_division, supervisor_id'),
    db.from('user_supervisor_mappings').select('user_id, supervisor_id'),
    db.from('users').select('id, username, full_name, jabatan, sales_division, role'),
  ]);
  const semua = (orang ?? []) as (OrangAtasan & OrangBawahan & { role: string | null })[];
  const anggotaGrup = semua.map(o => (o.role ?? '').toLowerCase() === 'guest' ? o : { ...o, sales_division: null });
  const ids = pilihBawahan({ viewerId: viewer.id, orang: anggotaGrup, peta: (peta ?? []) as PemetaanAtasan[], grup: (grup ?? []) as PemetaanGrup[] });
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
