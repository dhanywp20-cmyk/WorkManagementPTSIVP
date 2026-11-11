'use client';
import { namaBerkas, unduhSvgPNG, unduhUrl } from '@/lib/lembar-cetak';
import { kotakTampak } from '@/lib/sld/geometri';
import { WATERMARK_BAWAAN } from '@/lib/sld/lembar-umum';
import { svgLembar1 } from '@/lib/sld/lembar1';
import { svgLembar2 } from '@/lib/sld/lembar2';
import { esc } from '@/lib/sld/teks';
import type { DokSLD } from '@/lib/sld/tipe';
import { buatVsdx, type GambarVsdx } from '@/lib/sld/vsdx';
import { ilustrasiPng } from './ilustrasi';

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

export async function lembarSvg(d: DokSLD, logo?: string | null): Promise<[string, string]> {
  const watermark = d.watermark ? await watermarkData(logo) : undefined;
  return [svgLembar1(d, { watermark }), svgLembar2(d, { watermark })];
}

export async function cetakPdf(d: DokSLD, logo?: string | null): Promise<void> {
  const w = window.open('', '_blank');
  if (!w) throw new Error('Jendela cetak diblokir peramban. Izinkan pop-up untuk halaman ini.');
  w.document.write('<!doctype html><title>Menyiapkan PDF...</title><p style="font-family:Arial;padding:24px">Menyiapkan SLD...</p>');
  try {
    const [a, b] = await lembarSvg(d, logo);
    const halaman = [a, b].map(s => `<div class="hal">${s}</div>`).join('');
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(namaSLD(d))}</title><style>`
      + '@page{size:A3 landscape;margin:0}html,body{margin:0;padding:0;background:#fff}'
      + '.hal{width:420mm;height:297mm;overflow:hidden;page-break-after:always;break-after:page}.hal:last-child{page-break-after:auto;break-after:auto}'
      + '.hal svg{display:block;width:420mm;height:297mm}@media screen{body{background:#e5e7eb}.hal{margin:12px auto;box-shadow:0 2px 10px rgba(0,0,0,.15);background:#fff}}'
      + `</style></head><body>${halaman}</body></html>`);
    w.document.close();
    await Promise.all([...w.document.images].map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r; }))));
    setTimeout(() => { w.focus(); w.print(); }, 500);
  } catch (e) {
    w.close();
    throw e;
  }
}

export async function unduhPng(d: DokSLD, hal: 1 | 2, logo?: string | null): Promise<void> {
  const svg = (await lembarSvg(d, logo))[hal - 1].replace('width="420mm" height="297mm"', 'width="4200" height="2970"');
  await unduhSvgPNG(svg, `${namaSLD(d)} - Sheet ${hal}.png`, 1);
}

function dariDataUrl(url: string): GambarVsdx {
  const [kepala, isi] = url.split(',');
  const biner = atob(isi);
  const b = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) b[i] = biner.charCodeAt(i);
  return { isi: b, jpeg: /image\/jpe?g/.test(kepala) };
}

async function kePng(url: string): Promise<GambarVsdx> {
  if (/^data:image\/(png|jpe?g);base64,/.test(url)) return dariDataUrl(url);
  const img = new Image();
  await new Promise((ok, gagal) => { img.onload = ok; img.onerror = () => gagal(new Error('Gambar gagal dimuat.')); img.src = url; });
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || 600; c.height = img.naturalHeight || 375;
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return dariDataUrl(c.toDataURL('image/png'));
}

export async function unduhVsdx(d: DokSLD, logo?: string | null): Promise<void> {
  const gambar = new Map<string, GambarVsdx>();
  for (const p of d.perangkat) {
    const k = kotakTampak(p);
    gambar.set(p.id, p.gambar ? dariDataUrl(p.gambar) : await kePng(await ilustrasiPng(p.ikon, k.w / k.h)));
  }
  const watermark = d.watermark ? await kePng(await watermarkData(logo)) : undefined;
  const isi = buatVsdx({ dok: d, gambar, watermark, judul: namaSLD(d) });
  const url = URL.createObjectURL(new Blob([isi as BlobPart], { type: 'application/vnd.ms-visio.drawing' }));
  unduhUrl(url, `${namaSLD(d)}.vsdx`);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
