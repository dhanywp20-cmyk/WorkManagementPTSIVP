import { keGambar, lensaDari, type Lensa } from './blending';
import { cakupanProyektor, kerangka, permukaanBenda, TOLERANSI_TEPI } from './cakupanProyektor';
import { ukuranBidang } from './produk';
import { ruangDari } from './ruang';
import { type Benda, LABEL, LABEL_BENTUK_OBJEK, type Ruang, type Titik } from './tipe';

export const JENIS_DISINARI: ReadonlySet<Benda['jenis']> = new Set<Benda['jenis']>(['bidang', 'objek', 'model']);

export interface ObjekDisinari {
  b: Benda;
  jenis: string;
  ukuran: { w: number; h: number; d: number };
  proyektor: Benda[];
  sisi: string[];
  tertutup: number | null;
  tumpang: number | null;
  celah: string[];
}

const NAMA_BIDANG = { datar: 'Bidang mapping datar', lengkung: 'Bidang mapping cekung', cembung: 'Bidang mapping cembung', bola: 'Layar cekung bola' } as const;

export function jenisObjekDisinari(b: Benda): string {
  if (b.jenis === 'bidang') return (b.busur ?? 0) >= 360 && b.bentukBidang === 'cembung' ? 'Pilar mapping 360°' : NAMA_BIDANG[b.bentukBidang ?? 'datar'];
  if (b.jenis === 'objek') return `Objek mapping · ${LABEL_BENTUK_OBJEK[b.bentukObjek ?? 'kotak']}`;
  return LABEL[b.jenis];
}

const kena = (L: Lensa, X: Titik, n: Titik) => {
  const k = keGambar(L, X), w: Titik = [X[0] - L.O[0], X[1] - L.O[1], X[2] - L.O[2]];
  return !!k && Math.abs(k.u) <= 0.5 + TOLERANSI_TEPI && Math.abs(k.v) <= 0.5 + TOLERANSI_TEPI && w[0] * n[0] + w[1] * n[1] + w[2] * n[2] < 0;
};

const SISI: { nama: string; n: Titik; c: (w: number, h: number, d: number) => Titik; a: (w: number, h: number, d: number) => Titik; b: (w: number, h: number, d: number) => Titik }[] = [
  { nama: 'depan', n: [0, 0, 1], c: (w, h, d) => [0, h / 2, d / 2], a: w => [w / 2, 0, 0], b: (_, h) => [0, h / 2, 0] },
  { nama: 'kanan', n: [1, 0, 0], c: (w, h) => [w / 2, h / 2, 0], a: (_, __, d) => [0, 0, d / 2], b: (_, h) => [0, h / 2, 0] },
  { nama: 'kiri', n: [-1, 0, 0], c: (w, h) => [-w / 2, h / 2, 0], a: (_, __, d) => [0, 0, d / 2], b: (_, h) => [0, h / 2, 0] },
  { nama: 'belakang', n: [0, 0, -1], c: (w, h, d) => [0, h / 2, -d / 2], a: w => [w / 2, 0, 0], b: (_, h) => [0, h / 2, 0] },
  { nama: 'atas', n: [0, 1, 0], c: (_, h) => [0, h, 0], a: w => [w / 2, 0, 0], b: (_, __, d) => [0, 0, d / 2] },
];
const TITIK_SISI: [number, number][] = [[0, 0], [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]];

function sisiTerkena(o: Benda, L: Lensa): string[] {
  const F = kerangka(o), { w, h, d } = o;
  return SISI.filter(s => {
    const c = s.c(w, h, d), a = s.a(w, h, d), b = s.b(w, h, d), n = F.arahKeDunia(s.n);
    return TITIK_SISI.some(([i, j]) => kena(L, F.keDunia([c[0] + a[0] * i + b[0] * j, c[1] + a[1] * i + b[1] * j, c[2] + a[2] * i + b[2] * j]), n));
  }).map(s => s.nama);
}

export function objekDisinari(semua: Benda[], ruang: Ruang | null = null): ObjekDisinari[] {
  const proyektor = semua.filter(p => p.jenis === 'proyektor' && p.konten !== 'mati');
  if (!proyektor.length) return [];
  const lensa = new Map(proyektor.map(p => [p.id, lensaDari(p)]));
  const hasil: ObjekDisinari[] = [];
  for (const b of semua) {
    if (!JENIS_DISINARI.has(b.jenis)) continue;
    const sekamar = proyektor.filter(p => !ruang || ruangDari(ruang, p.x) === ruangDari(ruang, b.x));
    if (b.jenis === 'bidang') {
      const P = permukaanBenda(b);
      const ikut = sekamar.filter(p => P.sampel.some(X => kena(lensa.get(p.id)!, X.p, X.n)));
      if (!ikut.length) continue;
      const c = cakupanProyektor(ikut, P), u = ukuranBidang(b);
      hasil.push({ b, jenis: jenisObjekDisinari(b), ukuran: { w: u.w, h: b.h, d: u.d }, proyektor: ikut, sisi: [], tertutup: c.tertutup, tumpang: c.tumpang, celah: c.celah });
      continue;
    }
    const sisi = new Map<string, number>();
    const ikut = sekamar.filter(p => {
      const s = sisiTerkena(b, lensa.get(p.id)!);
      s.forEach(x => sisi.set(x, (sisi.get(x) ?? 0) + 1));
      return s.length > 0;
    });
    if (!ikut.length) continue;
    hasil.push({ b, jenis: jenisObjekDisinari(b), ukuran: { w: b.w, h: b.h, d: b.d }, proyektor: ikut, sisi: SISI.map(s => s.nama).filter(n => sisi.has(n)), tertutup: null, tumpang: null, celah: [] });
  }
  return hasil;
}
