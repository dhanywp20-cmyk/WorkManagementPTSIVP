import { bagikanTepat, persenInstaller } from './incentive-scheme-aturan';
import { SkemaInsentif } from './incentive-scheme-tipe';

export interface PenerimaPeran {
  peran: string;
  user_id: string;
  user_name: string;
}

export interface HasilBagi {
  role: string;
  user_id: string;
  user_name: string;
  percentage: number;
  amount: number;
}

export function petaPorsiBerlaku(
  sk: SkemaInsentif,
  remote: boolean,
  adaSupport: boolean,
): { dasar: Record<string, number>; pctInstaller: number; faktor: number } {
  const pakaiPetaRemote = remote && sk.porsiRemote?.aktif === true;

  const dasar: Record<string, number> = pakaiPetaRemote
    ? { ...(adaSupport ? sk.porsiRemote.adaSupport : sk.porsiRemote.tanpaSupport) }
    : adaSupport
      ? Object.fromEntries(sk.porsi.map(p => [p.peran, p.persen]))
      : { ...sk.tanpaSupport };

  const pctInstaller = pakaiPetaRemote
    ? Math.max(0, Math.min(99, dasar.installer || 0))
    : persenInstaller(sk, remote);
  if (pakaiPetaRemote) delete dasar.installer;

  return { dasar, pctInstaller, faktor: pakaiPetaRemote ? 1 : (100 - pctInstaller) / 100 };
}

export function persenPicBerlaku(
  sk: SkemaInsentif,
  remote: boolean,
  adaSupport: boolean,
  managerSebagaiPic = false,
): number {
  const { dasar, faktor } = petaPorsiBerlaku(sk, remote, adaSupport);
  if (managerSebagaiPic) {
    const peta = adaSupport ? sk.managerSebagaiPic.adaSupport : sk.managerSebagaiPic.tanpaSupport;
    return (peta.pic ?? 100) * ((100 - persenInstaller(sk, remote)) / 100);
  }
  return (dasar.pic || 0) * faktor;
}

export function hitungPembagian(
  sk: SkemaInsentif,
  pool: number,
  remote: boolean,
  penerima: PenerimaPeran[],
  adaSupport: boolean,
  supervisorJadiPic: boolean,
  namaInstaller?: string | null,
  installerUserId?: string | null,
): HasilBagi[] {
  if (pool <= 0) return [];

  let dasar: Record<string, number>;
  let pctInstaller: number;
  let faktor: number;

  if (supervisorJadiPic && sk.supervisorSebagaiPic?.aktif) {
    const grup = remote ? sk.supervisorSebagaiPic.remote : sk.supervisorSebagaiPic.onsite;
    const peta = { ...(adaSupport ? grup.adaSupport : grup.tanpaSupport) };
    pctInstaller = Math.max(0, Math.min(99, peta.installer || 0));
    delete peta.installer;
    dasar = peta;
    faktor = 1;
  } else {
    const berlaku = petaPorsiBerlaku(sk, remote, adaSupport);
    dasar = berlaku.dasar; pctInstaller = berlaku.pctInstaller; faktor = berlaku.faktor;
    if (supervisorJadiPic && dasar.supervisor) {
      const pindah = dasar.supervisor;
      dasar.supervisor = 0;
      const tujuan = sk.hangusSupervisorKe;
      if (tujuan) dasar[tujuan] = (dasar[tujuan] || 0) + pindah;
    }
  }

  const bagiRata = new Map(sk.porsi.map(p => [p.peran, p.bagiRata]));
  const hasil: HasilBagi[] = [];

  for (const [peran, persenPenuh] of Object.entries(dasar)) {
    const persen = (persenPenuh || 0) * faktor;
    if (persen <= 0) continue;
    const orang = penerima.filter(p => p.peran === peran);
    if (!orang.length) continue;
    const bagi = bagiRata.get(peran) !== false && orang.length > 1;
    const n = bagi ? orang.length : 1;
    for (const o of (bagi ? orang : orang.slice(0, 1))) {
      hasil.push({ role: peran, user_id: o.user_id, user_name: o.user_name, percentage: persen / n, amount: 0 });
    }
  }

  if (pctInstaller > 0) {
    hasil.push({
      role: 'installer',
      user_id: installerUserId || '',
      user_name: namaInstaller || 'PTS Daerah',
      percentage: pctInstaller,
      amount: 0,
    });
  }

  const rupiah = bagikanTepat(pool, hasil.map(h => h.percentage));
  return hasil.map((h, i) => ({ ...h, amount: rupiah[i] }));
}

export function hitungManagerSebagaiPic(
  sk: SkemaInsentif,
  pool: number,
  remote: boolean,
  managerId: string,
  managerNama: string,
  namaInstaller?: string | null,
  penerimaSupport: PenerimaPeran[] = [],
  installerUserId?: string | null,
): HasilBagi[] {
  if (pool <= 0) return [];
  const pctInstaller = persenInstaller(sk, remote);
  const faktor = (100 - pctInstaller) / 100;

  const adaSupport = penerimaSupport.length > 0;
  const peta = adaSupport ? sk.managerSebagaiPic.adaSupport : sk.managerSebagaiPic.tanpaSupport;

  const hasil: HasilBagi[] = [];
  for (const [peran, p] of Object.entries(peta)) {
    const persen = (p || 0) * faktor;
    if (persen <= 0) continue;
    if (peran === 'support') {
      for (const o of penerimaSupport) {
        hasil.push({ role: 'support', user_id: o.user_id, user_name: o.user_name,
          percentage: persen / penerimaSupport.length, amount: 0 });
      }
      continue;
    }
    hasil.push({ role: peran, user_id: managerId, user_name: managerNama, percentage: persen, amount: 0 });
  }
  if (pctInstaller > 0) {
    hasil.push({
      role: 'installer', user_id: installerUserId || '',
      user_name: namaInstaller || 'PTS Daerah',
      percentage: pctInstaller, amount: 0,
    });
  }
  const rupiah = bagikanTepat(pool, hasil.map(h => h.percentage));
  return hasil.map((h, i) => ({ ...h, amount: rupiah[i] }));
}
