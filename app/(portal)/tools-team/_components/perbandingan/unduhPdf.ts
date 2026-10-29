'use client';
/**
 * Buat PDF Product Comparison di peramban (pdfkit, dimuat saat dibutuhkan) lalu unduh langsung - tidak ada
 * yang diunggah / disimpan di server. Huruf template dari /fonts/perbandingan (Arimo ≈ Liberation Sans, ✓ DejaVu).
 */
import { type KartuBanding, namaBerkasPdf } from '@/lib/perbandingan';
import { type DokPenuh, gambarPerbandingan } from '@/lib/perbandingan-pdf';
import { unduhUrl } from '@/lib/lembar-cetak';

const HURUF = {
  Sans: 'Arimo_400Regular.ttf', SansBold: 'Arimo_700Bold.ttf', SansItalic: 'Arimo_400Regular_Italic.ttf', Centang: 'DejaVuSans-Bold-centang.ttf',
} as const;

type KelasPdf = new (o: object) => DokPenuh & {
  registerFont(n: string, src: ArrayBuffer): void; on(e: string, f: (x?: Uint8Array) => void): void; end(): void; info: Record<string, string>;
};
let muat: Promise<{ Pdf: KelasPdf; huruf: Record<string, ArrayBuffer> }> | null = null;
export function siapkan() {
  muat ??= Promise.all([
    import('pdfkit/js/pdfkit.standalone.js').then(m => ((m as { default?: unknown }).default ?? m) as KelasPdf),
    ...Object.entries(HURUF).map(async ([n, f]) => {
      const r = await fetch(`/fonts/perbandingan/${f}`);
      if (!r.ok) throw new Error('Huruf template gagal dimuat.');
      return [n, await r.arrayBuffer()] as const;
    }),
  ]).then(([Pdf, ...h]) => ({ Pdf: Pdf as KelasPdf, huruf: Object.fromEntries(h as (readonly [string, ArrayBuffer])[]) }));
  muat.catch(() => { muat = null; });
  return muat;
}

/** PDF sebagai Blob (dipakai juga untuk pratinjau / uji). */
export async function buatPdf(k: KartuBanding): Promise<Blob> {
  const { Pdf, huruf } = await siapkan();
  const doc = new Pdf({ size: 'A4', margin: 0, info: { Title: `Product Comparison - ${k.judul}` } });
  for (const [n, b] of Object.entries(huruf)) doc.registerFont(n, b);
  const potong: Uint8Array[] = [];
  const selesai = new Promise<Blob>((ok, gagal) => {
    doc.on('data', c => { if (c) potong.push(c); });
    doc.on('end', () => ok(new Blob(potong as BlobPart[], { type: 'application/pdf' })));
    doc.on('error', () => gagal(new Error('PDF gagal dibuat.')));
  });
  gambarPerbandingan(doc, k);
  doc.end();
  return selesai;
}

export async function unduhPdf(k: KartuBanding): Promise<void> {
  const blob = await buatPdf(k);
  const url = URL.createObjectURL(blob);
  unduhUrl(url, namaBerkasPdf(k.produk));
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
