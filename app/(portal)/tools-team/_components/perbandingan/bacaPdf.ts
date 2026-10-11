'use client';
/**
 * Baca teks brosur PDF DI PERAMBAN (pdf.js) - berkas tidak pernah diunggah. Per halaman, baris dirapikan.
 * pdf.js hanya dimuat saat dibutuhkan (build legacy: aman untuk WebView APK lama).
 */
import { MIN_KARAKTER_TEKS, periksaBerkas } from '@/lib/perbandingan';

export interface HasilBaca { halaman: string[]; jumlahHalaman: number; karakter: number }

type PdfJs = typeof import('pdfjs-dist');
let muat: Promise<PdfJs> | null = null;
function pdfjs(): Promise<PdfJs> {
  muat ??= import('pdfjs-dist/legacy/build/pdf.mjs').then(m => {
    const lib = m as unknown as PdfJs;
    lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
    return lib;
  });
  return muat;
}

/** Maks halaman yang dibaca per brosur (brosur panjang cukup halaman awal - teks dipangkas lagi sebelum ke AI). */
const MAKS_HALAMAN = 40;

export async function bacaTeksPdf(berkas: File, sinyal?: AbortSignal): Promise<HasilBaca> {
  const kepala = new Uint8Array(await berkas.slice(0, 8).arrayBuffer());
  const salah = periksaBerkas(berkas.name, berkas.size, kepala);
  if (salah) throw new Error(salah);
  const lib = await pdfjs();
  let dok: Awaited<ReturnType<PdfJs['getDocument']>['promise']>;
  try {
    //  Tanpa skrip / font sistem: brosur tidak menjalankan apa pun, hanya dibaca teksnya.
    dok = await lib.getDocument({ data: new Uint8Array(await berkas.arrayBuffer()), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
  } catch (e) {
    const nama = (e as { name?: string })?.name;
    if (nama === 'PasswordException') throw new Error(`${berkas.name}: PDF terkunci kata sandi - buka kuncinya dulu.`);
    throw new Error(`${berkas.name}: PDF rusak / tidak bisa dibaca.`);
  }
  const halaman: string[] = [];
  try {
    for (let i = 1; i <= Math.min(dok.numPages, MAKS_HALAMAN); i++) {
      if (sinyal?.aborted) throw new DOMException('Dibatalkan', 'AbortError');
      const p = await dok.getPage(i);
      const isi = await p.getTextContent();
      let teks = '';
      for (const it of isi.items) {
        if (!('str' in it)) continue;
        teks += it.str + (it.hasEOL ? '\n' : ' ');
      }
      halaman.push(teks.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim());
      p.cleanup();
    }
  } finally {
    void dok.destroy();
  }
  const karakter = halaman.join('').replace(/\s/g, '').length;
  if (karakter < MIN_KARAKTER_TEKS) {
    throw new Error(`${berkas.name}: tidak ada teks yang bisa dibaca - kemungkinan brosur hasil scan / gambar. Minta versi PDF digital (teks bisa diseleksi), atau isi manual.`);
  }
  return { halaman, jumlahHalaman: dok.numPages, karakter };
}
