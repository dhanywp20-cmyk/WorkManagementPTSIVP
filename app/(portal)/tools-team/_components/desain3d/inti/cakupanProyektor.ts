/**
 * desain3d/inti/cakupanProyektor.ts - Seberapa pas sinar proyektor dengan permukaan sasarannya, dihitung
 * dengan SINAR SEBENARNYA dari lensa (lensaDari / keGambar, rumus yang sama dengan sinar di kanvas) -
 * bukan gambar persegi ideal. Jadi keystone karena proyektor menunduk, dan layar lengkung / cembung yang
 * menjauh di ujungnya, ikut terhitung.
 *
 *   tertutup : bagian permukaan sasaran yang disinari minimal satu proyektor (0..1)
 *   tumpang  : bagian yang disinari >= 2 proyektor (area blending)
 *   meleset  : per proyektor, bagian gambarnya yang jatuh di luar sasaran (cahaya terbuang -> masking)
 *   celah    : tepi permukaan yang masih ada bagian tidak tersinari (atas / bawah / kiri / kanan)
 *
 * Permukaan yang dianalisis semuanya cembung atau cekung-dari-dalam (layar, bidang, dinding, lantai,
 * kotak), jadi "menghadap lensa" sudah cukup untuk keterlihatan; benda lain yang menghalangi tidak dihitung.
 * Murni: tanpa three.js / React / DOM (diuji di uji/desain3d-cakupan.ts).
 */
import { keGambar, lensaDari, arahSinar, type Lensa } from './blending';
import { ukuranBidang } from './produk';
import type { Benda, Kotak, Titik } from './tipe';

/** Titik sampel permukaan: posisi, normal sisi penerima cahaya, posisi relatif (0..1) mendatar & tegak. */
interface Sampel { p: Titik; n: Titik; s: number; t: number }
export interface Permukaan {
  nama: string;
  sampel: Sampel[];
  /** Jarak sinar (O + d·t) ke permukaan ini di sisi penerima, null = tidak kena. */
  kena: (O: Titik, d: Titik) => number | null;
}

const NS = 48, NT = 24;
/** Toleransi tepi (pecahan ukuran gambar, ±1% ≈ 2-3 cm): titik tepat di tepi layar tetap dihitung tersinari. */
export const TOLERANSI_TEPI = 0.01;
const dot = (a: Titik, b: Titik) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const kurang = (a: Titik, b: Titik): Titik => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Lokal benda (alas y = 0, +z = arah hadap) <-> dunia; kebalikan keDunia. */
function kerangka(b: Pick<Benda, 'x' | 'z' | 'elev' | 'rot'>) {
  const r = (b.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return {
    keDunia: ([x, y, z]: Titik): Titik => [b.x + x * c + z * s, b.elev + y, b.z - x * s + z * c],
    arahKeDunia: ([x, y, z]: Titik): Titik => [x * c + z * s, y, -x * s + z * c],
    keLokal: ([x, y, z]: Titik): Titik => { const dx = x - b.x, dz = z - b.z; return [dx * c - dz * s, y - b.elev, dx * s + dz * c]; },
    arahKeLokal: ([x, y, z]: Titik): Titik => [x * c - z * s, y, x * s + z * c],
  };
}

/** Bidang persegi: pusat, sumbu kanan & atas (satuan), normal sisi penerima, lebar & tinggi. */
export function permukaanPersegi(nama: string, pusat: Titik, kanan: Titik, atas: Titik, normal: Titik, w: number, h: number): Permukaan {
  const sampel: Sampel[] = [];
  for (let i = 0; i <= NS; i++) for (let j = 0; j <= NT; j++) {
    const s = i / NS, t = j / NT, a = (s - 0.5) * w, b = (t - 0.5) * h;
    sampel.push({ p: [pusat[0] + kanan[0] * a + atas[0] * b, pusat[1] + kanan[1] * a + atas[1] * b, pusat[2] + kanan[2] * a + atas[2] * b], n: normal, s, t });
  }
  return {
    nama, sampel,
    kena(O, d) {
      const dn = dot(d, normal);
      if (dn >= -1e-6) return null;               // dari belakang / sejajar
      const tt = dot(kurang(pusat, O), normal) / dn;
      if (tt <= 0) return null;
      const X: Titik = [O[0] + d[0] * tt, O[1] + d[1] * tt, O[2] + d[2] * tt], w0 = kurang(X, pusat);
      return Math.abs(dot(w0, kanan)) <= w / 2 + 1e-6 && Math.abs(dot(w0, atas)) <= h / 2 + 1e-6 ? tt : null;
    },
  };
}

/** Permukaan sasaran sebuah layar proyektor atau bidang mapping (datar / lengkung = cekung / cembung). */
export function permukaanBenda(b: Benda): Permukaan {
  const F = kerangka(b);
  if (b.jenis === 'layar' || (b.jenis === 'bidang' && (b.bentukBidang ?? 'datar') === 'datar')) {
    const w = b.jenis === 'layar' ? b.w : ukuranBidang(b).w, muka = b.jenis === 'layar' ? b.d / 2 : 0.02;
    return permukaanPersegi(b.nama, F.keDunia([0, b.h / 2, muka]), F.arahKeDunia([1, 0, 0]), [0, 1, 0], F.arahKeDunia([0, 0, 1]), w, b.h);
  }
  //  Silinder tegak seperti bangun/mapping.ts: cembung = sisi luar, pusat di belakang; lengkung = sisi dalam.
  const { R, busur, d } = ukuranBidang(b);
  const cembung = b.bentukBidang === 'cembung', zP = cembung ? d / 2 - R : R - d / 2;
  const tb = (busur * Math.PI) / 180, a0 = cembung ? -tb / 2 : Math.PI - tb / 2;
  const sampel: Sampel[] = [];
  for (let i = 0; i <= NS; i++) for (let j = 0; j <= NT; j++) {
    const s = i / NS, t = j / NT, a = a0 + tb * (cembung ? s : 1 - s);   // s = 0 di kiri dilihat penonton
    const nl: Titik = cembung ? [Math.sin(a), 0, Math.cos(a)] : [-Math.sin(a), 0, -Math.cos(a)];
    sampel.push({ p: F.keDunia([R * Math.sin(a), t * b.h, zP + R * Math.cos(a)]), n: F.arahKeDunia(nl), s, t });
  }
  return {
    nama: b.nama, sampel,
    kena(Ow, dw) {
      const O = F.keLokal(Ow), dd = F.arahKeLokal(dw);
      const ox = O[0], oz = O[2] - zP, A = dd[0] ** 2 + dd[2] ** 2, B = 2 * (ox * dd[0] + oz * dd[2]), C = ox * ox + oz * oz - R * R;
      const disk = B * B - 4 * A * C;
      if (A < 1e-9 || disk < 0) return null;
      const akar = Math.sqrt(disk);
      for (const tt of cembung ? [(-B - akar) / (2 * A)] : [(-B + akar) / (2 * A)]) {
        if (tt <= 0) continue;
        const x = ox + dd[0] * tt, z = oz + dd[2] * tt, y = O[1] + dd[1] * tt;
        if (y < -1e-6 || y > b.h + 1e-6) continue;
        let a = Math.atan2(x, z) - a0;
        a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (a <= tb + 1e-6) return tt;
      }
      return null;
    },
  };
}

/** Dinding / lantai ruangan (kotak k) sebagai permukaan sasaran. */
export function permukaanRuang(k: Kotak, sisi: 'depan' | 'belakang' | 'kiri' | 'kanan' | 'lantai'): Permukaan {
  const cx = k.x0 + k.p / 2;
  switch (sisi) {
    case 'depan': return permukaanPersegi('Dinding depan', [cx, k.t / 2, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], k.p, k.t);
    case 'belakang': return permukaanPersegi('Dinding belakang', [cx, k.t / 2, k.l], [-1, 0, 0], [0, 1, 0], [0, 0, -1], k.p, k.t);
    case 'kiri': return permukaanPersegi('Dinding kiri', [k.x0, k.t / 2, k.l / 2], [0, 0, -1], [0, 1, 0], [1, 0, 0], k.l, k.t);
    case 'kanan': return permukaanPersegi('Dinding kanan', [k.x0 + k.p, k.t / 2, k.l / 2], [0, 0, 1], [0, 1, 0], [-1, 0, 0], k.l, k.t);
    case 'lantai': return permukaanPersegi('Lantai', [cx, 0, k.l / 2], [1, 0, 0], [0, 0, 1], [0, 1, 0], k.p, k.l);
  }
}

export interface Cakupan {
  nama: string;
  tertutup: number; tumpang: number;
  /** Per proyektor (urutan masukan): bagian gambar yang tidak jatuh di permukaan ini. */
  meleset: number[];
  celah: ('atas' | 'bawah' | 'kiri' | 'kanan' | 'tengah')[];
}

/** Titik X disinari proyektor berlensa L: di dalam bingkai gambar & permukaannya menghadap lensa. */
function disinari(L: Lensa, X: Sampel): boolean {
  const k = keGambar(L, X.p);
  return !!k && Math.abs(k.u) <= 0.5 + TOLERANSI_TEPI && Math.abs(k.v) <= 0.5 + TOLERANSI_TEPI && dot(kurang(X.p, L.O), X.n) < 0;
}

/** Cakupan sekumpulan proyektor pada satu permukaan sasaran. */
export function cakupanProyektor(proyektor: Benda[], P: Permukaan): Cakupan {
  const lensa = proyektor.map(lensaDari);
  let tutup = 0, tumpang = 0;
  const kosong: Sampel[] = [];
  for (const X of P.sampel) {
    const n = lensa.filter(L => disinari(L, X)).length;
    if (n >= 1) tutup++; else kosong.push(X);
    if (n >= 2) tumpang++;
  }
  const meleset = lensa.map(L => {
    let luar = 0, total = 0;
    const sisi = 0.5 - TOLERANSI_TEPI;
    for (let i = 0; i <= 40; i++) for (let j = 0; j <= 22; j++) { total++; if (P.kena(L.O, arahSinar(L, (i / 40 - 0.5) * 2 * sisi, (j / 22 - 0.5) * 2 * sisi)) === null) luar++; }
    return luar / total;
  });
  const celah = new Set<Cakupan['celah'][number]>();
  for (const X of kosong) {
    if (X.t >= 0.9) celah.add('atas'); else if (X.t <= 0.1) celah.add('bawah');
    if (X.s <= 0.1) celah.add('kiri'); else if (X.s >= 0.9) celah.add('kanan');
    if (X.t > 0.1 && X.t < 0.9 && X.s > 0.1 && X.s < 0.9) celah.add('tengah');
  }
  const N = P.sampel.length;
  return { nama: P.nama, tertutup: tutup / N, tumpang: tumpang / N, meleset, celah: [...celah] };
}
