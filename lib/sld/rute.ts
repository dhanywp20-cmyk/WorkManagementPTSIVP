import type { Sisi, Titik } from './tipe';

export interface Kotak { x: number; y: number; w: number; h: number }

export const JARAK_HINDAR = 3;
const KAKI = 4;
const TEKUK = 12;
const E = 1e-6;

export const potongKotak = (a: Kotak, b: Kotak) => a.x < b.x + b.w - E && b.x < a.x + a.w - E && a.y < b.y + b.h - E && b.y < a.y + a.h - E;

export function potongRuas(a: Titik, b: Titik, k: Kotak, g = 0): boolean {
  const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x), y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
  return x2 > k.x - g + E && x1 < k.x + k.w + g - E && y2 > k.y - g + E && y1 < k.y + k.h + g - E;
}

export const tabrak = (titik: Titik[], rintangan: Kotak[], g = 0) =>
  titik.some((t, i) => i > 0 && rintangan.some(k => potongRuas(titik[i - 1], t, k, g)));

export const arahSisi = (s: Sisi): Titik => (s === 'kiri' ? { x: -1, y: 0 } : s === 'kanan' ? { x: 1, y: 0 } : s === 'atas' ? { x: 0, y: -1 } : { x: 0, y: 1 });

export function koridor(a: Kotak, s: Sisi, ke: Titik): Kotak {
  if (s === 'kanan') return { x: a.x + a.w, y: a.y, w: Math.max(0, ke.x - a.x - a.w), h: a.h };
  if (s === 'kiri') return { x: Math.min(ke.x, a.x), y: a.y, w: Math.max(0, a.x - ke.x), h: a.h };
  if (s === 'bawah') return { x: a.x, y: a.y + a.h, w: a.w, h: Math.max(0, ke.y - a.y - a.h) };
  return { x: a.x, y: Math.min(ke.y, a.y), w: a.w, h: Math.max(0, a.y - ke.y) };
}

const unik = (v: number[]) => [...new Set(v.map(x => Math.round(x * 100) / 100))].sort((p, q) => p - q);

function rapikan(t: Titik[]): Titik[] {
  const h: Titik[] = [];
  for (const p of t) {
    if (h.length && Math.abs(h[h.length - 1].x - p.x) < E && Math.abs(h[h.length - 1].y - p.y) < E) continue;
    if (h.length >= 2) {
      const a = h[h.length - 2], b = h[h.length - 1];
      if ((Math.abs(a.x - b.x) < E && Math.abs(b.x - p.x) < E) || (Math.abs(a.y - b.y) < E && Math.abs(b.y - p.y) < E)) { h[h.length - 1] = p; continue; }
    }
    h.push(p);
  }
  return h;
}

class Antrian {
  private isi: [number, number][] = [];
  ada() { return this.isi.length > 0; }
  masuk(biaya: number, kunci: number) {
    const a = this.isi;
    a.push([biaya, kunci]);
    for (let i = a.length - 1; i > 0;) {
      const j = (i - 1) >> 1;
      if (a[j][0] <= a[i][0]) break;
      [a[i], a[j]] = [a[j], a[i]]; i = j;
    }
  }
  keluar(): [number, number] {
    const a = this.isi, atas = a[0], akhir = a.pop()!;
    if (a.length) {
      a[0] = akhir;
      for (let i = 0; ;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; i = m;
      }
    }
    return atas;
  }
}

export function ruteHindar(a: Titik, sa: Sisi, b: Titik, sb: Sisi, semua: Kotak[]): Titik[] | null {
  const da = arahSisi(sa), db = arahSisi(sb), G = JARAK_HINDAR;
  const a1 = { x: a.x + da.x * KAKI, y: a.y + da.y * KAKI }, b1 = { x: b.x + db.x * KAKI, y: b.y + db.y * KAKI };
  const tepi = 60;
  const bx = { x: Math.min(a1.x, b1.x) - tepi, y: Math.min(a1.y, b1.y) - tepi, w: Math.abs(a1.x - b1.x) + tepi * 2, h: Math.abs(a1.y - b1.y) + tepi * 2 };
  const rintangan = semua.filter(k => potongKotak(k, bx));
  const xs = unik([a1.x, b1.x, ...rintangan.flatMap(k => [k.x - G, k.x + k.w + G])]);
  const ys = unik([a1.y, b1.y, ...rintangan.flatMap(k => [k.y - G, k.y + k.h + G])]);
  const nx = xs.length, ny = ys.length, idx = (i: number, j: number) => j * nx + i;
  const cari = (v: number[], x: number) => v.findIndex(t => Math.abs(t - Math.round(x * 100) / 100) < 0.006);
  const mulai = idx(cari(xs, a1.x), cari(ys, a1.y)), akhir = idx(cari(xs, b1.x), cari(ys, b1.y));
  const titik = (n: number): Titik => ({ x: xs[n % nx], y: ys[Math.floor(n / nx)] });
  const arah = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  const arahKe = (d: Titik) => arah.findIndex(r => r.x === d.x && r.y === d.y);
  const g = G - 0.5, tutupH = new Uint8Array(nx * ny), tutupV = new Uint8Array(nx * ny);
  for (const k of rintangan) {
    const x0 = k.x - g + E, x1 = k.x + k.w + g - E, y0 = k.y - g + E, y1 = k.y + k.h + g - E;
    for (let j = 0; j < ny; j++) if (ys[j] > y0 && ys[j] < y1) for (let i = 0; i + 1 < nx; i++) if (xs[i + 1] > x0 && xs[i] < x1) tutupH[j * nx + i] = 1;
    for (let i = 0; i < nx; i++) if (xs[i] > x0 && xs[i] < x1) for (let j = 0; j + 1 < ny; j++) if (ys[j + 1] > y0 && ys[j] < y1) tutupV[i * ny + j] = 1;
  }
  const terhalang = (i: number, j: number, rd: number) =>
    (rd === 0 ? tutupH[j * nx + i] : rd === 1 ? tutupH[j * nx + i - 1] : rd === 2 ? tutupV[i * ny + j] : tutupV[i * ny + j - 1]) === 1;
  const total = nx * ny * 4, biaya = new Float64Array(total).fill(Infinity), asal = new Int32Array(total).fill(-1), selesai = new Uint8Array(total);
  const awal = mulai * 4 + arahKe(da);
  biaya[awal] = 0;
  const antrian = new Antrian();
  antrian.masuk(0, awal);
  while (antrian.ada()) {
    const [bs, s] = antrian.keluar();
    if (selesai[s] || bs > biaya[s]) continue;
    selesai[s] = 1;
    const n = Math.floor(s / 4), r = s % 4;
    if (n === akhir) {
      const jalur: Titik[] = [];
      for (let k = s; k >= 0; k = asal[k]) jalur.unshift(titik(Math.floor(k / 4)));
      return rapikan([a, ...jalur, b]);
    }
    const i = n % nx, j = Math.floor(n / nx);
    for (let rd = 0; rd < 4; rd++) {
      const d = arah[rd];
      if (d.x === -arah[r].x && d.y === -arah[r].y) continue;
      const i2 = i + d.x, j2 = j + d.y;
      if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= ny || terhalang(i, j, rd)) continue;
      const n2 = idx(i2, j2);
      let c = bs + Math.abs(xs[i2] - xs[i]) + Math.abs(ys[j2] - ys[j]) + (rd === r ? 0 : TEKUK);
      if (n2 === akhir && (d.x !== -db.x || d.y !== -db.y)) c += TEKUK;
      const k2 = n2 * 4 + rd;
      if (selesai[k2] || c >= biaya[k2]) continue;
      biaya[k2] = c; asal[k2] = s; antrian.masuk(c, k2);
    }
  }
  return null;
}
