
export interface PenggunaPiket {
  role?: string | null;
  team_type?: string | null;
  access_level?: string | null;
  piket_akses?: string | null;
  piket_ubah?: boolean | null;
}

export type LingkupPiket = 'lingkup' | 'semua';

export const LABEL_PIKET_AKSES: Record<LingkupPiket, string> = {
  lingkup: 'Sesuai divisi',
  semua: 'Semua catatan',
};

export const JELAS_PIKET_AKSES: Record<LingkupPiket, string> = {
  lingkup: 'Dibatasi: hanya catatan atas namanya / divisinya (plus kegiatan internal). Pilih hanya bila akun ini memang tidak boleh melihat kunjungan lain.',
  semua: 'Bawaan: melihat seluruh catatan tamu showroom dan boleh export Excel.',
};

function peran(u: PenggunaPiket | null | undefined): string {
  return (u?.role ?? '').toLowerCase();
}

export function adalahPTS(u: PenggunaPiket | null | undefined): boolean {
  return ['admin', 'superadmin', 'team', 'team_pts'].includes(peran(u));
}

export function bisaLihatSemuaTamu(u: PenggunaPiket | null | undefined): boolean {
  if (adalahPTS(u)) return true;
  return (u?.piket_akses ?? '') !== 'lingkup';
}

export function bisaIsiKegiatan(u: PenggunaPiket | null | undefined): boolean {
  return adalahPTS(u) || u?.piket_ubah === true;
}

export function lingkupPiketSah(v: unknown): LingkupPiket | null {
  return v === 'lingkup' || v === 'semua' ? v : null;
}
