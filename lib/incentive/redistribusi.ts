import { bagikanTepat } from './scheme-aturan';

export interface AnggotaTim {
  id: string;
  full_name: string | null;
  role?: string | null;
  team_type?: string | null;
  tanggal_nonaktif?: string | null;
}

export interface BarisBagi {
  role: string;
  user_id: string;
  user_name: string;
  percentage: number;
  amount: number;
  redistribusi_dari?: string | null;
}

export interface LogRedistribusi {
  sumber_user_id: string;
  sumber_nama: string;
  nominal: number;
  penerima: { user_id: string; user_name: string; amount: number }[];
}

export const PERAN_TANPA_REDISTRIBUSI = ['installer', 'redistribusi'];

export function tanggalJatuhTempo(tahunBayar: number): string {
  return `${tahunBayar}-01-01`;
}

export function nonaktifPada(tanggalNonaktif: string | null | undefined, tanggal: string): boolean {
  const t = (tanggalNonaktif ?? '').slice(0, 10);
  return !!t && t <= tanggal;
}

export function penerimaAktif(anggota: AnggotaTim[], kelompokPTS: string[], kecuali: ReadonlySet<string>, hariIni: string): AnggotaTim[] {
  return anggota.filter(a =>
    !kecuali.has(a.id)
    && (a.role ?? '').toLowerCase() === 'team'
    && kelompokPTS.includes(a.team_type ?? '')
    && !nonaktifPada(a.tanggal_nonaktif, hariIni));
}

export function terapkanRedistribusi(args: {
  splits: BarisBagi[];
  anggota: AnggotaTim[];
  kelompokPTS: string[];
  tahunBayar: number;
  hariIni: string;
}): { splits: BarisBagi[]; log: LogRedistribusi[]; peringatan: string[] } {
  const { splits, anggota, kelompokPTS, tahunBayar, hariIni } = args;
  const jatuhTempo = tanggalJatuhTempo(tahunBayar);
  const peta = new Map(anggota.map(a => [a.id, a]));
  const keluar = new Set(splits
    .filter(s => !PERAN_TANPA_REDISTRIBUSI.includes(s.role) && nonaktifPada(peta.get(s.user_id)?.tanggal_nonaktif, jatuhTempo))
    .map(s => s.user_id));

  const hasil: BarisBagi[] = [];
  const log: LogRedistribusi[] = [];
  const peringatan: string[] = [];
  for (const s of splits) {
    if (!keluar.has(s.user_id) || PERAN_TANPA_REDISTRIBUSI.includes(s.role)) { hasil.push(s); continue; }
    const penerima = penerimaAktif(anggota, kelompokPTS, keluar, hariIni);
    if (penerima.length === 0 || s.amount <= 0) {
      peringatan.push(`${s.user_name} sudah tidak aktif, tetapi tidak ada anggota Tim PTS aktif untuk menerima bagiannya — bagian tetap dicatat atas namanya.`);
      hasil.push(s);
      continue;
    }
    const rupiah = bagikanTepat(s.amount, penerima.map(() => 100 / penerima.length));
    const baris = penerima.map((p, i) => ({
      role: 'redistribusi', user_id: p.id, user_name: p.full_name ?? '',
      percentage: s.percentage / penerima.length, amount: rupiah[i], redistribusi_dari: s.user_name,
    }));
    hasil.push(...baris);
    log.push({
      sumber_user_id: s.user_id, sumber_nama: s.user_name, nominal: s.amount,
      penerima: baris.map(b => ({ user_id: b.user_id, user_name: b.user_name, amount: b.amount })),
    });
  }
  return { splits: hasil, log, peringatan };
}
