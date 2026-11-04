
export interface BagianKontur { l: number[]; h?: number[][] }
export type Kontur = BagianKontur[];

export type ModeLatar = 'otomatis' | 'transparan' | 'warna' | 'utuh';
export interface OpsiKontur {
  latar: ModeLatar;
   toleransi: number;
   lubangLatar?: boolean;
}

export interface HasilKontur {
  kontur: Kontur;
   kotak: { x0: number; y0: number; x1: number; y1: number };
   mode: Exclude<ModeLatar, 'otomatis'>;
  titik: number;
}

const ALFA_LATAR = 128;

export function adaTransparansi(rgba: ArrayLike<number>, w: number, h: number): boolean {
  let n = 0;
  for (let i = 3; i < w * h * 4; i += 4) if (rgba[i] < ALFA_LATAR) n++;
  return n > w * h * 0.02;
}

export function warnaTepi(rgba: ArrayLike<number>, w: number, h: number): [number, number, number] {
  const r: number[] = [], g: number[] = [], b: number[] = [];
  const ambil = (x: number, y: number) => { const i = (y * w + x) * 4; r.push(rgba[i]); g.push(rgba[i + 1]); b.push(rgba[i + 2]); };
  for (let x = 0; x < w; x++) { ambil(x, 0); ambil(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { ambil(0, y); ambil(w - 1, y); }
  const med = (a: number[]) => { a.sort((p, q) => p - q); return a[a.length >> 1] ?? 255; };
  return [med(r), med(g), med(b)];
}

export function buatTopeng(rgba: ArrayLike<number>, w: number, h: number, opsi: OpsiKontur): { topeng: Uint8Array; mode: Exclude<ModeLatar, 'otomatis'> } {
  const n = w * h, topeng = new Uint8Array(n);
  const mode: Exclude<ModeLatar, 'otomatis'> = opsi.latar === 'otomatis' ? (adaTransparansi(rgba, w, h) ? 'transparan' : 'warna') : opsi.latar;
  if (mode === 'utuh') { topeng.fill(1); return { topeng, mode }; }
  if (mode === 'transparan') {
    for (let i = 0; i < n; i++) topeng[i] = rgba[i * 4 + 3] >= ALFA_LATAR ? 1 : 0;
    return { topeng, mode };
  }
  const [lr, lg, lb] = warnaTepi(rgba, w, h);
  const batas = (Math.max(0, Math.min(100, opsi.toleransi)) / 100) * 200;
  const batas2 = batas * batas;
  const mirip = (i: number) => {
    const p = i * 4;
    if (rgba[p + 3] < ALFA_LATAR) return true;
    const dr = rgba[p] - lr, dg = rgba[p + 1] - lg, db = rgba[p + 2] - lb;
    return dr * dr + dg * dg + db * db <= batas2;
  };
  if (opsi.lubangLatar) {
    for (let i = 0; i < n; i++) topeng[i] = mirip(i) ? 0 : 1;
    return { topeng, mode };
  }
  topeng.fill(1);
  const antre = new Int32Array(n); let kepala = 0, ekor = 0;
  const coba = (i: number) => { if (topeng[i] === 1 && mirip(i)) { topeng[i] = 0; antre[ekor++] = i; } };
  for (let x = 0; x < w; x++) { coba(x); coba((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { coba(y * w); coba(y * w + w - 1); }
  while (kepala < ekor) {
    const i = antre[kepala++], x = i % w;
    if (x > 0) coba(i - 1);
    if (x < w - 1) coba(i + 1);
    if (i >= w) coba(i - w);
    if (i < n - w) coba(i + w);
  }
  return { topeng, mode };
}

function komponen(topeng: Uint8Array, w: number, h: number, nilai: 0 | 1): { label: Int32Array; luas: number[]; tepi: boolean[] } {
  const n = w * h, label = new Int32Array(n).fill(-1), luas: number[] = [], tepi: boolean[] = [];
  const antre = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (topeng[s] !== nilai || label[s] !== -1) continue;
    const id = luas.length; let kepala = 0, ekor = 0, jml = 0, sentuh = false;
    label[s] = id; antre[ekor++] = s;
    while (kepala < ekor) {
      const i = antre[kepala++], x = i % w, y = (i - x) / w; jml++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) sentuh = true;
      const tetangga = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of tetangga) if (j >= 0 && topeng[j] === nilai && label[j] === -1) { label[j] = id; antre[ekor++] = j; }
    }
    luas.push(jml); tepi.push(sentuh);
  }
  return { label, luas, tepi };
}

export function bersihkanTopeng(topeng: Uint8Array, w: number, h: number, minBagian = 0.02, minLubang = 0.004): Uint8Array {
  const hasil = topeng.slice();
  const ob = komponen(hasil, w, h, 1);
  const terbesar = Math.max(0, ...ob.luas);
  if (!terbesar) return hasil;
  for (let i = 0; i < hasil.length; i++) if (hasil[i] && ob.luas[ob.label[i]] < terbesar * minBagian) hasil[i] = 0;
  let luasObjek = 0; for (let i = 0; i < hasil.length; i++) luasObjek += hasil[i];
  const lt = komponen(hasil, w, h, 0);
  for (let i = 0; i < hasil.length; i++) {
    const id = lt.label[i];
    if (id >= 0 && !lt.tepi[id] && lt.luas[id] < luasObjek * minLubang) hasil[i] = 1;
  }
  return hasil;
}

export function telusuriTepi(topeng: Uint8Array, w: number, h: number): number[][] {
  const isi = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && topeng[y * w + x] === 1;
  const keluar = new Map<number, number[]>();
  const W1 = w + 1;
  const tambah = (x0: number, y0: number, x1: number, y1: number) => {
    const a = y0 * W1 + x0, b = y1 * W1 + x1;
    const l = keluar.get(a); if (l) l.push(b); else keluar.set(a, [b]);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!isi(x, y)) continue;
    if (!isi(x, y - 1)) tambah(x, y, x + 1, y);
    if (!isi(x + 1, y)) tambah(x + 1, y, x + 1, y + 1);
    if (!isi(x, y + 1)) tambah(x + 1, y + 1, x, y + 1);
    if (!isi(x - 1, y)) tambah(x, y + 1, x, y);
  }
  const hasil: number[][] = [];
  for (const [awal] of keluar) {
    let daftar = keluar.get(awal);
    while (daftar && daftar.length) {
      const poli: number[] = [];
      let a = awal, b = daftar.shift()!, dx0 = 0, dy0 = 0;
      for (let langkah = 0; langkah < 4 * W1 * (h + 1); langkah++) {
        const ax = a % W1, ay = (a - ax) / W1, bx = b % W1, by = (b - bx) / W1;
        const dx = bx - ax, dy = by - ay;
        if (dx !== dx0 || dy !== dy0) poli.push(ax, ay);
        dx0 = dx; dy0 = dy;
        if (b === awal) break;
        const lanjut = keluar.get(b);
        if (!lanjut || !lanjut.length) break;
        let pilih = 0;
        if (lanjut.length > 1) {
          const kanan = (c: number) => { const cx = c % W1, cy = (c - cx) / W1; return dx * (cy - by) - dy * (cx - bx); };
          pilih = lanjut.reduce((p, c, i) => (kanan(c) > kanan(lanjut[p]) ? i : p), 0);
        }
        a = b; b = lanjut.splice(pilih, 1)[0];
      }
      if (poli.length >= 8) {
        const n = poli.length, ax = poli[n - 2], ay = poli[n - 1], bx = poli[0], by = poli[1], cx = poli[2], cy = poli[3];
        if ((bx - ax) * (cy - by) - (by - ay) * (cx - bx) === 0) poli.splice(0, 2);
      }
      if (poli.length >= 6) hasil.push(poli);
      daftar = keluar.get(awal);
    }
  }
  return hasil;
}

export function luasPoligon(p: number[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    s += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return s / 2;
}

export function sederhanakan(p: number[], tol: number): number[] {
  const n = p.length / 2;
  if (n <= 4) return p.slice();
  let jauh = 0, dMaks = -1;
  for (let i = 1; i < n; i++) { const d = (p[2 * i] - p[0]) ** 2 + (p[2 * i + 1] - p[1]) ** 2; if (d > dMaks) { dMaks = d; jauh = i; } }
  const simpan = new Uint8Array(n); simpan[0] = 1; simpan[jauh] = 1;
  const tol2 = tol * tol;
  const dp = (a: number, b: number) => {
    const tumpuk: [number, number][] = [[a, b]];
    while (tumpuk.length) {
      const [s, e] = tumpuk.pop()!;
      const panjang = (e - s + n) % n; if (panjang < 2) continue;
      const ax = p[2 * s], ay = p[2 * s + 1], bx = p[2 * e], by = p[2 * e + 1];
      const vx = bx - ax, vy = by - ay, vv = vx * vx + vy * vy || 1e-12;
      let idx = -1, d2 = -1;
      for (let k = 1; k < panjang; k++) {
        const i = (s + k) % n, px = p[2 * i] - ax, py = p[2 * i + 1] - ay;
        const t = Math.max(0, Math.min(1, (px * vx + py * vy) / vv));
        const ex = px - t * vx, ey = py - t * vy, dd = ex * ex + ey * ey;
        if (dd > d2) { d2 = dd; idx = i; }
      }
      if (d2 > tol2 && idx >= 0) { simpan[idx] = 1; tumpuk.push([s, idx], [idx, e]); }
    }
  };
  dp(0, jauh); dp(jauh, 0);
  const hasil: number[] = [];
  for (let i = 0; i < n; i++) if (simpan[i]) hasil.push(p[2 * i], p[2 * i + 1]);
  return hasil;
}

function didalam(x: number, y: number, p: number[]): boolean {
  let masuk = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) masuk = !masuk;
  }
  return masuk;
}

const MAKS_TITIK = 700;

export function konturDariPiksel(rgba: ArrayLike<number>, w: number, h: number, opsi: OpsiKontur): HasilKontur | null {
  const { topeng: mentah, mode } = buatTopeng(rgba, w, h, opsi);
  const topeng = mode === 'utuh' ? mentah : bersihkanTopeng(mentah, w, h);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (topeng[y * w + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const lebar = x1 + 1 - x0, tinggi = y1 + 1 - y0;
  if (lebar < 3 || tinggi < 3) return null;
  const tepi = telusuriTepi(topeng, w, h);
  let tol = Math.max(1, Math.max(lebar, tinggi) / 320);
  let poli: number[][] = [];
  for (let coba = 0; coba < 8; coba++) {
    poli = tepi.map(p => sederhanakan(p, tol)).filter(p => p.length >= 6 && Math.abs(luasPoligon(p)) >= 2);
    if (poli.reduce((s, p) => s + p.length / 2, 0) <= MAKS_TITIK) break;
    tol *= 1.6;
  }
  const luar = poli.filter(p => luasPoligon(p) > 0).sort((a, b) => luasPoligon(b) - luasPoligon(a));
  const lubang = poli.filter(p => luasPoligon(p) < 0);
  const nx = (x: number) => Math.round(((x - x0) / lebar) * 10000) / 10000;
  const ny = (y: number) => Math.round((1 - (y - y0) / tinggi) * 10000) / 10000;
  const norm = (p: number[]) => p.map((v, i) => (i % 2 ? ny(v) : nx(v)));
  const bagian: Kontur = luar.map(l => ({ l: norm(l), h: [] as number[][] }));
  for (const hl of lubang) {
    let pemilik = -1;
    for (let i = luar.length - 1; i >= 0; i--) if (didalam(hl[0], hl[1], luar[i])) { pemilik = i; break; }
    if (pemilik >= 0) bagian[pemilik].h!.push(norm(hl));
  }
  for (const b of bagian) if (!b.h!.length) delete b.h;
  const titik = poli.reduce((s, p) => s + p.length / 2, 0);
  return { kontur: bagian, kotak: { x0, y0, x1: x1 + 1, y1: y1 + 1 }, mode, titik };
}

export function konturSah(x: unknown): Kontur | null {
  if (!Array.isArray(x) || !x.length || x.length > 200) return null;
  let total = 0;
  const angkaSah = (p: unknown): p is number[] =>
    Array.isArray(p) && p.length >= 6 && p.length % 2 === 0 && p.every(v => typeof v === 'number' && Number.isFinite(v) && v >= -0.01 && v <= 1.01);
  for (const b of x as BagianKontur[]) {
    if (!b || !angkaSah(b.l)) return null;
    total += b.l.length;
    if (b.h !== undefined) {
      if (!Array.isArray(b.h) || !b.h.every(angkaSah)) return null;
      total += b.h.reduce((s, p) => s + p.length, 0);
    }
  }
  return total <= 4 * MAKS_TITIK ? (x as Kontur) : null;
}
