'use client';
import { namaBerkas } from '@/lib/lembar-cetak';
import { rasioPerangkat, sudutSah } from './geometri';
import { ilustrasiPng } from './ilustrasi';
import { adaArah, type Arah, WATERMARK_BAWAAN } from './lembar-umum';
import { svgLembar1 } from './lembar1';
import { svgLembar2Semua } from './lembar2';
import { fotoData, sematkanFoto } from './sematkan';
import { bagianBoq } from './boq';
import { jumlahRuang, namaRuangKe, semuaPerangkat, semuaRuang } from './ruang';
import type { GambarExcel } from './excel';
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

export async function lembarSvgProyek(d: DokSLD, o: OpsiEkspor = {}): Promise<string[]> {
  const hasil: string[] = [];
  for (const r of semuaRuang(d)) hasil.push(...await lembarSvg(r, o));
  return hasil;
}

export async function lembarSvg(d: DokSLD, o: OpsiEkspor = {}): Promise<string[]> {
  const watermark = d.watermark ? await watermarkData(o.logo) : undefined;
  const opsi = { watermark, simple: o.simple };
  return Promise.all([svgLembar1(d, opsi), ...(o.simple ? [] : svgLembar2Semua(d, opsi))].map(sematkanFoto));
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

async function putarPng(url: string, o: Arah, r: number): Promise<GambarVsdx> {
  const sudut = sudutSah(o.putar);
  const img = await muatGambar(url);
  const a = (sudut * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const w = 960, h = w / r, kanvas = document.createElement('canvas');
  kanvas.width = Math.round(w * c + h * s); kanvas.height = Math.round(w * s + h * c);
  const g = kanvas.getContext('2d');
  if (!g) throw new Error('Kanvas tidak tersedia.');
  g.translate(kanvas.width / 2, kanvas.height / 2); g.rotate(a); g.scale(o.balikH ? -1 : 1, o.balikV ? -1 : 1); g.drawImage(img, -w / 2, -h / 2, w, h);
  return dariDataUrl(kanvas.toDataURL('image/png'));
}

export async function bytesVsdx(d: DokSLD, o: OpsiEkspor = {}): Promise<Uint8Array> {
  const gambar = new Map<string, GambarVsdx>(), kartu = new Map<string, GambarVsdx>();
  for (const p of semuaPerangkat(d)) {
    const r = rasioPerangkat(p);
    const url = p.gambar ?? (p.foto ? await fotoData(p.foto) : await ilustrasiPng(p.ikon, r, p));
    const tegak = /^data:image\/(png|jpe?g);base64,/.test(url) ? dariDataUrl(url) : await kePng(url);
    if (adaArah(p)) { gambar.set(p.id, await putarPng(url, p, r)); kartu.set(p.id, tegak); } else gambar.set(p.id, tegak);
  }
  const watermark = d.watermark ? await kePng(await watermarkData(o.logo)) : undefined;
  const ruang = jumlahRuang(d) > 1 ? semuaRuang(d).map((r, i) => ({ dok: r, nama: namaRuangKe(d, i) })) : undefined;
  return buatVsdx({ dok: d, gambar, kartu, watermark, judul: namaSLD(d), simple: o.simple, ruang });
}

export const ukuranSvgMm = (svg: string) => {
  const m = /width="([\d.]+)mm" height="([\d.]+)mm"/.exec(svg);
  return { w: m ? Number(m[1]) : 420, h: m ? Number(m[2]) : 297 };
};

export async function pngDariSvg(svg: string, lebar = 4200): Promise<Blob> {
  const mm = ukuranSvgMm(svg), tinggi = Math.round((lebar * mm.h) / mm.w);
  const img = await muatGambar(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(`width="${mm.w}mm" height="${mm.h}mm"`, `width="${lebar}" height="${tinggi}"`))}`);
  const c = document.createElement('canvas');
  c.width = lebar; c.height = tinggi;
  const g = c.getContext('2d');
  if (!g) throw new Error('Kanvas tidak tersedia.');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, lebar, tinggi);
  g.drawImage(img, 0, 0, lebar, tinggi);
  return new Promise((ok, gagal) => c.toBlob(b => (b ? ok(b) : gagal(new Error('PNG gagal dibuat.'))), 'image/png'));
}

async function gambarExcel(url: string): Promise<GambarExcel> {
  const img = await muatGambar(url);
  const w = img.naturalWidth || 600, h = img.naturalHeight || 375;
  if (/^data:image\/(png|jpe?g);base64,/.test(url)) return { data: url, ext: /jpe?g/.test(url.slice(0, 20)) ? 'jpeg' : 'png', w, h };
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return { data: c.toDataURL('image/png'), ext: 'png', w, h };
}

export async function bytesExcel(d: DokSLD, o: OpsiEkspor = {}): Promise<Uint8Array> {
  const { bukuExcel } = await import('./excel');
  const lembar1: GambarExcel[] = [];
  for (const r of semuaRuang(d)) lembar1.push(await gambarExcel(await keDataUrl(await pngDariSvg((await lembarSvg(r, o))[0], 3000))));
  const gambar = new Map<string, GambarExcel>();
  if (!o.simple) {
    for (const b of bagianBoq(d).flatMap(x => x.baris)) {
      const p = b.contoh;
      try {
        gambar.set(p.id, await gambarExcel(p.gambar ?? (p.foto ? await fotoData(p.foto) : await ilustrasiPng(p.ikon, rasioPerangkat(p), p))));
      } catch {  }
    }
  }
  return bukuExcel({ dok: d, simple: o.simple, lembar1, gambar });
}

export async function berkasPaket(d: DokSLD, awalan: string): Promise<{ name: string; data: Uint8Array }[]> {
  const hasil: { name: string; data: Uint8Array }[] = [];
  const ruang = semuaRuang(d);
  for (const [r, dr] of ruang.entries()) {
    const lembar = await lembarSvg(dr);
    for (let i = 0; i < lembar.length; i++) {
      const nama = `${awalan}${ruang.length > 1 ? `_R${r + 1}` : ''}_Sheet${Math.min(i + 1, 2)}${i > 1 ? `-${i}` : ''}.png`;
      hasil.push({ name: nama, data: new Uint8Array(await (await pngDariSvg(lembar[i], 3000)).arrayBuffer()) });
    }
  }
  hasil.push({ name: `${awalan}.vsdx`, data: await bytesVsdx(d) });
  hasil.push({ name: `${awalan}_Sheet1-3_BOQ.xlsx`, data: await bytesExcel(d) });
  return hasil;
}
