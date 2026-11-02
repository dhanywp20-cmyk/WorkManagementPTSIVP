/**
 * desain3d/inti/katalogLain.ts - Katalog RESMI proyektor & lensa merek SELAIN Panasonic, terpisah dari katalog Panasonic
 * (katalogPanasonic.ts tidak berubah). Data dari kalkulator / simulator jarak lempar masing-masing merek:
 *   Epson    Projector Throw Distance Simulator (lib/data/epson-tdc.json, scripts/impor-epson-tdc.mjs)
 *   Vivitek  Projection Simulator               (lib/data/vivitek-tdc.json, scripts/impor-vivitek-tdc.mjs)
 * Isi per lensa sama bentuknya dengan Panasonic (koefisien L = TR x lebar gambar - b per rasio sinyal, daerah lens shift
 * atau offset tetap), ditambah lumen per lensa (Epson: lensa UST / long lebih redup). Rumus geometri (lensaPadaRasio,
 * panel native) memakai fungsi yang sama dengan Panasonic supaya Desain 3D & Kalkulator AV menghitung dengan cara sama.
 *
 * Data dimuat saat dibutuhkan saja (muatKatalogLain, import dinamis per merek). Murni selain pemuatan itu.
 */
import { lensaPadaRasio, type LensaPadaRasio, type LensaTdc, type ModelTdc, resolusiPanel } from './katalogPanasonic';
import { batasPoligonShiftLuas, throwRatioDari, zoomLensa } from './proyektor';
import type { Benda, RasioProyektor } from './tipe';

export const MEREK_LAIN = ['Epson', 'Vivitek'] as const;
export type MerekLain = (typeof MEREK_LAIN)[number];

export interface LensaLain extends LensaTdc {
  /** Lumen proyektor DENGAN lensa ini bila beda dari lumen model. */ lm?: number;
}
export interface ModelLain extends Omit<ModelTdc, 'l'> { l: LensaLain[] }
export interface KatalogLain {
  versi: string; sumber: string; merek: MerekLain;
  /** Kategori / "Model type" kalkulator merek itu; v 0 = All. */ kategori: { v: number; l: string }[];
  model: ModelLain[];
}

/** Nama singkat sumber (sumberLensa proyektor) & situs kalkulator resmi. */
export const SUMBER_LAIN: Record<MerekLain, { singkat: string; situs: string }> = {
  Epson: { singkat: 'Epson TDC', situs: 'download.epson.com.sg/tdc' },
  Vivitek: { singkat: 'Vivitek Simulator', situs: 'vivitekcorp.com/simulator' },
};
const DATA: Record<MerekLain, () => Promise<{ default?: unknown }>> = {
  Epson: () => import('@/lib/data/epson-tdc.json'),
  Vivitek: () => import('@/lib/data/vivitek-tdc.json'),
};
const cache = new Map<MerekLain, Promise<KatalogLain>>();
/** Muat katalog satu merek (sekali per merek, di-cache). */
export function muatKatalogLain(merek: MerekLain): Promise<KatalogLain> {
  let p = cache.get(merek);
  if (!p) {
    p = DATA[merek]().then(m => (m.default ?? m) as KatalogLain).catch(e => { cache.delete(merek); throw e; });
    cache.set(merek, p);
  }
  return p;
}

/**
 * lensaPadaRasio untuk merek lain: sama, tetapi batas lens shift juga terbaca untuk daerah shift satu arah (Epson UST,
 * Vivitek offset + shift) - dipakai Kalkulator AV - Proyektor.
 */
export function lensaPadaRasioLain(m: ModelLain, l: LensaLain, rasio?: RasioProyektor): LensaPadaRasio {
  const x = lensaPadaRasio(m, l, rasio);
  return { ...x, shift: l.pg ? batasPoligonShiftLuas(l.pg, x.bagian) : null };
}

/**
 * Isi proyektor dari model + lensa katalog merek lain pada rasio sinyal `rasio` - sama seperti isiDariKatalog Panasonic
 * (posisi zoom dipertahankan, data lensa lama diganti utuh), dengan nama & sumber merek itu dan lumen per lensa.
 */
export function isiDariKatalogLain(p: Benda, k: Pick<KatalogLain, 'merek' | 'versi'>, m: ModelLain, l: LensaLain, rasio: RasioProyektor): Partial<Benda> {
  const { rasio: r, trW, trT, bW, bT, offset: off } = lensaPadaRasio(m, l, rasio);
  const [lo, hi] = zoomLensa(p), t = hi - lo > 1e-9 ? Math.min(1, Math.max(0, (throwRatioDari(p) - lo) / (hi - lo))) : 0;
  return {
    nama: `${k.merek} ${m.n} + ${l.n}`.slice(0, 120),
    lumen: l.lm || m.lm || undefined, kontrasAsli: m.c, rasioProyektor: r,
    resolusiProyektor: resolusiPanel(m),
    koefRasio: l.ar, trMin: trW, trMax: trT, throwRatio: Math.round((trW + (trT - trW) * t) * 1e6) / 1e6,
    koreksiJarak: bW || undefined, koreksiJarakTele: bT,
    poligonShift: l.pg ?? undefined, shiftAtasMaks: undefined, shiftBawahMaks: undefined, shiftHMaks: undefined,
    ...(l.pg ? { offsetTetap: undefined } : { offsetTetap: off, offsetLensa: off, geserLensaH: 0 }),
    sumberLensa: `${SUMBER_LAIN[k.merek].singkat} ${k.versi}`.trim(),
  };
}
