

export type PeranInti = 'pic' | 'support' | 'supervisor' | 'manager' | 'installer';

export interface PorsiPeran {
  peran: string;
  label: string;
  persen: number;
  bagiRata: boolean;
}

export interface TahapPencairan {
  nomor: number;
  persen: number;
  tahunKe: number;
}

export interface SkemaInsentif {
  versi: number;

  kategoriProyek: string[];

  porsi: PorsiPeran[];

  tanpaSupport: Record<string, number>;

  jendelaSupportBulan: number;

  hangusSupervisorKe: string;

  managerSebagaiPic: {
    adaSupport: Record<string, number>;
    tanpaSupport: Record<string, number>;
  };

  installerAktif: boolean;

  installerRemotePersen: number;

  installerHanyaRemote: boolean;

  installerBayarDiMuka: boolean;

  porsiRemote: {
    aktif: boolean;
    adaSupport: Record<string, number>;
    tanpaSupport: Record<string, number>;
  };

  tranche: TahapPencairan[];

  supervisorSebagaiPic: {
    aktif: boolean;
    remote: { adaSupport: Record<string, number>; tanpaSupport: Record<string, number> };
    onsite: { adaSupport: Record<string, number>; tanpaSupport: Record<string, number> };
  };
}
