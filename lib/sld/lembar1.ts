import { GAYA_KABEL, LABEL_GARIS, LABEL_PERANGKAT, SUDUT_GARIS, TITIK_UJUNG, WARNA } from './gaya';
import { geometri, teksLabel } from './geometri';
import { bingkai, bukaSvg, gambarPerangkat, type OpsiLembar, watermark } from './lembar-umum';
import { garis, n, potong, teks } from './teks';
import { jenisTerpakai } from './turunan';
import type { DokSLD, GeoKabel, Perangkat, Titik } from './tipe';

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
    l.push(`<rect x="${n(k.label.x - k.lebarLabel / 2)}" y="${n(k.label.y - LABEL_GARIS.tinggi / 2)}" width="${n(k.lebarLabel)}" height="${LABEL_GARIS.tinggi}" fill="${WARNA.putih}"/>`
      + teks(k.label.x, k.label.y, teksLabel(c, k.kode), { ukuran: LABEL_GARIS.ukuran, warna: s.warna, tebal: true, tengah: true, pusatV: true }));
  }
  return { garis: g.join(''), label: l.join('') };
}

export function barisLabel(p: Perangkat): { isi: string; ukuran: number; warna: string; tebal: boolean }[] {
  const L = LABEL_PERANGKAT;
  return [
    ...(p.nama.trim() ? [{ isi: `#${p.nama.trim()}`, ukuran: L.nama.ukuran, warna: L.nama.warna, tebal: true }] : []),
    ...(p.peran.trim() ? [{ isi: `*${p.peran.trim()}`, ukuran: L.peran.ukuran, warna: L.peran.warna, tebal: true }] : []),
    ...p.ket.split('\n').filter(s => s.trim()).map(s => ({ isi: s.trim(), ukuran: L.ket.ukuran, warna: L.ket.warna, tebal: false })),
  ];
}

export function svgLabelPerangkat(p: Perangkat): string {
  const x = p.x + LABEL_PERANGKAT.geserKiri;
  let y = p.y + p.h + LABEL_PERANGKAT.jarakAtas;
  return barisLabel(p).map(b => {
    y += b.ukuran * 1.02;
    const s = teks(x, y, b.isi, { ukuran: b.ukuran, warna: b.warna, tebal: b.tebal });
    y += b.ukuran * (LABEL_PERANGKAT.spasi - 1.02);
    return s;
  }).join('');
}

const P = { putar: 90, pusatV: true } as const;

function strip(d: DokSLD): string {
  const b = d.blok, T = WARNA.tinta;
  const o: string[] = [garis(27, 7, 27, 290, T, 0.3)];
  o.push(teks(24.5, 10, 'Legend', { ukuran: 3, warna: T, ...P }));
  const jenis = jenisTerpakai(d).slice(0, 6);
  jenis.forEach((j, i) => {
    const kelompok = Math.floor(i / 3), x = 19.5 - (i % 3) * 5;
    const [y1, y2, yt, maks] = kelompok ? [70, 76, 78, 17] : [28, 37, 39, 30];
    const s = GAYA_KABEL[j];
    o.push(`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${s.warna}" stroke-width="${j === 'ac' ? 1.2 : 0.88}"${s.putus ? ` stroke-dasharray="${s.putus}"` : ''}/>`);
    o.push(teks(x, yt, potong(s.legend, maks, 2.15), { ukuran: 2.15, warna: T, ...P }));
  });
  o.push(garis(7, 96, 27, 96, T, 0.3));
  o.push(teks(24.5, 100, potong(`PROJECT : ${b.proyek}`, 97, 3, true), { ukuran: 3, warna: T, tebal: true, ...P }));
  o.push(teks(19.5, 100, potong([b.lokasi, b.sistem].filter(Boolean).join(' - '), 97, 2.4, true), { ukuran: 2.4, warna: T, tebal: true, ...P }));
  o.push(teks(14.5, 100, 'Single Line Diagram', { ukuran: 2.3, warna: T, ...P }));
  o.push(teks(9.5, 100, 'Sheet 1 : diagram koneksi perangkat', { ukuran: 2.15, warna: WARNA.redup, ...P }));
  o.push(garis(7, 200, 27, 200, T, 0.3), garis(7, 226, 27, 226, T, 0.2));
  for (const x of [12, 17, 22]) o.push(garis(x, 200, x, 290, T, 0.2));
  const isian: [number, string, string][] = [[24.5, 'Drawn by', b.dibuat], [19.5, 'Date', b.tanggal], [14.5, 'Checked by', b.diperiksa], [9.5, 'Approved by', b.disetujui]];
  for (const [x, l, v] of isian) o.push(teks(x, 202, l, { ukuran: 2.15, warna: T, ...P }), teks(x, 228, potong(v, 28, 2.15, true), { ukuran: 2.15, warna: T, tebal: true, ...P }));
  o.push(garis(7, 258, 27, 258, T, 0.3));
  o.push(teks(24.5, 260, 'Drawing No.', { ukuran: 2.15, warna: T, ...P }), teks(19.5, 260, potong(b.nomor, 15, 2.15, true), { ukuran: 2.15, warna: T, tebal: true, ...P }));
  o.push(teks(14.5, 260, 'Scale :', { ukuran: 2.15, warna: T, ...P }), teks(9.5, 260, potong(b.skala, 15, 2.15, true), { ukuran: 2.15, warna: T, tebal: true, ...P }));
  o.push(garis(7, 276, 27, 276, T, 0.3));
  o.push(teks(24.5, 278, 'SHEET', { ukuran: 2.15, warna: T, ...P }), teks(19.5, 278, '1 of 2', { ukuran: 2.15, warna: T, tebal: true, ...P }));
  o.push(teks(14.5, 278, 'Rev.', { ukuran: 2.15, warna: T, ...P }), teks(9.5, 278, potong(b.rev, 11, 2.15, true), { ukuran: 2.15, warna: T, tebal: true, ...P }));
  return o.join('');
}

export function isiLembar1(d: DokSLD, o: OpsiLembar = {}, geo = geometri(d)): string {
  const k = svgKabel(d, geo);
  return bingkai({ x: 4, y: 4, w: 412, h: 289, tebal: 0.7 }, { tebal: 0.3 }) + strip(d)
    + d.perangkat.map(p => gambarPerangkat(p, p.x, p.y, p.w, p.h)).join('')
    + k.garis + k.label + d.perangkat.map(svgLabelPerangkat).join('') + watermark(o);
}

export const svgLembar1 = (d: DokSLD, o: OpsiLembar = {}) => `${bukaSvg()}${isiLembar1(d, o)}</svg>`;
