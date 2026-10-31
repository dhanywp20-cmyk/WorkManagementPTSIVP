/**
 * desain3d/inti/lensaPanasonic.ts - Lensa NYATA Panasonic PT-MZ882 untuk template Mapping & Immersive.
 *
 * Angka sama persis dengan Pustaka (supabase/migrations/057_pustaka_proyektor_panasonic.sql, koefisien
 * Panasonic Throw Distance Calculator 2.79): rentang zoom, koreksi jarak b wide/tele, daerah lens shift segi
 * delapan, panel WUXGA 16:10. Dulu template memakai lensa karangan (UST TR 0,25, zoom 0,9-1,1, 1,39-2,09 tanpa b
 * & tanpa batas shift) - angkanya tidak bisa dicocokkan dengan kalkulator Panasonic. Kesamaan dengan migrasi
 * diuji di uji/desain3d-template-lensa.ts.
 */
import { bacaPoligonShift } from '@/lib/pustaka';
import type { Benda } from './tipe';

export interface LensaPanasonic {
  nama: string; trMin: number; trMax: number; koreksiJarak: number; koreksiJarakTele: number;
  /** % tinggi / lebar gambar (Pustaka) */ shiftAtas: number; shiftBawah: number; shiftHorizontal: number; poligonShift: string;
}

const SEGI8_67 = '-0.5,1.17; 0.5,1.17; 0.85,0.5; 0.85,-0.5; 0.5,-1.17; -0.5,-1.17; -0.85,-0.5; -0.85,0.5';

export const LENSA_MZ882 = {
  /** Ultra short throw zoom 0,338-0,364 (lens shift V ±50%, H ±24%). */
  ELU20: { nama: 'Panasonic PT-MZ882 + ET-ELU20 (ultra short throw)', trMin: 0.33827, trMax: 0.36417, koreksiJarak: 0.029388, koreksiJarakTele: 0.034616,
    shiftAtas: 50, shiftBawah: 50, shiftHorizontal: 24, poligonShift: '-0.5,1; 0.5,1; 0.74,0.5; 0.74,-0.5; 0.5,-1; -0.5,-1; -0.74,-0.5; -0.74,0.5' },
  /** Short throw zoom 0,814-1,009 (V ±60%, H ±30%). */
  ELW22: { nama: 'Panasonic PT-MZ882 + ET-ELW22', trMin: 0.81415, trMax: 1.00919, koreksiJarak: 0.04846, koreksiJarakTele: 0.045477,
    shiftAtas: 60, shiftBawah: 60, shiftHorizontal: 30, poligonShift: '-0.5,1.1; 0.5,1.1; 0.8,0.5; 0.8,-0.5; 0.5,-1.1; -0.5,-1.1; -0.8,-0.5; -0.8,0.5' },
  /** Wide zoom 1,245-1,695 (V ±67%, H ±35%). */
  ELW20: { nama: 'Panasonic PT-MZ882 + ET-ELW20', trMin: 1.24499, trMax: 1.6951, koreksiJarak: 0.055497, koreksiJarakTele: 0.0534,
    shiftAtas: 67, shiftBawah: 67, shiftHorizontal: 35, poligonShift: SEGI8_67 },
  /** Lensa standar 1,639-2,788 (V ±67%, H ±35%). */
  ELS20: { nama: 'Panasonic PT-MZ882 + lensa standar ET-ELS20', trMin: 1.63911, trMax: 2.78771, koreksiJarak: 0.054882, koreksiJarakTele: 0.048228,
    shiftAtas: 67, shiftBawah: 67, shiftHorizontal: 35, poligonShift: SEGI8_67 },
} satisfies Record<string, LensaPanasonic>;

/** PT-MZ882: 8.200 lm, WUXGA, kontras 3.000.000:1 (sama dengan Pustaka). */
const BADAN_MZ882 = { lumen: 8200, rasioProyektor: '16:10', resolusiProyektor: 'WUXGA', kontrasAsli: 3000000 } as const;

/**
 * Data lensa & badan PT-MZ882 untuk sebuah proyektor - bidang yang sama dengan isiDariPustaka. `tr` = posisi zoom,
 * dijepit ke rentang lensa (template tidak boleh memakai TR yang tidak bisa dicapai lensanya).
 */
export function lensaMZ882(l: LensaPanasonic, tr: number): Partial<Benda> {
  return {
    ...BADAN_MZ882, trMin: l.trMin, trMax: l.trMax, throwRatio: Math.min(l.trMax, Math.max(l.trMin, tr)),
    koreksiJarak: l.koreksiJarak, koreksiJarakTele: l.koreksiJarakTele,
    shiftAtasMaks: l.shiftAtas / 100, shiftBawahMaks: l.shiftBawah / 100, shiftHMaks: l.shiftHorizontal / 100,
    poligonShift: bacaPoligonShift(l.poligonShift), offsetTetap: undefined, koefRasio: undefined, sumberLensa: undefined,
  };
}
