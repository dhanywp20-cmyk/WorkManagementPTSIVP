import { bagikanTepat } from './scheme-aturan';
import type { SkemaInsentif } from './scheme-tipe';

export interface SplitTahap { role: string; user_id: string; user_name: string; percentage: number; amount: number }

export function hitungSplitTahap<T extends SplitTahap>(args: {
  sk: SkemaInsentif;
  splits: T[];
  pool: number;
  nomorTahap: number;
  persenTahap: number;
  namaInstaller?: string | null;
}): T[] {
  const { sk, splits, pool, nomorTahap, persenTahap, namaInstaller } = args;
  const barisInstaller = splits.find(s => s.role === 'installer');
  const pctInstaller = barisInstaller?.percentage ?? 0;
  const tahapPertama = sk.tranche.length ? Math.min(...sk.tranche.map(t => t.nomor)) : 1;
  const installerDiMuka = pctInstaller > 0 && sk.installerBayarDiMuka;
  const totalTahapTim = sk.tranche.reduce((n, t) => n + (t.persen || 0), 0) || 100;
  const bagian = (persenTahap || 0) / totalTahapTim;

  const komponen: { split: T; ideal: number }[] = splits
    .filter(s => s.role !== 'installer')
    .map(s => ({ split: s, ideal: pool * (s.percentage / 100) * bagian }));

  if (pctInstaller > 0) {
    const idealInstaller = installerDiMuka
      ? (nomorTahap === tahapPertama ? (pool * pctInstaller) / 100 : 0)
      : pool * (pctInstaller / 100) * bagian;
    if (idealInstaller > 0) {
      komponen.push({
        split: { ...(barisInstaller ?? { role: 'installer', user_id: '', user_name: namaInstaller || 'PTS Daerah', percentage: pctInstaller }), amount: 0 } as T,
        ideal: idealInstaller,
      });
    }
  }

  const totalTahap = Math.round(komponen.reduce((n, k) => n + k.ideal, 0));
  const rupiah = bagikanTepat(totalTahap, komponen.map(k => (totalTahap > 0 ? (k.ideal / totalTahap) * 100 : 0)));
  return komponen.map((k, i) => ({ ...k.split, amount: rupiah[i] }));
}
