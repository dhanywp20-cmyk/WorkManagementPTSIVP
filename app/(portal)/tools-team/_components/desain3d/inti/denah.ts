/**
 * Denah 2D (tampak atas) dari desain: dinding dengan pintu & jendela, tapak benda (benda plafon putus-putus),
 * teks, garis ukur ruangan, rantai ukur display di dinding depan, dan garis penggaris. Hasilnya primitif
 * gambar dalam meter (x ke kanan, z ke belakang = ke bawah di kertas) - diubah ke SVG / DXF oleh
 * inti/denahFormat.ts. Murni (diuji di uji/desain3d-denah.ts).
 */
import { penggarisSah } from './presisi';
import { bukaanDinding, daftarRuang, pintuSekat, sambunganKe, sisiLuar, ukuranPintu } from './ruang';
import { barisTeks } from './teks';
import { type Benda, DISPLAY, type Kotak, type Ruang, type SisiDinding } from './tipe';

export type P2 = [number, number];
export type LapisDenah = 'DINDING' | 'BUKAAN' | 'BENDA' | 'PLAFON' | 'TEKS' | 'UKURAN';
export interface GarisDenah { a: P2; b: P2; lapis: LapisDenah; putus?: boolean }
/** Busur: pusat, jari-jari, sudut awal → akhir (derajat, searah sudut naik pada sumbu x→z). */
export interface BusurDenah { c: P2; r: number; a0: number; a1: number; lapis: LapisDenah }
/** Tulisan: tinggi = minimal (m) di ruangan; `geser` = arah menjauhi garis ukur (teks digeser setengah tingginya). */
export interface TulisanDenah { p: P2; teks: string; tinggi: number; lapis: LapisDenah; sudut?: number; geser?: P2 }
export interface Denah { garis: GarisDenah[]; busur: BusurDenah[]; tulisan: TulisanDenah[]; batas: { x0: number; z0: number; x1: number; z1: number } }

/** Benda setinggi ini ke atas dianggap terpasang di plafon (digambar putus-putus). */
export const ELEV_PLAFON = 2;
/** Jarak garis ukur dari dinding (m). */
const JARAK_UKUR = 0.45, TINGGI_TEKS_UKUR = 0.11;

export const mm = (m: number) => Math.round(m * 1000).toLocaleString('id-ID');

/** Empat sudut tapak benda (ikut rotasi; sama dengan three.js rotation.y = rot). */
export function sudutTapak(b: Pick<Benda, 'x' | 'z' | 'w' | 'd' | 'rot'>): P2[] {
  const r = (b.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const kx: P2 = [c * b.w / 2, -s * b.w / 2], kz: P2 = [s * b.d / 2, c * b.d / 2];
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [b.x + i * kx[0] + j * kz[0], b.z + i * kx[1] + j * kz[1]] as P2);
}

/** Titik di dinding luar ruang k sejauh `pos` dari ujung kiri (dilihat dari dalam) & arah normal ke dalam ruang. */
function titikDinding(k: Kotak, sisi: SisiDinding, pos: number): { p: P2; n: P2 } {
  switch (sisi) {
    case 'depan': return { p: [k.x0 + pos, 0], n: [0, 1] };
    case 'belakang': return { p: [k.x0 + k.p - pos, k.l], n: [0, -1] };
    case 'kiri': return { p: [k.x0, k.l - pos], n: [1, 0] };
    case 'kanan': return { p: [k.x0 + k.p, pos], n: [-1, 0] };
  }
}

const sudutDari = (v: P2) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;

export function denahDari(ruang: Ruang, benda: Benda[]): Denah {
  const kotak = daftarRuang(ruang);
  const garis: GarisDenah[] = [], busur: BusurDenah[] = [], tulisan: TulisanDenah[] = [];
  const g = (a: P2, b: P2, lapis: LapisDenah, putus?: boolean) => { if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-4) garis.push({ a, b, lapis, ...(putus ? { putus } : {}) }); };

  /** Daun pintu + busur ayun ke dalam ruang (engsel di h, kusen seberang di j, normal n). */
  const pintu = (h: P2, j: P2, n: P2) => {
    const lebar = Math.hypot(j[0] - h[0], j[1] - h[1]);
    const e: P2 = [h[0] + n[0] * lebar, h[1] + n[1] * lebar];
    g(h, e, 'BUKAAN');
    let a0 = sudutDari([e[0] - h[0], e[1] - h[1]]), a1 = sudutDari([j[0] - h[0], j[1] - h[1]]);
    if ((((a1 - a0) % 360) + 360) % 360 > 180) [a0, a1] = [a1, a0];
    busur.push({ c: h, r: lebar, a0, a1, lapis: 'BUKAAN' });
  };
  /** Satu ruas dinding luar dengan lubang pintu / jendela. */
  const dindingLuar = (i: number, k: Kotak, sisi: SisiDinding) => {
    const P = sisi === 'depan' || sisi === 'belakang' ? k.p : k.l;
    const lubang = sisiLuar(ruang, i).includes(sisi) ? bukaanDinding(ruang, i, sisi).sort((a, b) => a.x0 - b.x0) : [];
    let pos = 0;
    for (const l of lubang) {
      g(titikDinding(k, sisi, pos).p, titikDinding(k, sisi, l.x0).p, 'DINDING');
      const a = titikDinding(k, sisi, l.x0), b = titikDinding(k, sisi, l.x1);
      if (l.b.jenis === 'pintu') pintu(a.p, b.p, a.n);
      else { g(a.p, b.p, 'BUKAAN'); g([a.p[0] + a.n[0] * 0.05, a.p[1] + a.n[1] * 0.05], [b.p[0] + a.n[0] * 0.05, b.p[1] + a.n[1] * 0.05], 'BUKAAN'); }
      pos = Math.max(pos, l.x1);
    }
    g(titikDinding(k, sisi, pos).p, titikDinding(k, sisi, P).p, 'DINDING');
  };

  kotak.forEach((k, i) => {
    dindingLuar(i, k, 'depan'); dindingLuar(i, k, 'belakang');
    if (i === 0) dindingLuar(i, k, 'kiri');
    else {
      //  Sekat dengan ruang di kiri: bagian bersama (pintu penghubung / terbuka) + sisa dinding ruang yang lebih panjang.
      const s = sambunganKe(ruang, i), bersama = Math.min(kotak[i - 1].l, k.l), x = k.x0;
      if (s?.sekat === 'terbuka') g([x, 0], [x, bersama], 'BUKAAN', true);
      else {
        const zp = pintuSekat(ruang, i);
        if (zp === null) g([x, 0], [x, bersama], 'DINDING');
        else {
          const half = ukuranPintu(ruang, i).lebar / 2;
          g([x, 0], [x, zp - half], 'DINDING'); g([x, zp + half], [x, bersama], 'DINDING');
          pintu([x, zp - half], [x, zp + half], [1, 0]);
        }
      }
      if (kotak[i - 1].l > bersama) g([x, bersama], [x, kotak[i - 1].l], 'DINDING');
      if (k.l > bersama) g([x, bersama], [x, k.l], 'DINDING');
    }
    if (i === kotak.length - 1) dindingLuar(i, k, 'kanan');
  });

  //  Benda: tapak (plafon putus-putus), teks sebagai tulisan, label nama + elevasi benda dinding.
  for (const b of benda) {
    if (b.jenis === 'teks') {
      tulisan.push({ p: [b.x, b.z], teks: barisTeks(b.teks).join(' '), tinggi: Math.max(0.06, Math.min(0.3, b.tinggiHuruf ?? 0.12)), lapis: 'TEKS', ...(b.hadapTeks === 'lantai' && b.rot ? { sudut: -b.rot } : {}) });
      continue;
    }
    const plafon = b.elev >= ELEV_PLAFON;
    const s = sudutTapak(b);
    for (let j = 0; j < 4; j++) g(s[j], s[(j + 1) % 4], plafon ? 'PLAFON' : 'BENDA', plafon);
    //  Label: tanpa kursi, benda kecil, dan lampu / perangkat plafon (kecuali proyektor) supaya denah tidak ramai.
    if (b.jenis === 'kursi' || Math.max(b.w, b.d) < 0.3 || (plafon && b.jenis !== 'proyektor')) continue;
    const dinding = !plafon && b.elev > 0.3 && b.jenis !== 'perangkat' && b.jenis !== 'mic' && b.jenis !== 'lift';
    tulisan.push({ p: [b.x, b.z], teks: dinding ? `${b.nama} · el. +${mm(b.elev)}` : b.nama, tinggi: 0.08, lapis: plafon ? 'PLAFON' : 'TEKS' });
  }

  //  Garis ukur: dimensi ruang (lebar di atas dinding depan, panjang di kiri ruang 1 / kanan ruang terakhir).
  const ukur = (a: P2, b: P2, teks: string, geser: P2) => {
    const a2: P2 = [a[0] + geser[0], a[1] + geser[1]], b2: P2 = [b[0] + geser[0], b[1] + geser[1]];
    g(a, a2, 'UKURAN'); g(b, b2, 'UKURAN'); g(a2, b2, 'UKURAN');
    for (const t of [a2, b2]) g([t[0] - 0.05, t[1] + 0.05], [t[0] + 0.05, t[1] - 0.05], 'UKURAN');
    const tegak = Math.abs(b[0] - a[0]) < 1e-6;
    tulisan.push({ p: [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2], teks, tinggi: TINGGI_TEKS_UKUR, lapis: 'UKURAN', geser: tegak ? [-1, 0] : [0, -1], ...(tegak ? { sudut: -90 } : {}) });
  };
  kotak.forEach((k, i) => {
    ukur([k.x0, 0], [k.x0 + k.p, 0], mm(k.p), [0, -JARAK_UKUR]);
    if (i === 0) ukur([k.x0, 0], [k.x0, k.l], mm(k.l), [-JARAK_UKUR, 0]);
    else if (i === kotak.length - 1 || k.l !== kotak[i - 1].l) ukur([k.x0 + k.p, 0], [k.x0 + k.p, k.l], mm(k.l), [JARAK_UKUR, 0]);
  });
  const ujung = kotak[kotak.length - 1];
  if (kotak.length > 1) ukur([0, 0], [ujung.x0 + ujung.p, 0], mm(ujung.x0 + ujung.p), [0, -JARAK_UKUR * 2]);

  //  Rantai ukur display di dinding depan: dinding kiri → tepi display → lebar → tepi display → dinding kanan.
  kotak.forEach(k => {
    const depan = benda.filter(b => (DISPLAY.includes(b.jenis) || b.jenis === 'bidang') && b.x > k.x0 && b.x < k.x0 + k.p)
      .map(b => { const s = sudutTapak(b); return { b, x0: Math.min(...s.map(p => p[0])), x1: Math.max(...s.map(p => p[0])), z0: Math.min(...s.map(p => p[1])) }; })
      .filter(d => d.z0 < 0.3).sort((a, c) => a.x0 - c.x0);
    if (!depan.length) return;
    const titik = [k.x0, ...depan.flatMap(d => [d.x0, d.x1]), k.x0 + k.p].map(v => Math.min(k.x0 + k.p, Math.max(k.x0, v)));
    for (let j = 0; j < titik.length - 1; j++) if (titik[j + 1] - titik[j] > 0.02) ukur([titik[j], 0], [titik[j + 1], 0], mm(titik[j + 1] - titik[j]), [0, -JARAK_UKUR / 2]);
  });

  //  Penggaris (diproyeksikan ke lantai), panjang 3D sebenarnya.
  for (const p of penggarisSah(ruang.penggaris)) {
    g([p.a[0], p.a[2]], [p.b[0], p.b[2]], 'UKURAN', true);
    tulisan.push({ p: [(p.a[0] + p.b[0]) / 2, (p.a[2] + p.b[2]) / 2], geser: [0, -1], teks: mm(Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2])), tinggi: TINGGI_TEKS_UKUR, lapis: 'UKURAN' });
  }

  const xs = [...garis.flatMap(l => [l.a[0], l.b[0]]), ...tulisan.map(t => t.p[0])], zs = [...garis.flatMap(l => [l.a[1], l.b[1]]), ...tulisan.map(t => t.p[1])];
  const tepi = 0.25;
  return { garis, busur, tulisan, batas: { x0: Math.min(...xs) - tepi, z0: Math.min(...zs) - tepi, x1: Math.max(...xs) + tepi, z1: Math.max(...zs) + tepi } };
}
