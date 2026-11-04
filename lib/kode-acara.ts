
export const TABEL_KODE_ACARA = 'pengaturan_kode_acara';

export interface PengaturanKodeAcara {
  aktif: boolean;
  kode: string;
  berlakuSampai: string | null;
}

export interface BarisKodeAcara {
  aktif?: boolean | null;
  kode?: string | null;
  berlaku_sampai?: string | null;
}

export function dariBaris(baris: BarisKodeAcara | null | undefined): PengaturanKodeAcara | null {
  if (!baris) return null;
  return {
    aktif: baris.aktif === true,
    kode: typeof baris.kode === 'string' ? baris.kode.trim() : '',
    berlakuSampai: baris.berlaku_sampai ?? null,
  };
}

export function rapikanKodeAcara(mentah: unknown): PengaturanKodeAcara | null {
  if (!mentah || typeof mentah !== 'object' || Array.isArray(mentah)) return null;
  const o = mentah as Record<string, unknown>;
  const kode = typeof o.kode === 'string' ? o.kode.trim() : '';
  const sampai = typeof o.berlakuSampai === 'string' && o.berlakuSampai.trim()
    ? o.berlakuSampai.trim() : null;
  return { aktif: o.aktif === true, kode, berlakuSampai: sampai };
}

export type StatusKodeAcara = 'kosong' | 'valid' | 'tidak_valid';

export function periksaKodeAcara(
  kodeDikirim: string,
  pengaturan: PengaturanKodeAcara | null,
): StatusKodeAcara {
  if (!kodeDikirim) return 'kosong';
  if (!pengaturan || !pengaturan.aktif || !pengaturan.kode) return 'tidak_valid';
  if (kodeDikirim !== pengaturan.kode) return 'tidak_valid';

  if (pengaturan.berlakuSampai) {
    const batas = new Date(pengaturan.berlakuSampai);
    if (!Number.isNaN(batas.getTime()) && new Date() > batas) return 'tidak_valid';
  }
  return 'valid';
}
