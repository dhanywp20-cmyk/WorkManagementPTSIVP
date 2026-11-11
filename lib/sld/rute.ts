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
  const biaya = new Map<number, number>(), asal = new Map<number, number>();
  const kunci = (n: number, r: number) => n * 4 + r;
  const awal = kunci(mulai, arahKe(da));
  biaya.set(awal, 0);
  const buka = new Set([awal]), selesai = new Set<number>();
  const g = G - 0.5;
  while (buka.size) {
    let s = -1, bs = Infinity;
    for (const k of buka) { const c = biaya.get(k)!; if (c < bs) { bs = c; s = k; } }
    buka.delete(s); selesai.add(s);
    const n = Math.floor(s / 4), r = s % 4;
    if (n === akhir) {
      const jalur: Titik[] = [];
      for (let k: number | undefined = s; k !== undefined; k = asal.get(k)) jalur.unshift(titik(Math.floor(k / 4)));
      return rapikan([a, ...jalur, b]);
    }
    const i = n % nx, j = Math.floor(n / nx), p = titik(n);
    arah.forEach((d, rd) => {
      if (d.x === -arah[r].x && d.y === -arah[r].y) return;
      const i2 = i + d.x, j2 = j + d.y;
      if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= ny) return;
      const n2 = idx(i2, j2), q = titik(n2);
      if (rintangan.some(k => potongRuas(p, q, k, g))) return;
      let c = bs + Math.abs(q.x - p.x) + Math.abs(q.y - p.y) + (rd === r ? 0 : TEKUK);
      if (n2 === akhir && (d.x !== -db.x || d.y !== -db.y)) c += TEKUK;
      const k2 = kunci(n2, rd);
      if (selesai.has(k2) || c >= (biaya.get(k2) ?? Infinity)) return;
      biaya.set(k2, c); asal.set(k2, s); buka.add(k2);
    });
  }
  return null;
}
