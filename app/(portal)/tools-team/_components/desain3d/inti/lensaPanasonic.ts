import { bacaPoligonShift } from '@/lib/pustaka';
import type { Benda } from './tipe';

export interface LensaPanasonic {
  nama: string; koef: Benda['koefRasio']; trMin: number; trMax: number; koreksiJarak: number; koreksiJarakTele: number;
   shiftAtas: number; shiftBawah: number; shiftHorizontal: number; poligonShift: string;
}

const SEGI8_67 = '-0.5,1.17; 0.5,1.17; 0.85,0.5; 0.85,-0.5; 0.5,-1.17; -0.5,-1.17; -0.85,-0.5; -0.85,0.5';

export const LENSA_MZ882 = {
  ELU20: { nama: 'Panasonic PT-MZ882 + ET-ELU20 (ultra short throw)',
    koef: { '16:10': [0.338268, 0.364174, 0.029388, 0.034616], '16:9': [0.338242, 0.36417, 0.029388, 0.034616], '4:3': [0.405906, 0.437008, 0.029388, 0.034616], '21:9': [0.338252, 0.36419, 0.029388, 0.034616] }, trMin: 0.33827, trMax: 0.36417, koreksiJarak: 0.029388, koreksiJarakTele: 0.034616,
    shiftAtas: 50, shiftBawah: 50, shiftHorizontal: 24, poligonShift: '-0.5,1; 0.5,1; 0.74,0.5; 0.74,-0.5; 0.5,-1; -0.5,-1; -0.74,-0.5; -0.74,0.5' },
  ELW22: { nama: 'Panasonic PT-MZ882 + ET-ELW22',
    koef: { '16:10': [0.814145, 1.009185, 0.04846, 0.045477], '16:9': [0.814165, 1.009169, 0.04846, 0.045477], '4:3': [0.977018, 1.211024, 0.04846, 0.045477], '21:9': [0.814139, 1.009202, 0.04846, 0.045477] }, trMin: 0.81415, trMax: 1.00919, koreksiJarak: 0.04846, koreksiJarakTele: 0.045477,
    shiftAtas: 60, shiftBawah: 60, shiftHorizontal: 30, poligonShift: '-0.5,1.1; 0.5,1.1; 0.8,0.5; 0.8,-0.5; 0.5,-1.1; -0.5,-1.1; -0.8,-0.5; -0.8,0.5' },
  ELW20: { nama: 'Panasonic PT-MZ882 + ET-ELW20',
    koef: { '16:10': [1.244988, 1.695099, 0.055497, 0.0534], '16:9': [1.244962, 1.695093, 0.055497, 0.0534], '4:3': [1.493996, 2.034154, 0.055497, 0.0534], '21:9': [1.244987, 1.695107, 0.055497, 0.0534] }, trMin: 1.24499, trMax: 1.6951, koreksiJarak: 0.055497, koreksiJarakTele: 0.0534,
    shiftAtas: 67, shiftBawah: 67, shiftHorizontal: 35, poligonShift: SEGI8_67 },
  ELS20: { nama: 'Panasonic PT-MZ882 + lensa standar ET-ELS20',
    koef: { '16:10': [1.639108, 2.787714, 0.054882, 0.048228], '16:9': [1.639081, 2.787693, 0.054882, 0.048228], '4:3': [1.966978, 3.345325, 0.054882, 0.048228], '21:9': [1.639088, 2.787719, 0.054882, 0.048228] }, trMin: 1.63911, trMax: 2.78771, koreksiJarak: 0.054882, koreksiJarakTele: 0.048228,
    shiftAtas: 67, shiftBawah: 67, shiftHorizontal: 35, poligonShift: SEGI8_67 },
} satisfies Record<string, LensaPanasonic>;

const BADAN_MZ882 = { lumen: 8200, rasioProyektor: '16:10', resolusiProyektor: 'WUXGA', kontrasAsli: 3000000 } as const;

export function lensaMZ882(l: LensaPanasonic, tr: number): Partial<Benda> {
  return {
    ...BADAN_MZ882, trMin: l.trMin, trMax: l.trMax, throwRatio: Math.min(l.trMax, Math.max(l.trMin, tr)),
    koreksiJarak: l.koreksiJarak, koreksiJarakTele: l.koreksiJarakTele,
    shiftAtasMaks: l.shiftAtas / 100, shiftBawahMaks: l.shiftBawah / 100, shiftHMaks: l.shiftHorizontal / 100,
    poligonShift: bacaPoligonShift(l.poligonShift), offsetTetap: undefined, koefRasio: l.koef, sumberLensa: undefined, modelProduk: l.nama.replace(/\s*\(.*\)$/, '').replace('lensa standar ', ''),
  };
}
