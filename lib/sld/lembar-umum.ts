import { kotakPutar, rasioPerangkat, sudutSah } from './geometri';
import { WARNA, WATERMARK } from './gaya';
import { svgIkon } from './ikon';
import type { Prim } from './primitif';
import { esc, n } from './teks';
import { HALAMAN, type Perangkat } from './tipe';

export interface OpsiLembar { watermark?: string; tanpaWatermark?: boolean; simple?: boolean }

export const WATERMARK_BAWAAN = '/sld/watermark.png';

export const bukaSvg = (dalam = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${HALAMAN.w} ${HALAMAN.h}"`
  + ` width="${HALAMAN.w}mm" height="${HALAMAN.h}mm"${dalam}><rect width="${HALAMAN.w}" height="${HALAMAN.h}" fill="${WARNA.putih}"/>`;

export const bingkaiPrim = (luar: { x: number; y: number; w: number; h: number; tebal: number }, dalam: number): Prim[] => [
  { t: 'kotak', ...luar, garis: WARNA.tinta, tebal: luar.tebal },
  { t: 'kotak', x: 7, y: 7, w: 406, h: 283, garis: WARNA.tinta, tebal: dalam },
];

export function watermark(o: OpsiLembar): string {
  if (o.tanpaWatermark) return '';
  const href = esc(o.watermark ?? WATERMARK_BAWAAN);
  const out: string[] = [`<defs><image id="sld-wm" href="${href}" xlink:href="${href}" x="${-WATERMARK.w / 2}" y="${-WATERMARK.h / 2}"`
    + ` width="${WATERMARK.w}" height="${WATERMARK.h}" preserveAspectRatio="xMidYMid meet"/></defs>`];
  WATERMARK.baris.forEach((cy, i) => {
    for (const cx of i % 2 ? WATERMARK.kolomGanjil : WATERMARK.kolomGenap) {
      out.push(`<use href="#sld-wm" xlink:href="#sld-wm" transform="translate(${cx} ${cy}) rotate(${WATERMARK.sudut})"/>`);
    }
  });
  return `<g opacity="${WATERMARK.tembus}" pointer-events="none">${out.join('')}</g>`;
}

export type Arah = Partial<Pick<Perangkat, 'putar' | 'balikH' | 'balikV'>>;

export const adaArah = (o: Arah) => !!sudutSah(o.putar) || !!o.balikH || !!o.balikV;

export function gambarPerangkat(p: Perangkat, x: number, y: number, w: number, h: number, o: Arah = {}): string {
  const g = kotakPutar({ x, y, w, h }, rasioPerangkat(p), o.putar);
  const gx = g.cx - g.w / 2, gy = g.cy - g.h / 2;
  const sumber = p.gambar ?? p.foto;
  const isi = sumber
    ? `<image href="${esc(sumber)}" xlink:href="${esc(sumber)}" x="${n(gx)}" y="${n(gy)}" width="${n(g.w)}" height="${n(g.h)}" preserveAspectRatio="xMidYMid meet"/>`
    : svgIkon(p.ikon, gx, gy, g.w, g.h, p);
  if (!adaArah(o)) return isi;
  const a = sudutSah(o.putar);
  const ubahan = [`translate(${n(g.cx)} ${n(g.cy)})`, a ? `rotate(${a})` : '', o.balikH || o.balikV ? `scale(${o.balikH ? -1 : 1} ${o.balikV ? -1 : 1})` : '', `translate(${n(-g.cx)} ${n(-g.cy)})`];
  return `<g transform="${ubahan.filter(Boolean).join(' ')}">${isi}</g>`;
}
