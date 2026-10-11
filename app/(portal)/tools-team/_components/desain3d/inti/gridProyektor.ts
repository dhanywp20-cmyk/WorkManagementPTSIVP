/**
 * Grid cahaya proyektor (mode "Grid sinar"), seperti simulator proyektor pada umumnya: gambar tiap proyektor
 * digambar sebagai pola kotak berwarna pilihan, dan ukuran SATU kotak di permukaan diketahui dalam mm - untuk
 * mengecek skala, distorsi, dan sambungan blending di lapangan. Murni (diuji di uji/desain3d-grid-proyektor.ts).
 */
export const PILIHAN_KOLOM_GRID = [8, 12, 16, 24, 32] as const;
export const KOLOM_GRID_AWAL = 16;

export const gridKolomSah = (v: unknown): number =>
  (PILIHAN_KOLOM_GRID as readonly number[]).includes(v as number) ? (v as number) : KOLOM_GRID_AWAL;

export interface KotakGrid { kolom: number; baris: number; /** ukuran satu kotak di permukaan (m) */ w: number; h: number }

/**
 * Kotak grid untuk gambar selebar × setinggi (m): jumlah baris dipilih supaya kotaknya paling mendekati persegi
 * (16:9 dengan 16 kolom = 9 baris; 4:3 dengan 16 kolom = 12 baris).
 */
export function kotakGrid(lebar: number, tinggi: number, kolom: unknown): KotakGrid {
  const k = gridKolomSah(kolom);
  const baris = Math.max(1, Math.round((k * tinggi) / Math.max(1e-6, lebar)));
  return { kolom: k, baris, w: lebar / k, h: tinggi / baris };
}

/** "1 kotak 245 × 245 mm" - satuan gambar kerja AV. */
export const labelKotakGrid = (g: KotakGrid) => `1 kotak ${Math.round(g.w * 1000).toLocaleString('id-ID')} × ${Math.round(g.h * 1000).toLocaleString('id-ID')} mm`;

/** Ukuran gambar di permukaan yang benar-benar disinari + nama permukaan sasaran (null = dinding / ruangan). */
export interface CahayaDiPermukaan { lebar: number; tinggi: number; permukaan: string | null }

/**
 * Permukaan sasaran utama sebuah proyektor dari id benda yang dikenai titik-titik sinarnya: benda yang
 * paling sering dikenai di antara yang lolos `sasaran`, bila mencakup minimal `porsiMin` dari semua titik.
 */
export function permukaanUtama(kenaId: readonly (string | null)[], sasaran: (id: string) => boolean, porsiMin = 0.25): string | null {
  const hitung = new Map<string, number>();
  for (const id of kenaId) if (id && sasaran(id)) hitung.set(id, (hitung.get(id) ?? 0) + 1);
  let terbaik: string | null = null, n = 0;
  for (const [id, c] of hitung) if (c > n) { terbaik = id; n = c; }
  return terbaik && n >= Math.max(1, kenaId.length * porsiMin) ? terbaik : null;
}
