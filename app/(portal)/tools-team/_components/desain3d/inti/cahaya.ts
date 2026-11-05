import { bendaBaru } from './katalog';
import { arahProyektor, bagianPanel, gainLayarDari, lumenGambarDari, luminanceDari, sinarProyektor } from './proyektor';
import { bukaanDinding, daftarRuang, ruangDari, sisiLuar } from './ruang';
import type { Benda, Kotak, Ruang, TipeLampu, Titik } from './tipe';

export const SPEK_LAMPU: Record<TipeLampu, { label: string; w: number; h: number; d: number; lumen: number; sudut: number; gantung: number }> = {
  downlight: { label: 'Downlight', w: 0.17, h: 0.06, d: 0.17, lumen: 1000, sudut: 60, gantung: 0 },
  spot: { label: 'Spotlight', w: 0.1, h: 0.1, d: 0.1, lumen: 700, sudut: 36, gantung: 0 },
  panel: { label: 'Panel LED 60×60', w: 0.6, h: 0.04, d: 0.6, lumen: 3600, sudut: 110, gantung: 0 },
  linear: { label: 'Lampu linear gantung', w: 1.2, h: 0.07, d: 0.06, lumen: 3500, sudut: 100, gantung: 0.6 },
  gantung: { label: 'Lampu gantung dekoratif', w: 0.42, h: 0.3, d: 0.42, lumen: 1500, sudut: 120, gantung: 0.9 },
};
export const lampuGantung = (t: TipeLampu | undefined) => SPEK_LAMPU[t ?? 'downlight'].gantung > 0;
export const lumenLampu = (b: Benda) => Math.max(0, b.lumen ?? SPEK_LAMPU[b.tipeLampu ?? 'downlight'].lumen);
export const sudutLampuDari = (b: Benda) => Math.max(10, Math.min(160, b.sudutLampu ?? SPEK_LAMPU[b.tipeLampu ?? 'downlight'].sudut));
export const nyalaLampu = (b: Benda, r: Ruang) => (Math.max(0, Math.min(100, b.dimmer ?? 100)) / 100) * (Math.max(0, Math.min(100, r.dimmer ?? 100)) / 100);
export const warnaKelvin = (k = 4000) => (k <= 3200 ? 0xffd6a0 : k <= 4500 ? 0xfff1dc : 0xeef4ff);
export function setLampuGrid(k: Kotak, atur: Partial<Benda> = {}): Benda[] {
  const nx = Math.max(1, Math.round(k.p / 2.2)), nz = Math.max(1, Math.round(k.l / 2.2));
  const hasil: Benda[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const b = bendaBaru('lampu', k, { tipeLampu: 'downlight', ...atur });
    hasil.push({ ...b, x: k.x0 + (k.p * (i + 0.5)) / nx, z: (k.l * (j + 0.5)) / nz, nama: `${b.nama} ${i * nz + j + 1}` });
  }
  return hasil;
}
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
export function luxPantul(lampu: Benda[], r: Ruang, k: Kotak, rho = 0.45): number {
  const phi = lampu.reduce((a, l) => a + lumenLampu(l) * nyalaLampu(l, r), 0);
  const luas = 2 * (k.p * k.l + k.p * k.t + k.l * k.t);
  return (phi * rho) / Math.max(1, luas * (1 - rho));
}
export const LUX_LUAR = { malam: 0, mendung: 8000, cerah: 20000, terik: 35000 } as const;
export type Siang = keyof typeof LUX_LUAR;
export function luxSiang(r: Ruang, ri: number): { lux: number; df: number; luasJendela: number } {
  const k = daftarRuang(r)[ri] ?? daftarRuang(r)[0];
  let Aw = 0;
  for (const sisi of sisiLuar(r, ri)) for (const x of bukaanDinding(r, ri, sisi)) if (x.b.jenis === 'jendela') Aw += (x.x1 - x.x0) * (x.y1 - x.y0);
  const A = 2 * (k.p * k.l + k.p * k.t + k.l * k.t);
  const df = (0.7 * Aw * 70 * 0.9) / Math.max(1, A * (1 - 0.45 * 0.45));
  const tutup = Math.min(100, Math.max(0, r.tirai ?? 0)) / 100;
  return { lux: (LUX_LUAR[r.siang ?? 'malam'] * df) / 100 * (1 - tutup), df, luasJendela: Aw };
}
export const LUX_PRESET: Record<'terang' | 'redup' | 'gelap', number> = { terang: 300, redup: 80, gelap: 5 };
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
export function luxBidangKerja(semua: Benda[], r: Ruang, ri: number) {
  const k = daftarRuang(r)[ri] ?? daftarRuang(r)[0];
  const nilai: number[] = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) {
    nilai.push(luxCahayaDi(semua, r, [k.x0 + (k.p * (i + 0.5)) / 8, 0.75, (k.l * (j + 0.5)) / 6], [0, 1, 0]).total);
  }
  return { rata: nilai.reduce((a, b) => a + b, 0) / nilai.length, min: Math.min(...nilai), maks: Math.max(...nilai) };
}
export const TARGET_KONTRAS: { v: number; l: string; ket: string }[] = [
  { v: 7, l: '7 : 1', ket: 'Passive viewing (tontonan santai)' },
  { v: 15, l: '15 : 1', ket: 'Basic decision making (presentasi, rapat)' },
  { v: 50, l: '50 : 1', ket: 'Analytical decision making (detail, spreadsheet)' },
  { v: 80, l: '80 : 1', ket: 'Full motion video (video, immersive)' },
];
export function kontrasProyektor(p: Benda, semua: Benda[], r: Ruang, target: number) {
  const sn = sinarProyektor(p, semua, r);
  const P: Titik = [0, 1, 2].map(i => sn.sudut.reduce((a, c) => a + c[i], 0) / 4) as Titik;
  let n: Titik;
  if (sn.layar) { const rl = (sn.layar.rot * Math.PI) / 180; n = [Math.sin(rl), 0, Math.cos(rl)]; }
  else { const D = arahProyektor(p); n = [-D[0], -D[1], -D[2]]; }
  const luas = Math.max(0.05, sn.lebar * sn.tinggi);
  const luxGambar = lumenGambarDari(p) / luas;
  const cahaya = luxCahayaDi(semua, r, P, n);
  const amb = Math.max(0.5, cahaya.total);
  const C = p.kontrasAsli && p.kontrasAsli > 1 ? p.kontrasAsli : Infinity;
  const kontras = (luxGambar + amb) / (luxGambar / C + amb);
  const luxPerlu = target < C ? (amb * (target - 1)) / (1 - target / C) : Infinity;
  const gain = gainLayarDari(sn.layar);
  return { luxGambar, cahaya, kontras, cukup: kontras >= target, lumenPerlu: Math.ceil((luxPerlu * luas) / (bagianPanel(p).lebar * bagianPanel(p).tinggi) / 100) * 100, luas,
    gain, luminance: luminanceDari(luxGambar, gain) };
}
