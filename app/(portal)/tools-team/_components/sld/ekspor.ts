'use client';
import { namaBerkas, unduhSvgPNG } from '@/lib/lembar-cetak';
import { WATERMARK_BAWAAN } from '@/lib/sld/lembar-umum';
import { svgLembar1 } from '@/lib/sld/lembar1';
import { svgLembar2 } from '@/lib/sld/lembar2';
import { esc } from '@/lib/sld/teks';
import type { DokSLD } from '@/lib/sld/tipe';

let wm: Promise<string> | null = null;

export function watermarkData(): Promise<string> {
  wm ??= fetch(WATERMARK_BAWAAN).then(r => (r.ok ? r.blob() : Promise.reject(new Error('Logo watermark gagal dimuat.'))))
    .then(b => new Promise<string>((ok, gagal) => {
      const f = new FileReader();
      f.onload = () => ok(String(f.result));
      f.onerror = () => gagal(new Error('Logo watermark gagal dibaca.'));
      f.readAsDataURL(b);
    }));
  wm.catch(() => { wm = null; });
  return wm;
}

export const namaSLD = (d: DokSLD) =>
  namaBerkas('SLD', [d.blok.proyek, d.blok.lokasi].filter(Boolean).join(' '), d.blok.rev ? `Rev ${d.blok.rev}` : '');

export async function lembarSvg(d: DokSLD): Promise<[string, string]> {
  const watermark = await watermarkData();
  return [svgLembar1(d, { watermark }), svgLembar2(d, { watermark })];
}

export async function cetakPdf(d: DokSLD): Promise<void> {
  const w = window.open('', '_blank');
  if (!w) throw new Error('Jendela cetak diblokir peramban. Izinkan pop-up untuk halaman ini.');
  w.document.write('<!doctype html><title>Menyiapkan PDF...</title><p style="font-family:Arial;padding:24px">Menyiapkan SLD...</p>');
  try {
    const [a, b] = await lembarSvg(d);
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

export async function unduhPng(d: DokSLD, hal: 1 | 2): Promise<void> {
  const svg = (await lembarSvg(d))[hal - 1].replace('width="420mm" height="297mm"', 'width="4200" height="2970"');
  await unduhSvgPNG(svg, `${namaSLD(d)} - Sheet ${hal}.png`, 1);
}
