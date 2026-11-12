import { WARNA } from './gaya';
import { bingkaiPrim, bukaSvg, gambarPerangkat, type OpsiLembar, watermark } from './lembar-umum';
import { type Prim, svgPrimitif } from './primitif';
import { bungkus, lebarTeks, potong } from './teks';
import { barisKoneksi, barisPerangkat, kartuGambar, type KartuGambar } from './turunan';
import type { BlokJudul, CatatanPasang, DokSLD } from './tipe';

const T = WARNA.tinta, R = WARNA.redup;
const UK = 2.3, BARIS = 2.875, PAD = 1.8, KEPALA = 5.6, BATAS_BAWAH = 248, MAKS_HALAMAN = 8;

export interface Kolom { judul: string; lebar: number; tebal?: boolean }
export interface HasilTabel { prim: Prim[]; bawah: number; terpotong: number; muat: number }

const teks = (x: number, y: number, isi: string, o: Omit<Extract<Prim, { t: 'teks' }>, 't' | 'x' | 'y' | 'isi'>): Prim => ({ t: 'teks', x, y, isi, ...o });
const garis = (x1: number, y1: number, x2: number, y2: number, tebal: number): Prim => ({ t: 'garis', x1, y1, x2, y2, warna: T, tebal });

export function tabel(x: number, y: number, kolom: Kolom[], baris: string[][]): HasilTabel {
  const o: Prim[] = [];
  let cx = x;
  for (const k of kolom) {
    o.push({ t: 'sel', x: cx, y, w: k.lebar, h: KEPALA, isi: WARNA.isiKepala, garis: WARNA.garisKepala, tebal: 0.25, baris: [], ukuran: UK, warna: T, huruf: true, jarak: BARIS });
    o.push(teks(cx + 1, y + KEPALA / 2, k.judul, { ukuran: UK, warna: T, tebal: true, pusatV: true }));
    cx += k.lebar;
  }
  let yy = y + KEPALA, muat = 0;
  baris.forEach((isi, i) => {
    if (muat < i) return;
    const pecah = kolom.map((k, j) => bungkus(isi[j] ?? '', k.lebar - 2, UK, k.tebal));
    const h = PAD + Math.max(1, ...pecah.map(p => p.length)) * BARIS;
    if (yy + h > BATAS_BAWAH) return;
    muat++;
    let xx = x;
    kolom.forEach((k, j) => {
      o.push({ t: 'sel', x: xx, y: yy, w: k.lebar, h, isi: i % 2 ? WARNA.isiSelang : WARNA.putih, garis: WARNA.garisTabel, tebal: 0.2,
        baris: pecah[j], ukuran: UK, warna: T, huruf: !!k.tebal, jarak: BARIS });
      xx += k.lebar;
    });
    yy += h;
  });
  return { prim: o, bawah: yy, terpotong: baris.length - muat, muat };
}

const judulSeksi = (x: number, yPusat: number, s: string, maks = 240) =>
  teks(x, yPusat, potong(s, maks, 3.4, true), { ukuran: 3.4, warna: T, tebal: true, pusatV: true });

function kartu(daftar: KartuGambar[], atas: number): { prim: Prim[]; muat: number } {
  const o: Prim[] = [];
  let muat = 0;
  daftar.forEach((k, i) => {
    const kol = i % 4, brs = Math.floor(i / 4);
    const x = 10 + kol * 61.75, y = atas + brs * 47;
    if (muat < i || y + 44 > BATAS_BAWAH) return;
    muat++;
    o.push({ t: 'kotak', x, y, w: 58.75, h: 44, isi: WARNA.putih, garis: WARNA.garisTabel, tebal: 0.25, r: 1.2 });
    o.push({ t: 'gambar', x: x + 8.575, y: y + 2.5, w: 41.6, h: 26, perangkat: k.contoh.id });
    const cx = x + 29.375, judul = potong(k.judul, 48, 2.35, true);
    const lebar = 3.8 + 1.2 + lebarTeks(judul, 2.35, true), x0 = cx - lebar / 2;
    o.push({ t: 'lingkaran', cx: x0 + 1.9, cy: y + 34.5, r: 1.9, isi: WARNA.putih, garis: T, tebal: 0.25 });
    o.push(teks(x0 + 1.9, y + 34.5, k.no, { ukuran: k.no.length > 2 ? 1.5 : 1.9, warna: T, tebal: true, rata: 'tengah', pusatV: true }));
    o.push(teks(x0 + 5, y + 34.5, judul, { ukuran: 2.35, warna: T, tebal: true, pusatV: true }));
    o.push(teks(cx, y + 38.9, potong(k.sub, 55, 2.1), { ukuran: 2.1, warna: R, rata: 'tengah' }));
  });
  return { prim: o, muat };
}

function catatan(daftar: CatatanPasang[], x: number, atas: number, lebar: number, awal = 0): { prim: Prim[]; muat: number } {
  const o: Prim[] = [];
  const uk = 2.35, adv = uk * 1.32;
  let y = atas, muat = 0;
  daftar.forEach((c, i) => {
    if (muat < i) return;
    const lead = `${awal + i + 1}. ${c.judul.trim()}${c.judul.trim() && !/[.:]$/.test(c.judul.trim()) ? '.' : ''} `;
    const wLead = lebarTeks(lead, uk, true);
    const kata = c.isi.trim().split(/\s+/).filter(Boolean);
    let pertama = '';
    while (kata.length && lebarTeks(`${pertama} ${kata[0]}`.trim(), uk) <= lebar - wLead) pertama = `${pertama} ${kata.shift()}`.trim();
    const sisa = bungkus(kata.join(' '), lebar - 3, uk);
    const total = 1 + (kata.length ? sisa.length : 0);
    if (y + total * adv > BATAS_BAWAH) return;
    muat++;
    y += uk;
    o.push({ t: 'runs', x, y, ukuran: uk, warna: T, runs: [{ isi: lead, tebal: true }, { isi: pertama, tebal: false }] });
    if (kata.length) for (const s of sisa) { y += adv; o.push(teks(x + 3, y, s, { ukuran: uk, warna: T })); }
    y += adv - uk + 1;
  });
  return { prim: o, muat };
}

export function blokJudul2(b: BlokJudul, hal: string, ruang?: string): Prim[] {
  const o: Prim[] = [garis(7, 250, 413, 250, 0.35), garis(262, 250, 262, 290, 0.35)];
  bungkus(b.catatanRev, 245, 1.9).slice(0, 10).forEach((s, i) => o.push(teks(10, 254.5 + i * 2.66, s, { ukuran: 1.9, warna: R })));
  o.push(teks(265, 255.01, 'SINGLE LINE DIAGRAM', { ukuran: 3.6, warna: T, tebal: true, pusatV: true }));
  o.push(teks(265, 259.97, potong([b.proyek, b.lokasi, ruang].filter(Boolean).join(' - '), 145, 2.3, true), { ukuran: 2.3, warna: T, tebal: true, pusatV: true }));
  o.push(garis(262, 263.4, 413, 263.4, 0.25));
  ([['PROYEK', b.ringkas, 266.9], ['ROOM', ruang?.trim() || b.lingkup, 270.5], ['ACUAN', b.acuan, 274.1]] as const).forEach(([l, v, y]) => {
    o.push(teks(265, y, l, { ukuran: 1.7, warna: R, tebal: true, pusatV: true }), teks(282, y, potong(v, 128, 1.95), { ukuran: 1.95, warna: T, pusatV: true }));
  });
  o.push(garis(262, 278.4, 413, 278.4, 0.25));
  for (const x of [292, 304, 330, 356, 373]) o.push(garis(x, 278.4, x, 290, 0.2));
  const skala = /^nts$/i.test(b.skala.trim()) ? 'Tanpa skala' : b.skala;
  const sel: [number, string, string, number][] = [[264, 'NO. GAMBAR', b.nomor, 27], [294, 'REV', b.rev, 9.5], [306, 'TANGGAL', b.tanggal, 23.5],
    [332, 'SKALA', skala, 23.5], [358, 'KERTAS', 'A3', 14.5], [375, 'HAL', hal, 37.5]];
  for (const [x, l, v, w] of sel) {
    o.push(teks(x, 281.56, l, { ukuran: 1.6, warna: R, tebal: true, pusatV: true }), teks(x, 286.4, potong(v, w, 2.2, true), { ukuran: 2.2, warna: T, tebal: true, pusatV: true }));
  }
  return o;
}

export interface InfoLembar2 { terpotongKoneksi: number; terpotongPerangkat: number; halaman: number }

const KOLOM_KONEKSI: Kolom[] = [{ judul: 'No', lebar: 8, tebal: true }, { judul: 'Dari (perangkat · port)', lebar: 50 }, { judul: 'Ke (perangkat · port)', lebar: 50 },
  { judul: 'Kabel / media', lebar: 31 }, { judul: 'Fungsi', lebar: 51 }, { judul: 'Catatan', lebar: 54 }];
const KOLOM_PERANGKAT: Kolom[] = [{ judul: 'No', lebar: 8, tebal: true }, { judul: 'Kategori', lebar: 44 }, { judul: 'Merek / model', lebar: 78 }, { judul: 'Qty', lebar: 18 }];
const LANJUT = ' - lanjutan';

export function halamanLembar2(d: DokSLD): { halaman: Prim[][]; info: InfoLembar2 } {
  const b = d.blok, acuan = b.acuanSingkat.trim();
  const jGambar = `GAMBAR PERANGKAT (No. = item ${acuan || 'BOM'})`, jPerangkat = `DAFTAR PERANGKAT (${acuan ? `= ${acuan}` : 'No. = item BOM'})`;
  let sisaK = barisKoneksi(d).map(r => [r.kode, r.dari, r.ke, r.media, r.fungsi, r.catatan]), sisaP = barisPerangkat(d).map(r => [r.no, r.kategori, r.model, r.qty]);
  let sisaG = kartuGambar(d), sisaC = d.catatan, noC = 0, adaG = false;
  const isi: Prim[][] = [];
  for (let n = 0; n < MAKS_HALAMAN; n++) {
    const sebelum = sisaK.length + sisaP.length + sisaG.length + sisaC.length;
    if (n > 0 && !sebelum) break;
    const o: Prim[] = [];
    let yG = 14.06, yC = 14.06;
    if (n === 0 || sisaK.length) {
      const k = tabel(10, 18, KOLOM_KONEKSI, sisaK);
      o.push(judulSeksi(10, 14.06, n === 0 ? 'DAFTAR KONEKSI (K = sinyal / kontrol, P = catu daya) - nomor K = label kabel di sheet 1' : `DAFTAR KONEKSI${LANJUT}`), ...k.prim);
      sisaK = sisaK.slice(k.muat); yG = k.bawah + 8.06;
    }
    if (!sisaK.length && (n === 0 || sisaG.length)) {
      const g = kartu(sisaG, yG + 3.9);
      if (n === 0 || g.muat) o.push(judulSeksi(10, yG, `${jGambar}${adaG ? LANJUT : ''}`), ...g.prim);
      adaG = adaG || g.muat > 0; sisaG = sisaG.slice(g.muat);
    }
    if (n === 0 || sisaP.length) {
      const p = tabel(262, 18, KOLOM_PERANGKAT, sisaP);
      o.push(judulSeksi(262, 14.06, n === 0 ? jPerangkat : `DAFTAR PERANGKAT${LANJUT}`, 148), ...p.prim);
      sisaP = sisaP.slice(p.muat); yC = p.bawah + 8.06;
    }
    if (!sisaP.length && sisaC.length) {
      const c = catatan(sisaC, 262, yC + 3.9, 148, noC);
      if (n === 0 || c.muat) o.push(judulSeksi(262, yC, `CATATAN PEMASANGAN${noC ? LANJUT : ''}`, 148), ...c.prim);
      noC += c.muat; sisaC = sisaC.slice(c.muat);
    }
    isi.push(o);
    if (n > 0 && sisaK.length + sisaP.length + sisaG.length + sisaC.length === sebelum) break;
  }
  const halaman = isi.map((o, i) => [
    ...bingkaiPrim({ x: 5, y: 5, w: 410, h: 287, tebal: 0.6 }, 0.25), ...o,
    ...blokJudul2(b, isi.length > 1 ? `2 / 2 · hal ${i + 1} dari ${isi.length}` : '2 / 2 · Koneksi & catatan', d.namaRuang),
  ]);
  return { halaman, info: { terpotongKoneksi: sisaK.length, terpotongPerangkat: sisaP.length, halaman: halaman.length } };
}

export function primLembar2(d: DokSLD): { prim: Prim[]; info: InfoLembar2 } {
  const { halaman, info } = halamanLembar2(d);
  return { prim: halaman[0], info };
}

export function isiLembar2(d: DokSLD, o: OpsiLembar = {}): { svg: string; svgs: string[]; info: InfoLembar2 } {
  const { halaman, info } = halamanLembar2(d);
  const peta = new Map(d.perangkat.map(p => [p.id, p]));
  const wm = watermark({ ...o, tanpaWatermark: o.tanpaWatermark || d.watermark === false });
  const svgs = halaman.map(prim => svgPrimitif(prim, (id, x, y, w, h) => { const p = peta.get(id); return p ? gambarPerangkat(p, x, y, w, h) : ''; }) + wm);
  return { svg: svgs[0], svgs, info };
}

export const svgLembar2 = (d: DokSLD, o: OpsiLembar = {}) => `${bukaSvg()}${isiLembar2(d, o).svg}</svg>`;
export const svgLembar2Semua = (d: DokSLD, o: OpsiLembar = {}) => isiLembar2(d, o).svgs.map(s => `${bukaSvg()}${s}</svg>`);
