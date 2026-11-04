import { cabinetUntukUkuran, hitungLED, type HasilLED, type ModulLED, type Pembulatan } from './av-hitung';

export interface OpsiBanding {
  lebarM: number; tinggiM: number; bulat: Pembulatan;
  perM2: (m: ModulLED) => { daya: number; berat: number };
  faktorRata: number; refresh: 60 | 120 | 144 | 240; bit: 8 | 10 | 12; tegangan: number; faktorDaya: number;
}
export interface BarisBanding { modul: ModulLED; kolom: number; baris: number; h: HasilLED; selisihLebarM: number; selisihTinggiM: number }

export function bandingPitch(daftar: ModulLED[], o: OpsiBanding): BarisBanding[] {
  return daftar.map(m => {
    const { kolom, baris } = cabinetUntukUkuran(o.lebarM, o.tinggiM, m.w, m.h, o.bulat);
    const luas = (m.w * m.h) / 1e6, per = o.perM2(m);
    const h = hitungLED({
      pitch: m.pitch, cabLebar: m.w, cabTinggi: m.h, kolom, baris, pxX: m.pxW, pxY: m.pxH,
      dayaMaksCab: per.daya * luas, beratCab: per.berat * luas, faktorRata: o.faktorRata,
      refresh: o.refresh, bit: o.bit, tegangan: o.tegangan, faktorDaya: o.faktorDaya,
    });
    return { modul: m, kolom, baris, h, selisihLebarM: h.lebarM - o.lebarM, selisihTinggiM: h.tinggiM - o.tinggiM };
  });
}

export function saranPitch(baris: BarisBanding[], jarakTerdekatM: number): { modul: ModulLED; nyaman: boolean } | null {
  const urut = [...baris].sort((a, b) => b.modul.pitch - a.modul.pitch);
  const nyaman = urut.find(b => b.h.jarakIdealM <= jarakTerdekatM);
  if (nyaman) return { modul: nyaman.modul, nyaman: true };
  const cukup = urut.find(b => b.h.jarakMinM <= jarakTerdekatM);
  return cukup ? { modul: cukup.modul, nyaman: false } : null;
}

export const MAKS_SISI_KANVAS = 16384;
export const MAKS_PIKSEL_KANVAS = 16384 * 8192;
export const polaUjiBisa = (resX: number, resY: number) =>
  resX > 0 && resY > 0 && resX <= MAKS_SISI_KANVAS && resY <= MAKS_SISI_KANVAS && resX * resY <= MAKS_PIKSEL_KANVAS;

export function garisCabinet(kolom: number, baris: number, pxCabX: number, pxCabY: number) {
  return {
    x: Array.from({ length: kolom + 1 }, (_, i) => i * pxCabX),
    y: Array.from({ length: baris + 1 }, (_, j) => j * pxCabY),
  };
}

export const labelCabinet = (c: number, r: number) => `K${c + 1}B${r + 1}`;
