/**
 * desain3d/inti/katalogPanasonic.ts - Katalog RESMI proyektor & lensa Panasonic (lib/data/panasonic-tdc.json, dibuat
 * scripts/impor-panasonic-tdc.mjs dari data Panasonic Throw Distance Calculator). Memilih model + lensa mengisi
 * proyektor dengan angka yang sama persis dengan kalkulator itu: koefisien jarak per rasio sinyal (wide & tele), panel
 * native (lumen efektif & piksel blending), lumen, kontras, daerah lens shift / offset tetap.
 *
 * Data (±0,5 MB) dimuat saat dibutuhkan saja (muatKatalogPanasonic, import dinamis). Murni selain pemuatan itu.
 */
import { bagianPanelRasio, batasPoligonShift, throwRatioDari, zoomLensa } from './proyektor';
import type { Benda, RasioProyektor, ResolusiProyektor } from './tipe';

export interface LensaTdc {
  /** Nama lensa ("Supplied lens", "ET-ELW20", ...). */ n: string;
  /** 1 = zoom, 0 = fixed. */ z: 0 | 1;
  /** Per rasio sinyal: [TR wide, TR tele, b wide, b tele] - L = TR x lebar gambar - b. */ ar: Partial<Record<RasioProyektor, [number, number, number, number]>>;
  /** Poligon daerah lens shift (satuan panel native) atau null = tanpa lens shift. */ pg: number[] | null;
  /** Offset vertikal tetap (pecahan tinggi panel) untuk lensa tanpa shift. */ off: number;
  /** 1 = jarak diukur khusus (ultra short throw cermin, lensa L) - tidak dari muka lensa biasa. */ k?: 1;
  /** Rentang diagonal layar yang didukung (inci). */ d: [number, number];
  /** Teks throw ratio brosur. */ ket: string;
}
export interface ModelTdc {
  n: string; /** kategori Panasonic; 7 = Previous (tidak diproduksi lagi) */ kat: number;
  /** Rasio native panel. */ a: RasioProyektor; /** Resolusi panel (kunci Desain 3D) bila dikenal. */ r: ResolusiProyektor | null;
  /** Lumen (normal) & lumen pusat bila datasheet menyebut dua. */ lm: number; lmc?: number;
  /** Kontras (x:1). */ c?: number; /** Rasio sinyal yang didukung. */ as: RasioProyektor[]; l: LensaTdc[];
}
export interface KatalogTdc { versi: string; sumber: string; model: ModelTdc[] }

let muat: Promise<KatalogTdc> | null = null;
/** Muat katalog (sekali, di-cache). */
export function muatKatalogPanasonic(): Promise<KatalogTdc> {
  muat ??= import('@/lib/data/panasonic-tdc.json').then(m => (m.default ?? m) as unknown as KatalogTdc).catch(e => { muat = null; throw e; });
  return muat;
}

/** "Model type" kalkulator Panasonic (ProjectorCategory); 0 = All = semua model, termasuk Previous. */
export const KATEGORI_TDC: { v: number; l: string }[] = [
  { v: 0, l: 'All' }, { v: 1, l: 'Large-venue' }, { v: 2, l: 'Installation' }, { v: 3, l: 'Portable' },
  { v: 4, l: 'Short-throw' }, { v: 8, l: 'Ultra Short Throw' }, { v: 7, l: 'Previous' },
];

/**
 * Data lensa Panasonic yang JELAS SALAH antar rasio sinyal: b beda > 30 cm (PT-RW330 16:10 b tele 1,0407 m vs 16:9
 * 0,0407 m) atau TR beda > 2x (PT-DW830 + ET-DLE030 16:9 TR 0,0101 vs 16:10 0,397). Kalkulator Panasonic memakai angka
 * itu apa adanya, Desain 3D juga (supaya hasilnya tetap sama) - engineer perlu tahu & cek brosur. Selisih TR yang lebih
 * kecil tidak ditandai: pola potong panel Panasonic tidak selalu sama dengan rasio AspectRatio[0] (PT-DX610 panel 4:3
 * tapi rasio pertamanya 16:9). null = tidak ada yang janggal.
 */
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

/** Rasio sinyal yang dipakai untuk lensa ini: pilihan bila didukung, selain itu native panel. */
export function rasioUntukLensa(m: ModelTdc, l: LensaTdc, pilihan?: RasioProyektor): RasioProyektor {
  return pilihan && l.ar[pilihan] ? pilihan : l.ar[m.a] ? m.a : (Object.keys(l.ar)[0] as RasioProyektor);
}

/** Angka lensa katalog pada satu rasio sinyal - sumber yang sama untuk Desain 3D & Kalkulator AV - Proyektor. */
export interface LensaPadaRasio {
  rasio: RasioProyektor; trW: number; trT: number; bW: number; bT: number;
  /** Bagian panel native yang dipakai gambar (letterbox / pillarbox; 1 = penuh) - lumen gambar = lumen x lebar x tinggi. */
  bagian: { lebar: number; tinggi: number };
  /** Lens shift maks (pecahan tinggi / lebar GAMBAR) dari poligon lensa; null = lensa tanpa lens shift. */
  shift: { atas: number; bawah: number; h: number } | null;
  /** Offset tetap lensa tanpa shift (pecahan tinggi GAMBAR - Panasonic menyimpannya per tinggi PANEL). */ offset: number;
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

/**
 * Isi proyektor dari model + lensa katalog pada rasio sinyal `rasio`. Posisi zoom (pecahan wide -> tele) proyektor
 * sekarang dipertahankan. Data lensa lama (b, batas shift, offset tetap) diganti utuh.
 */
export function isiDariKatalog(p: Benda, m: ModelTdc, l: LensaTdc, rasio: RasioProyektor, versi = ''): Partial<Benda> {
  const { rasio: r, trW, trT, bW, bT, offset: off } = lensaPadaRasio(m, l, rasio);
  const [lo, hi] = zoomLensa(p), t = hi - lo > 1e-9 ? Math.min(1, Math.max(0, (throwRatioDari(p) - lo) / (hi - lo))) : 0;
  return {
    nama: `Panasonic ${m.n} + ${l.n}`.slice(0, 120),
    lumen: m.lm || undefined, kontrasAsli: m.c, rasioProyektor: r,
    //  Resolusi tak dikenal: rasio panel tetap benar lewat resolusi standar serasio (piksel blending perlu dicek).
    resolusiProyektor: resolusiPanel(m),
    koefRasio: l.ar, trMin: trW, trMax: trT, throwRatio: Math.round((trW + (trT - trW) * t) * 1e6) / 1e6,
    koreksiJarak: bW || undefined, koreksiJarakTele: bT,
    poligonShift: l.pg ?? undefined, shiftAtasMaks: undefined, shiftBawahMaks: undefined, shiftHMaks: undefined,
    ...(l.pg ? { offsetTetap: undefined } : { offsetTetap: off, offsetLensa: off, geserLensaH: 0 }),
    sumberLensa: `Panasonic TDC ${versi}`.trim(),
  };
}
/** Resolusi panel model; tak dikenal = resolusi standar serasio panel (rasio panel tetap benar). */
export function resolusiPanel(m: ModelTdc): ResolusiProyektor | undefined {
  return m.r ?? ({ '16:10': 'WUXGA', '16:9': 'FHD', '4:3': 'XGA', '17:9': '4KDCI' } as Partial<Record<RasioProyektor, ResolusiProyektor>>)[m.a];
}
