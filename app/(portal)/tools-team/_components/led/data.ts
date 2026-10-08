/** Data & aturan Kalkulator LED: pengaturan BOM, pitch & cabinet umum, daya/berat per m², pembulatan. */
import type { Pembulatan } from '@/lib/av-hitung';

/** Pengaturan daftar material (BOM) & penawaran. */
export interface PengaturanBOM { cadanganUnit: number; cadanganRC: number; psuW: number; panjangLAN: number; ppn: number }

export const BOM_AWAL: PengaturanBOM = { cadanganUnit: 3, cadanganRC: 2, psuW: 200, panjangLAN: 10, ppn: 11 };

export function bersihkanBOM(x: unknown): PengaturanBOM {
  const o = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const a = (v: unknown, min: number, maks: number, awal: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(maks, Math.max(min, v)) : awal);
  return { cadanganUnit: a(o.cadanganUnit, 0, 50, 3), cadanganRC: a(o.cadanganRC, 0, 50, 2), psuW: a(o.psuW, 50, 1000, 200), panjangLAN: a(o.panjangLAN, 1, 300, 10), ppn: a(o.ppn, 0, 30, 11) };
}

export function bersihkanHarga(x: unknown): Record<string, number> {
  const o = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const h: Record<string, number> = {};
  for (const [k, v] of Object.entries(o).slice(0, 100)) if (typeof v === 'number' && Number.isFinite(v) && v > 0 && k.length <= 40) h[k] = Math.min(1e12, v);
  return h;
}

export const rupiah = (v: number) => `Rp ${Math.round(v).toLocaleString('id-ID')}`;

export const PITCH = [0.9, 1.2, 1.25, 1.5, 1.56, 1.86, 1.9, 2, 2.5, 2.6, 2.9, 3.91, 4.81, 5, 6.67, 8, 10];

export const CABINET: { v: string; l: string; w: number; h: number }[] = [
  { v: '500x500', l: '500 × 500 mm', w: 500, h: 500 },
  { v: '500x1000', l: '500 × 1000 mm', w: 500, h: 1000 },
  { v: '640x480', l: '640 × 480 mm', w: 640, h: 480 },
  { v: '600x337.5', l: '600 × 337,5 mm (16:9)', w: 600, h: 337.5 },
  { v: '960x960', l: '960 × 960 mm (outdoor)', w: 960, h: 960 },
  { v: '1000x1000', l: '1000 × 1000 mm (outdoor)', w: 1000, h: 1000 },
  { v: 'custom', l: 'Custom...', w: 0, h: 0 },
];

export type Lingkungan = 'indoor' | 'semi-outdoor' | 'outdoor';

/** Nilai umum per m² (W maks, kg) - selalu bisa ditimpa. */
export const PER_M2: Record<Lingkungan, { daya: number; berat: number }> = {
  indoor: { daya: 600, berat: 30 }, 'semi-outdoor': { daya: 750, berat: 38 }, outdoor: { daya: 900, berat: 45 },
};

export const LINGKUNGAN_TIPE = { Indoor: 'indoor', 'Indoor/Outdoor': 'semi-outdoor', Outdoor: 'outdoor' } as const;

export const BULAT: { v: Pembulatan; l: string }[] = [{ v: 'floor', l: 'Ke bawah' }, { v: 'round', l: 'Terdekat' }, { v: 'ceil', l: 'Ke atas' }];
