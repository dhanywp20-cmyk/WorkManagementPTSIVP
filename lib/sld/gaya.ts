import type { JenisKabel } from './tipe';

export const HURUF = 'Arial, Helvetica, sans-serif';

export const WARNA = {
  tinta: '#1f2328',
  redup: '#57606a',
  merah: '#e00000',
  garisTabel: '#afb8c1',
  garisKepala: '#8c959f',
  isiKepala: '#eaeef2',
  isiSelang: '#f6f8fa',
  putih: '#ffffff',
} as const;

export interface GayaKabel { label: string; legend: string; warna: string; tebal: number; putus?: string }

export const GAYA_KABEL: Record<JenisKabel, GayaKabel> = {
  catx: { label: 'CATX (Cat5e / Cat6)', legend: 'CATX Cable', warna: '#13a3e0', tebal: 0.55 },
  usb: { label: 'USB', legend: 'USB Cable', warna: '#111111', tebal: 0.55 },
  ac: { label: 'Listrik 230 VAC', legend: 'Power 230 VAC', warna: '#8d5524', tebal: 0.75 },
  hdmi: { label: 'HDMI', legend: 'HDMI Cable', warna: '#7a3fc4', tebal: 0.55 },
  audio: { label: 'Audio analog', legend: 'Audio Cable', warna: '#1a7f37', tebal: 0.55 },
  speaker: { label: 'Kabel speaker', legend: 'Speaker Cable', warna: '#bf3989', tebal: 0.55 },
  fiber: { label: 'Fiber optik', legend: 'Fiber Optic', warna: '#e16f24', tebal: 0.55 },
  dc: { label: 'Catu daya DC', legend: 'Power DC', warna: '#8c959f', tebal: 0.55, putus: '1.6 0.9' },
  ir: { label: 'Kabel IR emitter', legend: 'IR Emitter', warna: '#cf222e', tebal: 0.5, putus: '0.6 0.7' },
  lain: { label: 'Lainnya', legend: 'Other Cable', warna: '#57606a', tebal: 0.5, putus: '2.4 1' },
};

export const URUTAN_JENIS: JenisKabel[] = ['usb', 'catx', 'ac', 'hdmi', 'audio', 'speaker', 'fiber', 'dc', 'ir', 'lain'];

export const LABEL_GARIS = { ukuran: 2.0, tinggi: 2.9, jarakH: 2.95, jarakV: 2 } as const;
export const SUDUT_GARIS = 2.2;
export const TITIK_UJUNG = 0.95;

export const LABEL_PERANGKAT = {
  nama: { ukuran: 2.75, warna: WARNA.tinta },
  peran: { ukuran: 2.4, warna: WARNA.merah },
  ket: { ukuran: 2.3, warna: WARNA.tinta },
  jarakAtas: 3,
  geserKiri: 1,
  spasi: 1.32,
} as const;

export const WATERMARK = {
  w: 48, h: 12.8, sudut: -20, tembus: 0.12,
  baris: [27, 57, 87, 117, 147, 177, 207, 237, 267],
  kolomGenap: [45, 165, 285],
  kolomGanjil: [105, 225, 345],
} as const;
