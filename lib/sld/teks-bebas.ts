import { WARNA } from './gaya';
import { bungkus, lebarTeks, n, teks } from './teks';
import type { TeksBebas, WarnaTeks } from './tipe';

export const WARNA_TEKS: Record<WarnaTeks, string> = { hitam: WARNA.tinta, merah: WARNA.merah, abu: WARNA.redup, biru: '#0969da' };
export const LABEL_WARNA_TEKS: Record<WarnaTeks, string> = { hitam: 'Hitam', merah: 'Merah', abu: 'Abu-abu', biru: 'Biru' };
export const SPASI_TEKS = 1.25;

export const barisTeks = (t: Pick<TeksBebas, 'isi' | 'lebar' | 'ukuran' | 'tebal'>) =>
  t.isi.split('\n').flatMap(s => (t.lebar ? bungkus(s, t.lebar, t.ukuran, t.tebal) : [s])).slice(0, 40);

export function kotakTeks(t: TeksBebas) {
  const b = barisTeks(t);
  const w = Math.max(4, ...b.map(s => lebarTeks(s, t.ukuran, t.tebal))) + 1;
  return { x: t.x, y: t.y, w, h: b.length * t.ukuran * SPASI_TEKS + 0.6 };
}

export function svgTeksBebas(t: TeksBebas): string {
  const k = kotakTeks(t);
  const isi = barisTeks(t).map((s, i) => teks(t.x + 0.5, t.y + 0.3 + t.ukuran * (0.92 + i * SPASI_TEKS), s, { ukuran: t.ukuran, warna: WARNA_TEKS[t.warna], tebal: t.tebal })).join('');
  return t.putar ? `<g transform="rotate(${t.putar} ${n(k.x + k.w / 2)} ${n(k.y + k.h / 2)})">${isi}</g>` : isi;
}
