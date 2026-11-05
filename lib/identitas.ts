
export interface OrangRingkas {
  id: string;
  full_name?: string | null;
  username?: string | null;
}

export function idDariNama(
  orang: readonly OrangRingkas[] | null | undefined,
  nama: string | null | undefined,
): string | null {
  const cari = (nama ?? '').trim();
  if (!cari || !orang?.length) return null;
  const cocok = orang.filter(o => (o.full_name ?? '').trim() === cari);
  return cocok.length === 1 ? cocok[0].id : null;
}

export function idDariUsername(
  orang: readonly OrangRingkas[] | null | undefined,
  username: string | null | undefined,
): string | null {
  const cari = (username ?? '').trim().toLowerCase();
  if (!cari || !orang?.length) return null;
  return orang.find(o => (o.username ?? '').trim().toLowerCase() === cari)?.id ?? null;
}

export function kutipNilai(v: string | null | undefined): string {
  return `"${(v ?? '').replace(/"/g, '')}"`;
}

export function filterIdentitas(
  kolomId: string, id: string | null | undefined,
  kolomNama: string, nama: string | null | undefined,
): string | null {
  const bagian: string[] = [];
  if (id) bagian.push(`${kolomId}.eq.${id}`);
  const n = (nama ?? '').trim().replace(/"/g, '');
  if (n) bagian.push(`${kolomNama}.eq."${n}"`);
  return bagian.length ? bagian.join(',') : null;
}

export function pasanganIdentitas(
  kolomId: string, kolomNama: string,
  id: string | null | undefined, nama: string | null | undefined,
): Record<string, unknown> {
  return {
    [kolomNama]: (nama ?? '').trim() || null,
    [kolomId]: id ?? null,
  };
}

const KOLOM_IDENTITAS = ['sales_user_id', 'assign_user_id', 'guest_user_id', 'pic_user_id'] as const;

interface GalatRingkas { message?: string | null; code?: string | null }

export function kolomIdentitasBelumAda(galat: GalatRingkas | null | undefined): boolean {
  if (!galat) return false;
  const pesan = (galat.message ?? '').toLowerCase();
  if (!KOLOM_IDENTITAS.some(k => pesan.includes(k))) return false;
  return galat.code === 'PGRST204' || pesan.includes('column') || pesan.includes('schema cache');
}

export function tanpaIdentitas<T extends Record<string, unknown>>(baris: T): T {
  const salinan: Record<string, unknown> = { ...baris };
  for (const k of KOLOM_IDENTITAS) delete salinan[k];
  return salinan as T;
}

export async function cobaIdentitas<H extends { error: GalatRingkas | null }>(
  jalankan: (pakaiUuid: boolean) => Promise<H>,
): Promise<H> {
  const hasil = await jalankan(true);
  return kolomIdentitasBelumAda(hasil.error) ? jalankan(false) : hasil;
}
