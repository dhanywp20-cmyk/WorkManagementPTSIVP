import { ukuranDariDiagonal } from './hitung';

const RAD = Math.PI / 180;

export const KETAJAMAN_MATA_RAD = RAD / 60;

export function jarakPikselMenyatuM(pitchMm: number): number {
  return pitchMm / 1000 / Math.tan(KETAJAMAN_MATA_RAD);
}

export const RESOLUSI_DISPLAY = [
  { nama: 'Full HD', x: 1920, y: 1080 },
  { nama: '4K UHD', x: 3840, y: 2160 },
  { nama: '8K', x: 7680, y: 4320 },
] as const;

export function cekResolusi(lebarLayarM: number, jarakTerdekatM: number) {
  return RESOLUSI_DISPLAY.map(r => {
    const pitchMm = (lebarLayarM * 1000) / r.x;
    const menyatuM = jarakPikselMenyatuM(pitchMm);
    return { nama: r.nama, x: r.x, y: r.y, pitchMm, menyatuM, cukup: jarakTerdekatM >= menyatuM };
  });
}

export function sudutKeAtasDerajat(jarakM: number, mataM: number, bawahGambarM: number, tinggiGambarM: number): number {
  return Math.atan2(bawahGambarM + tinggiGambarM - mataM, Math.max(0.01, jarakM)) / RAD;
}

export function jarakTerdekatNyamanM(mataM: number, bawahGambarM: number, tinggiGambarM: number, batasDerajat = 30): number {
  const naik = bawahGambarM + tinggiGambarM - mataM;
  return naik <= 0 ? 0 : naik / Math.tan(batasDerajat * RAD);
}

export interface PanelVideowall { nama: string; diagonalInci: number; bezelMm: number }
export const PANEL_VIDEOWALL: PanelVideowall[] = [
  { nama: '46" · bezel 3,5 mm', diagonalInci: 46, bezelMm: 3.5 },
  { nama: '49" · bezel 3,5 mm', diagonalInci: 49, bezelMm: 3.5 },
  { nama: '55" · bezel 3,5 mm', diagonalInci: 55, bezelMm: 3.5 },
  { nama: '55" · bezel 1,8 mm', diagonalInci: 55, bezelMm: 1.8 },
  { nama: '55" · bezel 0,88 mm', diagonalInci: 55, bezelMm: 0.88 },
];

export function videowallUntuk(lebarTargetM: number, tinggiTargetM: number, panel: PanelVideowall) {
  const p = ukuranDariDiagonal(panel.diagonalInci, 16, 9);
  const b = panel.bezelMm / 1000;
  const kolom = Math.max(1, Math.round((lebarTargetM + b) / (p.lebarM + b)));
  const baris = Math.max(1, Math.round((tinggiTargetM + b) / (p.tinggiM + b)));
  const lebarM = kolom * p.lebarM + (kolom - 1) * b;
  const tinggiM = baris * p.tinggiM + (baris - 1) * b;
  return { kolom, baris, jumlah: kolom * baris, lebarM, tinggiM, diagonalInci: (Math.hypot(lebarM, tinggiM) * 1000) / 25.4, resX: kolom * 1920, resY: baris * 1080 };
}

export const KONTRAS_ANSI = [
  { v: 'pasif', l: 'Tontonan pasif (signage, hiburan)', rasio: 7 },
  { v: 'dasar', l: 'Keputusan dasar (presentasi, rapat)', rasio: 15 },
  { v: 'analitis', l: 'Keputusan analitis (spreadsheet, CAD)', rasio: 50 },
  { v: 'video', l: 'Video gerak penuh (sinema)', rasio: 80 },
] as const;
export type KategoriKontras = (typeof KONTRAS_ANSI)[number]['v'];

export function lumenUntukKontras(luasM2: number, luxDiLayar: number, rasio: number, kontrasAsli?: number): number {
  const C = kontrasAsli && kontrasAsli > 1 ? kontrasAsli : Infinity;
  if (rasio >= C) return Infinity;
  return (luasM2 * Math.max(0, luxDiLayar) * Math.max(0, rasio - 1)) / (1 - rasio / C);
}

export function kontrasDiLayar(lumen: number, luasM2: number, luxDiLayar: number, kontrasAsli?: number): number {
  const E = lumen / Math.max(1e-6, luasM2), La = Math.max(1e-6, luxDiLayar);
  const C = kontrasAsli && kontrasAsli > 1 ? kontrasAsli : Infinity;
  return (E + La) / (E / C + La);
}

export const luminanceLayar = (lux: number, gain = 1) => (lux * gain) / Math.PI;

export function lumenSpesifikasi(lumenPerlu: number, susutPersen: number): number {
  return lumenPerlu / Math.max(0.1, 1 - Math.min(90, Math.max(0, susutPersen)) / 100);
}

export function rentangJarakLempar(lebarGambarM: number, trMin: number, trMaks: number, koreksiM = 0, koreksiTeleM = koreksiM) {
  return { dekatM: lebarGambarM * Math.min(trMin, trMaks) - koreksiM, jauhM: lebarGambarM * Math.max(trMin, trMaks) - koreksiTeleM };
}

export function rumusLensaDariDuaTitik(lebar1M: number, jarak1M: number, lebar2M: number, jarak2M: number): { tr: number; b: number } | null {
  if (![lebar1M, jarak1M, lebar2M, jarak2M].every(v => Number.isFinite(v) && v > 0)) return null;
  if (Math.abs(lebar2M - lebar1M) < 1e-6) return null;
  const tr = (jarak2M - jarak1M) / (lebar2M - lebar1M);
  if (!(tr > 0)) return null;
  return { tr, b: tr * lebar1M - jarak1M };
}

export type Pemasangan = 'plafon' | 'meja';

export function rentangTinggiLensa(bawahGambarM: number, tinggiGambarM: number, shiftAtasPersen: number, shiftBawahPersen: number, pasang: Pemasangan = 'plafon') {
  const pusat = bawahGambarM + tinggiGambarM / 2;
  const [turun, naik] = pasang === 'meja' ? [shiftAtasPersen, shiftBawahPersen] : [shiftBawahPersen, shiftAtasPersen];
  return { terendahM: pusat - (tinggiGambarM * turun) / 100, tertinggiM: pusat + (tinggiGambarM * naik) / 100 };
}

export function tinggiLensaTetap(bawahGambarM: number, tinggiGambarM: number, offsetPersen: number, pasang: Pemasangan = 'plafon') {
  const pusat = bawahGambarM + tinggiGambarM / 2;
  return pusat + (pasang === 'meja' ? -1 : 1) * (tinggiGambarM * offsetPersen) / 100;
}

export function hitungBlending(kolom: number, baris: number, lebarSatuM: number, overlapPersen: number, resX: number, resY: number) {
  const o = Math.min(50, Math.max(0, overlapPersen)) / 100;
  const k = Math.max(1, Math.round(kolom)), b = Math.max(1, Math.round(baris));
  const tinggiSatuM = (lebarSatuM * resY) / resX;
  const faktorX = k - (k - 1) * o, faktorY = b - (b - 1) * o;
  return {
    jumlah: k * b, lebarM: lebarSatuM * faktorX, tinggiM: tinggiSatuM * faktorY,
    resX: Math.round(resX * faktorX), resY: Math.round(resY * faktorY),
    overlapM: lebarSatuM * o, overlapPx: Math.round(resX * o),
  };
}

export interface MasukanBlending {
  kolom: number; baris: number;
   resX: number; resY: number;
  overlapH: number; overlapV: number; overlapSatuan?: 'persen' | 'meter';
  mode: 'proyektor' | 'target';
  lebarSatuM?: number; targetLebarM?: number; targetTinggiM?: number;
  lensa?: { trMin: number; trMaks: number; bWide?: number; bTele?: number };
}

export function rencanaBlending(m: MasukanBlending) {
  const k = Math.max(1, Math.round(m.kolom)), b = Math.max(1, Math.round(m.baris));
  const rx = Math.max(1, Math.round(m.resX)), ry = Math.max(1, Math.round(m.resY));
  const target = m.mode === 'target' && (m.targetLebarM ?? 0) > 0 && (m.targetTinggiM ?? 0) > 0;
  let pH = m.overlapH, pV = m.overlapV;
  if (m.overlapSatuan === 'meter') {
    const oH = k > 1 ? Math.max(0, m.overlapH) : 0, oV = b > 1 ? Math.max(0, m.overlapV) : 0;
    const lebarSatu = target
      ? Math.max((m.targetLebarM! + (k - 1) * oH) / k, ((m.targetTinggiM! + (b - 1) * oV) / b) * (rx / ry))
      : Math.max(0, m.lebarSatuM ?? 0);
    const tinggiSatu = (lebarSatu * ry) / rx;
    pH = lebarSatu > 0 ? (oH / lebarSatu) * 100 : 0;
    pV = tinggiSatu > 0 ? (oV / tinggiSatu) * 100 : 0;
  }
  const oHpx = k > 1 ? Math.round((rx * Math.min(50, Math.max(0, pH))) / 100) : 0;
  const oVpx = b > 1 ? Math.round((ry * Math.min(50, Math.max(0, pV))) / 100) : 0;
  const kanvasX = k * rx - (k - 1) * oHpx, kanvasY = b * ry - (b - 1) * oVpx;
  const mPerPx = target
    ? Math.max(m.targetLebarM! / kanvasX, m.targetTinggiM! / kanvasY)
    : Math.max(0, m.lebarSatuM ?? 0) / rx;
  const lebarSatuM = rx * mPerPx, tinggiSatuM = ry * mPerPx;
  const lebarM = kanvasX * mPerPx, tinggiM = kanvasY * mPerPx;
  const kontenX = target ? Math.min(kanvasX, Math.round(m.targetLebarM! / mPerPx)) : kanvasX;
  const kontenY = target ? Math.min(kanvasY, Math.round(m.targetTinggiM! / mPerPx)) : kanvasY;
  const ln = m.lensa && m.lensa.trMin > 0 ? m.lensa : null;
  const lempar = ln ? rentangJarakLempar(rx * mPerPx, ln.trMin, Math.max(ln.trMin, ln.trMaks), ln.bWide ?? 0, ln.bTele ?? ln.bWide ?? 0) : null;
  return {
    kolom: k, baris: b, jumlah: k * b, resX: rx, resY: ry,
    lebarSatuM, tinggiSatuM, lebarM, tinggiM, kanvasX, kanvasY,
    overlapHpx: oHpx, overlapVpx: oVpx, overlapHM: oHpx * mPerPx, overlapVM: oVpx * mPerPx,
     overlapHPersen: (oHpx / rx) * 100, overlapVPersen: (oVpx / ry) * 100,
    kontenX, kontenY, maskX: kanvasX - kontenX, maskY: kanvasY - kontenY,
    efisiensiPersen: ((kontenX * kontenY) / (k * b * rx * ry)) * 100,
    pxPerM: mPerPx > 0 ? 1 / mPerPx : 0, pitchMm: mPerPx * 1000,
    zonaKiriKanan: (k - 1) * b, zonaAtasBawah: (b - 1) * k, zonaSudut: (k - 1) * (b - 1),
    jarakDekatM: lempar ? lempar.dekatM : 0, jarakJauhM: lempar ? lempar.jauhM : 0,
    jarakLensaHM: k > 1 ? (rx - oHpx) * mPerPx : 0, jarakLensaVM: b > 1 ? (ry - oVpx) * mPerPx : 0,
    peta: Array.from({ length: k * b }, (_, i) => {
      const c = i % k, r = Math.floor(i / k);
      const x = c * (rx - oHpx), y = r * (ry - oVpx);
      return { nama: `P${i + 1}`, kolom: c + 1, baris: r + 1, x, y, x2: x + rx, y2: y + ry };
    }),
  };
}

export type RencanaBlending = ReturnType<typeof rencanaBlending>;

export function saranSusunanBlending(m: Omit<MasukanBlending, 'kolom' | 'baris' | 'mode'>, maksKolom = 12, maksBaris = 6, efisiensiMin = 60, maks = 6) {
  const semua: RencanaBlending[] = [];
  for (let b = 1; b <= maksBaris; b++) for (let k = 1; k <= maksKolom; k++) {
    const r = rencanaBlending({ ...m, kolom: k, baris: b, mode: 'target' });
    if (r.efisiensiPersen >= efisiensiMin) semua.push(r);
  }
  semua.sort((p, q) => p.jumlah - q.jumlah || q.efisiensiPersen - p.efisiensiPersen);
  const hasil: RencanaBlending[] = [];
  let terbaik = 0;
  for (const r of semua) {
    const px = r.kontenX * r.kontenY;
    if (px > terbaik * 1.05) { hasil.push(r); terbaik = px; }
  }
  return hasil.slice(0, maks);
}

export const teksRasio = (x: number, y: number) => (y > 0 ? `${(x / y).toLocaleString('id-ID', { maximumFractionDigits: 2 })} : 1` : '-');
