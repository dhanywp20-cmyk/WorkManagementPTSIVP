import { bisaInputNominal, type PemilikAkses } from './akses';

export const KUNCI_ATURAN_NOMINAL = 'incentive.nominal';

export type LihatNominal = 'petugas' | 'terlibat';

export interface AturanNominal { lihat: LihatNominal }

export const ATURAN_NOMINAL_BAWAAN: AturanNominal = { lihat: 'petugas' };

export function rapikanAturanNominal(v: unknown): AturanNominal {
  const lihat = (v as { lihat?: unknown } | null)?.lihat;
  return { lihat: lihat === 'terlibat' ? 'terlibat' : 'petugas' };
}

export function bolehLihatBrand(lingkup: string | null | undefined, brandProyek: string | null | undefined): boolean {
  if (!lingkup) return true;
  if (!brandProyek) return true;
  return brandProyek === lingkup || brandProyek === 'BOTH';
}

export interface BarisNominal {
  id: string;
  brand?: string | null;
  pic_id?: string | null;
  assigned_to?: string | null;
  assign_name?: string | null;
}

export interface PenggunaNominal {
  id: string;
  username?: string | null;
  full_name?: string | null;
}

export function terlibatDiProyek(baris: BarisNominal, p: PenggunaNominal, punyaBagian: boolean): boolean {
  if (punyaBagian) return true;
  const uname = (p.username || '').toLowerCase();
  const nama = (p.full_name || '').toLowerCase();
  if (p.id && baris.pic_id && baris.pic_id === p.id) return true;
  if (uname && (baris.assigned_to || '').toLowerCase() === uname) return true;
  if (nama && (baris.assign_name || '').toLowerCase() === nama) return true;
  return false;
}

export function nominalTerbuka(args: {
  hak: PemilikAkses;
  lingkupBrand: string | null | undefined;
  aturan: AturanNominal;
  baris: BarisNominal;
  pengguna: PenggunaNominal;
  punyaBagian: boolean;
}): boolean {
  const { hak, lingkupBrand, aturan, baris, pengguna, punyaBagian } = args;
  if (bisaInputNominal(hak)) return bolehLihatBrand(lingkupBrand, baris.brand);
  if (aturan.lihat === 'terlibat') return terlibatDiProyek(baris, pengguna, punyaBagian);
  return false;
}

export function tempelkanNominal<T extends { id: string; incentive_value?: number | null }>(
  baris: T[], peta: Record<string, number>,
): T[] {
  return baris.map(b => ({ ...b, incentive_value: Number(peta[b.id]) || 0 }));
}
