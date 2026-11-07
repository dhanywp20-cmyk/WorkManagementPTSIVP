import { arahProyektor, geserLensaDari, keDunia, koreksiJarakDari, lensaProyektor, offsetLensaDari, rasioGambarProyektor, rasioProyektorDari, resolusiProyektorDari, throwRatioDari } from './proyektor';
import type { Benda, Titik } from './tipe';

export interface Lensa {
  O: Titik; D: Titik; kanan: Titik; atas: Titik;
   w1: number; h1: number;
   gH: number; gV: number;
}

const tambah = (a: Titik, b: Titik, k = 1): Titik => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const kurang = (a: Titik, b: Titik): Titik => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const titik = (a: Titik, b: Titik) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const silang = (a: Titik, b: Titik): Titik => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const panjang = (a: Titik) => Math.hypot(a[0], a[1], a[2]);
const satuan = (a: Titik): Titik => { const l = panjang(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const jarakTitik = (a: Titik, b: Titik) => panjang(kurang(a, b));

export function lensaDari(p: Benda): Lensa {
  const r = (p.rot * Math.PI) / 180;
  const D = satuan(arahProyektor(p));
  const kanan: Titik = [-Math.cos(r), 0, Math.sin(r)];
  const atas = satuan(silang(kanan, D));
  const w1 = 1 / throwRatioDari(p), h1 = w1 * rasioGambarProyektor(p);
  const arahV = p.pasangProyektor === 'meja' ? 1 : -1;
  const O = tambah(keDunia(p, lensaProyektor(p)), D, -koreksiJarakDari(p));
  return { O, D, kanan, atas, w1, h1, gH: geserLensaDari(p), gV: arahV * offsetLensaDari(p) };
}

export function arahSinar(L: Lensa, u: number, v: number): Titik {
  return satuan(tambah(tambah(L.D, L.kanan, (u + L.gH) * L.w1), L.atas, (v + L.gV) * L.h1));
}

export function keGambar(L: Lensa, X: Titik): { u: number; v: number } | null {
  const w = kurang(X, L.O);
  const t = titik(w, L.D);
  if (t <= 1e-6) return null;
  return { u: titik(w, L.kanan) / t / L.w1 - L.gH, v: titik(w, L.atas) / t / L.h1 - L.gV };
}

export function dalamGambar(L: Lensa, X: Titik): boolean {
  const k = keGambar(L, X);
  return !!k && Math.abs(k.u) <= 0.5 + 1e-9 && Math.abs(k.v) <= 0.5 + 1e-9;
}

function panjangGaris(t: (Titik | null)[], dari = 0, sampai = t.length - 1): number {
  let s = 0;
  for (let i = dari + 1; i <= sampai; i++) { const a = t[i - 1], b = t[i]; if (a && b) s += jarakTitik(a, b); }
  return s;
}

function sisaBingkai(L: Lensa, X: Titik): number | null {
  const k = keGambar(L, X);
  return k ? 0.5 - Math.max(Math.abs(k.u), Math.abs(k.v)) : null;
}

export function tumpangGaris(garisA: (Titik | null)[], LB: Lensa, terlihatB: (X: Titik) => boolean = () => true):
  { lebarM: number; persen: number; tengah: Titik; garis: Titik[] } | null {
  const n = garisA.length;
  if (n < 2 || panjangGaris(garisA) <= 1e-6) return null;
  const masuk = garisA.map(x => !!x && dalamGambar(LB, x) && terlihatB(x));
  let terbaik: [number, number] | null = null;
  for (let i = 0; i < masuk.length; i++) {
    if (!masuk[i]) continue;
    let j = i; while (j + 1 < masuk.length && masuk[j + 1]) j++;
    if (!terbaik || j - i > terbaik[1] - terbaik[0]) terbaik = [i, j];
    i = j;
  }
  if (!terbaik) return null;
  const [s, e] = terbaik;
  const seg = garisA.slice(1).map((b, i) => (b && garisA[i] ? jarakTitik(garisA[i]!, b) : 0)).filter(x => x > 0).sort((a, b) => a - b);
  const batasSeg = (seg[Math.floor(seg.length / 2)] ?? 0) * 3;
  const tepi = (dalam: number, luar: number): { t: number; X: Titik } => {
    const a = garisA[dalam]!, b = garisA[luar];
    if (!b || jarakTitik(a, b) > batasSeg) return { t: 0.5, X: a };
    const fa = sisaBingkai(LB, a), fb = sisaBingkai(LB, b);
    const t = fa !== null && fb !== null && fb < 0 ? Math.min(1, Math.max(0, fa / (fa - fb))) : 0.5;
    return { t, X: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] };
  };
  const awal = s > 0 ? tepi(s, s - 1) : { t: 0, X: garisA[s]! };
  const akhir = e < n - 1 ? tepi(e, e + 1) : { t: 0, X: garisA[e]! };
  const lebar = panjangGaris(garisA, s, e) + jarakTitik(awal.X, garisA[s]!) + jarakTitik(akhir.X, garisA[e]!);
  const porsi = (e - s + awal.t + akhir.t) / (n - 1);
  if (lebar < 0.005) return null;
  const m = Math.round((s + e) / 2);
  const garis = [awal.X, ...(garisA.slice(s, e + 1) as Titik[]), akhir.X].filter((x, i, d) => i === 0 || jarakTitik(x, d[i - 1]) > 1e-6);
  return { lebarM: lebar, persen: Math.min(100, porsi * 100), tengah: garisA[m]!, garis };
}

export interface SampelProyektor {
  p: Benda; L: Lensa;
  baris: (Titik | null)[]; kolom: (Titik | null)[];
}

export interface Blending {
  a: string; b: string; namaA: string; namaB: string;
  arah: 'kiri-kanan' | 'atas-bawah';
   lebarM: number;
   persenA: number; persenB: number;
   tengah: Titik;
   garis: Titik[];
   pxA?: number; pxB?: number; resA?: string; resB?: string;
}

function pikselSisi(p: Benda, arah: Blending['arah']): { px: number; res?: string } {
  const r = resolusiProyektorDari(p), a = rasioProyektorDari(p).px;
  return r ? { px: arah === 'kiri-kanan' ? r.x : r.y, res: r.kunci } : { px: arah === 'kiri-kanan' ? a.x : a.y };
}

export const BLENDING_MIN_PERSEN = 1;

export function hitungBlending(daftar: SampelProyektor[], terlihat: (i: number, X: Titik) => boolean = () => true): Blending[] {
  const hasil: Blending[] = [];
  for (let i = 0; i < daftar.length; i++) for (let j = i + 1; j < daftar.length; j++) {
    const A = daftar[i], B = daftar[j];
    const ukur = (sumbu: 'baris' | 'kolom') => {
      const ab = tumpangGaris(A[sumbu], B.L, X => terlihat(j, X));
      const ba = tumpangGaris(B[sumbu], A.L, X => terlihat(i, X));
      return ab && ba ? { ab, ba } : null;
    };
    const h = ukur('baris'), v = ukur('kolom');
    const pilih = h && v ? (h.ab.persen <= v.ab.persen ? { arah: 'kiri-kanan' as const, ...h } : { arah: 'atas-bawah' as const, ...v })
      : h ? { arah: 'kiri-kanan' as const, ...h } : v ? { arah: 'atas-bawah' as const, ...v } : null;
    if (!pilih || Math.max(pilih.ab.persen, pilih.ba.persen) < BLENDING_MIN_PERSEN) continue;
    const sa = pikselSisi(A.p, pilih.arah), sb = pikselSisi(B.p, pilih.arah);
    hasil.push({
      a: A.p.id, b: B.p.id, namaA: A.p.nama, namaB: B.p.nama, arah: pilih.arah,
      lebarM: (pilih.ab.lebarM + pilih.ba.lebarM) / 2, persenA: pilih.ab.persen, persenB: pilih.ba.persen,
      tengah: [(pilih.ab.tengah[0] + pilih.ba.tengah[0]) / 2, (pilih.ab.tengah[1] + pilih.ba.tengah[1]) / 2, (pilih.ab.tengah[2] + pilih.ba.tengah[2]) / 2],
      garis: pilih.ab.garis,
      pxA: sa.px, pxB: sb.px, ...(sa.res ? { resA: sa.res } : {}), ...(sb.res ? { resB: sb.res } : {}),
    });
  }
  return hasil;
}

export function teksBlending(b: Pick<Blending, 'lebarM' | 'persenA' | 'persenB'>): string {
  const cm = Math.round(b.lebarM * 100);
  const pa = Math.round(b.persenA), pb = Math.round(b.persenB);
  return `${cm} cm · ${pa === pb ? `${pa}%` : `${pa}% / ${pb}%`}`;
}

export const PIKSEL_ACUAN = { 'kiri-kanan': 1920, 'atas-bawah': 1080 } as const;

export const pikselBlending = (persen: number, arah: Blending['arah'], px: number = PIKSEL_ACUAN[arah]) => Math.round((persen / 100) * px);

export function barisKeterangan(b: Blending, nama: (n: string) => string = n => n): string[] {
  const pxA = b.pxA ?? PIKSEL_ACUAN[b.arah], pxB = b.pxB ?? PIKSEL_ACUAN[b.arah];
  const p = (x: number, px: number) => `${Math.round(x)}% ≈ ${pikselBlending(x, b.arah, px)} px`;
  const sisi = b.arah === 'kiri-kanan' ? 'lebar' : 'tinggi';
  const sumber = (res: string | undefined, px: number) => `${res ?? 'acuan'} ${px}`;
  const asal = b.resA || b.resB
    ? (sumber(b.resA, pxA) === sumber(b.resB, pxB) ? `${sumber(b.resA, pxA)} px` : `${sumber(b.resA, pxA)} / ${sumber(b.resB, pxB)} px`)
    : `acuan ${pxA === pxB ? `${pxA} px` : `${pxA} / ${pxB} px`}`;
  return [
    `Area blending ${nama(b.namaA)} ↔ ${nama(b.namaB)} · ${b.arah}`,
    `${sisi === 'lebar' ? 'Lebar' : 'Tinggi'} area ${Math.round(b.lebarM * 100)} cm`,
    `${nama(b.namaA)}: ${p(b.persenA, pxA)} · ${nama(b.namaB)}: ${p(b.persenB, pxB)}`,
    `dari ${sisi} gambar (${asal})`,
  ];
}
