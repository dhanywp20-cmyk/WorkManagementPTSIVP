'use client';
import { namaBerkas } from '@/lib/lembar-cetak';
import { kotakTampak } from './geometri';
import { ilustrasiPng } from './ilustrasi';
import { WATERMARK_BAWAAN } from './lembar-umum';
import { svgLembar1 } from './lembar1';
import { svgLembar2 } from './lembar2';
import { fotoData, sematkanFoto } from './sematkan';
import type { DokSLD } from './tipe';
import { buatVsdx, type GambarVsdx } from './vsdx';

export interface OpsiEkspor { logo?: string | null; simple?: boolean }

let bawaan: Promise<string> | null = null;

const keDataUrl = (b: Blob) => new Promise<string>((ok, gagal) => {
  const f = new FileReader();
  f.onload = () => ok(String(f.result));
  f.onerror = () => gagal(new Error('Gambar gagal dibaca.'));
  f.readAsDataURL(b);
});

export function watermarkData(logo?: string | null): Promise<string> {
  if (logo) return Promise.resolve(logo);
  bawaan ??= fetch(WATERMARK_BAWAAN).then(r => (r.ok ? r.blob() : Promise.reject(new Error('Logo watermark gagal dimuat.')))).then(keDataUrl);
  bawaan.catch(() => { bawaan = null; });
  return bawaan;
}

export const namaSLD = (d: DokSLD) =>
  namaBerkas('SLD', [d.blok.proyek, d.blok.lokasi].filter(Boolean).join(' '), d.blok.rev ? `Rev ${d.blok.rev}` : '');

export const namaEkspor = (d: DokSLD, simple = false) => `${namaSLD(d)} - ${simple ? 'no dtl' : 'Full Detail (NO SHARE)'}`;

export async function lembarSvg(d: DokSLD, o: OpsiEkspor = {}): Promise<string[]> {
  const watermark = d.watermark ? await watermarkData(o.logo) : undefined;
  const opsi = { watermark, simple: o.simple };
  return Promise.all([svgLembar1(d, opsi), ...(o.simple ? [] : [svgLembar2(d, opsi)])].map(sematkanFoto));
}

function dariDataUrl(url: string): GambarVsdx {
  const [kepala, isi] = url.split(',');
  const biner = atob(isi);
  const b = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) b[i] = biner.charCodeAt(i);
  return { isi: b, jpeg: /image\/jpe?g/.test(kepala) };
}

const muatGambar = (src: string) => new Promise<HTMLImageElement>((ok, gagal) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => gagal(new Error('Gambar gagal dimuat.'));
  img.src = src;
});

async function kePng(url: string): Promise<GambarVsdx> {
  if (/^data:image\/(png|jpe?g);base64,/.test(url)) return dariDataUrl(url);
  const img = await muatGambar(url);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || 600; c.height = img.naturalHeight || 375;
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return dariDataUrl(c.toDataURL('image/png'));
}

export async function bytesVsdx(d: DokSLD, o: OpsiEkspor = {}): Promise<Uint8Array> {
  const gambar = new Map<string, GambarVsdx>();
  for (const p of d.perangkat) {
    const k = kotakTampak(p);
    gambar.set(p.id, p.gambar ? dariDataUrl(p.gambar) : p.foto ? dariDataUrl(await fotoData(p.foto)) : await kePng(await ilustrasiPng(p.ikon, k.w / k.h)));
  }
  const watermark = d.watermark ? await kePng(await watermarkData(o.logo)) : undefined;
  return buatVsdx({ dok: d, gambar, watermark, judul: namaSLD(d), simple: o.simple });
}

export async function pngDariSvg(svg: string, lebar = 4200): Promise<Blob> {
  const tinggi = Math.round((lebar * 297) / 420);
  const img = await muatGambar(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace('width="420mm" height="297mm"', `width="${lebar}" height="${tinggi}"`))}`);
  const c = document.createElement('canvas');
  c.width = lebar; c.height = tinggi;
  const g = c.getContext('2d');
  if (!g) throw new Error('Kanvas tidak tersedia.');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, lebar, tinggi);
  g.drawImage(img, 0, 0, lebar, tinggi);
  return new Promise((ok, gagal) => c.toBlob(b => (b ? ok(b) : gagal(new Error('PNG gagal dibuat.'))), 'image/png'));
}

export async function berkasPaket(d: DokSLD, awalan: string): Promise<{ name: string; data: Uint8Array }[]> {
  const lembar = await lembarSvg(d);
  const hasil: { name: string; data: Uint8Array }[] = [];
  for (let i = 0; i < lembar.length; i++) {
    hasil.push({ name: `${awalan}_Sheet${i + 1}.png`, data: new Uint8Array(await (await pngDariSvg(lembar[i], 3000)).arrayBuffer()) });
  }
  hasil.push({ name: `${awalan}.vsdx`, data: await bytesVsdx(d) });
  return hasil;
}
