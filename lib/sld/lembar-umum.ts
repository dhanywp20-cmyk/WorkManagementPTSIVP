import { WARNA, WATERMARK } from './gaya';
import { svgIkon } from './ikon';
import type { Prim } from './primitif';
import { esc, n } from './teks';
import { HALAMAN, type Perangkat } from './tipe';

export interface OpsiLembar { watermark?: string; tanpaWatermark?: boolean }

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

export function gambarPerangkat(p: Pick<Perangkat, 'gambar' | 'foto' | 'ikon'>, x: number, y: number, w: number, h: number): string {
  const sumber = p.gambar ?? p.foto;
  if (sumber) {
    const href = esc(sumber);
    return `<image href="${href}" xlink:href="${href}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return svgIkon(p.ikon, x, y, w, h);
}
