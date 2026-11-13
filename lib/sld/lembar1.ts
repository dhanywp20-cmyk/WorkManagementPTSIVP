import { GAYA_KABEL, LABEL_GARIS, LABEL_PERANGKAT, SUDUT_GARIS, TITIK_UJUNG, WARNA } from './gaya';
import { geometri, hurufPerangkat, kotakTampak, teksLabel } from './geometri';
import { bingkaiPrim, bukaSvg, gambarPerangkat, type OpsiLembar, watermark } from './lembar-umum';
import { type Prim, svgPrimitif } from './primitif';
import { bungkus, lebarTeks, n, potong, teks } from './teks';
import { jenisTerpakai } from './turunan';
import { svgTeksBebas } from './teks-bebas';
import { svgZona } from './zona';
import { type DokSLD, type GeoKabel, halamanDok, type Perangkat, type Titik } from './tipe';

const PANJANG_PANAH = 2.2, LEBAR_PANAH = 1.8;

export function jalurBulat(t: Titik[], r = SUDUT_GARIS): string {
  if (t.length < 2) return '';
  let d = `M${n(t[0].x)} ${n(t[0].y)}`;
  for (let i = 1; i < t.length - 1; i++) {
    const a = t[i - 1], b = t[i], c = t[i + 1];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    if (rr < 0.05) { d += ` L${n(b.x)} ${n(b.y)}`; continue; }
    const p1 = { x: b.x - ((b.x - a.x) / l1) * rr, y: b.y - ((b.y - a.y) / l1) * rr };
    const p2 = { x: b.x + ((c.x - b.x) / l2) * rr, y: b.y + ((c.y - b.y) / l2) * rr };
    d += ` L${n(p1.x)} ${n(p1.y)} Q${n(b.x)} ${n(b.y)} ${n(p2.x)} ${n(p2.y)}`;
  }
  const z = t[t.length - 1];
  return `${d} L${n(z.x)} ${n(z.y)}`;
}

function panah(t: Titik[], warna: string): { titik: Titik[]; svg: string } {
  const z = t[t.length - 1], y = t[t.length - 2];
  const l = Math.hypot(z.x - y.x, z.y - y.y);
  if (l < PANJANG_PANAH + 0.2) return { titik: t, svg: '' };
  const ux = (z.x - y.x) / l, uy = (z.y - y.y) / l;
  const dasar = { x: z.x - ux * PANJANG_PANAH, y: z.y - uy * PANJANG_PANAH };
  const px = -uy * LEBAR_PANAH / 2, py = ux * LEBAR_PANAH / 2;
  const svg = `<path d="M${n(z.x)} ${n(z.y)} L${n(dasar.x + px)} ${n(dasar.y + py)} L${n(dasar.x - px)} ${n(dasar.y - py)} Z" fill="${warna}"/>`;
  return { titik: [...t.slice(0, -1), dasar], svg };
}

export function svgKabel(d: DokSLD, geo: GeoKabel[]): { garis: string; label: string } {
  const peta = new Map(d.kabel.map(c => [c.id, c]));
  const g: string[] = [], l: string[] = [];
  for (const k of geo) {
    const c = peta.get(k.id)!;
    const s = GAYA_KABEL[c.jenis];
    const dash = s.putus ? ` stroke-dasharray="${s.putus}"` : '';
    for (const gr of k.garis) {
      const ujung = c.duaArah ? { titik: gr.titik, svg: `<circle cx="${n(gr.titik[gr.titik.length - 1].x)}" cy="${n(gr.titik[gr.titik.length - 1].y)}" r="${TITIK_UJUNG}" fill="${s.warna}"/>` } : panah(gr.titik, s.warna);
      g.push(`<path d="${jalurBulat(ujung.titik)}" fill="none" stroke="${s.warna}" stroke-width="${s.tebal}" stroke-linejoin="round"${dash}/>${ujung.svg}`);
      if (gr.awal) g.push(`<circle cx="${n(gr.titik[0].x)}" cy="${n(gr.titik[0].y)}" r="${TITIK_UJUNG}" fill="${s.warna}"/>`);
    }
    const tl = LABEL_GARIS.tinggi * k.huruf;
    l.push(`<rect x="${n(k.label.x - k.lebarLabel / 2)}" y="${n(k.label.y - tl / 2)}" width="${n(k.lebarLabel)}" height="${n(tl)}" fill="${WARNA.putih}"/>`
      + teks(k.label.x, k.label.y, teksLabel(c, k.kode), { ukuran: LABEL_GARIS.ukuran * k.huruf, warna: s.warna, tebal: true, tengah: true, pusatV: true }));
  }
  return { garis: g.join(''), label: l.join('') };
}

const SATUAN_BIJI = /^(unit|units|pcs|pc|buah|bh|set|ea|nos|titik)?$/i;
export const jumlahLabel = (p: Pick<Perangkat, 'qty' | 'satuan'>) => {
  if (!(p.qty > 1)) return '';
  const n = p.qty.toLocaleString('id-ID');
  return SATUAN_BIJI.test((p.satuan ?? '').trim()) ? ` (${n}X)` : ` (${n} ${p.satuan.trim()})`;
};

type BarisLabel = { isi: string; ukuran: number; warna: string; tebal: boolean };
const pecahBaris = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);

export function barisLabel(p: Perangkat, f = 1): BarisLabel[] {
  const L = LABEL_PERANGKAT, maks = p.lebarLabel;
  const susun = (daftar: string[], g: Omit<BarisLabel, 'isi'>): BarisLabel[] =>
    daftar.flatMap(s => (maks ? bungkus(s, maks, g.ukuran, g.tebal) : [s]).map(isi => ({ ...g, isi })));
  const nama = pecahBaris(p.nama), peran = pecahBaris(p.peran);
  return [
    ...susun(nama.map((s, i) => `${i === 0 ? '#' : ''}${s}${i === nama.length - 1 ? jumlahLabel(p) : ''}`), { ukuran: L.nama.ukuran * f, warna: L.nama.warna, tebal: true }),
    ...susun(peran.map((s, i) => `${i === 0 ? '*' : ''}${s}`), { ukuran: L.peran.ukuran * f, warna: L.peran.warna, tebal: true }),
    ...susun(pecahBaris(p.ket), { ukuran: L.ket.ukuran * f, warna: L.ket.warna, tebal: false }),
  ];
}

export interface LetakLabel { x: number; atas: number; w: number; h: number; kanan: boolean }

export function letakLabel(p: Perangkat, f = 1): LetakLabel {
  const b = barisLabel(p, f), L = LABEL_PERANGKAT, G = 1.5;
  const h = b.reduce((s, x) => s + x.ukuran * L.spasi, 0), w = Math.max(0, ...b.map(x => lebarTeks(x.isi, x.ukuran, x.tebal)));
  const k = kotakTampak(p), tengahV = k.y + (k.h - h) / 2, posisi = p.labelDi ?? 'bawah';
  const kiri = { x: k.x - G, kanan: true }, kanan = { x: k.x + k.w + G, kanan: false };
  const sisi: Record<string, { x: number; kanan: boolean; atas: number }> = {
    bawah: { x: p.x + L.geserKiri, kanan: false, atas: p.y + p.h + L.jarakAtas }, atas: { x: k.x + L.geserKiri, kanan: false, atas: k.y - L.jarakAtas - h },
    kiri: { ...kiri, atas: tengahV }, kanan: { ...kanan, atas: tengahV }, 'kiri-atas': { ...kiri, atas: k.y - h }, 'kanan-atas': { ...kanan, atas: k.y - h },
    'kiri-bawah': { ...kiri, atas: k.y + k.h }, 'kanan-bawah': { ...kanan, atas: k.y + k.h },
  };
  return { ...(sisi[posisi] ?? sisi.bawah), w, h };
}

export function svgLabelPerangkat(p: Perangkat, f = 1): string {
  const l = letakLabel(p, f);
  let y = l.atas;
  return barisLabel(p, f).map(b => {
    y += b.ukuran * 1.02;
    const s = teks(l.x, y, b.isi, { ukuran: b.ukuran, warna: b.warna, tebal: b.tebal, kanan: l.kanan });
    y += b.ukuran * (LABEL_PERANGKAT.spasi - 1.02);
    return s;
  }).join('');
}

const P = { putar: 90, pusatV: true } as const;

export function primStrip(d: DokSLD, simple = false): Prim[] {
  const b = d.blok, T = WARNA.tinta;
  const k = (halamanDok(d).h - 14) / 283, Y = (y: number) => 7 + (y - 7) * k, M = (m: number) => Math.round(m * k);
  const tk = (x: number, y: number, isi: string, ukuran: number, tebal = false, warna: string = T): Prim => ({ t: 'teks', x, y: Y(y), isi, ukuran, warna, tebal, ...P });
  const gr = (x1: number, y1: number, x2: number, y2: number, tebal: number): Prim => ({ t: 'garis', x1, y1: Y(y1), x2, y2: Y(y2), warna: T, tebal });
  const o: Prim[] = [gr(27, 7, 27, 290, 0.3), tk(24.5, 10, 'Legend', 3)];
  jenisTerpakai(d).slice(0, 6).forEach((j, i) => {
    const kelompok = Math.floor(i / 3), x = 19.5 - (i % 3) * 5;
    const [y1, y2, yt, maks] = kelompok ? [70, 76, 78, 17] : [28, 37, 39, 30];
    const s = GAYA_KABEL[j];
    o.push({ t: 'garis', x1: x, y1: Y(y1), x2: x, y2: Y(y2), warna: s.warna, tebal: j === 'ac' ? 1.2 : 0.88, putus: s.putus }, tk(x, yt, potong(s.legend, M(maks), 2.15), 2.15));
  });
  o.push(gr(7, 96, 27, 96, 0.3));
  o.push(tk(24.5, 100, potong(`PROJECT : ${b.proyek}`, M(97), 3, true), 3, true));
  o.push(tk(19.5, 100, potong([b.lokasi, d.namaRuang, b.sistem].filter(Boolean).join(' - '), M(97), 2.4, true), 2.4, true));
  o.push(tk(14.5, 100, 'Single Line Diagram', 2.3));
  if (!simple) o.push(tk(9.5, 100, 'Sheet 1 : diagram koneksi perangkat', 2.15, false, WARNA.redup));
  o.push(gr(7, 200, 27, 200, 0.3), gr(7, 226, 27, 226, 0.2));
  for (const x of [12, 17, 22]) o.push(gr(x, 200, x, 290, 0.2));
  const isian: [number, string, string][] = [[24.5, 'Drawn by', b.dibuat], [19.5, 'Date', b.tanggal], [14.5, 'Checked by', b.diperiksa], [9.5, 'Approved by', b.disetujui]];
  for (const [x, l, v] of isian) o.push(tk(x, 202, l, 2.15), tk(x, 228, potong(v, M(28), 2.15, true), 2.15, true));
  o.push(gr(7, 258, 27, 258, 0.3));
  o.push(tk(24.5, 260, 'Drawing No.', 2.15), tk(19.5, 260, potong(b.nomor, 15, 2.15, true), 2.15, true));
  o.push(tk(14.5, 260, 'Scale :', 2.15), tk(9.5, 260, potong(b.skala, 15, 2.15, true), 2.15, true));
  o.push(gr(7, 276, 27, 276, 0.3));
  o.push(tk(24.5, 278, 'SHEET', 2.15), tk(19.5, 278, simple || d.tanpaKoneksi ? '1 of 1' : '1 of 2', 2.15, true), tk(14.5, 278, 'Rev.', 2.15), tk(9.5, 278, potong(b.rev, 11, 2.15, true), 2.15, true));
  return o;
}

export const primRangka1 = (d: DokSLD, simple = false): Prim[] => [...bingkaiPrim({ x: 4, y: 4, w: 412, h: halamanDok(d).h - 8, tebal: 0.7 }, 0.3), ...primStrip(d, simple)];

export function isiLembar1(d: DokSLD, o: OpsiLembar = {}, geo = geometri(d)): string {
  const k = svgKabel(d, geo);
  return svgPrimitif(primRangka1(d, o.simple), () => '') + (d.zona ?? []).map(svgZona).join('')
    + d.perangkat.map(p => gambarPerangkat(p, p.x, p.y, p.w, p.h, p)).join('')
    + k.garis + k.label + d.perangkat.map(p => svgLabelPerangkat(p, hurufPerangkat(p, d))).join('') + (d.teks ?? []).map(svgTeksBebas).join('')
    + watermark({ ...o, tinggi: halamanDok(d).h, tanpaWatermark: o.tanpaWatermark || d.watermark === false });
}

export const svgLembar1 = (d: DokSLD, o: OpsiLembar = {}) => `${bukaSvg('', halamanDok(d).h)}${isiLembar1(d, o)}</svg>`;
