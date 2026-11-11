import { lebarTeks, n, teks } from './teks';
import type { WarnaZona, ZonaSLD } from './tipe';

export const WARNA_ZONA: Record<WarnaZona, string> = { abu: '#57606a', biru: '#0969da', merah: '#cf222e', hijau: '#1a7f37', oranye: '#bc4c00' };
export const LABEL_WARNA_ZONA: Record<WarnaZona, string> = { abu: 'Abu-abu', biru: 'Biru', merah: 'Merah', hijau: 'Hijau', oranye: 'Oranye' };
export const LABEL_ZONA_CEPAT = ['Rack', 'Wall', 'Ceiling', 'Meja', 'Ruang kontrol', 'Lantai'];
export const GAYA_ZONA = { huruf: 2.4, tebal: 0.45, putus: '2.2 1.4', sudut: 1.2 } as const;

export function labelZona(z: ZonaSLD) {
  const w = z.label.trim() ? lebarTeks(z.label.trim(), GAYA_ZONA.huruf, true) + 3 : 0;
  return { x: z.x + 3, y: z.y - GAYA_ZONA.huruf * 0.8, w, h: GAYA_ZONA.huruf * 1.6 };
}

export function svgZona(z: ZonaSLD): string {
  const c = WARNA_ZONA[z.warna] ?? WARNA_ZONA.abu, l = labelZona(z);
  const kotak = `<rect x="${n(z.x)}" y="${n(z.y)}" width="${n(z.w)}" height="${n(z.h)}" rx="${GAYA_ZONA.sudut}" fill="none" stroke="${c}"`
    + ` stroke-width="${GAYA_ZONA.tebal}" stroke-dasharray="${GAYA_ZONA.putus}"/>`;
  if (!l.w) return kotak;
  return `${kotak}<rect x="${n(l.x)}" y="${n(l.y)}" width="${n(l.w)}" height="${n(l.h)}" fill="#ffffff"/>`
    + teks(l.x + 1.5, z.y, z.label.trim(), { ukuran: GAYA_ZONA.huruf, warna: c, tebal: true, pusatV: true });
}
