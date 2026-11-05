import type { Titik } from './tipe';

export interface Snap { aktif: boolean; langkah: number; sudut: number;  magnet: boolean }
export const LANGKAH_SNAP = [0.01, 0.05, 0.1, 0.25, 0.5, 1] as const;
export const SUDUT_SNAP = [5, 15, 45, 90] as const;
export const SNAP_AWAL: Snap = { aktif: false, langkah: 0.1, sudut: 15, magnet: true };

export function snapSah(x: unknown): Snap {
  const o = (x ?? {}) as Partial<Snap>;
  return {
    aktif: o.aktif === true,
    langkah: (LANGKAH_SNAP as readonly number[]).includes(o.langkah as number) ? (o.langkah as number) : SNAP_AWAL.langkah,
    sudut: (SUDUT_SNAP as readonly number[]).includes(o.sudut as number) ? (o.sudut as number) : SNAP_AWAL.sudut,
    magnet: o.magnet !== false,
  };
}

export const labelLangkah = (m: number) => (m < 1 ? `${Math.round(m * 100)} cm` : `${m} m`);

export const bulatkanKe = (v: number, langkah: number) => Math.round(Math.round(v / langkah) * langkah * 1000) / 1000;

export function titikSnap(p: Titik, snap: Snap): Titik {
  const l = snap.aktif ? snap.langkah : 0.001;
  return [bulatkanKe(p[0], l), bulatkanKe(p[1], l), bulatkanKe(p[2], l)];
}

export function jarakGrid(langkah: number, panjangMaks: number, maksGaris = 120): number {
  let j = langkah;
  for (const k of [2, 2.5, 2, 2, 2.5, 2, 2]) { if (panjangMaks / j <= maksGaris) break; j *= k; }
  return Math.round(j * 1000) / 1000;
}

export interface GarisPenggaris { id: string; a: Titik; b: Titik }
export const MAKS_PENGGARIS = 30;

export const panjangGaris = (g: Pick<GarisPenggaris, 'a' | 'b'>) => Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1], g.b[2] - g.a[2]);

export const formatPanjang = (m: number) => `${Math.round(m * 1000).toLocaleString('id-ID')} mm`;

export function rincianGaris(g: Pick<GarisPenggaris, 'a' | 'b'>): { datar: number; tinggi: number } {
  return { datar: Math.hypot(g.b[0] - g.a[0], g.b[2] - g.a[2]), tinggi: Math.abs(g.b[1] - g.a[1]) };
}

export function penggarisSah(x: unknown): GarisPenggaris[] {
  if (!Array.isArray(x)) return [];
  const titik = (t: unknown): t is Titik => Array.isArray(t) && t.length === 3 && t.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1000);
  return x.slice(0, MAKS_PENGGARIS).flatMap(g => {
    const o = g as Partial<GarisPenggaris>;
    return typeof o?.id === 'string' && titik(o.a) && titik(o.b) ? [{ id: o.id.slice(0, 40), a: o.a, b: o.b }] : [];
  });
}
