import { BRAND_UMUM, brandModul, cabinetUntukUkuran, cariModul, type ModulLED, type Pembulatan, pikselUnit } from '@/lib/av/hitung';
import { bersihkanReferensiLED } from '@/lib/tools-team';
import { bersihkanKoneksi, KONEKSI_AWAL, type PengaturanKoneksi } from './koneksi/data';
import { CABINET, type Lingkungan, PER_M2 } from './data';

export interface SpekModul {
  satuan: 'modul' | 'cabinet';
  modulKode: string;
  pitch: number; cabKey: string; cabW: number; cabH: number;
  lingkungan: Lingkungan;
  ref: ModulLED | null;
}

export interface LayarTambahan {
  id: string;
  nama: string;
  mode: 'ukuran' | 'jumlah';
  targetW: number; targetH: number; bulat: Pembulatan;
  kolomIn: number; barisIn: number;
  koneksi: PengaturanKoneksi;
  modul: SpekModul | null;
}

export const MAKS_LAYAR = 8;

const idBaru = () => Math.random().toString(36).slice(2, 10);

export const layarBaru = (urut: number, dari?: Partial<LayarTambahan>): LayarTambahan => ({
  mode: 'ukuran', targetW: 3, targetH: 2, bulat: 'round', kolomIn: 6, barisIn: 4,
  ...dari, koneksi: dari?.koneksi ?? KONEKSI_AWAL, modul: dari?.modul ?? null, id: idBaru(), nama: `Screen ${urut}`,
});

const angka = (v: unknown, min: number, maks: number, awal: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(maks, Math.max(min, v)) : awal);

export function bersihkanSpek(x: unknown): SpekModul | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const ref = o.ref ? bersihkanReferensiLED({ modul: [o.ref], kartu: [], vp: [] })?.modul[0] ?? null : null;
  const cabKey = typeof o.cabKey === 'string' && (o.cabKey === 'custom' || CABINET.some(c => c.v === o.cabKey)) ? o.cabKey : '500x500';
  return {
    satuan: o.satuan === 'cabinet' ? 'cabinet' : 'modul',
    modulKode: typeof o.modulKode === 'string' && o.modulKode ? o.modulKode.slice(0, 120) : 'P2.5',
    pitch: angka(o.pitch, 0.3, 50, 2.5), cabKey, cabW: angka(o.cabW, 50, 3000, 500), cabH: angka(o.cabH, 50, 3000, 500),
    lingkungan: o.lingkungan === 'outdoor' || o.lingkungan === 'semi-outdoor' ? o.lingkungan : 'indoor',
    ref,
  };
}

export function bersihkanLayar(x: unknown): LayarTambahan[] {
  if (!Array.isArray(x)) return [];
  return x.slice(0, MAKS_LAYAR - 1).filter(o => o && typeof o === 'object' && !Array.isArray(o)).map((o: Record<string, unknown>, i) => ({
    id: typeof o.id === 'string' && o.id ? o.id.slice(0, 20) : idBaru(),
    nama: typeof o.nama === 'string' && o.nama.trim() ? o.nama.slice(0, 40) : `Screen ${i + 2}`,
    mode: o.mode === 'jumlah' ? 'jumlah' : 'ukuran',
    targetW: angka(o.targetW, 0.01, 500, 3), targetH: angka(o.targetH, 0.01, 500, 2),
    bulat: o.bulat === 'floor' || o.bulat === 'ceil' ? o.bulat : 'round',
    kolomIn: Math.round(angka(o.kolomIn, 1, 1000, 6)), barisIn: Math.round(angka(o.barisIn, 1, 1000, 4)),
    koneksi: bersihkanKoneksi(o.koneksi),
    modul: bersihkanSpek(o.modul),
  }));
}

export const susunanLayar = (l: Pick<LayarTambahan, 'mode' | 'targetW' | 'targetH' | 'bulat' | 'kolomIn' | 'barisIn'>, wUnit: number, hUnit: number) =>
  l.mode === 'ukuran' ? cabinetUntukUkuran(l.targetW, l.targetH, wUnit, hUnit, l.bulat) : { kolom: l.kolomIn, baris: l.barisIn };

export interface UnitLED { pitch: number; w: number; h: number; pxX: number; pxY: number; kode: string; merek: string; model: string }

export function unitLED(spek: Pick<SpekModul, 'satuan' | 'modulKode' | 'pitch' | 'cabW' | 'cabH'>, daftarModul: ModulLED[], ref?: ModulLED | null) {
  const modul = cariModul(daftarModul, spek.modulKode) ?? ref ?? daftarModul[0];
  const merek = brandModul(modul);
  const u: UnitLED = spek.satuan === 'modul'
    ? { pitch: modul.pitch, w: modul.w, h: modul.h, pxX: modul.pxW, pxY: modul.pxH, kode: modul.kode, merek, model: modul.model ?? '' }
    : { pitch: spek.pitch, w: spek.cabW, h: spek.cabH, pxX: pikselUnit(spek.cabW, spek.pitch), pxY: pikselUnit(spek.cabH, spek.pitch), kode: `P${spek.pitch}`, merek: '', model: '' };
  const labelLED = [u.merek !== BRAND_UMUM && u.merek, u.model, u.kode].filter(Boolean).join(' ');
  const namaUnit: 'modul' | 'cabinet' = spek.satuan === 'modul' ? (modul.unit ?? 'modul') : 'cabinet';
  return { modul, u, labelLED, namaUnit, luasUnit: (u.w * u.h) / 1e6 };
}

export const dayaUmum = (lingkungan: Lingkungan, luasUnit: number) => Math.round(PER_M2[lingkungan].daya * luasUnit * 10) / 10;
export const beratUmum = (lingkungan: Lingkungan, luasUnit: number) => Math.round(PER_M2[lingkungan].berat * luasUnit * 100) / 100;
