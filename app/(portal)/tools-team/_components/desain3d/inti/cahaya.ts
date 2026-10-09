/**
 * desain3d/inti/cahaya.ts - Lampu plafon & perhitungan cahaya: lux langsung + pantul, cahaya siang, kontras gambar proyektor.
 * Murni: tanpa three.js / React / DOM (diuji di uji/desain3d.ts).
 */
import { bendaBaru } from './katalog';
import { arahProyektor, lumenDari, sinarProyektor } from './proyektor';
import { bukaanDinding, daftarRuang, ruangDari, sisiLuar } from './ruang';
import type { Benda, Kotak, Ruang, TipeLampu, Titik } from './tipe';

// ── Lampu plafon & perhitungan cahaya ───────────────────────────────────────

export const SPEK_LAMPU: Record<TipeLampu, { label: string; w: number; h: number; d: number; lumen: number; sudut: number; gantung: number }> = {
  downlight: { label: 'Downlight', w: 0.17, h: 0.06, d: 0.17, lumen: 1000, sudut: 60, gantung: 0 },
  spot: { label: 'Spotlight', w: 0.1, h: 0.1, d: 0.1, lumen: 700, sudut: 36, gantung: 0 },
  panel: { label: 'Panel LED 60×60', w: 0.6, h: 0.04, d: 0.6, lumen: 3600, sudut: 110, gantung: 0 },
  linear: { label: 'Lampu linear gantung', w: 1.2, h: 0.07, d: 0.06, lumen: 3500, sudut: 100, gantung: 0.6 },
  gantung: { label: 'Lampu gantung dekoratif', w: 0.42, h: 0.3, d: 0.42, lumen: 1500, sudut: 120, gantung: 0.9 },
};
/** Lampu yang tergantung kabel dari plafon (jarak gantung bisa diatur). */
export const lampuGantung = (t: TipeLampu | undefined) => SPEK_LAMPU[t ?? 'downlight'].gantung > 0;
export const lumenLampu = (b: Benda) => Math.max(0, b.lumen ?? SPEK_LAMPU[b.tipeLampu ?? 'downlight'].lumen);
export const sudutLampuDari = (b: Benda) => Math.max(10, Math.min(160, b.sudutLampu ?? SPEK_LAMPU[b.tipeLampu ?? 'downlight'].sudut));
/** Faktor nyala lampu 0..1 (dimmer lampu x dimmer semua lampu ruangan). */
export const nyalaLampu = (b: Benda, r: Ruang) => (Math.max(0, Math.min(100, b.dimmer ?? 100)) / 100) * (Math.max(0, Math.min(100, r.dimmer ?? 100)) / 100);
/** Warna cahaya dari suhu warna (K). */
export const warnaKelvin = (k = 4000) => (k <= 3200 ? 0xffd6a0 : k <= 4500 ? 0xfff1dc : 0xeef4ff);
/** Downlight merata di plafon satu ruang (jarak ±2,2 m, 0,6-1,1 m dari dinding). */
export function setLampuGrid(k: Kotak, atur: Partial<Benda> = {}): Benda[] {
  const nx = Math.max(1, Math.round(k.p / 2.2)), nz = Math.max(1, Math.round(k.l / 2.2));
  const hasil: Benda[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const b = bendaBaru('lampu', k, { tipeLampu: 'downlight', ...atur });
    hasil.push({ ...b, x: k.x0 + (k.p * (i + 0.5)) / nx, z: (k.l * (j + 0.5)) / nz, nama: `${b.nama} ${i * nz + j + 1}` });
  }
  return hasil;
}
/**
 * Iluminansi langsung (lux) dari satu lampu plafon di titik P berpermukaan normal n.
 * Lampu = sumber titik menghadap ke bawah dengan distribusi I = I0 cos^m(a): m dipilih supaya
 * intensitas 50% tepat di tepi sudut sinar, I0 supaya fluks total = lumen x dimmer.
 * Lampu linear dipecah 4 titik sepanjang badannya. E = I cos(b) / d^2.
 */
export function luxLampuLangsung(l: Benda, r: Ruang, P: Titik, n: Titik): number {
  const phi = lumenLampu(l) * nyalaLampu(l, r);
  if (phi <= 0) return 0;
  const setengah = (sudutLampuDari(l) / 2) * (Math.PI / 180);
  const m = Math.log(0.5) / Math.log(Math.cos(Math.min(1.5, setengah)));
  const linear = l.tipeLampu === 'linear', bagian = linear ? 4 : 1;
  const I0 = (phi * (m + 1)) / (2 * Math.PI) / bagian;
  const rr = (l.rot * Math.PI) / 180;
  let E = 0;
  for (let i = 0; i < bagian; i++) {
    const t = linear ? ((i + 0.5) / bagian - 0.5) * l.w : 0;
    const sx = l.x + t * Math.cos(rr), sz = l.z - t * Math.sin(rr), sy = l.elev;
    const vx = P[0] - sx, vy = P[1] - sy, vz = P[2] - sz;
    const d2 = vx * vx + vy * vy + vz * vz; if (d2 < 1e-4) continue;
    const d = Math.sqrt(d2), cosA = -vy / d;
    if (cosA <= 0) continue;
    const cosB = Math.max(0, -(vx * n[0] + vy * n[1] + vz * n[2]) / d);
    E += (I0 * Math.pow(cosA, m) * cosB) / d2;
  }
  return E;
}
/** Cahaya pantulan rata-rata di permukaan ruang (lux): fluks total x rho / (luas permukaan x (1 - rho)). */
export function luxPantul(lampu: Benda[], r: Ruang, k: Kotak, rho = 0.45): number {
  const phi = lampu.reduce((a, l) => a + lumenLampu(l) * nyalaLampu(l, r), 0);
  const luas = 2 * (k.p * k.l + k.p * k.t + k.l * k.t);
  return (phi * rho) / Math.max(1, luas * (1 - rho));
}
/** Cahaya langit di luar (lux horizontal, difus - tanpa sinar matahari langsung masuk) per kondisi. */
export const LUX_LUAR = { malam: 0, mendung: 8000, cerah: 20000, terik: 35000 } as const;
export type Siang = keyof typeof LUX_LUAR;
/**
 * Cahaya siang rata-rata di dalam ruang ri dari jendela dinding luar (lux), rumus average daylight
 * factor (BRE): DF% = T × Aw × θ × M / (A × (1 − R²)) dengan transmisi kaca T 0,7, sudut langit
 * terlihat θ 70°, faktor kotor M 0,9, pantulan rata-rata R 0,45, A = luas semua permukaan ruang.
 * Tirai/blind mengurangi sebanding persen tertutup. Jendela di sekat (ke ruang lain) tidak dihitung.
 */
export function luxSiang(r: Ruang, ri: number): { lux: number; df: number; luasJendela: number } {
  const k = daftarRuang(r)[ri] ?? daftarRuang(r)[0];
  let Aw = 0;
  for (const sisi of sisiLuar(r, ri)) for (const x of bukaanDinding(r, ri, sisi)) if (x.b.jenis === 'jendela') Aw += (x.x1 - x.x0) * (x.y1 - x.y0);
  const A = 2 * (k.p * k.l + k.p * k.t + k.l * k.t);
  const df = (0.7 * Aw * 70 * 0.9) / Math.max(1, A * (1 - 0.45 * 0.45));
  const tutup = Math.min(100, Math.max(0, r.tirai ?? 0)) / 100;
  return { lux: (LUX_LUAR[r.siang ?? 'malam'] * df) / 100 * (1 - tutup), df, luasJendela: Aw };
}
/** Perkiraan cahaya ruangan bila belum ada lampu di desain (dari pilihan Cahaya ruangan). */
export const LUX_PRESET: Record<'terang' | 'redup' | 'gelap', number> = { terang: 300, redup: 80, gelap: 5 };
/**
 * Cahaya ruangan yang jatuh di titik P (normal n): lampu (langsung + pantulan, atau perkiraan preset
 * bila belum ada lampu) ditambah cahaya siang dari jendela.
 */
export function luxCahayaDi(semua: Benda[], r: Ruang, P: Titik, n: Titik) {
  const ri = ruangDari(r, P[0]);
  const k = daftarRuang(r)[ri] ?? daftarRuang(r)[0];
  const lampu = semua.filter(b => b.jenis === 'lampu' && ruangDari(r, b.x) === ri);
  const siang = luxSiang(r, ri).lux;
  if (!lampu.length) {
    const preset = LUX_PRESET[r.cahaya ?? 'terang'];
    return { langsung: preset, pantul: 0, siang, total: preset + siang, dariLampu: false, jumlahLampu: 0 };
  }
  const langsung = lampu.reduce((a, l) => a + luxLampuLangsung(l, r, P, n), 0);
  const pantul = luxPantul(lampu, r, k);
  return { langsung, pantul, siang, total: langsung + pantul + siang, dariLampu: true, jumlahLampu: lampu.length };
}
/** Rata-rata iluminansi di bidang kerja (0,75 m) satu ruang - 8 x 6 titik. */
export function luxBidangKerja(semua: Benda[], r: Ruang, ri: number) {
  const k = daftarRuang(r)[ri] ?? daftarRuang(r)[0];
  const nilai: number[] = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) {
    nilai.push(luxCahayaDi(semua, r, [k.x0 + (k.p * (i + 0.5)) / 8, 0.75, (k.l * (j + 0.5)) / 6], [0, 1, 0]).total);
  }
  return { rata: nilai.reduce((a, b) => a + b, 0) / nilai.length, min: Math.min(...nilai), maks: Math.max(...nilai) };
}
/** Target kontras gambar proyeksi (ANSI/INFOCOMM 3M-2011, AVIXA). */
export const TARGET_KONTRAS: { v: number; l: string; ket: string }[] = [
  { v: 7, l: '7 : 1', ket: 'Passive viewing (tontonan santai)' },
  { v: 15, l: '15 : 1', ket: 'Basic decision making (presentasi, rapat)' },
  { v: 50, l: '50 : 1', ket: 'Analytical decision making (detail, spreadsheet)' },
  { v: 80, l: '80 : 1', ket: 'Full motion video (video, immersive)' },
];
/**
 * Kontras gambar proyektor terhadap cahaya ruangan: (lux gambar + lux ruangan) / lux ruangan,
 * dihitung di tengah gambar dengan normal permukaan yang dituju (layar, dinding, lantai).
 */
export function kontrasProyektor(p: Benda, semua: Benda[], r: Ruang, target: number) {
  const sn = sinarProyektor(p, semua, r);
  const P: Titik = [0, 1, 2].map(i => sn.sudut.reduce((a, c) => a + c[i], 0) / 4) as Titik;
  let n: Titik;
  if (sn.layar) { const rl = (sn.layar.rot * Math.PI) / 180; n = [Math.sin(rl), 0, Math.cos(rl)]; }
  else { const D = arahProyektor(p); n = [-D[0], -D[1], -D[2]]; }
  const luas = Math.max(0.05, sn.lebar * sn.tinggi);
  const luxGambar = lumenDari(p) / luas;
  const cahaya = luxCahayaDi(semua, r, P, n);
  const amb = Math.max(0.5, cahaya.total);
  const kontras = (luxGambar + amb) / amb;
  return { luxGambar, cahaya, kontras, cukup: kontras >= target, lumenPerlu: Math.ceil(((target - 1) * amb * luas) / 100) * 100, luas };
}
