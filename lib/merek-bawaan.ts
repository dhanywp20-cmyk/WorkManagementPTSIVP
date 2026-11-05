
export interface Merek {
  namaPlatform: string;
  namaPlatformSingkat: string;
  namaPortal: string;
  namaPerusahaan: string;
  kredit: string;
  kontakDukungan: string;
  logoUrl: string;
  warnaUtama: string;
  warnaUtama2: string;
  warnaAksen: string;
  gambarLatarDasbor: string;
  latarDasbor: string;

  gambarLatar: string;
  warnaLogin: string;
  warnaLogin2: string;
  tembusLogin: string;
  tembusKanan: string;
  judulLogin: string;
  subjudulLogin: string;
}

export const MEREK_BAWAAN: Merek = {
  namaPlatform: 'Work Management Platform',
  namaPlatformSingkat: 'WM Platform',
  namaPortal: 'PTS Portal',
  namaPerusahaan: 'IndoVisual Professional Tools',
  kredit: 'Created by DWP',
  kontakDukungan: '',
  logoUrl: '/logo-mark.png',
  warnaUtama: '#e11d48',
  warnaUtama2: '#be123c',
  warnaAksen: '#c8861d',
  gambarLatarDasbor: '/IVP_Background.png',
  latarDasbor: 'netral',

  gambarLatar: '/IVP_Background.png',
  warnaLogin: '#be123c',
  warnaLogin2: '#881337',
  tembusLogin: '0.84',
  tembusKanan: '0.55',
  judulLogin: 'Portal Manajemen Kerja Tim PTS',
  subjudulLogin: 'Request schedule, ticket troubleshooting, design project & piket showroom — dalam satu platform yang rapi.',
};

export const FIELD_LOGIN = [
  'gambarLatar', 'warnaLogin', 'warnaLogin2', 'tembusLogin', 'tembusKanan',
  'judulLogin', 'subjudulLogin',
] as const satisfies readonly (keyof Merek)[];

export const KUNCI_MEREK = 'merek';
export const KUNCI_DIVISI = 'sales_divisions';
