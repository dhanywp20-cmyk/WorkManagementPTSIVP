import { MCB_STANDAR } from './hitung-led';

export const FAKTOR_PANDANG = { detail: 4, analitis: 6, umum: 8 } as const;

export type JenisPandang = keyof typeof FAKTOR_PANDANG;

export function layarDariJarak(jarakTerjauhM: number, jenis: JenisPandang, rasioLebar = 16, rasioTinggi = 9) {
  const tinggiM = jarakTerjauhM / FAKTOR_PANDANG[jenis];
  const lebarM = (tinggiM * rasioLebar) / rasioTinggi;
  return { tinggiM, lebarM, diagonalInci: (Math.hypot(lebarM, tinggiM) * 1000) / 25.4 };
}

export function ukuranDariDiagonal(diagonalInci: number, rasioLebar = 16, rasioTinggi = 9) {
  const d = (diagonalInci * 25.4) / 1000;
  const k = Math.hypot(rasioLebar, rasioTinggi);
  return { lebarM: (d * rasioLebar) / k, tinggiM: (d * rasioTinggi) / k };
}

export function jarakMaksDariLayar(tinggiLayarM: number, jenis: JenisPandang) {
  return tinggiLayarM * FAKTOR_PANDANG[jenis];
}

export function jarakLempar(throwRatio: number, lebarGambarM: number) { return throwRatio * lebarGambarM; }

export type Chroma = '4:4:4' | '4:2:2' | '4:2:0';

type TimingPerHz = Record<number, [number, number]>;

const TIMING_4K: TimingPerHz = { 24: [5500, 2250], 25: [5280, 2250], 30: [4400, 2250], 50: [5280, 2250], 60: [4400, 2250], 120: [4400, 2250] };
const TIMING: Record<string, TimingPerHz> = {
  '1280x720': { 24: [3300, 750], 25: [3960, 750], 30: [3300, 750], 50: [1980, 750], 60: [1650, 750], 120: [1650, 750] },
  '1920x1080': { 24: [2750, 1125], 25: [2640, 1125], 30: [2200, 1125], 50: [2640, 1125], 60: [2200, 1125], 120: [2200, 1125] },
  '2560x1440': { 60: [2720, 1481] },
  '3840x2160': TIMING_4K,
  '4096x2160': TIMING_4K,
  '5120x2880': { 60: [5280, 2962] },
  '7680x4320': { 24: [11000, 4500], 25: [10800, 4400], 30: [9000, 4400], 50: [10800, 4400], 60: [9000, 4400], 120: [9000, 4400] },
};

function timingStandar(lebar: number, tinggi: number, hz: number): [number, number] {
  const t = TIMING[`${lebar}x${tinggi}`];
  return t?.[hz] ?? t?.[60] ?? [Math.round(lebar * 1.08), Math.round(tinggi * 1.04)];
}

const BIT_PER_PX_HDMI = (bit: number, chroma: Chroma) => (chroma === '4:4:4' ? bit * 3 : chroma === '4:2:2' ? 24 : bit * 1.5);

export function bandwidthGbps(lebar: number, tinggi: number, hz: number, bit: number, chroma: Chroma) {
  const [ht, vt] = timingStandar(lebar, tinggi, hz);
  return { dataGbps: (ht * vt * hz * BIT_PER_PX_HDMI(bit, chroma)) / 1e9, pixelClockMHz: (ht * vt * hz) / 1e6 };
}

export type JenisAntarmuka = 'hdmi' | 'dp' | 'sdi';

export const ANTARMUKA: { nama: string; gbps: number; panjang: string; jenis: JenisAntarmuka }[] = [
  { nama: 'HDMI 1.4', gbps: 8.16, jenis: 'hdmi', panjang: '±10 m pasif; lebih jauh pakai AOC/extender' },
  { nama: 'HDMI 2.0', gbps: 14.4, jenis: 'hdmi', panjang: '±5-7 m pasif; AOC sampai 50 m+' },
  { nama: 'HDMI 2.1 (FRL)', gbps: 42.6, jenis: 'hdmi', panjang: '±3 m pasif (Ultra High Speed); AOC untuk lebih jauh' },
  { nama: 'HDBaseT 1.0/2.0', gbps: 8.16, jenis: 'hdmi', panjang: '100 m (CAT6A); 4K60 hanya 4:2:0 8-bit' },
  { nama: 'HDBaseT 3.0', gbps: 16, jenis: 'hdmi', panjang: '100 m (CAT6A)' },
  { nama: 'DisplayPort 1.4 (HBR3)', gbps: 25.92, jenis: 'dp', panjang: '±2-3 m pasif' },
  { nama: 'SDI 12G', gbps: 11.88, jenis: 'sdi', panjang: '±50-70 m coax' },
];

export function kebutuhanAntarmuka(jenis: JenisAntarmuka, lebar: number, tinggi: number, hz: number, bit: number, chroma: Chroma): number {
  if (jenis === 'hdmi') return bandwidthGbps(lebar, tinggi, hz, bit, chroma).dataGbps;
  const faktor = chroma === '4:4:4' ? 3 : chroma === '4:2:2' ? 2 : 1.5;
  if (jenis === 'dp') {
    const vt = Math.ceil(tinggi / (1 - 460e-6 * hz));
    return ((lebar + 80) * vt * hz * bit * faktor) / 1e9;
  }
  const [ht, vt] = timingStandar(lebar, tinggi, hz);
  return (ht * vt * hz * Math.max(10, bit) * Math.max(2, faktor)) / 1e9;
}

export function splPadaJarak(spl1m: number, jarakM: number) { return spl1m - 20 * Math.log10(Math.max(0.1, jarakM)); }

export function splMaks(sensitivitas: number, dayaW: number) { return sensitivitas + 10 * Math.log10(Math.max(0.01, dayaW)); }

export function speakerPlafon(panjangM: number, lebarM: number, tinggiPlafonM: number, telingaM: number, sudutDerajat: number, rapat = true) {
  const h = Math.max(0.3, tinggiPlafonM - telingaM);
  const diameter = 2 * h * Math.tan((sudutDerajat * Math.PI) / 360);
  const jarak = diameter * (rapat ? 0.7 : 1);
  const kolom = Math.max(1, Math.ceil(panjangM / jarak));
  const baris = Math.max(1, Math.ceil(lebarM / jarak));
  return { diameterM: diameter, jarakM: jarak, kolom, baris, jumlah: kolom * baris };
}

export interface Beban { nama: string; watt: number; jumlah: number }

export function hitungDaya(beban: Beban[], tegangan = 220, faktorDaya = 0.9, cadangan = 0.25) {
  const totalW = beban.reduce((n, b) => n + Math.max(0, b.watt) * Math.max(0, b.jumlah), 0);
  const va = totalW / faktorDaya;
  const arusA = va / tegangan;
  return {
    totalW, va, arusA,
    upsVA: Math.ceil((va * (1 + cadangan)) / 500) * 500,
    mcbA: MCB_STANDAR.find(r => r >= arusA * 1.25) ?? Math.ceil((arusA * 1.25) / 10) * 10,
    btu: totalW * 3.412,
    pkAC: (totalW * 3.412) / 9000,
  };
}
