import { isiIkon, viewBoxIkon } from './ikon';
import { dokRuang, jumlahRuang, namaRuangKe } from './ruang';
import { esc } from './teks';
import type { DokSLD, IsiBoqItem, Perangkat } from './tipe';
import { judulKartu, kelompokNo, kunciModel, kunciNama, namaKelompok } from './turunan';

export type IsiBoq = IsiBoqItem;
export type KolomEditBoq = keyof IsiBoqItem;
export interface BarisBoq {
  ruang: number; kunci: string; no: string; kategori: string; merek: string; model: string; spek: string; fungsi: string; qty: number; satuan: string; contoh: Perangkat;
}

export const KOLOM_BOQ = [
  { judul: 'No', lebar: 5 }, { judul: 'Gambar', lebar: 25 }, { judul: 'Kategori', lebar: 14 }, { judul: 'Merek', lebar: 12 },
  { judul: 'Model / Part No.', lebar: 23 }, { judul: 'Spesifikasi Singkat', lebar: 44 }, { judul: 'Fungsi di Solusi', lebar: 34 },
  { judul: 'Qty', lebar: 6 }, { judul: 'Satuan', lebar: 8 }, { judul: 'Harga Satuan (Rp)', lebar: 17 }, { judul: 'Total (Rp)', lebar: 17 },
] as const;

export const GAYA_BOQ = {
  huruf: 'Arial', navy: '1F3864', seksi: 'D9E2F3', harga: 'FFF2CC', garis: 'BFBFBF', biru: '0000FF', hitam: '000000', putih: 'FFFFFF',
  ukuran: 10, ukuranJudul: 14, tinggiJudul: 18, tinggiKepala: 30, tinggiBaris: 84, gambar: { w: 160, h: 100, x: 10, y: 5 },
} as const;

export const SEKSI_BOQ = 'A. PERANGKAT UTAMA (sesuai daftar)';
export const FORMAT_RP = '"Rp "#,##0;\\("Rp "#,##0\\);"-"';
export const SESUAI_PENGADAAN = 'Sesuai pengadaan';
export const lebarPx = (lebar: number) => Math.round(lebar * 7 + 5);
export const ptPx = (pt: number) => Math.round(((pt * 96) / 72) * 100) / 100;
export const LEBAR_BOQ = KOLOM_BOQ.reduce((s, k) => s + lebarPx(k.lebar), 0);

const MEREK = ['WyreStorm', 'Philips', 'TCL', 'CUE', 'NovaStar', 'Elite Screens', 'Screenview', 'Fonestar', 'Sennheiser', 'Shure', 'AVer', 'Netgear', 'ASUS', 'BrightSign',
  'Hikvision', 'Panasonic', 'Epson', 'Pontus', 'Tricolor', 'Samsung', 'LG', 'Sony', 'Crestron', 'Extron', 'Kramer', 'Lightware', 'Bose', 'Yamaha', 'Biamp', 'QSC',
  'Logitech', 'Poly', 'Jabra', 'Ubiquiti', 'Cisco', 'TP-Link', 'APC', 'BenQ', 'ViewSonic', 'Optoma', 'Barco', 'Dell', 'HP', 'Lenovo', 'Intel'];

export function pisahMerek(model: string, nama: string): { merek: string; model: string } {
  const m = model.trim(), sesuai = /\s*\(sesuai pengadaan\)\s*$/i;
  if (!m) return { merek: SESUAI_PENGADAAN, model: judulKartu(nama) };
  if (sesuai.test(m)) return { merek: SESUAI_PENGADAAN, model: m.replace(sesuai, '').trim() };
  const merek = MEREK.find(x => m.toLowerCase().startsWith(`${x.toLowerCase()} `));
  return merek ? { merek, model: m.slice(merek.length).trim() } : { merek: SESUAI_PENGADAAN, model: m };
}

export function barisBoq(d: DokSLD, ruang = 0): BarisBoq[] {
  return [...kelompokNo(d).entries()].map(([no, daftar]) => {
    const p = daftar[0], kunci = kunciModel(p), isi = d.boq?.[kunci] ?? daftar.map(x => d.boq?.[kunciNama(x)]).find(Boolean) ?? {};
    const asal = pisahMerek(p.model, namaKelompok(daftar));
    return {
      ruang, kunci, no, kategori: isi.kategori ?? p.kategori, merek: isi.merek ?? asal.merek, model: isi.model ?? asal.model, spek: isi.spek ?? '', fungsi: isi.fungsi ?? '', satuan: p.satuan || 'unit',
      qty: daftar.reduce((s, x) => s + (Number.isFinite(x.qty) ? x.qty : 0), 0), contoh: daftar.find(x => x.gambar || x.foto) ?? p,
    };
  });
}

export interface BagianBoq { ruang: number; judul: string; baris: BarisBoq[] }

export function bagianBoq(d: DokSLD): BagianBoq[] {
  const n = jumlahRuang(d);
  return Array.from({ length: n }, (_, i) => ({
    ruang: i, baris: barisBoq(dokRuang(d, i), i),
    judul: n === 1 ? SEKSI_BOQ : `${String.fromCharCode(65 + i)}. ${namaRuangKe(d, i).toUpperCase()} (sesuai daftar)`,
  }));
}

export const judulBoq = (d: DokSLD) => ['BILL OF MATERIALS', [d.blok.proyek, d.blok.lokasi].filter(Boolean).join(' ').toUpperCase()].filter(Boolean).join(' - ');
export const teksRoom = (d: DokSLD) => (jumlahRuang(d) > 1 ? Array.from({ length: jumlahRuang(d) }, (_, i) => namaRuangKe(d, i)).join(', ') : d.namaRuang?.trim() || d.blok.lingkup);
export const infoBoq = (d: DokSLD): [string, string][] => [['Proyek', d.blok.ringkas || d.blok.proyek], ['Room', teksRoom(d)], ['Disusun oleh', d.blok.dibuat]];

const G = GAYA_BOQ, px = ptPx;
export const CSS_BOQ = `.boq{font-family:${G.huruf},Helvetica,sans-serif;color:#000;width:${LEBAR_BOQ}px;background:#fff}`
  + `.boq-judul{font-size:${px(G.ukuranJudul)}px;font-weight:700;color:#${G.navy};height:${px(G.tinggiJudul)}px;line-height:${px(G.tinggiJudul)}px;white-space:nowrap}`
  + `.boq-info{border-collapse:collapse;font-size:${px(G.ukuran)}px;margin-bottom:${px(15)}px}.boq-info td{height:${px(15)}px;padding:0 2px;vertical-align:bottom;white-space:nowrap}`
  + `.boq-info td.l{font-weight:700;width:${lebarPx(5) + lebarPx(25) - 4}px}.boq-info td.biru{color:#${G.biru}}`
  + `.boq-tabel{border-collapse:collapse;table-layout:fixed;width:${LEBAR_BOQ}px;font-size:${px(G.ukuran)}px}`
  + `.boq-tabel th{background:#${G.navy};color:#${G.putih};font-weight:700;text-align:center;vertical-align:middle;height:${px(G.tinggiKepala)}px;border:1px solid #${G.garis};padding:0 3px}`
  + `.boq-tabel td{border:1px solid #${G.garis};vertical-align:top;padding:1px 3px;height:${px(G.tinggiBaris)}px;white-space:pre-wrap;overflow-wrap:anywhere}`
  + `.boq-tabel td.seksi{background:#${G.seksi};color:#${G.navy};font-weight:700;height:${px(15)}px;vertical-align:bottom}`
  + `.boq-tabel td.c{text-align:center}.boq-tabel td.b{font-weight:700}.boq-tabel td.qty{color:#${G.biru};text-align:center}`
  + `.boq-tabel td.harga{background:#${G.harga};color:#${G.biru}}.boq-tabel td.total{text-align:right}.boq-tabel td.gbr{padding:${G.gambar.y}px 0 0 ${G.gambar.x}px}`
  + `.boq-gbr{display:block;width:${G.gambar.w}px;height:${G.gambar.h}px;object-fit:contain}`
  + '.boq-tabel thead{display:table-header-group}.boq-tabel tr{break-inside:avoid;page-break-inside:avoid}';

export function htmlGambarBoq(p: Perangkat): string {
  const src = p.gambar ?? p.foto;
  if (src) return `<img class="boq-gbr" src="${esc(src)}" alt=""/>`;
  return `<svg class="boq-gbr" viewBox="${viewBoxIkon(p.ikon, p)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${isiIkon(p.ikon, p)}</svg>`;
}

export const kolomBoqHtml = () => `<colgroup>${KOLOM_BOQ.map(k => `<col style="width:${lebarPx(k.lebar)}px"/>`).join('')}</colgroup>`;
export const kepalaBoqHtml = () => `<thead><tr>${KOLOM_BOQ.map(k => `<th>${esc(k.judul)}</th>`).join('')}</tr></thead>`;

export function htmlBoq(d: DokSLD): string {
  const info = infoBoq(d).map(([l, v], i) => `<tr><td class="l">${esc(l)}</td><td${i === 2 ? ' class="biru"' : ''}>${esc(v)}</td></tr>`).join('');
  const baris = (r: BarisBoq) => `<tr><td class="c">${esc(r.no)}</td><td class="gbr">${htmlGambarBoq(r.contoh)}</td><td>${esc(r.kategori)}</td><td>${esc(r.merek)}</td>`
    + `<td class="b">${esc(r.model)}</td><td>${esc(r.spek)}</td><td>${esc(r.fungsi)}</td><td class="qty">${r.qty}</td><td class="c">${esc(r.satuan)}</td>`
    + '<td class="harga"></td><td class="total">-</td></tr>';
  const isi = bagianBoq(d).map(b => `<tr><td class="seksi" colspan="${KOLOM_BOQ.length}">${esc(b.judul)}</td></tr>${b.baris.map(baris).join('')}`).join('');
  return `<div class="boq"><div class="boq-judul">${esc(judulBoq(d))}</div><table class="boq-info">${info}</table>`
    + `<table class="boq-tabel">${kolomBoqHtml()}${kepalaBoqHtml()}<tbody>${isi}</tbody></table></div>`;
}
