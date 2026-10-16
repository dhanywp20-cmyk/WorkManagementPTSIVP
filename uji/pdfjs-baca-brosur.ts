/**
 * uji/pdfjs-baca-brosur.ts - pdf.js 6 di Product Comparison (Tools Team).
 *
 * pdf.js 6 menghapus PDFDocumentProxy.destroy() dan opsi isEvalSupported: kode lama memanggil
 * `dok.destroy()` di finally -> TypeError -> baca brosur gagal walau teksnya sudah terbaca. Uji ini
 * menjalankan alur yang sama dengan bacaPdf.ts (getDocument -> getTextContent -> tugas.destroy())
 * memakai pdf.js sungguhan, dan menjaga agar pola lama tidak kembali.
 *
 * Jalankan: npm test -- pdfjs-baca-brosur
 */
import { readFileSync } from 'fs';
import PDFDocument from 'pdfkit';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

function buatPdf(): Promise<Uint8Array> {
  return new Promise(res => {
    const d = new PDFDocument({ size: 'A4', margin: 40 });
    const bagian: Buffer[] = [];
    d.on('data', b => bagian.push(b));
    d.on('end', () => res(new Uint8Array(Buffer.concat(bagian))));
    d.fontSize(12).text('Brosur LED P1.5 - kecerahan 600 nit, refresh 3840 Hz');
    d.addPage().text('Halaman dua: konsumsi daya 450 W/m2');
    d.end();
  });
}

(async () => {
  const kode = readFileSync('app/(portal)/tools-team/_components/perbandingan/bacaPdf.ts', 'utf8');
  cek('tidak memanggil dok.destroy() (tidak ada di pdf.js 6)', !/dok\.destroy\(/.test(kode));
  cek('ditutup lewat tugas pemuat', /tugas\.destroy\(\)/.test(kode));
  cek('tanpa opsi isEvalSupported (dihapus pdf.js 6)', !/isEvalSupported/.test(kode));
  const ver = JSON.parse(readFileSync('node_modules/pdfjs-dist/package.json', 'utf8')).version as string;
  cek(`pdfjs-dist terpasang ${ver} (>= 6)`, Number(ver.split('.')[0]) >= 6);

  const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const tugas = lib.getDocument({ data: await buatPdf(), disableFontFace: true, useSystemFonts: false });
  const dok = await tugas.promise;
  const teks: string[] = [];
  for (let i = 1; i <= dok.numPages; i++) {
    const p = await dok.getPage(i);
    const isi = await p.getTextContent();
    teks.push(isi.items.map(it => ('str' in it ? it.str : '')).join(' '));
    p.cleanup();
  }
  cek('2 halaman terbaca', dok.numPages === 2);
  cek('teks halaman 1 utuh', teks[0].includes('kecerahan 600 nit'));
  cek('teks halaman 2 utuh', teks[1].includes('450 W/m2'));
  let galat = '';
  try { await tugas.destroy(); } catch (e) { galat = String(e); }
  cek('tugas.destroy() tanpa galat', !galat);

  console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})();
