import { INCENTIVE_CATEGORIES } from './scheme-kategori-bawaan';
import { SkemaInsentif } from './scheme-tipe';

export const SKEMA_BAWAAN: SkemaInsentif = {
  versi: 3,
  kategoriProyek: [...INCENTIVE_CATEGORIES],
  porsi: [
    { peran: 'pic',        label: 'PIC Proyek',                   persen: 65, bagiRata: true  },
    { peran: 'support',    label: 'Tim Support (Troubleshooting)', persen: 15, bagiRata: true  },
    { peran: 'supervisor', label: 'Supervisor',                   persen: 10, bagiRata: true  },
    { peran: 'manager',    label: 'Manager',                      persen: 10, bagiRata: false },
  ],
  tanpaSupport: { pic: 80, supervisor: 10, manager: 10 },
  jendelaSupportBulan: 12,
  hangusSupervisorKe: 'manager',
  managerSebagaiPic: { adaSupport: { pic: 100 }, tanpaSupport: { pic: 100 } },
  installerAktif: true,
  installerRemotePersen: 15,
  installerHanyaRemote: true,
  installerBayarDiMuka: true,
  tranche: [
    { nomor: 1, persen: 50, tahunKe: 1 },
    { nomor: 2, persen: 35, tahunKe: 2 },
    { nomor: 3, persen: 15, tahunKe: 3 },
  ],
  porsiRemote: {
    aktif: false,
    adaSupport:   { pic: 55.25, support: 12.75, supervisor: 8.5, manager: 8.5, installer: 15 },
    tanpaSupport: { pic: 68,    supervisor: 8.5, manager: 8.5,   installer: 15 },
  },
  supervisorSebagaiPic: {
    aktif: false,
    remote: {
      tanpaSupport: { pic: 55, manager: 25, installer: 20 },
      adaSupport:   { pic: 50, support: 15, manager: 15, installer: 20 },
    },
    onsite: {
      tanpaSupport: { pic: 70, manager: 30 },
      adaSupport:   { pic: 60, support: 15, manager: 25 },
    },
  },
};

export function persenInstaller(sk: SkemaInsentif, remote: boolean): number {
  if (!sk.installerAktif) return 0;
  if (sk.installerHanyaRemote && !remote) return 0;
  return Math.max(0, Math.min(99, sk.installerRemotePersen || 0));
}

export function bagikanTepat(pool: number, persenTiap: number[]): number[] {
  const target = Math.round(pool);
  if (!persenTiap.length || target <= 0) return persenTiap.map(() => 0);

  const tepat = persenTiap.map(p => (target * p) / 100);
  const bawah = tepat.map(v => Math.floor(v));
  let sisa = target - bawah.reduce((a, b) => a + b, 0);

  const urut = tepat
    .map((v, i) => ({ i, pecahan: v - Math.floor(v) }))
    .sort((a, b) => b.pecahan - a.pecahan);

  for (let k = 0; k < urut.length && sisa > 0; k++, sisa--) bawah[urut[k].i] += 1;
  return bawah;
}

export interface MasalahSkema {
  bidang: string;
  pesan: string;
  peringatan?: boolean;
}

export function periksaSkema(sk: SkemaInsentif): MasalahSkema[] {
  const masalah: MasalahSkema[] = [];
  const bulat = (n: number) => Math.round(n * 100) / 100;

  const kategori = (sk.kategoriProyek ?? []).map(k => k.trim()).filter(Boolean);
  if (kategori.length === 0) {
    masalah.push({ bidang: 'kategoriProyek', pesan: 'Minimal satu kategori proyek harus diisi — tanpa itu tidak ada proyek yang masuk daftar Incentive.' });
  }
  if (new Set(kategori.map(k => k.toLowerCase())).size !== kategori.length) {
    masalah.push({ bidang: 'kategoriProyek', pesan: 'Ada kategori proyek yang kembar.' });
  }

  const totalPorsi = bulat(sk.porsi.reduce((t, p) => t + (p.persen || 0), 0));
  if (totalPorsi !== 100) masalah.push({ bidang: 'porsi', pesan: `Total porsi ${totalPorsi}% — harus tepat 100%.` });

  const kunci = sk.porsi.map(p => p.peran.trim().toLowerCase());
  if (new Set(kunci).size !== kunci.length) masalah.push({ bidang: 'porsi', pesan: 'Ada kunci peran yang kembar.' });
  if (kunci.some(k => !k)) masalah.push({ bidang: 'porsi', pesan: 'Ada peran tanpa kunci.' });
  if (!kunci.includes('pic')) masalah.push({ bidang: 'porsi', pesan: 'Peran "pic" wajib ada — ia penerima utama.' });

  const totalTanpa = bulat(Object.values(sk.tanpaSupport).reduce((t, n) => t + (n || 0), 0));
  if (totalTanpa !== 100) masalah.push({ bidang: 'tanpaSupport', pesan: `Total porsi tanpa support ${totalTanpa}% — harus tepat 100%.` });
  for (const k of Object.keys(sk.tanpaSupport)) {
    if (!kunci.includes(k)) masalah.push({ bidang: 'tanpaSupport', pesan: `Peran "${k}" tidak ada di daftar porsi.` });
  }

  for (const [nama, peta] of [
    ['ada support', sk.managerSebagaiPic.adaSupport],
    ['tanpa support', sk.managerSebagaiPic.tanpaSupport],
  ] as const) {
    const total = bulat(Object.values(peta ?? {}).reduce((t, n) => t + (n || 0), 0));
    if (total !== 100) {
      masalah.push({ bidang: 'managerSebagaiPic', pesan: `Manager-sebagai-PIC (${nama}) ${total}% — harus tepat 100%.` });
    }
  }

  if (sk.installerRemotePersen < 0 || sk.installerRemotePersen >= 100) {
    masalah.push({ bidang: 'installer', pesan: 'Porsi PTS Daerah harus 0–99%.' });
  }
  if (sk.porsiRemote?.aktif) {
    for (const [nama, peta] of [
      ['ada support', sk.porsiRemote.adaSupport],
      ['tanpa support', sk.porsiRemote.tanpaSupport],
    ] as const) {
      const total = bulat(Object.values(peta ?? {}).reduce((t, n) => t + (n || 0), 0));
      if (total !== 100) {
        masalah.push({ bidang: 'porsiRemote', pesan: `Porsi Remote (${nama}) ${total}% — harus tepat 100%.` });
      }
      for (const k of Object.keys(peta ?? {})) {
        if (k !== 'installer' && !kunci.includes(k)) {
          masalah.push({ bidang: 'porsiRemote', pesan: `Porsi Remote (${nama}): peran "${k}" tidak ada di daftar porsi.` });
        }
      }
    }
  }

  if (sk.supervisorSebagaiPic?.aktif) {
    for (const [nama, peta] of [
      ['remote, tanpa support', sk.supervisorSebagaiPic.remote.tanpaSupport],
      ['remote, ada support', sk.supervisorSebagaiPic.remote.adaSupport],
      ['onsite, tanpa support', sk.supervisorSebagaiPic.onsite.tanpaSupport],
      ['onsite, ada support', sk.supervisorSebagaiPic.onsite.adaSupport],
    ] as const) {
      const total = bulat(Object.values(peta ?? {}).reduce((t, n) => t + (n || 0), 0));
      if (total !== 100) {
        masalah.push({ bidang: 'supervisorSebagaiPic', pesan: `Supervisor-sebagai-PIC (${nama}) ${total}% — harus tepat 100%.` });
      }
      for (const k of Object.keys(peta ?? {})) {
        if (k !== 'installer' && !kunci.includes(k)) {
          masalah.push({ bidang: 'supervisorSebagaiPic', pesan: `Supervisor-sebagai-PIC (${nama}): peran "${k}" tidak ada di daftar porsi.` });
        }
      }
    }
  }

  if (sk.installerAktif && (sk.installerRemotePersen || 0) <= 0) {
    masalah.push({
      bidang: 'installer',
      pesan: 'PTS Daerah dinyalakan tapi porsinya 0% — isi porsinya, atau matikan saklarnya.',
    });
  }
  if (sk.jendelaSupportBulan < 0) masalah.push({ bidang: 'jendela', pesan: 'Jendela penilaian support tidak boleh negatif.' });

  const totalTranche = bulat(sk.tranche.reduce((t, x) => t + (x.persen || 0), 0));
  if (totalTranche !== 100) masalah.push({ bidang: 'tranche', pesan: `Total tahapan pencairan ${totalTranche}% — harus tepat 100%.` });
  if (!sk.tranche.length) masalah.push({ bidang: 'tranche', pesan: 'Minimal ada satu tahapan pencairan.' });
  const tahunKeList = sk.tranche.map(x => x.tahunKe);
  if (new Set(tahunKeList).size !== tahunKeList.length) {
    masalah.push({
      bidang: 'tranche',
      pesan: 'Ada dua tahapan dengan "Tahun ke-" yang sama — satu tahun pencairan akan hilang. Tiap tahapan harus punya "Tahun ke-" berbeda.',
    });
  }
  if (sk.tranche.some(x => x.tahunKe < 1)) {
    masalah.push({ bidang: 'tranche', pesan: '"Tahun ke-" tiap tahapan minimal 1.' });
  }

  return masalah;
}
