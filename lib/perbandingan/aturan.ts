export const KUNCI_ATURAN_PERBANDINGAN = 'tools.perbandingan';

export interface AturanPerbandingan {
  wajibVerifikasi: boolean;
  langsungRole: string[];
  verifikatorRole: string[];
  verifikatorTim: string[];
  verifikatorJabatan: string[];
  lolosSemua: boolean;
  simpanHari: number;
  maksMenunggu: number;
}

export const ROLE_PILIHAN = ['admin', 'superadmin', 'team', 'team_pts', 'guest'];
export const JABATAN_PILIHAN = ['Staff', 'Supervisor', 'Manager', 'Deputy General Manager', 'General Manager', 'Direktur'];

export const ATURAN_BAWAAN: AturanPerbandingan = {
  wajibVerifikasi: true,
  langsungRole: ['admin', 'superadmin', 'team', 'team_pts'],
  verifikatorRole: ['admin', 'superadmin'],
  verifikatorTim: ['Team PTS IVP', 'Team PTS MVI'],
  verifikatorJabatan: ['Supervisor', 'Manager', 'Deputy General Manager', 'General Manager', 'Direktur'],
  lolosSemua: true,
  simpanHari: 30,
  maksMenunggu: 10,
};

const daftar = (v: unknown, cadangan: string[], izin?: string[]) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string').map(x => x.trim().slice(0, 60)).filter(x => !izin || izin.includes(x)))].slice(0, 30) : cadangan;
const angka = (v: unknown, cadangan: number, min: number, maks: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(maks, Math.max(min, Math.round(v))) : cadangan;

export function rapikanAturan(x: unknown): AturanPerbandingan {
  const a = (x ?? {}) as Record<string, unknown>;
  const B = ATURAN_BAWAAN;
  return {
    wajibVerifikasi: typeof a.wajibVerifikasi === 'boolean' ? a.wajibVerifikasi : B.wajibVerifikasi,
    langsungRole: daftar(a.langsungRole, B.langsungRole, ROLE_PILIHAN),
    verifikatorRole: [...new Set(['admin', ...daftar(a.verifikatorRole, B.verifikatorRole, ROLE_PILIHAN)])],
    verifikatorTim: daftar(a.verifikatorTim, B.verifikatorTim),
    verifikatorJabatan: daftar(a.verifikatorJabatan, B.verifikatorJabatan, JABATAN_PILIHAN),
    lolosSemua: typeof a.lolosSemua === 'boolean' ? a.lolosSemua : B.lolosSemua,
    simpanHari: angka(a.simpanHari, B.simpanHari, 1, 365),
    maksMenunggu: angka(a.maksMenunggu, B.maksMenunggu, 1, 100),
  };
}

type AkunPeran = { role?: string | null; team_type?: string | null; jabatan?: string | null } | null | undefined;
const role = (u: AkunPeran) => (u?.role ?? '').toLowerCase();

export function bolehLangsungUnduh(u: AkunPeran, a: AturanPerbandingan = ATURAN_BAWAAN): boolean {
  if (!u) return false;
  return !a.wajibVerifikasi || a.langsungRole.includes(role(u));
}

export function bolehVerifikasi(u: AkunPeran, a: AturanPerbandingan = ATURAN_BAWAAN): boolean {
  if (!u) return false;
  if (a.verifikatorRole.includes(role(u))) return true;
  return a.verifikatorTim.includes(u.team_type ?? '') && a.verifikatorJabatan.includes(u.jabatan ?? '');
}
