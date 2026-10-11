/**
 * lib/perbandingan-pdf.ts - Menggambar PDF Product Comparison dengan pdfkit, mengikuti template baku owner
 * ("LG 22SM3G-B vs DigiSIGN DSN-LAD-015 Comparison (EN).pdf"): ukuran, warna & jarak diukur dari PDF itu
 * (A4, margin 16 mm, Liberation Sans ≈ Arimo, ✓ DejaVu Sans Bold). Tanpa footer.
 *
 * Dipakai peramban (pdfkit standalone) & tes Node (pdfkit) - huruf didaftarkan pemanggil dengan nama
 * 'Sans', 'SansBold', 'SansItalic', 'Centang'.
 */
import { type KartuBanding, LABEL, type NilaiSpek, teksNilai } from './perbandingan';
import { type BarisTeks, type DokPdf, gambarBaris, type Potong, potongKaya, tataBaris } from './perbandingan-teks';

/** Bagian pdfkit yang dipakai untuk bentuk. */
export interface DokPenuh extends DokPdf {
  page: { width: number; height: number };
  addPage(): DokPenuh; rect(x: number, y: number, w: number, h: number): DokPenuh;
  roundedRect(x: number, y: number, w: number, h: number, r: number): DokPenuh;
  fill(c?: string | object): DokPenuh; stroke(c?: string): DokPenuh; lineWidth(w: number): DokPenuh; strokeColor(c: string): DokPenuh;
  moveTo(x: number, y: number): DokPenuh; lineTo(x: number, y: number): DokPenuh;
  linearGradient(x1: number, y1: number, x2: number, y2: number): { stop(o: number, c: string): unknown };
}

const ML = 45.68, CW = 503.92, MT = 45.4, MB = 34;
const W = {
  navyGelap: '#0a1f38', navyTerang: '#1b4972', eyebrow: '#7fd0ff', putih: '#ffffff', pengantar: '#c6d6e6',
  merah: '#c80f2d', merahTeks: '#a80f28', judul: '#14202c', label: '#253444', isi: '#1c2733', abu: '#a4acb8', hijau: '#16803c',
  kepalaSpek: '#131f2b', kepalaLain: '#3a4656', zebra: '#f4f6f9', unggul0: '#fdf0f2', unggul1: '#fbe6e8', garis: '#e6e9ed', lencana: '#163b5d',
  kartuUnggul: '#fdf4f6', tepiUnggul: '#efd3d8', kartuLain: '#f6f9fb', tepiLain: '#e1e6eb', bilahLain: '#9aa5b1',
  merekUnggul: '#c8102e', merekLain: '#8b93a0', ketKartu: '#4c5867', ringkasLatar: '#fff8f8', ringkasTeks: '#33404d', sorotTeks: '#47535f',
  rekomLatar: '#131f2b', rekomMerah: '#ff8a9b', catatan: '#9aa4b0', cek: '#b45309',
};

const tinggiTeks = (b: BarisTeks[], lh: number) => Math.max(1, b.length) * lh;

/** Potongan sel nilai sesuai gaya template. */
function potongNilai(n: NilaiSpek, kolom: number, bahasa: KartuBanding['bahasa']): Potong[] {
  const t = teksNilai(n, bahasa);
  if (n.status === 'tidak-disebut') return [{ t, f: 'SansItalic', c: W.abu }];
  if (n.status === 'cek') return [{ t, f: 'Sans', c: W.cek }];
  if (n.unggul) return [{ t, f: 'SansBold', c: kolom === 0 ? W.merahTeks : W.isi }, { t: ' ✓', f: 'Centang', c: W.hijau }];
  return [{ t, f: 'Sans', c: W.isi }];
}

export function gambarPerbandingan(doc: DokPenuh, k: KartuBanding) {
  const L = LABEL[k.bahasa];
  const bawah = () => doc.page.height - MB;
  let y = 51;

  // ── Header ──
  const lebarPengantar = 440;
  const bJudul = tataBaris(doc, [{ t: k.judul, f: 'SansBold', c: W.putih }], CW - 36, 18.5);
  const bPengantar = tataBaris(doc, [{ t: k.pengantar, f: 'Sans', c: W.pengantar }], lebarPengantar, 8.6);
  const tHeader = 15 + 11 + 5 + tinggiTeks(bJudul, 23) + 4 + (k.pengantar ? tinggiTeks(bPengantar, 13.4) : 0) + 18;
  const gr = doc.linearGradient(ML, y, ML + CW, y + tHeader);
  gr.stop(0, W.navyGelap); gr.stop(1, W.navyTerang);
  doc.roundedRect(ML, y, CW, tHeader, 7).fill(gr);
  let cy = y + 15;
  gambarBaris(doc, tataBaris(doc, [{ t: k.kategori.toUpperCase(), f: 'SansBold', c: W.eyebrow }], CW - 36, 8.3, 1), ML + 18, cy, 8.3, 11, { jarak: 1 });
  cy += 16;
  gambarBaris(doc, bJudul, ML + 18, cy, 18.5, 23); cy += tinggiTeks(bJudul, 23) + 4;
  if (k.pengantar) gambarBaris(doc, bPengantar, ML + 18, cy, 8.6, 13.4);
  y += tHeader + 7.7;

  // ── Kartu produk (indeks 0 = RECOMMENDED) ──
  const n = k.produk.length, jarakK = 9, wK = (CW - jarakK * (n - 1)) / n, pad = 11.2;
  const isiKartu = k.produk.map((p, i) => ({
    merek: tataBaris(doc, [{ t: p.merek.toUpperCase(), f: 'SansBold', c: i === 0 ? W.merekUnggul : W.merekLain }], wK - pad * 2 - (i === 0 ? 74 : 0), 7.6, 0.9),
    judul: tataBaris(doc, [{ t: p.judulKartu || p.nama, f: 'SansBold', c: W.judul }], wK - pad * 2, 12),
    ket: tataBaris(doc, [{ t: p.deskripsi, f: 'Sans', c: W.ketKartu }], wK - pad * 2, 8),
  }));
  const tKartu = Math.max(...isiKartu.map(c => 13 + tinggiTeks(c.merek, 11) + 4 + tinggiTeks(c.judul, 15) + 4 + (c.ket.length ? tinggiTeks(c.ket, 12.2) : 0) + 12));
  isiKartu.forEach((c, i) => {
    const x = ML + i * (wK + jarakK), unggul = i === 0;
    doc.roundedRect(x, y, wK, tKartu, 5).fill(unggul ? W.tepiUnggul : W.bilahLain);
    doc.roundedRect(x, y + 3, wK, tKartu - 3, 5).fill(unggul ? W.kartuUnggul : W.kartuLain);
    doc.lineWidth(0.75).roundedRect(x + 0.4, y + 0.4, wK - 0.8, tKartu - 0.8, 5).stroke(unggul ? W.tepiUnggul : W.tepiLain);
    let ky = y + 13;
    gambarBaris(doc, c.merek, x + pad, ky, 7.6, 11, { jarak: 0.9 });
    if (unggul) {
      doc.font('SansBold').fontSize(6.6);
      const wPil = doc.widthOfString(L.rekomendasiPil, { characterSpacing: 0.5 }) + 14;
      doc.roundedRect(x + wK - pad - wPil, ky - 1, wPil, 13.3, 6.6).fill(W.merah);
      doc.fillColor(W.putih).text(L.rekomendasiPil, x + wK - pad - wPil + 7, ky + 2.4, { lineBreak: false, characterSpacing: 0.5 });
    }
    ky += tinggiTeks(c.merek, 11) + 4;
    gambarBaris(doc, c.judul, x + pad, ky, 12, 15); ky += tinggiTeks(c.judul, 15) + 4;
    gambarBaris(doc, c.ket, x + pad, ky, 8, 12.2);
  });
  y += tKartu + 13.2;

  // ── Bagian bernomor + tabel ──
  const wSpek = CW * 0.3, wNilai = (CW - wSpek) / n;
  const xKolom = (j: number) => (j < 0 ? ML : ML + wSpek + j * wNilai);
  //  Kepala tabel: satu baris setinggi 20 pt seperti template; nama produk panjang (3-4 kolom) boleh 2-3 baris.
  const isiKepala = [tataBaris(doc, [{ t: L.spesifikasi, f: 'SansBold', c: W.putih }], wSpek - 13.4, 7.6, 0.6),
    ...k.produk.map(p => tataBaris(doc, [{ t: p.nama.toUpperCase(), f: 'SansBold', c: W.putih }], wNilai - 13.4, 7.6, 0.6).slice(0, 3))];
  const barisKepala = Math.max(...isiKepala.map(b => b.length));
  const tKepala = barisKepala > 1 ? barisKepala * 9.6 + 10.4 : 20;
  const kepala = () => {
    doc.rect(ML, y, wSpek, tKepala).fill(W.kepalaSpek);
    k.produk.forEach((_, j) => doc.rect(xKolom(j), y, wNilai, tKepala).fill(j === 0 ? W.merah : W.kepalaLain));
    isiKepala.forEach((b, j) => gambarBaris(doc, b, xKolom(j - 1) + 6.7, y + (tKepala - b.length * (barisKepala > 1 ? 9.6 : 20)) / 2, 7.6, barisKepala > 1 ? 9.6 : 20, { jarak: 0.6 }));
    y += tKepala;
  };
  k.bagian.forEach((bg, bi) => {
    const baris = bg.baris.map(r => {
      const sel = [tataBaris(doc, [{ t: r.spesifikasi, f: 'SansBold', c: W.label }], wSpek - 13.4, 8.4),
        ...r.nilai.map((v, j) => tataBaris(doc, potongNilai(v, j, k.bahasa), wNilai - 13.4, 8.4))];
      return { sel, h: Math.max(...sel.map(s => s.length)) * 12.4 + 8.8 };
    });
    //  Judul bagian tidak boleh tertinggal sendirian di bawah halaman.
    if (y + 19.2 + tKepala + (baris[0]?.h ?? 21) > bawah()) { doc.addPage(); y = MT; }
    doc.roundedRect(ML, y, 13.5, 13.5, 3).fill(W.lencana);
    gambarBaris(doc, tataBaris(doc, [{ t: String(bi + 1), f: 'SansBold', c: W.putih }], 13.5, 8.3), ML, y, 8.3, 13.5, { tengah: 13.5 });
    gambarBaris(doc, tataBaris(doc, [{ t: bg.judul, f: 'SansBold', c: W.judul }], CW - 20, 11).slice(0, 1), ML + 19.5, y, 11, 13.5);
    y += 19.2;
    kepala();
    baris.forEach((r, i) => {
      if (y + r.h > bawah()) { doc.addPage(); y = MT; kepala(); i = 0; }
      const genap = i % 2 === 1;
      doc.rect(ML, y, wSpek, r.h).fill(genap ? W.zebra : W.putih);
      k.produk.forEach((_, j) => doc.rect(xKolom(j), y, wNilai, r.h).fill(j === 0 ? (genap ? W.unggul1 : W.unggul0) : genap ? W.zebra : W.putih));
      if (i > 0) doc.lineWidth(0.75).moveTo(ML, y).lineTo(ML + CW, y).stroke(W.garis);
      r.sel.forEach((s, j) => gambarBaris(doc, s, xKolom(j - 1) + 6.7, y + 4.4, 8.4, 12.4));
      y += r.h;
    });
    doc.lineWidth(0.75).moveTo(ML, y).lineTo(ML + CW, y).stroke(W.garis);
    y += 13.6;
  });

  // ── Ringkasan & rekomendasi ──
  const pd = 13.1, wIsi = CW - pd * 2;
  const bRingkas = tataBaris(doc, potongKaya(k.ringkasan, 'Sans', W.ringkasTeks), wIsi, 8.7);
  const ns = k.sorotan.length, jarakS = 7.5, wS = ns ? (wIsi - jarakS * (ns - 1)) / ns : 0;
  const sorot = k.sorotan.map(s => ({
    judul: tataBaris(doc, [{ t: s.judul, f: 'SansBold', c: W.merahTeks }], wS - 16.6, 8.2),
    teks: tataBaris(doc, [{ t: s.teks, f: 'Sans', c: W.sorotTeks }], wS - 16.6, 7.7),
  }));
  const tSorot = ns ? Math.max(...sorot.map(s => 8.3 + tinggiTeks(s.judul, 11) + 3 + tinggiTeks(s.teks, 11.2) + 8.3)) : 0;
  const bRekom = tataBaris(doc, [{ t: L.rekomendasi, f: 'SansBold', c: W.rekomMerah }, ...potongKaya(` ${k.rekomendasi}`, 'Sans', W.putih, 'SansBold', W.rekomMerah)], wIsi - 18, 8.4);
  const bCatatan = k.catatan ? tataBaris(doc, [{ t: `${L.catatan} ${k.catatan}`, f: 'Sans', c: W.catatan }], wIsi, 7) : [];
  const tRekom = tinggiTeks(bRekom, 13) + 14;
  const tRingkas = pd + 16 + 6 + tinggiTeks(bRingkas, 13.7) + (ns ? 9 + tSorot : 0) + 7.5 + tRekom + (bCatatan.length ? 7 + tinggiTeks(bCatatan, 10.4) : 0) + 13;
  if (y + tRingkas > bawah()) { doc.addPage(); y = MT; }
  doc.lineWidth(1.2).roundedRect(ML + 0.6, y + 0.6, CW - 1.2, tRingkas - 1.2, 6).fill(W.ringkasLatar);
  doc.lineWidth(1.2).roundedRect(ML + 0.6, y + 0.6, CW - 1.2, tRingkas - 1.2, 6).stroke(W.merah);
  let ry = y + pd;
  gambarBaris(doc, tataBaris(doc, [{ t: L.ringkasan, f: 'SansBold', c: W.merahTeks }], wIsi, 12.5), ML + pd, ry, 12.5, 16); ry += 22;
  gambarBaris(doc, bRingkas, ML + pd, ry, 8.7, 13.7); ry += tinggiTeks(bRingkas, 13.7);
  if (ns) {
    ry += 9;
    sorot.forEach((s, i) => {
      const x = ML + pd + i * (wS + jarakS);
      doc.roundedRect(x, ry, wS, tSorot, 4).fill(W.putih);
      doc.lineWidth(0.75).roundedRect(x + 0.4, ry + 0.4, wS - 0.8, tSorot - 0.8, 4).stroke(W.tepiUnggul);
      gambarBaris(doc, s.judul, x + 8.3, ry + 8.3, 8.2, 11);
      gambarBaris(doc, s.teks, x + 8.3, ry + 8.3 + tinggiTeks(s.judul, 11) + 3, 7.7, 11.2);
    });
    ry += tSorot;
  }
  ry += 7.5;
  doc.roundedRect(ML + pd, ry, wIsi, tRekom, 4).fill(W.rekomLatar);
  gambarBaris(doc, bRekom, ML + pd + 9, ry + 7, 8.4, 13); ry += tRekom;
  if (bCatatan.length) gambarBaris(doc, bCatatan, ML + pd, ry + 7, 7, 10.4);
}
