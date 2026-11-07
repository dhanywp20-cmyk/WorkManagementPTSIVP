import { bagianPanelRasio, batasPoligonShift, throwRatioDari, zoomLensa } from './proyektor';
import type { Benda, RasioProyektor, ResolusiProyektor } from './tipe';

export interface LensaTdc {
   n: string;
   z: 0 | 1;
   ar: Partial<Record<RasioProyektor, [number, number, number, number]>>;
   pg: number[] | null;
   off: number;
   k?: 1;
   d: [number, number];
   ket: string;
}
export interface ModelTdc {
  n: string;  kat: number;
   a: RasioProyektor;  r: ResolusiProyektor | null;
   lm: number; lmc?: number;
   c?: number;  as: RasioProyektor[]; l: LensaTdc[];
}
export interface KatalogTdc { versi: string; sumber: string; model: ModelTdc[] }

let muat: Promise<KatalogTdc> | null = null;
export function muatKatalogPanasonic(): Promise<KatalogTdc> {
  muat ??= import('@/lib/data/panasonic-tdc.json').then(m => (m.default ?? m) as unknown as KatalogTdc).catch(e => { muat = null; throw e; });
  return muat;
}

export const KATEGORI_TDC: { v: number; l: string }[] = [
  { v: 0, l: 'All' }, { v: 1, l: 'Large-venue' }, { v: 2, l: 'Installation' }, { v: 3, l: 'Portable' },
  { v: 4, l: 'Short-throw' }, { v: 8, l: 'Ultra Short Throw' }, { v: 7, l: 'Previous' },
];

export function cekDataLensa(l: LensaTdc, rasio: RasioProyektor): string | null {
  const k = l.ar[rasio];
  if (!k) return null;
  for (const [r, j] of Object.entries(l.ar) as [RasioProyektor, [number, number, number, number]][]) {
    if (r === rasio) continue;
    const trBeda = [0, 1].some(i => k[i] / j[i] > 2 || j[i] / k[i] > 2);
    const bBeda = [2, 3].some(i => Math.abs(k[i] - j[i]) > 0.3);
    if (trBeda || bBeda) {
      const fm = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 4 });
      return `Data Panasonic ${rasio} lensa ini janggal dibanding ${r}: TR ${fm(k[0])}–${fm(k[1])}, b ${fm(k[2])}/${fm(k[3])} m vs `
        + `TR ${fm(j[0])}–${fm(j[1])}, b ${fm(j[2])}/${fm(j[3])} m. Kalkulator Panasonic memakai angka ini apa adanya - cek brosur / datasheet.`;
    }
  }
  return null;
}

export function rasioUntukLensa(m: ModelTdc, l: LensaTdc, pilihan?: RasioProyektor): RasioProyektor {
  return pilihan && l.ar[pilihan] ? pilihan : l.ar[m.a] ? m.a : (Object.keys(l.ar)[0] as RasioProyektor);
}

export interface LensaPadaRasio {
  rasio: RasioProyektor; trW: number; trT: number; bW: number; bT: number;
  bagian: { lebar: number; tinggi: number };
  shift: { atas: number; bawah: number; h: number } | null;
   offset: number;
}
export function lensaPadaRasio(m: ModelTdc, l: LensaTdc, rasio?: RasioProyektor): LensaPadaRasio {
  const r = rasioUntukLensa(m, l, rasio);
  const [trW, trT, bW, bT] = l.ar[r]!;
  const bagian = bagianPanelRasio(m.a, r);
  return {
    rasio: r, trW, trT, bW, bT, bagian, shift: l.pg ? batasPoligonShift(l.pg, bagian) : null,
    offset: Math.round((l.off / bagian.tinggi) * 1e4) / 1e4,
  };
}

export function isiDariKatalog(p: Benda, m: ModelTdc, l: LensaTdc, rasio: RasioProyektor, versi = ''): Partial<Benda> {
  const { rasio: r, trW, trT, bW, bT, offset: off } = lensaPadaRasio(m, l, rasio);
  const [lo, hi] = zoomLensa(p), t = hi - lo > 1e-9 ? Math.min(1, Math.max(0, (throwRatioDari(p) - lo) / (hi - lo))) : 0;
  return {
    nama: `Panasonic ${m.n} + ${l.n}`.slice(0, 120),
    lumen: m.lm || undefined, kontrasAsli: m.c, rasioProyektor: r,
    resolusiProyektor: resolusiPanel(m),
    koefRasio: l.ar, trMin: trW, trMax: trT, throwRatio: Math.round((trW + (trT - trW) * t) * 1e6) / 1e6,
    koreksiJarak: bW || undefined, koreksiJarakTele: bT,
    poligonShift: l.pg ?? undefined, shiftAtasMaks: undefined, shiftBawahMaks: undefined, shiftHMaks: undefined,
    ...(l.pg ? { offsetTetap: undefined } : { offsetTetap: off, offsetLensa: off, geserLensaH: 0 }),
    sumberLensa: `Panasonic TDC ${versi}`.trim(),
  };
}
export function resolusiPanel(m: ModelTdc): ResolusiProyektor | undefined {
  return m.r ?? ({ '16:10': 'WUXGA', '16:9': 'FHD', '4:3': 'XGA', '17:9': '4KDCI' } as Partial<Record<RasioProyektor, ResolusiProyektor>>)[m.a];
}
