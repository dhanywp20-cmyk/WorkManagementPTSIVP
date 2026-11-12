'use client';
import { unduhUrl } from '@/lib/lembar-cetak';
import { CSS_BOQ, htmlBoq } from '@/lib/sld/boq';
import { bytesExcel, bytesVsdx, lembarSvg, lembarSvgProyek, namaEkspor, pngDariSvg, type OpsiEkspor, ukuranSvgMm } from '@/lib/sld/ekspor';
import { sematkanFoto } from '@/lib/sld/sematkan';
import { esc } from '@/lib/sld/teks';
import type { DokSLD } from '@/lib/sld/tipe';

export async function cetakPdf(d: DokSLD, o: OpsiEkspor = {}): Promise<void> {
  const w = window.open('', '_blank');
  if (!w) throw new Error('Jendela cetak diblokir peramban. Izinkan pop-up untuk halaman ini.');
  w.document.write('<!doctype html><title>Menyiapkan PDF...</title><p style="font-family:Arial;padding:24px">Menyiapkan SLD...</p>');
  try {
    const halaman = (await lembarSvgProyek(d, o)).map(s => {
      const h = ukuranSvgMm(s).h;
      return `<div class="hal${h < 297 ? ' lebar' : ''}" style="height:${h}mm">${s}</div>`;
    }).join('') + (o.simple ? '' : `<div class="hal-boq">${await sematkanFoto(htmlBoq(d))}</div>`);
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(namaEkspor(d, o.simple))}</title><style>`
      + '@page{size:A3 landscape;margin:0}@page lebar{size:420mm 236.25mm;margin:0}.lebar{page:lebar}html,body{margin:0;padding:0;background:#fff}'
      + '.hal{width:420mm;overflow:hidden;page-break-after:always;break-after:page}.hal:last-child{page-break-after:auto;break-after:auto}'
      + '.hal svg{display:block;width:420mm;height:100%}@media screen{body{background:#e5e7eb}.hal{margin:12px auto;box-shadow:0 2px 10px rgba(0,0,0,.15);background:#fff}}'
      + `@page boq{size:A3 landscape;margin:10mm}.hal-boq{page:boq}.hal-boq .boq{margin:0 auto}${CSS_BOQ}`
      + '@media screen{.hal-boq{width:420mm;margin:12px auto;padding:10mm 0;box-sizing:border-box;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.15)}}'
      + `</style></head><body>${halaman}</body></html>`);
    w.document.close();
    await Promise.all([...w.document.images].map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r; }))));
    setTimeout(() => { w.focus(); w.print(); }, 500);
  } catch (e) {
    w.close();
    throw e;
  }
}

function unduhBlob(b: Blob, nama: string) {
  const url = URL.createObjectURL(b);
  unduhUrl(url, nama);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function unduhPng(d: DokSLD, hal: 1 | 2, o: OpsiEkspor = {}): Promise<void> {
  const semua = await lembarSvg(d, o), pilih = hal === 1 ? semua.slice(0, 1) : semua.slice(1);
  if (!pilih.length) throw new Error('Sheet 2 tidak ada di mode Simple.');
  for (const [i, svg] of pilih.entries()) {
    unduhBlob(await pngDariSvg(svg), `${namaEkspor(d, o.simple)}${o.simple ? '' : ` - Sheet ${hal}${pilih.length > 1 ? ` (${i + 1} dari ${pilih.length})` : ''}`}.png`);
    if (i < pilih.length - 1) await new Promise(r => setTimeout(r, 400));
  }
}

export async function unduhExcel(d: DokSLD, o: OpsiEkspor = {}): Promise<void> {
  const isi = await bytesExcel(d, o);
  unduhBlob(new Blob([isi as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${namaEkspor(d, o.simple)}.xlsx`);
}

export async function unduhVsdx(d: DokSLD, o: OpsiEkspor = {}): Promise<void> {
  const isi = await bytesVsdx(d, o);
  unduhBlob(new Blob([isi as BlobPart], { type: 'application/vnd.ms-visio.drawing' }), `${namaEkspor(d, o.simple)}.vsdx`);
}
