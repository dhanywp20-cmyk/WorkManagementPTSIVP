/**
 * lib/perbandingan-aturan.ts - aturan Product Comparison yang diatur Admin Panel (app_settings
 * 'tools.perbandingan'), BUKAN tertulis di kode: siapa langsung mengunduh, siapa memverifikasi, boleh
 * "Loloskan semua", lama simpan pengajuan. Bawaan = perilaku awal (owner 2026-10-12). Murni (uji/perbandingan.ts).
 */
export const KUNCI_ATURAN_PERBANDINGAN = 'tools.perbandingan';

export interface AturanPerbandingan {
  /** false = semua pengguna boleh langsung mengunduh (verifikasi dimatikan). */
  wajibVerifikasi: boolean;
  /** Role yang mengunduh langsung (memverifikasi sendiri) - orang produk. */
  langsungRole: string[];
  /** Role yang selalu boleh memverifikasi. */
  verifikatorRole: string[];
  /** Kelompok (users.team_type) & jabatan yang boleh memverifikasi (keduanya harus cocok). */
  verifikatorTim: string[];
  verifikatorJabatan: string[];
  /** Tombol "Loloskan semua": selesaikan semua nilai "cek" sekaligus (verifikator & pengunduh langsung). */
  lolosSemua: boolean;
  /** Pengajuan dihapus otomatis setelah N hari; batas pengajuan menunggu per orang. */
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

/** Isian app_settings (boleh sebagian / rusak) -> aturan lengkap & sah. */
export function rapikanAturan(x: unknown): AturanPerbandingan {
  const a = (x ?? {}) as Record<string, unknown>;
  const B = ATURAN_BAWAAN;
  return {
    wajibVerifikasi: typeof a.wajibVerifikasi === 'boolean' ? a.wajibVerifikasi : B.wajibVerifikasi,
    langsungRole: daftar(a.langsungRole, B.langsungRole, ROLE_PILIHAN),
    //  Admin selalu bisa memverifikasi - supaya pengajuan tidak pernah tanpa pemeriksa.
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

/** Boleh mengunduh PDF tanpa verifikasi (orang produk, atau verifikasi dimatikan). */
export function bolehLangsungUnduh(u: AkunPeran, a: AturanPerbandingan = ATURAN_BAWAAN): boolean {
  if (!u) return false;
  return !a.wajibVerifikasi || a.langsungRole.includes(role(u));
}

/** Boleh memverifikasi pengajuan: role verifikator, atau kelompok + jabatan yang dipilih Admin. */
export function bolehVerifikasi(u: AkunPeran, a: AturanPerbandingan = ATURAN_BAWAAN): boolean {
  if (!u) return false;
  if (a.verifikatorRole.includes(role(u))) return true;
  return a.verifikatorTim.includes(u.team_type ?? '') && a.verifikatorJabatan.includes(u.jabatan ?? '');
}
