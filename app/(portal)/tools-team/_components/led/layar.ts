import { cabinetUntukUkuran, type Pembulatan } from '@/lib/av/hitung';
import { bersihkanKoneksi, KONEKSI_AWAL, type PengaturanKoneksi } from './koneksi/data';

export interface LayarTambahan {
  id: string;
  nama: string;
  mode: 'ukuran' | 'jumlah';
  targetW: number; targetH: number; bulat: Pembulatan;
  kolomIn: number; barisIn: number;
  koneksi: PengaturanKoneksi;
}

export const MAKS_LAYAR = 8;

const idBaru = () => Math.random().toString(36).slice(2, 10);

export const layarBaru = (urut: number, dari?: Partial<LayarTambahan>): LayarTambahan => ({
  mode: 'ukuran', targetW: 3, targetH: 2, bulat: 'round', kolomIn: 6, barisIn: 4,
  ...dari, koneksi: dari?.koneksi ?? KONEKSI_AWAL, id: idBaru(), nama: `Screen ${urut}`,
});

export function bersihkanLayar(x: unknown): LayarTambahan[] {
  if (!Array.isArray(x)) return [];
  const angka = (v: unknown, min: number, maks: number, awal: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(maks, Math.max(min, v)) : awal);
  return x.slice(0, MAKS_LAYAR - 1).filter(o => o && typeof o === 'object' && !Array.isArray(o)).map((o: Record<string, unknown>, i) => ({
    id: typeof o.id === 'string' && o.id ? o.id.slice(0, 20) : idBaru(),
    nama: typeof o.nama === 'string' && o.nama.trim() ? o.nama.slice(0, 40) : `Screen ${i + 2}`,
    mode: o.mode === 'jumlah' ? 'jumlah' : 'ukuran',
    targetW: angka(o.targetW, 0.01, 500, 3), targetH: angka(o.targetH, 0.01, 500, 2),
    bulat: o.bulat === 'floor' || o.bulat === 'ceil' ? o.bulat : 'round',
    kolomIn: Math.round(angka(o.kolomIn, 1, 1000, 6)), barisIn: Math.round(angka(o.barisIn, 1, 1000, 4)),
    koneksi: bersihkanKoneksi(o.koneksi),
  }));
}

export const susunanLayar = (l: Pick<LayarTambahan, 'mode' | 'targetW' | 'targetH' | 'bulat' | 'kolomIn' | 'barisIn'>, wUnit: number, hUnit: number) =>
  l.mode === 'ukuran' ? cabinetUntukUkuran(l.targetW, l.targetH, wUnit, hUnit, l.bulat) : { kolom: l.kolomIn, baris: l.barisIn };
