import { keGambar, lensaDari, arahSinar, type Lensa } from './blending';
import { bolaBidang, ukuranBidang } from './produk';
import { gantiRasioProyektor, pasangKeLayar, RASIO_PROYEKTOR, rasioGambarProyektor } from './proyektor';
import type { Benda, Kotak, RasioProyektor, Ruang, Titik } from './tipe';

interface Sampel { p: Titik; n: Titik; s: number; t: number }
export interface Permukaan {
  nama: string;
  sampel: Sampel[];
  kena: (O: Titik, d: Titik) => number | null;
}

const NS = 48, NT = 24;
export const TOLERANSI_TEPI = 0.01;
const dot = (a: Titik, b: Titik) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const kurang = (a: Titik, b: Titik): Titik => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

function kerangka(b: Pick<Benda, 'x' | 'z' | 'elev' | 'rot'>) {
  const r = (b.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return {
    keDunia: ([x, y, z]: Titik): Titik => [b.x + x * c + z * s, b.elev + y, b.z - x * s + z * c],
    arahKeDunia: ([x, y, z]: Titik): Titik => [x * c + z * s, y, -x * s + z * c],
    keLokal: ([x, y, z]: Titik): Titik => { const dx = x - b.x, dz = z - b.z; return [dx * c - dz * s, y - b.elev, dx * s + dz * c]; },
    arahKeLokal: ([x, y, z]: Titik): Titik => [x * c - z * s, y, x * s + z * c],
  };
}

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
      if (dn >= -1e-6) return null;
      const tt = dot(kurang(pusat, O), normal) / dn;
      if (tt <= 0) return null;
      const X: Titik = [O[0] + d[0] * tt, O[1] + d[1] * tt, O[2] + d[2] * tt], w0 = kurang(X, pusat);
      return Math.abs(dot(w0, kanan)) <= w / 2 + 1e-6 && Math.abs(dot(w0, atas)) <= h / 2 + 1e-6 ? tt : null;
    },
  };
}

function permukaanBola(b: Benda, F: ReturnType<typeof kerangka>): Permukaan {
  const { R, tb, a0, zP, yP, fiA, fiB } = bolaBidang(b);
  const sampel: Sampel[] = [];
  for (let i = 0; i <= NS; i++) for (let j = 0; j <= NT; j++) {
    const s = i / NS, t = j / NT, a = a0 + tb * (1 - s), fi = -fiB + (fiA + fiB) * t;
    const arah: Titik = [Math.cos(fi) * Math.sin(a), Math.sin(fi), Math.cos(fi) * Math.cos(a)];
    sampel.push({ p: F.keDunia([R * arah[0], yP + R * arah[1], zP + R * arah[2]]), n: F.arahKeDunia([-arah[0], -arah[1], -arah[2]]), s, t });
  }
  return {
    nama: b.nama, sampel,
    kena(Ow, dw) {
      const O = F.keLokal(Ow), dd = F.arahKeLokal(dw);
      const o: Titik = [O[0], O[1] - yP, O[2] - zP];
      const A = dot(dd, dd), B = 2 * dot(o, dd), C = dot(o, o) - R * R, disk = B * B - 4 * A * C;
      if (A < 1e-9 || disk < 0) return null;
      const tt = (-B + Math.sqrt(disk)) / (2 * A);
      if (tt <= 0) return null;
      const x = o[0] + dd[0] * tt, y = o[1] + dd[1] * tt, z = o[2] + dd[2] * tt;
      const fi = Math.asin(Math.max(-1, Math.min(1, y / R)));
      if (fi > fiA + 1e-6 || fi < -fiB - 1e-6) return null;
      let a = Math.atan2(x, z) - a0;
      a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return a <= tb + 1e-6 ? tt : null;
    },
  };
}

export function permukaanBenda(b: Benda): Permukaan {
  const F = kerangka(b);
  if (b.jenis === 'layar' || (b.jenis === 'bidang' && (b.bentukBidang ?? 'datar') === 'datar')) {
    const w = b.jenis === 'layar' ? b.w : ukuranBidang(b).w, muka = b.jenis === 'layar' ? b.d / 2 : 0.02;
    return permukaanPersegi(b.nama, F.keDunia([0, b.h / 2, muka]), F.arahKeDunia([1, 0, 0]), [0, 1, 0], F.arahKeDunia([0, 0, 1]), w, b.h);
  }
  if (b.bentukBidang === 'bola') return permukaanBola(b, F);
  const { R, busur, d } = ukuranBidang(b);
  const cembung = b.bentukBidang === 'cembung', zP = cembung ? d / 2 - R : R - d / 2;
  const tb = (busur * Math.PI) / 180, a0 = cembung ? -tb / 2 : Math.PI - tb / 2;
  const sampel: Sampel[] = [];
  for (let i = 0; i <= NS; i++) for (let j = 0; j <= NT; j++) {
    const s = i / NS, t = j / NT, a = a0 + tb * (cembung ? s : 1 - s);
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

export const BATAS_LUBER = 0.01;
export interface LuberLayar { atas: number; bawah: number; kiri: number; kanan: number; maks: number }

export function luberLayar(p: Benda, l: Benda): LuberLayar {
  const L = lensaDari(p), F = kerangka(l);
  const C = F.keDunia([0, l.h / 2, l.d / 2]), kanan = F.arahKeDunia([1, 0, 0]), n = F.arahKeDunia([0, 0, 1]);
  const x: LuberLayar = { atas: 0, bawah: 0, kiri: 0, kanan: 0, maks: 0 };
  for (const u of [-0.5, 0.5]) for (const v of [-0.5, 0.5]) {
    const d = arahSinar(L, u, v), dn = dot(d, n);
    if (dn >= -1e-6) return { ...x, maks: Infinity };
    const t = dot(kurang(C, L.O), n) / dn;
    const w0 = kurang([L.O[0] + d[0] * t, L.O[1] + d[1] * t, L.O[2] + d[2] * t], C);
    const gx = dot(w0, kanan), gy = w0[1];
    x.kanan = Math.max(x.kanan, gx - l.w / 2); x.kiri = Math.max(x.kiri, -gx - l.w / 2);
    x.atas = Math.max(x.atas, gy - l.h / 2); x.bawah = Math.max(x.bawah, -gy - l.h / 2);
  }
  return { ...x, maks: Math.max(x.atas, x.bawah, x.kiri, x.kanan) };
}

export function teksLuber(x: LuberLayar): string {
  if (!Number.isFinite(x.maks)) return 'sebagian cahaya tidak mengarah ke layar';
  return (['atas', 'bawah', 'kiri', 'kanan'] as const).filter(s => x[s] > BATAS_LUBER).map(s => `${s} ${Math.round(x[s] * 100)} cm`).join(', ');
}

export function masukkanKeLayar(p: Benda, l: Benda, k: Kotak, ruang: Ruang): { benda: Benda; sisa: LuberLayar; dimask: boolean } {
  const r = l.rasio as RasioProyektor | undefined;
  const bisaRasio = !!r && r !== (p.rasioProyektor ?? '16:9') && !!RASIO_PROYEKTOR[r] && (!p.koefRasio || !!p.koefRasio[r]);
  const q: Benda = bisaRasio ? { ...p, ...gantiRasioProyektor(p, r) } : p;
  let hasil = pasangKeLayar(q, l, k, ruang).benda;
  if (luberLayar(hasil, l).maks > BATAS_LUBER) {
    hasil = pasangKeLayar(hasil, l, k, ruang, { du: 0, dv: 0, lebar: Math.min(l.w, l.h / rasioGambarProyektor(hasil)) }).benda;
  }
  const sisa = luberLayar(hasil, l), dimask = sisa.maks > BATAS_LUBER;
  return { benda: dimask ? { ...hasil, maskBidang: true } : hasil, sisa, dimask };
}

export interface Cakupan {
  nama: string;
  tertutup: number; tumpang: number;
  meleset: number[];
  celah: ('atas' | 'bawah' | 'kiri' | 'kanan' | 'tengah')[];
}

function disinari(L: Lensa, X: Sampel): boolean {
  const k = keGambar(L, X.p);
  return !!k && Math.abs(k.u) <= 0.5 + TOLERANSI_TEPI && Math.abs(k.v) <= 0.5 + TOLERANSI_TEPI && dot(kurang(X.p, L.O), X.n) < 0;
}

const LANGKAH_TEPI = 160, LUAR_TEPI = 0.002;

function menyinari(L: Lensa, X: Titik, P: Permukaan): boolean {
  const k = keGambar(L, X);
  if (!k || Math.abs(k.u) > 0.5 || Math.abs(k.v) > 0.5) return false;
  const w = kurang(X, L.O), jarak = Math.hypot(w[0], w[1], w[2]), t = P.kena(L.O, [w[0] / jarak, w[1] / jarak, w[2] / jarak]);
  return t !== null && Math.abs(t - jarak) < 1e-3;
}

export function celahTepi(lensa: Lensa[], P: Permukaan): Titik[] {
  const hasil: Titik[] = [];
  lensa.forEach((L, i) => {
    for (let k = 0; k <= LANGKAH_TEPI; k++) {
      const a = k / LANGKAH_TEPI - 0.5, b = 0.5 + LUAR_TEPI;
      for (const [u, v] of [[a, b], [a, -b], [b, a], [-b, a]]) {
        const d = arahSinar(L, u, v), t = P.kena(L.O, d);
        if (t === null) continue;
        const X: Titik = [L.O[0] + d[0] * t, L.O[1] + d[1] * t, L.O[2] + d[2] * t];
        if (!lensa.some((M, j) => j !== i && menyinari(M, X, P))) hasil.push(X);
      }
    }
  });
  return hasil;
}

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
  const tandai = (X: Pick<Sampel, 's' | 't'>) => {
    if (X.t >= 0.9) celah.add('atas'); else if (X.t <= 0.1) celah.add('bawah');
    if (X.s <= 0.1) celah.add('kiri'); else if (X.s >= 0.9) celah.add('kanan');
    if (X.t > 0.1 && X.t < 0.9 && X.s > 0.1 && X.s < 0.9) celah.add('tengah');
  };
  kosong.forEach(tandai);
  const retak = lensa.length > 1 && P.sampel.length ? celahTepi(lensa, P) : [];
  for (const X of retak.filter((_, i) => i % Math.ceil(retak.length / 40) === 0)) {
    let dekat = P.sampel[0], jarak = Infinity;
    for (const S of P.sampel) { const w = kurang(S.p, X), d = dot(w, w); if (d < jarak) { jarak = d; dekat = S; } }
    tandai(dekat);
  }
  const N = P.sampel.length, tertutup = tutup / N;
  return { nama: P.nama, tertutup: retak.length && tertutup >= 1 ? (N - 1) / N : tertutup, tumpang: tumpang / N, meleset, celah: [...celah] };
}
