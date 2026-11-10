import { WARNA } from './gaya';
import { bingkai, bukaSvg, gambarPerangkat, type OpsiLembar, watermark } from './lembar-umum';
import { bungkus, esc, garis, kotak, lebarTeks, n, potong, teks } from './teks';
import { barisKoneksi, barisPerangkat, kartuGambar } from './turunan';
import type { BlokJudul, CatatanPasang, DokSLD } from './tipe';

const T = WARNA.tinta, R = WARNA.redup;
const UK = 2.3, BARIS = 2.875, PAD = 1.8, KEPALA = 5.6, BATAS_BAWAH = 248;

export interface Kolom { judul: string; lebar: number; tebal?: boolean }
export interface HasilTabel { svg: string; bawah: number; terpotong: number }

export function tabel(x: number, y: number, kolom: Kolom[], baris: string[][]): HasilTabel {
  const o: string[] = [];
  let cx = x;
  for (const k of kolom) {
    o.push(kotak(cx, y, k.lebar, KEPALA, { isi: WARNA.isiKepala, garis: WARNA.garisKepala, tebal: 0.25 }));
    o.push(teks(cx + 1, y + KEPALA / 2, k.judul, { ukuran: UK, warna: T, tebal: true, pusatV: true }));
    cx += k.lebar;
  }
  let yy = y + KEPALA, terpotong = 0;
  baris.forEach((isi, i) => {
    const pecah = kolom.map((k, j) => bungkus(isi[j] ?? '', k.lebar - 2, UK, k.tebal));
    const h = PAD + Math.max(1, ...pecah.map(p => p.length)) * BARIS;
    if (yy + h > BATAS_BAWAH) { terpotong++; return; }
    let xx = x;
    kolom.forEach((k, j) => {
      o.push(kotak(xx, yy, k.lebar, h, { isi: i % 2 ? WARNA.isiSelang : WARNA.putih, garis: WARNA.garisTabel, tebal: 0.2 }));
      pecah[j].forEach((s, b) => o.push(teks(xx + 1, yy + 0.9 + UK * 0.92 + b * BARIS, s, { ukuran: UK, warna: T, tebal: k.tebal })));
      xx += k.lebar;
    });
    yy += h;
  });
  return { svg: o.join(''), bawah: yy, terpotong };
}

const judulSeksi = (x: number, yPusat: number, s: string, maks = 240) =>
  teks(x, yPusat, potong(s, maks, 3.4, true), { ukuran: 3.4, warna: T, tebal: true, pusatV: true });

function kartu(d: DokSLD, atas: number): string {
  const o: string[] = [];
  const daftar = kartuGambar(d);
  daftar.forEach((k, i) => {
    const kol = i % 4, brs = Math.floor(i / 4);
    const x = 10 + kol * 61.75, y = atas + brs * 47;
    if (y + 44 > BATAS_BAWAH) return;
    o.push(kotak(x, y, 58.75, 44, { isi: WARNA.putih, garis: WARNA.garisTabel, tebal: 0.25, r: 1.2 }));
    o.push(gambarPerangkat(k.contoh, x + 8.575, y + 2.5, 41.6, 26));
    const cx = x + 29.375, judul = potong(k.judul, 48, 2.35, true);
    const lebar = 3.8 + 1.2 + lebarTeks(judul, 2.35, true), x0 = cx - lebar / 2;
    o.push(`<circle cx="${n(x0 + 1.9)}" cy="${n(y + 34.5)}" r="1.9" fill="${WARNA.putih}" stroke="${T}" stroke-width="0.25"/>`);
    o.push(teks(x0 + 1.9, y + 34.5, k.no, { ukuran: k.no.length > 2 ? 1.5 : 1.9, warna: T, tebal: true, tengah: true, pusatV: true }));
    o.push(teks(x0 + 5, y + 34.5, judul, { ukuran: 2.35, warna: T, tebal: true, pusatV: true }));
    o.push(teks(cx, y + 38.9, potong(k.sub, 55, 2.1), { ukuran: 2.1, warna: R, tengah: true }));
  });
  return o.join('');
}

function catatan(daftar: CatatanPasang[], x: number, atas: number, lebar: number): string {
  const o: string[] = [];
  const uk = 2.35, adv = uk * 1.32;
  let y = atas;
  daftar.forEach((c, i) => {
    const lead = `${i + 1}. ${c.judul.trim()}${c.judul.trim() && !/[.:]$/.test(c.judul.trim()) ? '.' : ''} `;
    const wLead = lebarTeks(lead, uk, true);
    const kata = c.isi.trim().split(/\s+/).filter(Boolean);
    let pertama = '';
    while (kata.length && lebarTeks(`${pertama} ${kata[0]}`.trim(), uk) <= lebar - wLead) pertama = `${pertama} ${kata.shift()}`.trim();
    const sisa = bungkus(kata.join(' '), lebar - 3, uk);
    const total = 1 + (kata.length ? sisa.length : 0);
    if (y + total * adv > BATAS_BAWAH) return;
    y += uk;
    o.push(`<text x="${n(x)}" y="${n(y)}" font-family="Arial, Helvetica, sans-serif" font-size="${uk}" fill="${T}"><tspan font-weight="700">${esc(lead)}</tspan>${esc(pertama)}</text>`);
    if (kata.length) for (const s of sisa) { y += adv; o.push(teks(x + 3, y, s, { ukuran: uk, warna: T })); }
    y += adv - uk + 1;
  });
  return o.join('');
}


export function blokJudul2(b: BlokJudul, hal: string): string {
  const o: string[] = [garis(7, 250, 413, 250, T, 0.35), garis(262, 250, 262, 290, T, 0.35)];
  bungkus(b.catatanRev, 245, 1.9).slice(0, 10).forEach((s, i) => o.push(teks(10, 254.5 + i * 2.66, s, { ukuran: 1.9, warna: R })));
  o.push(teks(265, 255.01, 'SINGLE LINE DIAGRAM', { ukuran: 3.6, warna: T, tebal: true, pusatV: true }));
  o.push(teks(265, 259.97, potong([b.proyek, b.lokasi].filter(Boolean).join(' - '), 145, 2.3, true), { ukuran: 2.3, warna: T, tebal: true, pusatV: true }));
  o.push(garis(262, 263.4, 413, 263.4, T, 0.25));
  ([['PROYEK', b.ringkas, 266.9], ['LINGKUP', b.lingkup, 270.5], ['ACUAN', b.acuan, 274.1]] as const).forEach(([l, v, y]) => {
    o.push(teks(265, y, l, { ukuran: 1.7, warna: R, tebal: true, pusatV: true }), teks(282, y, potong(v, 128, 1.95), { ukuran: 1.95, warna: T, pusatV: true }));
  });
  o.push(garis(262, 278.4, 413, 278.4, T, 0.25));
  for (const x of [292, 304, 330, 356, 373]) o.push(garis(x, 278.4, x, 290, T, 0.2));
  const skala = /^nts$/i.test(b.skala.trim()) ? 'Tanpa skala' : b.skala;
  const sel: [number, string, string, number][] = [[264, 'NO. GAMBAR', b.nomor, 27], [294, 'REV', b.rev, 9.5], [306, 'TANGGAL', b.tanggal, 23.5],
    [332, 'SKALA', skala, 23.5], [358, 'KERTAS', 'A3', 14.5], [375, 'HAL', hal, 37.5]];
  for (const [x, l, v, w] of sel) {
    o.push(teks(x, 281.56, l, { ukuran: 1.6, warna: R, tebal: true, pusatV: true }), teks(x, 286.4, potong(v, w, 2.2, true), { ukuran: 2.2, warna: T, tebal: true, pusatV: true }));
  }
  return o.join('');
}

export interface InfoLembar2 { terpotongKoneksi: number; terpotongPerangkat: number }

export function isiLembar2(d: DokSLD, o: OpsiLembar = {}): { svg: string; info: InfoLembar2 } {
  const b = d.blok, acuan = b.acuanSingkat.trim();
  const k = tabel(10, 18, [{ judul: 'No', lebar: 8, tebal: true }, { judul: 'Dari (perangkat · port)', lebar: 50 }, { judul: 'Ke (perangkat · port)', lebar: 50 },
    { judul: 'Kabel / media', lebar: 31 }, { judul: 'Fungsi', lebar: 51 }, { judul: 'Catatan', lebar: 54 }],
  barisKoneksi(d).map(r => [r.kode, r.dari, r.ke, r.media, r.fungsi, r.catatan]));
  const yGambar = k.bawah + 8.06;
  const p = tabel(262, 18, [{ judul: 'No', lebar: 8, tebal: true }, { judul: 'Kategori', lebar: 44 }, { judul: 'Merek / model', lebar: 78 }, { judul: 'Qty', lebar: 18 }],
    barisPerangkat(d).map(r => [r.no, r.kategori, r.model, r.qty]));
  const yCatatan = p.bawah + 8.06;
  const svg = bingkai({ x: 5, y: 5, w: 410, h: 287, tebal: 0.6 }, { tebal: 0.25 })
    + judulSeksi(10, 14.06, 'DAFTAR KONEKSI (K = sinyal / kontrol, P = catu daya) - nomor K = label kabel di sheet 1') + k.svg
    + judulSeksi(10, yGambar, `GAMBAR PERANGKAT (No. = item ${acuan || 'BOM'})`) + kartu(d, yGambar + 3.9)
    + judulSeksi(262, 14.06, `DAFTAR PERANGKAT (${acuan ? `= ${acuan}` : 'No. = item BOM'})`, 148) + p.svg
    + (d.catatan.length ? judulSeksi(262, yCatatan, 'CATATAN PEMASANGAN', 148) + catatan(d.catatan, 262, yCatatan + 3.9, 148) : '')
    + blokJudul2(b, '2 / 2 · Koneksi & catatan') + watermark(o);
  return { svg, info: { terpotongKoneksi: k.terpotong, terpotongPerangkat: p.terpotong } };
}

export const svgLembar2 = (d: DokSLD, o: OpsiLembar = {}) => `${bukaSvg()}${isiLembar2(d, o).svg}</svg>`;
