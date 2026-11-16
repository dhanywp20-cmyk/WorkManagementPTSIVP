import { lensaDari } from './blending';
import { JENIS_BIDANG_MASK, kenaBidang } from './maskProyektor';
import { PESAWAT_ACUAN } from './produk';
import { engselProyektor, tiltDari } from './proyektor';
import type { Benda, Titik } from './tipe';

export interface Penghalang { id: string; nama: string; min: Titik; max: Titik; dalam: (x: number, y: number, z: number) => boolean }

export const PROFIL_BADAN_PESAWAT: readonly (readonly [number, number])[] = [
  [0.02, -1.38], [0.2, -1.32], [0.34, -1.2], [0.45, -1.0], [0.52, -0.68], [0.55, -0.3], [0.54, 0.2], [0.48, 0.6], [0.36, 1.0], [0.22, 1.3], [0.08, 1.47], [0.01, 1.5],
];
const SIRIP: [number, number][] = [[0.85, 0.3], [1.48, 0], [1.48, 0.95], [1.25, 0.95]];

function jariBadan(z: number) {
  const P = PROFIL_BADAN_PESAWAT;
  if (z < P[0][1] || z > P[P.length - 1][1]) return -1;
  for (let i = 1; i < P.length; i++) {
    if (z > P[i][1]) continue;
    const [r0, z0] = P[i - 1], [r1, z1] = P[i];
    return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0);
  }
  return -1;
}
function dalamPoligon(p: [number, number][], x: number, y: number) {
  let dalam = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dalam = !dalam;
  }
  return dalam;
}

export function dalamPesawatAcuan(x: number, y: number, z: number): boolean {
  const ax = Math.abs(x), SUMBU = 0.8;
  if (ax <= 0.5 && y >= 0 && y <= 0.25 && Math.abs(z - 0.1) <= 1.1) return true;
  const r = jariBadan(z);
  if (r > 0 && ax * ax + (y - SUMBU) ** 2 <= r * r) return true;
  if (ax <= 0.9 && Math.abs(y - 0.6) <= 0.03 && z >= -0.05 + (0.17 * ax) / 0.9 && z <= 0.55 - (0.13 * ax) / 0.9) return true;
  if (ax <= 0.45 && Math.abs(y - SUMBU - 0.06) <= 0.02 && z >= 1.12 + (0.14 * ax) / 0.45 && z <= 1.46 - (0.04 * ax) / 0.45) return true;
  if (ax <= 0.025 && dalamPoligon(SIRIP, z, y - SUMBU)) return true;
  if ((z + 1.4) ** 2 + ax * ax + (y - SUMBU) ** 2 <= 0.11 * 0.11) return true;
  if (Math.abs(z + 1.38) <= 0.0125) {
    const k = Math.cos(Math.PI / 5), s = Math.sin(Math.PI / 5), yy = y - SUMBU;
    if (Math.abs(x * k + yy * s) <= 0.035 && Math.abs(-x * s + yy * k) <= 0.55) return true;
  }
  return false;
}

function keLokal(b: Benda) {
  const r = (b.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return (x: number, y: number, z: number): Titik => { const dx = x - b.x, dz = z - b.z; return [dx * c - dz * s, y - b.elev, dx * s + dz * c]; };
}

export function penghalangBenda(b: Benda): Penghalang | null {
  if (JENIS_BIDANG_MASK.has(b.jenis)) return null;
  const lokal = keLokal(b), jari = Math.hypot(b.w, b.d) / 2 + 0.05;
  const kotak = (y0: number, y1: number): Pick<Penghalang, 'min' | 'max'> => ({ min: [b.x - jari, b.elev + y0, b.z - jari], max: [b.x + jari, b.elev + y1, b.z + jari] });
  if (b.jenis === 'proyektor') {
    const meja = b.pasangProyektor === 'meja', tiang = !meja && !b.tanpaTiang;
    const [, hy, hz] = engselProyektor(b), t = (tiltDari(b) * Math.PI) / 180, ct = Math.cos(t), st = Math.sin(t);
    const turun = Math.hypot(b.d, b.h) + 0.05;
    return {
      id: b.id, nama: b.nama, ...kotak(-turun, tiang ? 99 : b.h + 0.1),
      dalam: (x, y, z) => {
        const [lx, ly, lz] = lokal(x, y, z);
        if (tiang && ly >= b.h && lx * lx + lz * lz <= 0.0016) return true;
        const py = ly - hy, pz = lz - hz, qy = py * ct - pz * st + hy, qz = py * st + pz * ct + hz;
        return Math.abs(lx) <= b.w / 2 && qy >= 0 && qy <= b.h && Math.abs(qz) <= b.d / 2;
      },
    };
  }
  if (b.jenis === 'objek' && b.bentukObjek === 'pesawat') {
    const A = PESAWAT_ACUAN, kx = A.w / b.w, ky = A.h / b.h, kz = A.d / b.d;
    return { id: b.id, nama: b.nama, ...kotak(0, b.h), dalam: (x, y, z) => { const [lx, ly, lz] = lokal(x, y, z); return dalamPesawatAcuan(lx * kx, ly * ky, lz * kz); } };
  }
  return { id: b.id, nama: b.nama, ...kotak(0, b.h), dalam: (x, y, z) => { const [lx, ly, lz] = lokal(x, y, z); return Math.abs(lx) <= b.w / 2 && ly >= 0 && ly <= b.h && Math.abs(lz) <= b.d / 2; } };
}

function rentangKotak(O: Titik, d: Titik, min: Titik, max: Titik, t0: number, t1: number): [number, number] | null {
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-12) { if (O[i] < min[i] || O[i] > max[i]) return null; continue; }
    let a = (min[i] - O[i]) / d[i], b = (max[i] - O[i]) / d[i];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

const LANGKAH = 0.01;
export function terhalangDi(O: Titik, d: Titik, panjang: number, penghalang: Penghalang[]): Penghalang | null {
  for (const q of penghalang) {
    const r = rentangKotak(O, d, q.min, q.max, 0.03, panjang - 0.01);
    if (!r) continue;
    for (let t = r[0]; t <= r[1]; t += LANGKAH) if (q.dalam(O[0] + d[0] * t, O[1] + d[1] * t, O[2] + d[2] * t)) return q;
  }
  return null;
}

export interface BayanganProyektor {
  id: string; nama: string;
  keLayar: number;
  balikLayar: number;
  terhalang: { nama: string; porsi: number }[];
  terlihatPilot: number;
}

export function bayanganProyektor(benda: Benda[], opsi: { NU?: number; NV?: number; mata?: Titik | null } = {}): BayanganProyektor[] {
  const NU = opsi.NU ?? 48, NV = opsi.NV ?? 30;
  const bidang = benda.filter(b => JENIS_BIDANG_MASK.has(b.jenis)).map(kenaBidang);
  const semua = benda.map(penghalangBenda).filter((q): q is Penghalang => !!q);
  return benda.filter(p => p.jenis === 'proyektor').map(p => {
    const L = lensaDari(p), O = L.O, kena = bidang.map(f => f(O));
    const penghalang = semua.filter(q => q.id !== p.id), hitung = new Map<string, number>();
    let keLayar = 0, balik = 0, terlihat = 0, total = 0;
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const fu = ((i + 0.5) / NU - 0.5 + L.gH) * L.w1, fv = ((j + 0.5) / NV - 0.5 + L.gV) * L.h1;
      let d: Titik = [L.D[0] + L.kanan[0] * fu + L.atas[0] * fv, L.D[1] + L.kanan[1] * fu + L.atas[1] * fv, L.D[2] + L.kanan[2] * fu + L.atas[2] * fv];
      const n = Math.hypot(d[0], d[1], d[2]); d = [d[0] / n, d[1] / n, d[2] / n];
      let t = 0;
      for (const f of kena) { const x = f(d[0], d[1], d[2]); if (x !== 0 && (t === 0 || Math.abs(x) < Math.abs(t))) t = x; }
      if (t === 0) continue;
      total++;
      if (t < 0) { balik++; continue; }
      const q = terhalangDi(O, d, t, penghalang);
      if (!q) { keLayar++; continue; }
      hitung.set(q.nama, (hitung.get(q.nama) ?? 0) + 1);
      if (opsi.mata) {
        const X: Titik = [O[0] + d[0] * t, O[1] + d[1] * t, O[2] + d[2] * t], m = opsi.mata;
        const v: Titik = [X[0] - m[0], X[1] - m[1], X[2] - m[2]], jarak = Math.hypot(v[0], v[1], v[2]);
        const u: Titik = [v[0] / jarak, v[1] / jarak, v[2] / jarak];
        if (!terhalangDi(m, u, jarak, semua)) terlihat++;
      }
    }
    const bagi = Math.max(1, total);
    return {
      id: p.id, nama: p.nama, keLayar: keLayar / bagi, balikLayar: balik / bagi,
      terhalang: [...hitung].map(([nama, c]) => ({ nama, porsi: c / bagi })).sort((a, b) => b.porsi - a.porsi),
      terlihatPilot: terlihat / bagi,
    };
  });
}
