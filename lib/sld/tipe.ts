export type JenisKabel = 'catx' | 'usb' | 'ac' | 'hdmi' | 'audio' | 'speaker' | 'fiber' | 'dc' | 'ir' | 'lain';

export type Sisi = 'kiri' | 'kanan' | 'atas' | 'bawah';
export type PilihSisi = 'auto' | Sisi;

export interface Perangkat {
  id: string;
  no: string;
  nama: string;
  peran: string;
  ket: string;
  kategori: string;
  model: string;
  qty: number;
  satuan: string;
  subGambar: string;
  ikon: string;
  port: string[];
  x: number; y: number; w: number; h: number;
  gambar?: string;
  foto?: string;
  rasio?: number;
  putar?: number;
  balikH?: boolean;
  balikV?: boolean;
  huruf?: number;
}

export interface Ujung { p: string; nama: string; port: string; sisi: PilihSisi }

export interface Kabel {
  id: string;
  jenis: JenisKabel;
  daya: boolean;
  duaArah: boolean;
  dari: Ujung;
  ke: Ujung;
  cabang: Ujung[];
  media: string;
  teksGaris: string;
  fungsi: string;
  catatan: string;
  labelBalik: boolean;
  tengah?: number;
  huruf?: number;
}

export interface CatatanPasang { judul: string; isi: string }

export interface BlokJudul {
  proyek: string;
  lokasi: string;
  sistem: string;
  ringkas: string;
  lingkup: string;
  acuan: string;
  acuanSingkat: string;
  catatanRev: string;
  nomor: string;
  rev: string;
  tanggal: string;
  skala: string;
  dibuat: string;
  diperiksa: string;
  disetujui: string;
}

export type Kertas = 'a3' | '169';
export type WarnaTeks = 'hitam' | 'merah' | 'abu' | 'biru';

export interface TeksBebas { id: string; x: number; y: number; isi: string; ukuran: number; warna: WarnaTeks; tebal: boolean; putar?: number }

export interface DokSLD {
  versi: 1;
  blok: BlokJudul;
  perangkat: Perangkat[];
  kabel: Kabel[];
  teks: TeksBebas[];
  catatan: CatatanPasang[];
  watermark: boolean;
  kertas?: Kertas;
  huruf?: { perangkat?: number; kabel?: number };
  boq?: Record<string, { spek?: string; fungsi?: string }>;
}

export interface Titik { x: number; y: number }

export interface GeoGaris { titik: Titik[]; awal: boolean }

export interface GeoKabel {
  id: string;
  kode: string;
  garis: GeoGaris[];
  label: Titik;
  lebarLabel: number;
  huruf: number;
}

export const HALAMAN = { w: 420, h: 297 } as const;
export const AREA = { x: 29, y: 9, w: 382, h: 279 } as const;
export const KERTAS: Record<Kertas, { w: number; h: number; label: string }> = { a3: { w: 420, h: 297, label: 'A3' }, '169': { w: 420, h: 236.25, label: '16:9' } };
export const halamanDok = (d: { kertas?: Kertas }) => KERTAS[d.kertas === '169' ? '169' : 'a3'];
export const areaDok = (d: { kertas?: Kertas }) => ({ ...AREA, h: halamanDok(d).h - 18 });
export const HURUF_MIN = 0.5, HURUF_MAKS = 3;
export const MAKS_TEKS = 60;
export const UKURAN_AWAL = { w: 46, h: 30 } as const;
export const UKURAN_MIN = { w: 12, h: 8 } as const;
export const MAKS_PERANGKAT = 60;
export const MAKS_KABEL = 120;
export const MAKS_CATATAN = 20;
export const MAKS_BYTE_GAMBAR_SLD = 90_000;
