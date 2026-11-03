import { ambilSkema } from './incentive-scheme-simpan';
import { INCENTIVE_CATEGORIES } from './incentive-scheme-kategori-bawaan';

export { INCENTIVE_CATEGORIES };

let kategoriBerlaku: string[] = [...INCENTIVE_CATEGORIES];
export function aturKategoriBerlaku(kategori: string[]) { kategoriBerlaku = kategori; }

export function kategoriInsentif(): string[] {
  return kategoriBerlaku;
}

export function adalahKategoriInsentif(kategori: string | null | undefined): boolean {
  return !!kategori && kategoriBerlaku.includes(kategori);
}

export async function muatKategoriInsentif(): Promise<string[]> {
  const sk = await ambilSkema();
  return sk.kategoriProyek;
}
