'use client';
import { isiIkon, viewBoxIkon } from './ikon';
import { sematkanFoto } from './sematkan';

const simpanan = new Map<string, Promise<string>>();
const LEBAR = 960, TINGGI = 600;

export function ilustrasiPng(ikon: string, rasio = 1.6): Promise<string> {
  const kunci = `${ikon}|${Math.round(rasio * 100)}`;
  const ada = simpanan.get(kunci);
  if (ada) return ada;
  const h = Math.round(LEBAR / rasio);
  const janji = sematkanFoto(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxIkon(ikon)}" width="${LEBAR}" height="${h}" preserveAspectRatio="xMidYMid meet">${isiIkon(ikon)}</svg>`)
    .then(svg => new Promise<string>((ok, gagal) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = LEBAR; c.height = h || TINGGI;
      const g = c.getContext('2d');
      if (!g) { gagal(new Error('Kanvas tidak tersedia.')); return; }
      g.drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL('image/png'));
    };
    img.onerror = () => gagal(new Error('Ilustrasi gagal dibuat.'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }));
  janji.catch(() => simpanan.delete(kunci));
  simpanan.set(kunci, janji);
  return janji;
}
