import ExcelJS from 'exceljs';
import { bagianBoq, FORMAT_RP, GAYA_BOQ as G, infoBoq, judulBoq, KOLOM_BOQ, lebarPx, ptPx } from './boq';
import { dokRuang, jumlahRuang, namaRuangKe } from './ruang';
import { WARNA } from './gaya';
import type { DokSLD } from './tipe';
import { barisKoneksi, barisPerangkat } from './turunan';

export interface GambarExcel { data: string; ext: 'png' | 'jpeg'; w: number; h: number }
export interface MasukanExcel { dok: DokSLD; simple?: boolean; lembar1?: (GambarExcel | undefined)[]; gambar?: Map<string, GambarExcel> }

const KERTAS_A3 = 8 as unknown as ExcelJS.PaperSize;
const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;
const isi = (hex: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } });
const garis = (hex: string): Partial<ExcelJS.Borders> => {
  const s = { style: 'thin' as const, color: { argb: argb(hex) } };
  return { top: s, left: s, bottom: s, right: s };
};
const huruf = (o: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: G.huruf, size: G.ukuran, ...o });

function lembarGambar(wb: ExcelJS.Workbook, nama: string, g: GambarExcel) {
  const ws = wb.addWorksheet(nama, {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', paperSize: KERTAS_A3, fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.2, right: 0.2, top: 0.2, bottom: 0.2, header: 0, footer: 0 } },
  });
  const lebar = 1400, tinggi = Math.round((lebar * g.h) / g.w);
  ws.addImage(wb.addImage({ base64: g.data, extension: g.ext }), { tl: { col: 0, row: 0 }, ext: { width: lebar, height: tinggi }, editAs: 'oneCell' });
}

function lembarTabel(wb: ExcelJS.Workbook, d: DokSLD, nama: string) {
  const ws = wb.addWorksheet(nama, { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', paperSize: KERTAS_A3, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [{ width: 6 }, { width: 34 }, { width: 34 }, { width: 24 }, { width: 32 }, { width: 38 }];
  const kecil = (o: Partial<ExcelJS.Font> = {}) => huruf({ size: 9, color: { argb: argb(WARNA.tinta) }, ...o });
  let r = 1;
  const judul = (t: string) => { ws.getCell(r, 1).value = t; ws.getCell(r, 1).font = kecil({ bold: true, size: 11 }); r++; };
  const tabel = (kepala: string[], data: string[][]) => {
    kepala.forEach((k, i) => Object.assign(ws.getCell(r, i + 1), { value: k, font: kecil({ bold: true }), fill: isi(WARNA.isiKepala), border: garis(WARNA.garisTabel) }));
    r++;
    data.forEach((b, j) => {
      b.forEach((v, i) => Object.assign(ws.getCell(r, i + 1), {
        value: v, font: kecil({ bold: i === 0 }), border: garis(WARNA.garisTabel), alignment: { vertical: 'top', wrapText: true },
        ...(j % 2 ? { fill: isi(WARNA.isiSelang) } : {}),
      }));
      r++;
    });
    r++;
  };
  ws.getCell(r, 1).value = `SINGLE LINE DIAGRAM - ${[d.blok.proyek, d.blok.lokasi, d.namaRuang].filter(Boolean).join(' - ')}`;
  ws.getCell(r, 1).font = kecil({ bold: true, size: 13 });
  r += 2;
  judul('DAFTAR KONEKSI (K = sinyal / kontrol, P = catu daya)');
  tabel(['No', 'Dari (perangkat · port)', 'Ke (perangkat · port)', 'Kabel / media', 'Fungsi', 'Catatan'], barisKoneksi(d).map(k => [k.kode, k.dari, k.ke, k.media, k.fungsi, k.catatan]));
  judul('DAFTAR PERANGKAT (No. = item BOM)');
  tabel(['No', 'Kategori', 'Merek / model', 'Qty'], barisPerangkat(d).map(p => [p.no, p.kategori, p.model, p.qty]));
  if (d.catatan.length) {
    judul('CATATAN PEMASANGAN');
    d.catatan.forEach((c, i) => {
      ws.mergeCells(r, 2, r, 6);
      Object.assign(ws.getCell(r, 1), { value: `${i + 1}.`, font: kecil() });
      Object.assign(ws.getCell(r, 2), { value: [c.judul, c.isi].filter(Boolean).join(' - '), font: kecil(), alignment: { vertical: 'top', wrapText: true } });
      r++;
    });
  }
}

function lembarBoq(wb: ExcelJS.Workbook, d: DokSLD, gambar?: Map<string, GambarExcel>) {
  const bagian = bagianBoq(d), akhir = 5 + bagian.reduce((t, b) => t + 1 + b.baris.length, 0);
  const ws = wb.addWorksheet('Sheet 3 - BOQ', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 6, topLeftCell: 'A7', showGridLines: false, zoomScale: 70 }],
    pageSetup: {
      orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '6:6', printArea: `A1:K${Math.max(7, akhir)}`,
      margins: { left: 0.75, right: 0.75, top: 1, bottom: 1, header: 0.3, footer: 0.3 },
    },
  });
  ws.columns = KOLOM_BOQ.map(k => ({ width: k.lebar }));
  Object.assign(ws.getCell('A1'), { value: judulBoq(d), font: huruf({ size: G.ukuranJudul, bold: true, color: { argb: argb(G.navy) } }) });
  ws.getRow(1).height = G.tinggiJudul;
  infoBoq(d).forEach(([l, v], i) => {
    const r = i + 2;
    ws.mergeCells(`A${r}:B${r}`); ws.mergeCells(`C${r}:G${r}`);
    Object.assign(ws.getCell(`A${r}`), { value: l, font: huruf({ bold: true }) });
    Object.assign(ws.getCell(`C${r}`), { value: v, font: huruf({ color: { argb: argb(i === 2 ? G.biru : G.hitam) } }) });
  });
  KOLOM_BOQ.forEach((k, i) => Object.assign(ws.getCell(6, i + 1), {
    value: k.judul, font: huruf({ bold: true, color: { argb: argb(G.putih) } }), fill: isi(G.navy), border: garis(G.garis),
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  }));
  ws.getRow(6).height = G.tinggiKepala;
  let r = 7;
  for (const bg of bagian) {
    ws.mergeCells(`A${r}:K${r}`);
    Object.assign(ws.getCell(`A${r}`), { value: bg.judul, font: huruf({ bold: true, color: { argb: argb(G.navy) } }), fill: isi(G.seksi), border: garis(G.garis) });
    r++;
    for (const b of bg.baris) {
      const nilai: (string | number | null)[] = [Number(b.no) || b.no, null, b.kategori, b.merek, b.model, b.spek, b.fungsi, b.qty, b.satuan, null];
      nilai.forEach((v, c) => Object.assign(ws.getCell(r, c + 1), {
        value: v, border: garis(G.garis), font: huruf({ bold: c === 4, ...(c === 7 || c === 9 ? { color: { argb: argb(G.biru) } } : {}) }),
        alignment: { vertical: 'top', wrapText: true, ...([0, 7, 8].includes(c) ? { horizontal: 'center' as const } : {}) },
        ...(c === 9 ? { fill: isi(G.harga), numFmt: FORMAT_RP } : {}),
      }));
      Object.assign(ws.getCell(r, 11), { value: { formula: `H${r}*J${r}`, result: 0 }, numFmt: FORMAT_RP, border: garis(G.garis), font: huruf(), alignment: { vertical: 'top', wrapText: true } });
      ws.getRow(r).height = G.tinggiBaris;
      const g = gambar?.get(b.contoh.id);
      if (g) {
        const k = Math.min(G.gambar.w / g.w, G.gambar.h / g.h), w = Math.round(g.w * k), h = Math.round(g.h * k);
        const x = G.gambar.x + (G.gambar.w - w) / 2, y = G.gambar.y + (G.gambar.h - h) / 2;
        ws.addImage(wb.addImage({ base64: g.data, extension: g.ext }), {
          tl: { col: 1 + x / lebarPx(KOLOM_BOQ[1].lebar), row: r - 1 + y / ptPx(G.tinggiBaris) }, ext: { width: w, height: h }, editAs: 'oneCell',
        });
      }
      r++;
    }
  }
}

const namaLembar = (s: string, pakai: Set<string>) => {
  const dasar = s.replace(/[\\/?*[\]:]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet';
  let n = dasar, i = 2;
  while (pakai.has(n.toLowerCase())) n = `${dasar.slice(0, 28)} ${i++}`;
  pakai.add(n.toLowerCase());
  return n;
};

export async function bukuExcel(m: MasukanExcel): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AV Solution Tools';
  wb.created = new Date();
  const n = jumlahRuang(m.dok), pakai = new Set<string>();
  const nama = (lembar: string, i: number) => namaLembar(n === 1 ? lembar : `R${i + 1} ${lembar.replace(/ - .*/, '')} - ${namaRuangKe(m.dok, i)}`, pakai);
  for (let i = 0; i < n; i++) {
    const g = m.lembar1?.[i];
    if (g) lembarGambar(wb, nama('Sheet 1 - Diagram', i), g);
    if (!m.simple && !m.dok.tanpaKoneksi) lembarTabel(wb, dokRuang(m.dok, i), nama('Sheet 2 - Koneksi', i));
  }
  if (!m.simple) lembarBoq(wb, m.dok, m.gambar);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
