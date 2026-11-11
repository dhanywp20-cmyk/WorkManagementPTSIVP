import { lebarTeks, n, teks } from './teks';
import type { WarnaZona, ZonaSLD } from './tipe';

export const WARNA_ZONA: Record<WarnaZona, string> = { abu: '#57606a', biru: '#0969da', merah: '#cf222e', hijau: '#1a7f37', oranye: '#bc4c00' };
export const LABEL_WARNA_ZONA: Record<WarnaZona, string> = { abu: 'Abu-abu', biru: 'Biru', merah: 'Merah', hijau: 'Hijau', oranye: 'Oranye' };
export const LABEL_ZONA_CEPAT = ['Rack', 'Wall', 'Ceiling', 'Meja', 'Ruang kontrol', 'Lantai'];
export const GAYA_ZONA = { huruf: 2.4, tebal: 0.45, putus: '2.2 1.4', sudut: 1.2 } as const;

export const TEBAL_ZONA = { min: 0.2, maks: 3, cepat: [0.3, 0.45, 0.8, 1.2, 2] } as const;
export const hurufZona = (z: ZonaSLD) => GAYA_ZONA.huruf * (z.huruf ?? 1);
export const tebalZona = (z: ZonaSLD) => z.tebal ?? GAYA_ZONA.tebal;
export const putusZona = (z: ZonaSLD) => {
  const f = Math.max(1, tebalZona(z) / 0.6);
  return `${n(2.2 * f)} ${n(1.4 * f)}`;
};

export function labelZona(z: ZonaSLD) {
  const u = hurufZona(z);
  const w = z.label.trim() ? lebarTeks(z.label.trim(), u, true) + u * 1.25 : 0;
  return { x: z.x + 3, y: z.y - u * 0.8, w, h: u * 1.6 };
}

export function svgZona(z: ZonaSLD): string {
  const c = WARNA_ZONA[z.warna] ?? WARNA_ZONA.abu, l = labelZona(z), u = hurufZona(z);
  const kotak = `<rect x="${n(z.x)}" y="${n(z.y)}" width="${n(z.w)}" height="${n(z.h)}" rx="${GAYA_ZONA.sudut}" fill="none" stroke="${c}"`
    + ` stroke-width="${n(tebalZona(z))}" stroke-dasharray="${putusZona(z)}"/>`;
  if (!l.w) return kotak;
  return `${kotak}<rect x="${n(l.x)}" y="${n(l.y)}" width="${n(l.w)}" height="${n(l.h)}" fill="#ffffff"/>`
    + teks(l.x + u * 0.625, z.y, z.label.trim(), { ukuran: u, warna: c, tebal: true, pusatV: true });
}
