import type { ModulLED } from './hitung-led';

type Baris = [model: string, kode: string, pitch: number, pxW: number, pxH: number, lampu: string, refresh: number];

const buat = (baris: Baris[], tipe: ModulLED['tipe'], seri: string, nits: string, w = 320, h = 160): ModulLED[] =>
  baris.map(([model, kode, pitch, pxW, pxH, lampu, refresh]) => ({
    brand: 'Hikvision', model, kode, pitch, w, h, pxW, pxH, tipe,
    guna: `${seri} · ${refresh} Hz · ${nits} nits · LED ${lampu}`,
  }));

export const MODUL_HIKVISION: ModulLED[] = [
  ...buat([
    ['DS-D41Q12CA-1PH', 'P1.25', 1.25, 256, 128, '1010', 3840],
    ['DS-D41Q15CA-1PH', 'P1.53', 1.53, 208, 104, '1212', 3840],
    ['DS-D41Q18CA-1PH', 'P1.86', 1.86, 172, 86, '1515', 3840],
    ['DS-D41Q20CA-1PH', 'P2', 2, 160, 80, '1515', 3840],
    ['DS-D41Q25CA-1PH', 'P2.5', 2.5, 128, 64, '1515', 3840],
    ['DS-D41Q25CA-1PN', 'P2.5', 2.5, 128, 64, '1515', 1920],
  ], 'Indoor', 'Indoor regular', '550-600'),
  ...buat([
    ['DS-D41Q30CA-1PH', 'P3', 3.076, 104, 52, '2121', 3840],
    ['DS-D41Q30CA-1PN', 'P3', 3.076, 104, 52, '2121', 1920],
  ], 'Indoor', 'Indoor regular', '600'),
  ...buat([
    ['DS-D43Q25CA-1PH', 'P2.5', 2.5, 128, 64, '1415', 3840],
    ['DS-D43Q25CA-1PN', 'P2.5', 2.5, 128, 64, '1415', 1920],
    ['DS-D43Q30CA-1PH', 'P3.076', 3.076, 104, 52, '1415', 3840],
    ['DS-D43Q30CA-1PN', 'P3.076', 3.076, 104, 52, '1415', 1920],
    ['DS-D43Q40CA-1PH', 'P4', 4, 80, 40, '2121', 3840],
    ['DS-D43Q40CA-1PN', 'P4', 4, 80, 40, '2121', 1920],
    ['DS-D43Q50CA-1PH', 'P5', 5, 64, 32, '2121', 3840],
    ['DS-D43Q50CA-1PN', 'P5', 5, 64, 32, '2121', 1920],
    ['DS-D43Q60CA-1PH', 'P6.67', 6.67, 48, 24, '2727', 3840],
    ['DS-D43Q60CA-1PN', 'P6.67', 6.67, 48, 24, '2727', 1920],
    ['DS-D43Q80CA-1PH', 'P8', 8, 40, 20, '2727', 3840],
    ['DS-D43Q80CA-1PN', 'P8', 8, 40, 20, '2727', 1920],
    ['DS-D43QA0CA-1PH', 'P10', 10, 32, 16, '2727', 3840],
    ['DS-D43QA0CA-1PN', 'P10', 10, 32, 16, '2727', 1920],
  ], 'Outdoor', 'Outdoor regular', '4500-5000'),
  ...buat([
    ['DS-D41Q15CA-1PHT', 'P1.53', 1.53, 208, 104, '1212', 3840],
    ['DS-D41Q18CA-1PHT', 'P1.86', 1.86, 172, 86, '1515', 3840],
    ['DS-D41Q20CA-1PHT', 'P2', 2, 160, 80, '1515', 3840],
    ['DS-D41Q25CA-1PHT', 'P2.5', 2.5, 128, 64, '1515', 3840],
  ], 'Indoor', 'Indoor edge-cut', '500-550'),
  ...buat([
    ['DS-D4340CA-1PHT', 'P4', 4, 40, 40, '1921', 3840],
    ['DS-D4350CA-1PHT', 'P5', 5, 32, 32, '1921', 3840],
    ['DS-D4360CA-1PHT', 'P6.6', 6.67, 24, 24, '1921', 3840],
    ['DS-D4380CA-1PHT', 'P8', 8, 20, 20, '1921', 3840],
  ], 'Outdoor', 'Outdoor edge-cut', '4500', 160, 160),
  ...buat([
    ['DS-D41Q12CA-1GS', 'P1.25', 1.25, 256, 128, '1010', 3840],
    ['DS-D41Q15CA-1GS', 'P1.53', 1.53, 208, 104, '1212', 3840],
    ['DS-D41Q18CA-1GS', 'P1.86', 1.86, 172, 86, '1515', 3840],
    ['DS-D41Q20CA-1GS', 'P2', 2, 160, 80, '1515', 3840],
    ['DS-D41Q25CA-1GS', 'P2.5', 2.5, 128, 64, '1515', 3840],
  ], 'Indoor', 'Indoor soft', '600'),
];
