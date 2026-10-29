/**
 * uji/checklist-barang.ts - Checklist Barang (AV Solution Tools): impor Excel / PDF, draf, PDF hasil.
 *
 * PDF diuji sungguhan: tabel dibuat pdfkit -> dibaca pdf.js (alur yang sama dengan cekbarang/berkas.ts),
 * dan PDF hasil gambarChecklist dibaca balik untuk memastikan isi, halaman & tanda tangan.
 *
 * Jalankan: npm test -- checklist-barang
 */
import { readFileSync, writeFileSync } from 'fs';
import PDFDocument from 'pdfkit';
import {
  bacaDraf, bacaPdf, bacaTabel, barisTeks, type DokCek, type DokChecklist, dokBaru, gambarChecklist, itemBaru,
  namaBerkasPdf, type PotongPdf, ringkas, tglIndo,
} from '../lib/checklist-barang';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean, info?: unknown) => {
  if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`, info ?? ''); }
};

const F = 'public/fonts/perbandingan/';
type Dok = InstanceType<typeof PDFDocument>;
function buat(gambar: (d: Dok) => void, opsi: object = {}): Promise<Uint8Array> {
  return new Promise(res => {
    const d = new PDFDocument({ size: 'A4', margin: 0, ...opsi });
    const bagian: Buffer[] = [];
    d.on('data', b => bagian.push(b));
    d.on('end', () => res(new Uint8Array(Buffer.concat(bagian))));
    d.registerFont('Sans', readFileSync(F + 'Arimo_400Regular.ttf'));
    d.registerFont('SansBold', readFileSync(F + 'Arimo_700Bold.ttf'));
    gambar(d);
    d.end();
  });
}

async function potongPdf(data: Uint8Array): Promise<{ halaman: PotongPdf[][]; teks: string[] }> {
  const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  //  Salinan: pdf.js memindahkan (detach) buffer yang diberikan.
  const tugas = lib.getDocument({ data: data.slice(), disableFontFace: true, useSystemFonts: false });
  const dok = await tugas.promise;
  const halaman: PotongPdf[][] = [], teks: string[] = [];
  for (let i = 1; i <= dok.numPages; i++) {
    const p = await dok.getPage(i);
    const isi = await p.getTextContent();
    const potong = isi.items.flatMap(it => ('str' in it && it.str.trim()
      ? [{ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.hypot(it.transform[2], it.transform[3]) }]
      : []));
    halaman.push(potong);
    teks.push(potong.map(x => x.str).join(' '));
    p.cleanup();
  }
  void tugas.destroy();
  return { halaman, teks };
}

(async () => {
  console.log('\n1. Excel: baris kepala, judul kelompok, total & sel "2 pcs"');
  const excel = bacaTabel([
    ['DAFTAR BARANG KIRIM', '', '', '', '', ''],
    ['Project: Ruang Meeting Lt. 5'],
    [],
    ['No.', 'Nama Barang', 'Merk', 'Tipe', 'Qty', 'Satuan', 'Harga', 'Keterangan'],
    ['', 'AUDIO SYSTEM', '', '', '', '', '', ''],
    [1, 'Speaker ceiling', 'JBL', 'Control 26C', 8, 'pcs', '1.200.000', ''],
    [2, 'Power amplifier', 'Crown', 'XLS 1002', '1', 'unit', '', 'cadangan di gudang'],
    ['', 'VIDEO', '', '', '', '', '', ''],
    [3, 'Kabel HDMI 10 m', '', '', '2 roll', '', '', ''],
    ['', 'Total', '', '', 11, '', '', ''],
  ]);
  cek('5 baris (2 kelompok + 3 barang), total dilewati', excel.length === 5, excel.map(x => x.nama));
  cek('kelompok AUDIO SYSTEM', excel[0].grup === true && excel[0].nama === 'AUDIO SYSTEM');
  cek('merk + tipe digabung jadi spek', excel[1].spek === 'JBL · Control 26C', excel[1].spek);
  cek('qty & satuan', excel[1].qty === '8' && excel[1].satuan === 'pcs');
  cek('keterangan ikut', excel[2].ket === 'cadangan di gudang');
  cek('"2 roll" dipecah jadi qty + satuan', excel[4].qty === '2' && excel[4].satuan === 'roll', excel[4]);
  cek('kolom Harga diabaikan', !JSON.stringify(excel).includes('1.200.000'));
  const r = ringkas(excel);
  cek('ringkasan hanya menghitung barang', r.total === 3 && r.belum === 3);

  console.log('\n2. Excel ekspor ulang (kolom Status) & tanpa kepala');
  const ulang = bacaTabel([['Item', 'Qty', 'Status'], ['Mic wireless', '2', '✓'], ['Mixer', '1', 'Tidak ada'], ['Stand', '2', '']]);
  cek('status ✓ / tidak / kosong terbaca', ulang.map(x => x.status).join(',') === 'ok,tidak,', ulang.map(x => x.status));
  const tanpa = bacaTabel([[1, 'Display 65 inch', 2, 'unit'], [2, 'Bracket dinding', 2, 'pcs'], [3, 'Kabel power', 4, 'pcs']]);
  cek('tanpa kepala: kolom nama, qty, satuan ditebak', tanpa.length === 3 && tanpa[0].nama === 'Display 65 inch' && tanpa[0].qty === '2' && tanpa[0].satuan === 'unit', tanpa[0]);

  console.log('\n3. Daftar teks biasa');
  cek('"1. Speaker ceiling 8 pcs"', (() => { const x = barisTeks(['1. Speaker ceiling 8 pcs']); return x?.nama === 'Speaker ceiling' && x.qty === '8' && x.satuan === 'pcs'; })());
  cek('"- HDMI 5m x2"', (() => { const x = barisTeks(['- HDMI 5m x2']); return x?.nama === 'HDMI 5m' && x.qty === '2'; })());
  cek('sel terpisah: 3 | Mixer | 1 | unit', (() => { const x = barisTeks(['3', 'Mixer digital', '1', 'unit']); return x?.nama === 'Mixer digital' && x.qty === '1' && x.satuan === 'unit'; })());
  cek('angka di nama tanpa satuan tidak jadi qty', barisTeks(['Display 65'])?.qty === '');

  console.log('\n4. PDF tabel (pdfkit -> pdf.js): kolom kosong, nama 2 baris, kepala berulang di halaman 2');
  const kolomX = [40, 70, 260, 380, 430, 480];
  const tabelPdf = await buat(d => {
    const baris = (y: number, sel: string[], bold = false) => sel.forEach((t, i) => {
      if (t) d.font(bold ? 'SansBold' : 'Sans').fontSize(9).text(t, kolomX[i], y, { lineBreak: false });
    });
    d.font('SansBold').fontSize(14).text('Surat Jalan No. 123/SJ/X/2026', 40, 40, { lineBreak: false });
    const kepala = ['No', 'Description', 'Brand / Type', 'Qty', 'Unit', 'Remarks'];
    baris(90, kepala, true);
    baris(110, ['1', 'LED Display 55 inch', 'Samsung QM55C', '2', 'unit', '']);
    baris(126, ['2', 'Wall bracket heavy duty', '', '2', 'pcs', 'baru']);
    baris(142, ['3', 'Kabel HDMI 2.1 ultra high speed', 'Ugreen', '4', 'pcs', '']);
    baris(153, ['', 'panjang 5 meter', '', '', '', '']);
    baris(169, ['', 'CONTROL SYSTEM', '', '', '', '']);
    baris(185, ['4', 'Touch panel 10"', 'Crestron TSW', '1', 'unit', '']);
    d.addPage();
    baris(60, kepala, true);
    baris(80, ['5', 'Control processor', 'Crestron CP4', '1', 'unit', '']);
    d.font('Sans').fontSize(8).text('Halaman 2', 40, 800, { lineBreak: false });
  });
  const { halaman } = await potongPdf(tabelPdf);
  const dariPdf = bacaPdf(halaman);
  const barang = dariPdf.filter(x => !x.grup);
  cek('5 barang + 1 kelompok', barang.length === 5 && dariPdf.filter(x => x.grup).length === 1, dariPdf.map(x => `${x.grup ? '#' : ''}${x.nama}|${x.qty}`));
  cek('judul dokumen & kepala halaman 2 tidak jadi barang', !dariPdf.some(x => /Surat Jalan|Description|Halaman/.test(x.nama)));
  cek('kolom Brand kosong tidak menggeser qty', barang[1]?.nama === 'Wall bracket heavy duty' && barang[1].spek === '' && barang[1].qty === '2' && barang[1].ket === 'baru', barang[1]);
  cek('nama terbungkus 2 baris digabung', barang[2]?.nama === 'Kabel HDMI 2.1 ultra high speed panjang 5 meter', barang[2]?.nama);
  cek('spek & satuan dari PDF', barang[0]?.spek === 'Samsung QM55C' && barang[0].satuan === 'unit');
  cek('kelompok CONTROL SYSTEM', dariPdf.find(x => x.grup)?.nama === 'CONTROL SYSTEM');
  cek('barang di halaman 2 terbaca', barang[4]?.nama === 'Control processor');

  console.log('\n5. Draf tersimpan');
  const draf = bacaDraf({ judul: 'X', items: [{ nama: 'A', status: 'ok', grup: false }, { nama: 5 }, null, { nama: 'B', status: 'aneh' }], penanda: [{ label: 'L', nama: 'N', ttd: 'javascript:alert(1)' }], tanggal: '2026-10-29' });
  cek('item rusak dibuang, status tidak dikenal = belum', draf?.items.length === 2 && draf.items[0].status === 'ok' && draf.items[1].status === '');
  cek('ttd bukan PNG data URL dibuang', draf?.penanda[0].ttd === '');
  cek('bentuk asing = null', bacaDraf({ items: 'x' }) === null && bacaDraf(null) === null);
  cek('tglIndo', tglIndo('2026-10-29') === '29 Oktober 2026');
  cek('nama berkas PDF', namaBerkasPdf({ judul: 'Checklist Barang', project: 'PT Maju / Lt.5', tanggal: '2026-10-29' }) === 'Checklist-Barang-PT-Maju-Lt.5-2026-10-29.pdf');

  console.log('\n6. PDF hasil: banyak halaman, status, catatan, tanda tangan');
  const dok: DokChecklist = {
    ...dokBaru('2026-10-29'), judul: 'Checklist Barang Kirim', nomor: 'SJ-123', project: 'PT Contoh Sejahtera', lokasi: 'Jakarta',
    catatan: 'Kekurangan 1 bracket menyusul minggu depan.',
    items: [
      itemBaru({ nama: 'AUDIO SYSTEM', grup: true }),
      ...Array.from({ length: 70 }, (_, i) => itemBaru({
        nama: `Barang ke-${i + 1}${i === 3 ? ' dengan nama yang sangat panjang sekali sampai harus dibungkus ke baris berikutnya di tabel PDF' : ''}`,
        spek: i % 5 === 0 ? 'Merk X · Tipe Y' : '', qty: String(i + 1), satuan: 'pcs',
        status: i % 3 === 0 ? 'ok' : i % 3 === 1 ? 'tidak' : '', ket: i % 3 === 1 ? 'kurang 1' : '',
      })),
    ],
  };
  //  PNG 1x1 hitam sebagai tanda tangan.
  dok.penanda[0] = { label: 'Diserahkan oleh', nama: 'Budi Santoso', ttd: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' };
  dok.penanda[2] = { label: 'Diterima oleh', nama: 'Sari', ttd: 'data:image/png;base64,rusak' };
  let galatGambar = '';
  const hasil = await buat(d => { try { gambarChecklist(d as unknown as DokCek, dok, { dicetak: 'Dicetak 29 Oktober 2026 oleh Uji' }); } catch (e) { galatGambar = String(e); } }, { bufferPages: true });
  cek('gambar tanpa galat (ttd rusak diabaikan)', !galatGambar, galatGambar);
  const baca = await potongPdf(hasil);
  const semua = baca.teks.join('\n');
  cek(`lebih dari 1 halaman (${baca.teks.length})`, baca.teks.length > 1);
  cek('kaki "Halaman 1 dari N" di tiap halaman', baca.teks.every((t, i) => t.includes(`Halaman ${i + 1} dari ${baca.teks.length}`)));
  cek('kepala dokumen', semua.includes('Checklist Barang Kirim') && semua.includes('SJ-123') && semua.includes('29 Oktober 2026') && semua.includes('PT Contoh Sejahtera'));
  cek('barang pertama & terakhir ada', semua.includes('Barang ke-1 ') && semua.includes('Barang ke-70'));
  cek('kepala tabel diulang di halaman lanjutan', baca.teks.slice(1).every(t => t.includes('Nama Barang') || !t.includes('Barang ke-')));
  const rk = ringkas(dok.items);
  cek('ringkasan 70 = 24 sesuai / 23 tidak / 23 belum (kelompok tidak dihitung)', rk.total === 70 && rk.ok === 24 && rk.tidak === 23 && rk.belum === 23, rk);
  cek('ubin ringkasan di halaman 1', ['TOTAL ITEM', 'SESUAI / ADA', 'TIDAK SESUAI', 'BELUM DICEK'].every(l => baca.teks[0].includes(l)));
  cek('catatan & penanda tangan', semua.includes('Kekurangan 1 bracket') && semua.includes('Budi Santoso') && semua.includes('Diperiksa oleh') && semua.includes('Sari'));
  cek('dicetak oleh di kaki', semua.includes('Dicetak 29 Oktober 2026 oleh Uji'));
  const kosong = await buat(d => gambarChecklist(d as unknown as DokCek, dokBaru('2026-10-29')), { bufferPages: true });
  cek('dokumen tanpa barang tetap jadi PDF', (await potongPdf(kosong)).teks[0].includes('Belum ada barang'));
  if (process.env.SIMPAN_PDF) writeFileSync(process.env.SIMPAN_PDF, hasil);

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})();
