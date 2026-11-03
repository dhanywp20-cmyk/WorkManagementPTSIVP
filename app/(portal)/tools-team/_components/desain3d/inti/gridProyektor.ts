export const PILIHAN_KOLOM_GRID = [8, 12, 16, 24, 32] as const;
export const KOLOM_GRID_AWAL = 16;

export const gridKolomSah = (v: unknown): number =>
  (PILIHAN_KOLOM_GRID as readonly number[]).includes(v as number) ? (v as number) : KOLOM_GRID_AWAL;

export interface KotakGrid { kolom: number; baris: number;  w: number; h: number }

export function kotakGrid(lebar: number, tinggi: number, kolom: unknown): KotakGrid {
  const k = gridKolomSah(kolom);
  const baris = Math.max(1, Math.round((k * tinggi) / Math.max(1e-6, lebar)));
  return { kolom: k, baris, w: lebar / k, h: tinggi / baris };
}

export const labelKotakGrid = (g: KotakGrid) => `1 kotak ${Math.round(g.w * 1000).toLocaleString('id-ID')} × ${Math.round(g.h * 1000).toLocaleString('id-ID')} mm`;

export interface CahayaDiPermukaan { lebar: number; tinggi: number; permukaan: string | null }

export function permukaanUtama(kenaId: readonly (string | null)[], sasaran: (id: string) => boolean, porsiMin = 0.25): string | null {
  const hitung = new Map<string, number>();
  for (const id of kenaId) if (id && sasaran(id)) hitung.set(id, (hitung.get(id) ?? 0) + 1);
  let terbaik: string | null = null, n = 0;
  for (const [id, c] of hitung) if (c > n) { terbaik = id; n = c; }
  return terbaik && n >= Math.max(1, kenaId.length * porsiMin) ? terbaik : null;
}
