'use client';
/**
 * Checklist Barang - berkas di peramban: baca Excel / CSV (SheetJS) & PDF (pdf.js), template Excel,
 * dan unduh PDF hasil (pdfkit). Tidak ada yang diunggah / disimpan di server.
 * Loader pdf.js & pdfkit + huruf dipakai bersama Product Comparison (../perbandingan).
 */
import {
  bacaPdf, bacaTabel, type DokCek, type DokChecklist, gambarChecklist, type ItemBarang, namaBerkasPdf, type PotongPdf,
} from '@/lib/checklist-barang';
import { loadXLSX } from '@/lib/xlsx-loader';
import { unduhUrl } from '@/lib/lembar-cetak';
import { pdfjs } from '../perbandingan/bacaPdf';
import { siapkan } from '../perbandingan/unduhPdf';

const MAKS_BYTE = 15_000_000;
const MAKS_HALAMAN = 50;

async function jenisBerkas(f: File): Promise<'pdf' | 'excel'> {
  const k = new Uint8Array(await f.slice(0, 4).arrayBuffer());
  //  Tanda tangan isi berkas, bukan ekstensi: "%PDF", ZIP (xlsx) "PK", OLE (xls lama) D0 CF.
  if (k[0] === 0x25 && k[1] === 0x50 && k[2] === 0x44 && k[3] === 0x46) return 'pdf';
  if ((k[0] === 0x50 && k[1] === 0x4b) || (k[0] === 0xd0 && k[1] === 0xcf)) return 'excel';
  if (/\.(csv|txt)$/i.test(f.name)) return 'excel';
  throw new Error(`${f.name}: format tidak dikenali. Gunakan Excel (.xlsx / .xls), CSV, atau PDF.`);
}

/** Excel / CSV / PDF -> daftar barang (lembar Excel dengan barang terbanyak yang dipakai). */
export async function imporBerkas(f: File): Promise<ItemBarang[]> {
  if (f.size <= 0) throw new Error(`${f.name}: berkas kosong.`);
  if (f.size > MAKS_BYTE) throw new Error(`${f.name}: terlalu besar (maks ${MAKS_BYTE / 1_000_000} MB).`);
  const items = (await jenisBerkas(f)) === 'pdf' ? await dariPdf(f) : await dariExcel(f);
  if (!items.length) throw new Error(`${f.name}: tidak ada daftar barang yang terbaca. Pastikan ada kolom Nama Barang (dan Qty), atau pakai Template Excel.`);
  return items;
}

function dariExcel(f: File): Promise<ItemBarang[]> {
  return new Promise((ok, gagal) => loadXLSX(async XLSX => {
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      let terbaik: ItemBarang[] = [];
      for (const n of (wb.SheetNames as string[]).slice(0, 10)) {
        const baris = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '', blankrows: false }) as unknown[][];
        const items = bacaTabel(baris);
        if (items.length > terbaik.length) terbaik = items;
      }
      ok(terbaik);
    } catch { gagal(new Error(`${f.name}: berkas Excel rusak / tidak bisa dibaca.`)); }
  }, () => gagal(new Error('Pembaca Excel gagal dimuat - periksa koneksi.'))));
}

async function dariPdf(f: File): Promise<ItemBarang[]> {
  const lib = await pdfjs();
  const tugas = lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), disableFontFace: true, useSystemFonts: false });
  try {
    let dok: Awaited<typeof tugas.promise>;
    try { dok = await tugas.promise; } catch (e) {
      if ((e as { name?: string })?.name === 'PasswordException') throw new Error(`${f.name}: PDF terkunci kata sandi - buka kuncinya dulu.`);
      throw new Error(`${f.name}: PDF rusak / tidak bisa dibaca.`);
    }
    const halaman: PotongPdf[][] = [];
    for (let i = 1; i <= Math.min(dok.numPages, MAKS_HALAMAN); i++) {
      const p = await dok.getPage(i);
      const isi = await p.getTextContent();
      halaman.push(isi.items.flatMap(it => ('str' in it && it.str.trim()
        ? [{ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.hypot(it.transform[2], it.transform[3]) }]
        : [])));
      p.cleanup();
    }
    if (!halaman.some(h => h.length)) throw new Error(`${f.name}: tidak ada teks yang bisa dibaca - kemungkinan PDF hasil scan / foto. Gunakan PDF digital atau Excel.`);
    return bacaPdf(halaman);
  } finally {
    void tugas.destroy();
  }
}

export function unduhTemplate(): Promise<void> {
  return new Promise((ok, gagal) => loadXLSX(XLSX => {
    try {
      const ws = XLSX.utils.aoa_to_sheet([
        ['No', 'Nama Barang', 'Merk / Tipe', 'Qty', 'Satuan', 'Keterangan'],
        [1, 'Speaker ceiling', 'JBL Control 26C', 8, 'pcs', ''],
        [2, 'Kabel HDMI 10 m', '', 2, 'roll', ''],
      ]);
      ws['!cols'] = [6, 40, 24, 8, 10, 30].map(wch => ({ wch }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Checklist Barang');
      XLSX.writeFile(wb, 'Template-Checklist-Barang.xlsx');
      ok();
    } catch (e) { gagal(e); }
  }, () => gagal(new Error('Library Excel gagal dimuat - periksa koneksi.'))));
}

/** Potong tanda tangan ke area goresan supaya tidak tampil kecil di PDF. '' bila kanvas kosong. */
function potongTtd(src: string): Promise<string> {
  if (!src) return Promise.resolve('');
  return new Promise(ok => {
    const img = new Image();
    img.onerror = () => ok('');
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      if (!g || !c.width || !c.height) { ok(src); return; }
      g.drawImage(img, 0, 0);
      const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
      let x0 = width, y0 = height, x1 = -1, y1 = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * 4 + 3] < 24) continue;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      if (x1 < 0) { ok(''); return; }
      const tepi = 8;
      x0 = Math.max(0, x0 - tepi); y0 = Math.max(0, y0 - tepi);
      x1 = Math.min(width - 1, x1 + tepi); y1 = Math.min(height - 1, y1 + tepi);
      const o = document.createElement('canvas');
      o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
      o.getContext('2d')?.drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
      ok(o.toDataURL('image/png'));
    };
    img.src = src;
  });
}

type DokPdfkit = DokCek & { registerFont(n: string, src: ArrayBuffer): void; on(e: string, f: (x?: Uint8Array) => void): void; end(): void };

export async function unduhPdfChecklist(d: DokChecklist, dicetak: string): Promise<void> {
  const [{ Pdf, huruf }, penanda] = await Promise.all([
    siapkan(),
    Promise.all(d.penanda.map(async p => ({ ...p, ttd: await potongTtd(p.ttd) }))),
  ]);
  const doc = new Pdf({ size: 'A4', margin: 0, bufferPages: true, info: { Title: d.judul || 'Checklist Barang' } }) as unknown as DokPdfkit;
  doc.registerFont('Sans', huruf.Sans);
  doc.registerFont('SansBold', huruf.SansBold);
  const potong: Uint8Array[] = [];
  const selesai = new Promise<Blob>((ok, gagal) => {
    doc.on('data', c => { if (c) potong.push(c); });
    doc.on('end', () => ok(new Blob(potong as BlobPart[], { type: 'application/pdf' })));
    doc.on('error', () => gagal(new Error('PDF gagal dibuat.')));
  });
  gambarChecklist(doc, { ...d, penanda }, { dicetak });
  doc.end();
  const url = URL.createObjectURL(await selesai);
  unduhUrl(url, namaBerkasPdf(d));
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
