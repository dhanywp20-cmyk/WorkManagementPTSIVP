import { StatusCek, DokChecklist, MAKS_PENANDA, ringkas, tglIndo } from './barang';

export interface DokCek {
  page: { width: number; height: number };
  font(n: string): DokCek; fontSize(s: number): DokCek; fillColor(c: string): DokCek; strokeColor(c: string): DokCek;
  lineWidth(w: number): DokCek; lineCap(c: string): DokCek; lineJoin(c: string): DokCek;
  text(t: string, x: number, y: number, o?: object): DokCek;
  heightOfString(t: string, o?: object): number; widthOfString(t: string, o?: object): number;
  rect(x: number, y: number, w: number, h: number): DokCek; roundedRect(x: number, y: number, w: number, h: number, r: number): DokCek;
  fill(c?: string): DokCek; stroke(c?: string): DokCek;
  moveTo(x: number, y: number): DokCek; lineTo(x: number, y: number): DokCek;
  image(src: string, x: number, y: number, o?: object): DokCek;
  addPage(): DokCek; switchToPage(n: number): DokCek; bufferedPageRange(): { start: number; count: number };
}

export const W = {
  navy: '#0f2a4a', biru: '#1d4ed8', eyebrow: '#93c5fd', putih: '#ffffff', teks: '#1e293b', redup: '#64748b',
  garis: '#d7dee7', zebra: '#f6f8fb', kepala: '#e8eef6', grup: '#eef2f7', hijau: '#15803d', merah: '#b91c1c', abu: '#94a3b8',
};

export const M = 36, PAD = 5, BAWAH = 44;

export function kotakCek(doc: DokCek, x: number, y: number, s: number, st: StatusCek) {
  if (!st) { doc.lineWidth(0.8).roundedRect(x, y, s, s, 2).stroke(W.abu); return; }
  doc.roundedRect(x, y, s, s, 2).fill(st === 'ok' ? W.hijau : W.merah);
  doc.lineWidth(1.4).lineCap('round').lineJoin('round').strokeColor(W.putih);
  if (st === 'ok') doc.moveTo(x + s * 0.24, y + s * 0.53).lineTo(x + s * 0.43, y + s * 0.72).lineTo(x + s * 0.78, y + s * 0.3).stroke();
  else doc.moveTo(x + s * 0.28, y + s * 0.28).lineTo(x + s * 0.72, y + s * 0.72).moveTo(x + s * 0.72, y + s * 0.28).lineTo(x + s * 0.28, y + s * 0.72).stroke();
  doc.lineCap('butt').lineJoin('miter');
}

export interface Kolom { k: 'no' | 'nama' | 'qty' | 'satuan' | 'cek' | 'ket'; l: string; w: number; rata?: 'center' | 'right' }

export interface OpsiPdf {  dicetak?: string }

export function gambarChecklist(doc: DokCek, d: DokChecklist, o: OpsiPdf = {}) {
  const PW = doc.page.width, PH = doc.page.height, CW = PW - 2 * M;
  const judul = d.judul.trim() || 'Checklist Barang';
  const r = ringkas(d.items);

  const kol: Kolom[] = [
    { k: 'no', l: 'No', w: 26, rata: 'center' },
    { k: 'nama', l: 'Nama Barang', w: 0 },
    { k: 'qty', l: 'Qty', w: 38, rata: 'center' },
    { k: 'satuan', l: 'Satuan', w: 46, rata: 'center' },
    { k: 'cek', l: 'Cek', w: 34, rata: 'center' },
    { k: 'ket', l: 'Keterangan', w: 118 },
  ];
  kol[1].w = CW - kol.reduce((s, k) => s + k.w, 0);
  const xKol = kol.map((_, i) => M + kol.slice(0, i).reduce((s, k) => s + k.w, 0));

  let y = 0;

  doc.rect(0, 0, PW, 84).fill(W.navy);
  doc.font('SansBold').fontSize(7.5).fillColor(W.eyebrow).text('CHECKLIST BARANG', M, 22, { characterSpacing: 1.2, lineBreak: false });
  const lebarJudul = CW - 170;
  doc.font('SansBold').fontSize(16);
  const hJudul = Math.min(doc.heightOfString(judul, { width: lebarJudul }), 40);
  doc.fillColor(W.putih).text(judul, M, 34, { width: lebarJudul, height: 40, ellipsis: true });
  const kanan = [['No. Dokumen', d.nomor || '-'], ['Tanggal', tglIndo(d.tanggal) || '-']];
  kanan.forEach(([l, v], i) => {
    doc.font('Sans').fontSize(7).fillColor(W.eyebrow).text(l.toUpperCase(), PW - M - 160, 22 + i * 26, { width: 160, align: 'right', lineBreak: false });
    doc.font('SansBold').fontSize(9.5).fillColor(W.putih).text(v, PW - M - 160, 31 + i * 26, { width: 160, align: 'right', height: 12, ellipsis: true });
  });
  y = Math.max(84, 34 + hJudul + 12) + 14;

  const info = [['Project / Customer', d.project], ['Lokasi', d.lokasi]].filter(([, v]) => v.trim());
  if (info.length) {
    const w = CW / info.length;
    let tinggi = 0;
    info.forEach(([l, v], i) => {
      doc.font('Sans').fontSize(7).fillColor(W.redup).text(l.toUpperCase(), M + i * w, y, { width: w - 10, characterSpacing: 0.6, lineBreak: false });
      doc.font('SansBold').fontSize(10).fillColor(W.teks).text(v, M + i * w, y + 10, { width: w - 10 });
      tinggi = Math.max(tinggi, 10 + doc.heightOfString(v, { width: w - 10 }));
    });
    y += tinggi + 12;
  }

  const ubin: [string, number, string][] = [['Total item', r.total, W.teks], ['Sesuai / ada', r.ok, W.hijau], ['Tidak sesuai', r.tidak, W.merah], ['Belum dicek', r.belum, W.redup]];
  const wu = (CW - 3 * 8) / 4;
  ubin.forEach(([l, n, c], i) => {
    const x = M + i * (wu + 8);
    doc.lineWidth(0.8).roundedRect(x, y, wu, 36, 5).fill(W.zebra);
    doc.font('Sans').fontSize(7).fillColor(W.redup).text(l.toUpperCase(), x + 9, y + 7, { width: wu - 18, lineBreak: false });
    doc.font('SansBold').fontSize(13).fillColor(c).text(String(n), x + 9, y + 17, { width: wu - 18, lineBreak: false });
  });
  y += 36 + 14;

  const kepalaTabel = () => {
    doc.rect(M, y, CW, 20).fill(W.kepala);
    kol.forEach((k, i) => doc.font('SansBold').fontSize(8).fillColor(W.teks)
      .text(k.l, xKol[i] + PAD, y + 6.5, { width: k.w - 2 * PAD, align: k.rata ?? 'left', lineBreak: false }));
    y += 20;
  };
  const halamanBaru = () => {
    doc.addPage();
    y = M;
    doc.font('SansBold').fontSize(10).fillColor(W.teks).text(judul, M, y, { width: CW - 120, lineBreak: false, ellipsis: true });
    doc.font('Sans').fontSize(8).fillColor(W.redup).text('(lanjutan)', PW - M - 120, y + 1.5, { width: 120, align: 'right', lineBreak: false });
    y += 22;
  };
  const batas = () => PH - BAWAH;

  kepalaTabel();
  let no = 0, zebra = false;
  const wNama = kol[1].w - 2 * PAD, wKet = kol[5].w - 2 * PAD;
  if (!d.items.length) {
    doc.font('Sans').fontSize(9).fillColor(W.redup).text('Belum ada barang.', M + PAD, y + 8, { width: CW - 2 * PAD });
    y += 26;
  }
  d.items.forEach(it => {
    if (it.grup) {
      doc.font('SansBold').fontSize(8.5);
      const h = doc.heightOfString(it.nama, { width: CW - 2 * PAD }) + 2 * PAD + 2;
      if (y + h + 24 > batas()) { halamanBaru(); kepalaTabel(); }
      doc.rect(M, y, CW, h).fill(W.grup);
      doc.font('SansBold').fontSize(8.5).fillColor(W.navy).text(it.nama, M + PAD, y + PAD + 1, { width: CW - 2 * PAD });
      y += h;
      zebra = false;
      return;
    }
    no++;
    doc.font('Sans').fontSize(8.5);
    const hNama = doc.heightOfString(it.nama || '-', { width: wNama });
    doc.font('Sans').fontSize(7);
    const hSpek = it.spek ? doc.heightOfString(it.spek, { width: wNama }) + 1.5 : 0;
    doc.font('Sans').fontSize(8);
    const hKet = it.ket ? doc.heightOfString(it.ket, { width: wKet }) : 0;
    const h = Math.max(20, Math.max(hNama + hSpek, hKet, 10) + 2 * PAD + 1);
    if (y + h > batas()) { halamanBaru(); kepalaTabel(); zebra = false; }
    if (zebra) doc.rect(M, y, CW, h).fill(W.zebra);
    zebra = !zebra;
    const ty = y + PAD + 1;
    doc.font('Sans').fontSize(8.5).fillColor(W.redup).text(String(no), xKol[0] + PAD, ty, { width: kol[0].w - 2 * PAD, align: 'center', lineBreak: false });
    doc.font('Sans').fontSize(8.5).fillColor(W.teks).text(it.nama || '-', xKol[1] + PAD, ty, { width: wNama });
    if (it.spek) doc.font('Sans').fontSize(7).fillColor(W.redup).text(it.spek, xKol[1] + PAD, ty + hNama + 1.5, { width: wNama });
    doc.font('Sans').fontSize(8.5).fillColor(W.teks).text(it.qty || '-', xKol[2] + PAD, ty, { width: kol[2].w - 2 * PAD, align: 'center', lineBreak: false, ellipsis: true });
    doc.font('Sans').fontSize(8).fillColor(W.teks).text(it.satuan || '-', xKol[3] + PAD, ty + 0.5, { width: kol[3].w - 2 * PAD, align: 'center', lineBreak: false, ellipsis: true });
    kotakCek(doc, xKol[4] + (kol[4].w - 11) / 2, y + Math.min(PAD + 0.5, (h - 11) / 2), 11, it.status);
    if (it.ket) doc.font('Sans').fontSize(8).fillColor(it.status === 'tidak' ? W.merah : W.teks).text(it.ket, xKol[5] + PAD, ty + 0.5, { width: wKet });
    doc.lineWidth(0.5).moveTo(M, y + h).lineTo(M + CW, y + h).stroke(W.garis);
    y += h;
  });

  y += 8;
  if (y + 14 > batas()) halamanBaru();
  let lx = M;
  doc.font('Sans').fontSize(7.5).fillColor(W.redup).text('Keterangan cek:', lx, y + 1, { lineBreak: false });
  lx += doc.widthOfString('Keterangan cek:') + 8;
  ([['ok', 'sesuai / ada'], ['tidak', 'tidak sesuai / tidak ada'], ['', 'belum dicek']] as [StatusCek, string][]).forEach(([st, l]) => {
    kotakCek(doc, lx, y, 9, st);
    doc.font('Sans').fontSize(7.5).fillColor(W.redup).text(l, lx + 13, y + 1, { lineBreak: false });
    lx += 13 + doc.widthOfString(l) + 14;
  });
  y += 20;

  const catatan = d.catatan.trim();
  if (catatan) {
    doc.font('Sans').fontSize(8.5);
    const h = doc.heightOfString(catatan, { width: CW - 20 }) + 24;
    if (y + Math.min(h, 80) > batas()) halamanBaru();
    doc.lineWidth(0.8).roundedRect(M, y, CW, h, 5).stroke(W.garis);
    doc.font('SansBold').fontSize(7).fillColor(W.redup).text('CATATAN', M + 10, y + 7, { characterSpacing: 0.6, lineBreak: false });
    doc.font('Sans').fontSize(8.5).fillColor(W.teks).text(catatan, M + 10, y + 17, { width: CW - 20 });
    y += h + 14;
  }

  const pen = d.penanda.slice(0, MAKS_PENANDA);
  if (pen.length) {
    const T = 112;
    if (y + T > batas()) halamanBaru();
    y += 6;
    const w = CW / pen.length;
    pen.forEach((p, i) => {
      const x = M + i * w;
      doc.font('Sans').fontSize(8.5).fillColor(W.teks).text(p.label || '', x + 6, y, { width: w - 12, align: 'center', height: 12, ellipsis: true });
      if (/^data:image\/(png|jpeg);base64,/.test(p.ttd)) {
        try { doc.image(p.ttd, x + 18, y + 16, { fit: [w - 36, 58], align: 'center', valign: 'center' }); } catch {  }
      }
      doc.lineWidth(0.7).moveTo(x + 18, y + 80).lineTo(x + w - 18, y + 80).stroke(W.teks);
      doc.font('SansBold').fontSize(8.5).fillColor(W.teks).text(p.nama.trim() ? p.nama.trim() : '', x + 6, y + 84, { width: w - 12, align: 'center', height: 12, ellipsis: true });
    });
    y += T;
  }

  const { start, count } = doc.bufferedPageRange();
  for (let i = 0; i < count; i++) {
    doc.switchToPage(start + i);
    doc.lineWidth(0.5).moveTo(M, PH - 30).lineTo(PW - M, PH - 30).stroke(W.garis);
    doc.font('Sans').fontSize(7).fillColor(W.redup).text(o.dicetak ?? judul, M, PH - 24, { width: CW - 90, lineBreak: false, ellipsis: true });
    doc.font('Sans').fontSize(7).fillColor(W.redup).text(`Halaman ${i + 1} dari ${count}`, PW - M - 90, PH - 24, { width: 90, align: 'right', lineBreak: false });
  }
}
