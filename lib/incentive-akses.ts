
export type TingkatAkses = 'penuh' | 'input' | 'lihat';

export const URUTAN_AKSES: TingkatAkses[] = ['lihat', 'input', 'penuh'];

export const LABEL_AKSES: Record<TingkatAkses, string> = {
  lihat: 'Lihat saja',
  input: 'Input nominal',
  penuh: 'Konfigurasi penuh',
};

export const JELAS_AKSES: Record<TingkatAkses, string> = {
  lihat: 'Hanya melihat proyek yang ia terlibat & bagiannya sendiri.',
  input: 'Boleh isi nominal, buat & proses tahapan pencairan. Tidak boleh mengubah skema pembagian atau akses orang lain.',
  penuh: 'Setara admin di modul ini: skema pembagian, pengaturan akses, process batch, set brand, hapus tahapan.',
};

export interface PemilikAkses {
  role?: string | null;
  incentive_akses?: string | null;
  allow_incentive_input?: boolean | null;
  access_level?: string | null;
}

const ROLE_SELALU_PENUH = ['admin', 'superadmin'];

export function tingkatAkses(u: PemilikAkses | null | undefined): TingkatAkses {
  if (!u) return 'lihat';
  if (ROLE_SELALU_PENUH.includes((u.role || '').toLowerCase())) return 'penuh';
  if ((u.access_level || '') === 'full') return 'penuh';
  const set = (u.incentive_akses || '') as TingkatAkses;
  if (set === 'penuh' || set === 'input' || set === 'lihat') return set;
  return u.allow_incentive_input ? 'input' : 'lihat';
}

export function bisaKonfigPenuh(u: PemilikAkses | null | undefined): boolean {
  return tingkatAkses(u) === 'penuh';
}

export function bisaInputNominal(u: PemilikAkses | null | undefined): boolean {
  const t = tingkatAkses(u);
  return t === 'penuh' || t === 'input';
}

export function aksesSah(v: unknown): TingkatAkses | null {
  return v === 'penuh' || v === 'input' || v === 'lihat' ? v : null;
}
