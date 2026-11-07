import { bacaPoligonShift } from '@/lib/pustaka';
import type { Benda } from './tipe';

export interface LensaPanasonic {
  nama: string; trMin: number; trMax: number; koreksiJarak: number; koreksiJarakTele: number;
   shiftAtas: number; shiftBawah: number; shiftHorizontal: number; poligonShift: string;
}

const SEGI8_67 = '-0.5,1.17; 0.5,1.17; 0.85,0.5; 0.85,-0.5; 0.5,-1.17; -0.5,-1.17; -0.85,-0.5; -0.85,0.5';

export const LENSA_MZ882 = {
  ELU20: { nama: 'Panasonic PT-MZ882 + ET-ELU20 (ultra short throw)', trMin: 0.33827, trMax: 0.36417, koreksiJarak: 0.029388, koreksiJarakTele: 0.034616,
    shiftAtas: 50, shiftBawah: 50, shiftHorizontal: 24, poligonShift: '-0.5,1; 0.5,1; 0.74,0.5; 0.74,-0.5; 0.5,-1; -0.5,-1; -0.74,-0.5; -0.74,0.5' },
  ELW22: { nama: 'Panasonic PT-MZ882 + ET-ELW22', trMin: 0.81415, trMax: 1.00919, koreksiJarak: 0.04846, koreksiJarakTele: 0.045477,
    shiftAtas: 60, shiftBawah: 60, shiftHorizontal: 30, poligonShift: '-0.5,1.1; 0.5,1.1; 0.8,0.5; 0.8,-0.5; 0.5,-1.1; -0.5,-1.1; -0.8,-0.5; -0.8,0.5' },
  ELW20: { nama: 'Panasonic PT-MZ882 + ET-ELW20', trMin: 1.24499, trMax: 1.6951, koreksiJarak: 0.055497, koreksiJarakTele: 0.0534,
    shiftAtas: 67, shiftBawah: 67, shiftHorizontal: 35, poligonShift: SEGI8_67 },
  ELS20: { nama: 'Panasonic PT-MZ882 + lensa standar ET-ELS20', trMin: 1.63911, trMax: 2.78771, koreksiJarak: 0.054882, koreksiJarakTele: 0.048228,
    shiftAtas: 67, shiftBawah: 67, shiftHorizontal: 35, poligonShift: SEGI8_67 },
} satisfies Record<string, LensaPanasonic>;

const BADAN_MZ882 = { lumen: 8200, rasioProyektor: '16:10', resolusiProyektor: 'WUXGA', kontrasAsli: 3000000 } as const;

export function lensaMZ882(l: LensaPanasonic, tr: number): Partial<Benda> {
  return {
    ...BADAN_MZ882, trMin: l.trMin, trMax: l.trMax, throwRatio: Math.min(l.trMax, Math.max(l.trMin, tr)),
    koreksiJarak: l.koreksiJarak, koreksiJarakTele: l.koreksiJarakTele,
    shiftAtasMaks: l.shiftAtas / 100, shiftBawahMaks: l.shiftBawah / 100, shiftHMaks: l.shiftHorizontal / 100,
    poligonShift: bacaPoligonShift(l.poligonShift), offsetTetap: undefined, koefRasio: undefined, sumberLensa: undefined, modelProduk: l.nama.replace(/\s*\(.*\)$/, '').replace('lensa standar ', ''),
  };
}
