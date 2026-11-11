'use client';
import type { Potong } from '@/lib/sld/bom';
import { MAKS_BYTE_GAMBAR_SLD } from '@/lib/sld/tipe';

const MAKS_SISI = 640;
export interface FotoSiap { dataUrl: string; rasio: number }

function muatGambar(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, gagal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => gagal(new Error('Gambar tidak bisa dibaca. Gunakan PNG atau JPG.'));
    img.src = url;
  });
}

const adaTransparan = (c: CanvasRenderingContext2D, w: number, h: number) => {
  const d = c.getImageData(0, 0, w, h).data;
  for (let i = 3; i < d.length; i += 16) if (d[i] < 250) return true;
  return false;
};

export async function kompresGambar(f: Blob, potong?: Potong): Promise<FotoSiap> {
  if (!/^image\/(png|jpeg|webp|gif|bmp)$/.test(f.type)) throw new Error('Pilih berkas gambar (PNG / JPG).');
  if (f.size > 15_000_000) throw new Error('Gambar terlalu besar (maks 15 MB).');
  const url = URL.createObjectURL(f);
  try {
    const img = await muatGambar(url);
    const p = potong ?? { l: 0, t: 0, r: 0, b: 0 };
    const sx = img.naturalWidth * p.l, sy = img.naturalHeight * p.t;
    const sw = Math.max(1, img.naturalWidth * (1 - p.l - p.r)), sh = Math.max(1, img.naturalHeight * (1 - p.t - p.b));
    const s = Math.min(1, MAKS_SISI / Math.max(sw, sh));
    let w = Math.max(1, Math.round(sw * s)), h = Math.max(1, Math.round(sh * s));
    const kanvas = document.createElement('canvas');
    const c = kanvas.getContext('2d');
    if (!c) throw new Error('Peramban tidak mendukung pengolahan gambar.');
    for (let coba = 0; coba < 6; coba++) {
      kanvas.width = w; kanvas.height = h;
      c.clearRect(0, 0, w, h);
      c.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      const transparan = adaTransparan(c, w, h);
      let hasil = transparan ? kanvas.toDataURL('image/png') : '';
      if (!transparan || hasil.length > MAKS_BYTE_GAMBAR_SLD * 1.33) {
        if (transparan) { c.globalCompositeOperation = 'destination-over'; c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over'; }
        hasil = kanvas.toDataURL('image/jpeg', 0.85);
      }
      if (hasil.length <= MAKS_BYTE_GAMBAR_SLD * 1.33) return { dataUrl: hasil, rasio: sw / sh };
      w = Math.round(w * 0.78); h = Math.round(h * 0.78);
    }
    throw new Error('Gambar tetap terlalu besar setelah dikecilkan.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function gambarDariClipboard(e: ClipboardEvent): File | null {
  for (const it of e.clipboardData?.items ?? []) if (it.kind === 'file' && it.type.startsWith('image/')) return it.getAsFile();
  return null;
}
