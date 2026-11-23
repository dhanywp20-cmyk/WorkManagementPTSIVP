import type { RuangLED } from '../ruang';

export interface LayarPanggung {
  nama: string;
  lebar: number;
  tinggi: number;
  kolom: number;
  baris: number;
}

export interface KotakLayar extends LayarPanggung {
  x: number; y: number; w: number; h: number;
}

export const TINGGI_ORANG = 1.7;
const ZONA_ORANG = 1.5;
const JARAK_LAYAR = 0.4;
export const VB_W = 1000;
const M = { kiri: 40, kanan: 150, atas: 86, bawah: 64 };
const TINGGI_MAKS = 400;

export function susunPanggung(layar: LayarPanggung[], ruang: RuangLED) {
  const totalW = layar.reduce((a, l) => a + l.lebar, 0) + JARAK_LAYAR * Math.max(0, layar.length - 1);
  const maksH = Math.max(...layar.map(l => l.tinggi));
  const dindingW = Math.max(ruang.lebar, totalW + 0.2);
  const dindingH = Math.max(ruang.tinggi, ruang.elevasi + maksH + 0.1, TINGGI_ORANG + 0.2);
  const spanX = dindingW + ZONA_ORANG;
  const lebarIsi = VB_W - M.kiri - M.kanan;
  const s = Math.min(lebarIsi / spanX, TINGGI_MAKS / dindingH);
  const x0 = M.kiri + (lebarIsi - spanX * s) / 2;
  const X = (m: number) => x0 + (m + ZONA_ORANG) * s;
  const Y = (m: number) => M.atas + (dindingH - m) * s;
  const vbH = M.atas + dindingH * s + M.bawah;
  let kiri = (dindingW - totalW) / 2;
  const kotak: KotakLayar[] = layar.map(l => {
    const k = { ...l, x: X(kiri), y: Y(ruang.elevasi + l.tinggi), w: l.lebar * s, h: l.tinggi * s };
    kiri += l.lebar + JARAK_LAYAR;
    return k;
  });
  const orang = { x: X(-ZONA_ORANG / 2 - 0.1), y: Y(0), s };
  return {
    s, X, Y, vbH, dindingW, dindingH, kotak, orang,
    dinding: { x: X(0), y: Y(dindingH), w: dindingW * s, h: dindingH * s },
    garisAtas: M.atas - 40,
    kananDinding: X(dindingW),
  };
}

export type Panggung = ReturnType<typeof susunPanggung>;

export const SILUET = 'M-6 21L6 21L8 25Q19 26 21 33L24 70Q25 84 22 92L19 92L17 72L15 46L14 92L12 166Q12 170 7 170L2 170L1 100L-1 100L-2 170L-7 170Q-12 170 -12 166L-14 92L-15 46L-17 72L-19 92L-22 92Q-25 84 -24 70L-21 33Q-19 26 -8 25Z';

export const KE_KAKI = 3.28084;

export function teksUkur(m: number, satuan: 'm' | 'ft') {
  const v = satuan === 'ft' ? m * KE_KAKI : m;
  return `${v.toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${satuan}`;
}
