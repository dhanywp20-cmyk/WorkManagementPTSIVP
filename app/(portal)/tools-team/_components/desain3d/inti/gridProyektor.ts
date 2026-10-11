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
