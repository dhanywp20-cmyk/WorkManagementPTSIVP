import type { Perangkat } from './tipe';

export const ISI_VIDEOWALL = [1, 2, 3, 4, 5, 6].map(i => `/sld/produk/vw-isi-${i}.jpg`);
export const ISI_LED = '/sld/produk/led-isi.jpg';
export const PROFIL_LED = '/sld/produk/led-profil.jpg';
export const IKON_DINDING = new Set(['videowall', 'led']);

export type TeksPerangkat = Partial<Pick<Perangkat, 'nama' | 'model' | 'ket' | 'subGambar'>>;
export interface Grid { kol: number; bar: number }
export interface UkuranLed extends Grid { w: number; h: number }
export interface Dinding { vb: [number, number]; isi: string; rasio: number }

const n = (v: number) => String(Math.round(v * 100) / 100);
const batas = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const angka = (s: string) => parseFloat(s.replace(',', '.'));
export const teksPerangkat = (p: TeksPerangkat = {}) => [p.nama, p.model, p.subGambar, p.ket].filter(Boolean).join(' ');

export function gridVideowall(teks: string): Grid {
  const m = /(?<![\d.,])(\d{1,2})\s*[x×]\s*(\d{1,2})(?![\d.,])(?!\s*(?:m|mm|cm|meter)\b)/i.exec(teks);
  return m ? { kol: batas(Number(m[1]), 1, 8), bar: batas(Number(m[2]), 1, 6) } : { kol: 3, bar: 2 };
}

const SATUAN: Record<string, number> = { mm: 0.001, cm: 0.01, m: 1, meter: 1 };
const KABINET = 0.5;

export function ukuranLed(teks: string): UkuranLed {
  const u = /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|meter|m)\b/i.exec(teks);
  const k = /(\d{1,2})\s*[x×]\s*(\d{1,2})\s*(?:kabinet|cabinet|cab)\b/i.exec(teks);
  let w = u ? batas(angka(u[1]) * SATUAN[u[3].toLowerCase()], 0.3, 60) : 0;
  let h = u ? batas(angka(u[2]) * SATUAN[u[3].toLowerCase()], 0.3, 30) : 0;
  if (!w && k) { w = Number(k[1]) * KABINET; h = Number(k[2]) * KABINET; }
  if (!w) { w = 4; h = 2.25; }
  const kol = k ? Number(k[1]) : Math.round(w / KABINET), bar = k ? Number(k[2]) : Math.round(h / KABINET);
  return { w, h, kol: batas(kol, 1, 24), bar: batas(bar, 1, 14) };
}

interface T { x: number; y: number }
const LEBAR = 160, TEPI = 5, RASIO_KANAN = 0.86;

function bidang(aspek: number, sisiRel: number) {
  const dalam = LEBAR - 2 * TEPI;
  const h0 = dalam / ((aspek * (1 + RASIO_KANAN)) / 2 + sisiRel);
  const t = h0 * sisiRel, wf = dalam - t, h1 = h0 * RASIO_KANAN;
  const tl = { x: TEPI + t, y: TEPI }, bl = { x: TEPI + t, y: TEPI + h0 };
  const tr = { x: TEPI + t + wf, y: TEPI + (h0 - h1) * 0.6 }, br = { x: tr.x, y: tr.y + h1 };
  const titik = (u: number, v: number): T => ({
    x: (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x,
    y: (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y,
  });
  return { tl, tr, br, bl, t, h0, titik, vh: TEPI * 2 + h0 + 3 };
}

const matriks = (a: T, b: T, c: T, w: number, h: number) =>
  `matrix(${n((b.x - a.x) / w)} ${n((b.y - a.y) / w)} ${n((c.x - a.x) / h)} ${n((c.y - a.y) / h)} ${n(a.x)} ${n(a.y)})`;
const poligon = (...t: T[]) => t.map(p => `${n(p.x)},${n(p.y)}`).join(' ');

const DEFS = '<filter id="sldd-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>'
  + '<linearGradient id="sldd-kilau" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity=".03"/>'
  + '<stop offset=".46" stop-color="#fff" stop-opacity="0"/></linearGradient>'
  + '<linearGradient id="sldd-sisi" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3b4048"/><stop offset="1" stop-color="#121417"/></linearGradient>';

function bingkai(b: ReturnType<typeof bidang>, tile: string, sisi: string): string {
  const { tl, tr, br, bl } = b;
  const geser = (p: T) => ({ x: p.x + 2, y: p.y + 2.6 });
  return `<polygon points="${poligon(geser(tl), geser(tr), geser(br), geser(bl))}" fill="#0f172a" fill-opacity=".28" filter="url(#sldd-blur)"/>`
    + sisi + `<polygon points="${poligon(tl, tr, br, bl)}" fill="#0b0c0e"/>${tile}<polygon points="${poligon(tl, tr, br, bl)}" fill="url(#sldd-kilau)"/>`;
}

function videowall(teks: string): Dinding {
  const { kol, bar } = gridVideowall(teks);
  const b = bidang((kol * 16) / (bar * 9), 0.035);
  const TW = 16, TH = 9, BZ = 0.24;
  const defs = ISI_VIDEOWALL.map((src, i) => `<image id="sldd-vw-${i + 1}" href="${src}" width="${TW - 2 * BZ}" height="${TH - 2 * BZ}" preserveAspectRatio="xMidYMid slice"/>`).join('');
  const tile: string[] = [];
  for (let j = 0; j < bar; j++) for (let i = 0; i < kol; i++) {
    const a = b.titik(i / kol, j / bar), c = b.titik((i + 1) / kol, j / bar), d = b.titik(i / kol, (j + 1) / bar);
    tile.push(`<g transform="${matriks(a, c, d, TW, TH)}"><rect width="${TW}" height="${TH}" fill="#15161a"/><use href="#sldd-vw-${((j * kol + i) % 6) + 1}" x="${BZ}" y="${BZ}"/></g>`);
  }
  const { tl, bl, t } = b;
  const sisi = `<polygon points="${poligon(tl, { x: tl.x - t, y: tl.y + t * 0.5 }, { x: bl.x - t, y: bl.y - t * 0.5 }, bl)}" fill="url(#sldd-sisi)"/>`;
  return { vb: [LEBAR, b.vh], rasio: LEBAR / b.vh, isi: `<defs>${DEFS}${defs}</defs>${bingkai(b, tile.join(''), sisi)}` };
}

function led(teks: string): Dinding {
  const u = ukuranLed(teks);
  const aspek = u.w / u.h, b = bidang(aspek, 0.09);
  const { tl, tr, br, bl, t, h0 } = b;
  const CH = 100, CW = CH * aspek, id = `sldd-led-${Math.round(aspek * 100)}`;
  const layar = `<clipPath id="${id}"><polygon points="${poligon(tl, tr, br, bl)}"/></clipPath><g clip-path="url(#${id})">`
    + `<image href="${ISI_LED}" width="${n(CW)}" height="${CH}" preserveAspectRatio="xMidYMid slice" transform="${matriks(tl, tr, bl, CW, CH)}"/></g>`;
  const sisi = `<image href="${PROFIL_LED}" x="${n(tl.x - t)}" y="${n(tl.y - 0.4)}" width="${n(t)}" height="${n(h0 + 0.8)}" preserveAspectRatio="none"/>`;
  return { vb: [LEBAR, b.vh], rasio: LEBAR / b.vh, isi: `<defs>${DEFS}</defs>${bingkai(b, layar, sisi)}` };
}

const simpanan = new Map<string, Dinding>();

export function dinding(ikon: string, p?: TeksPerangkat): Dinding | null {
  if (!IKON_DINDING.has(ikon)) return null;
  const teks = teksPerangkat(p), kunci = `${ikon}|${teks}`;
  let d = simpanan.get(kunci);
  if (!d) {
    d = ikon === 'led' ? led(teks) : videowall(teks);
    if (simpanan.size > 200) simpanan.clear();
    simpanan.set(kunci, d);
  }
  return d;
}

const rasioBidang = (aspek: number, sisiRel: number) => LEBAR / (TEPI * 2 + 3 + (LEBAR - 2 * TEPI) / ((aspek * (1 + RASIO_KANAN)) / 2 + sisiRel));

export function rasioDinding(ikon: string, p?: TeksPerangkat): number | null {
  if (!IKON_DINDING.has(ikon)) return null;
  const teks = teksPerangkat(p);
  if (ikon === 'led') { const u = ukuranLed(teks); return rasioBidang(u.w / u.h, 0.09); }
  const g = gridVideowall(teks);
  return rasioBidang((g.kol * 16) / (g.bar * 9), 0.035);
}
