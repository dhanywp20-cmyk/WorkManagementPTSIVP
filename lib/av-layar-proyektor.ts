/**
 * lib/av-layar-proyektor.ts - Rumus lanjutan Kalkulator AV: geometri pandang, ketajaman resolusi,
 * videowall LCD, dan proyektor (jarak lempar, lens shift, kecerahan menurut kontras, blending).
 * Murni (tanpa React), diuji di uji/av-layar-proyektor.ts. Rumus dasar ada di lib/av-hitung.ts.
 */
import { ukuranDariDiagonal } from './av-hitung';

const RAD = Math.PI / 180;

// ── Ketajaman: kapan piksel tidak terlihat lagi ───────────────────────────────

/** Ketajaman mata normal ±1 menit busur (20/20): dua titik yang lebih rapat dari sudut ini menyatu. */
export const KETAJAMAN_MATA_RAD = RAD / 60;

/** Jarak (m) mulai piksel berjarak `pitchMm` tidak lagi terlihat sebagai titik terpisah: pitch / tan(1'). */
export function jarakPikselMenyatuM(pitchMm: number): number {
  return pitchMm / 1000 / Math.tan(KETAJAMAN_MATA_RAD);
}

export const RESOLUSI_DISPLAY = [
  { nama: 'Full HD', x: 1920, y: 1080 },
  { nama: '4K UHD', x: 3840, y: 2160 },
  { nama: '8K', x: 7680, y: 4320 },
] as const;

/**
 * Untuk tiap resolusi: pitch piksel layar & jarak pikselnya menyatu. "Cukup" bila penonton terdekat
 * duduk sejauh itu atau lebih - lebih dekat, garis piksel/teks bergerigi mulai terlihat.
 */
export function cekResolusi(lebarLayarM: number, jarakTerdekatM: number) {
  return RESOLUSI_DISPLAY.map(r => {
    const pitchMm = (lebarLayarM * 1000) / r.x;
    const menyatuM = jarakPikselMenyatuM(pitchMm);
    return { nama: r.nama, x: r.x, y: r.y, pitchMm, menyatuM, cukup: jarakTerdekatM >= menyatuM };
  });
}

// ── Geometri pandang: tinggi pasang & penonton terdekat ──────────────────────

/** Sudut (°) dari mata ke tepi ATAS gambar. */
export function sudutKeAtasDerajat(jarakM: number, mataM: number, bawahGambarM: number, tinggiGambarM: number): number {
  return Math.atan2(bawahGambarM + tinggiGambarM - mataM, Math.max(0.01, jarakM)) / RAD;
}

/**
 * Jarak terdekat (m) supaya tepi atas gambar tidak lebih dari `batasDerajat` di atas mata
 * (default 30° - batas nyaman leher untuk menonton lama). 0 bila tepi atas di bawah mata.
 */
export function jarakTerdekatNyamanM(mataM: number, bawahGambarM: number, tinggiGambarM: number, batasDerajat = 30): number {
  const naik = bawahGambarM + tinggiGambarM - mataM;
  return naik <= 0 ? 0 : naik / Math.tan(batasDerajat * RAD);
}

// ── Videowall LCD ─────────────────────────────────────────────────────────────

export interface PanelVideowall { nama: string; diagonalInci: number; bezelMm: number }
/** bezelMm = celah total antar dua panel (bezel-to-bezel). */
export const PANEL_VIDEOWALL: PanelVideowall[] = [
  { nama: '46" · bezel 3,5 mm', diagonalInci: 46, bezelMm: 3.5 },
  { nama: '49" · bezel 3,5 mm', diagonalInci: 49, bezelMm: 3.5 },
  { nama: '55" · bezel 3,5 mm', diagonalInci: 55, bezelMm: 3.5 },
  { nama: '55" · bezel 1,8 mm', diagonalInci: 55, bezelMm: 1.8 },
  { nama: '55" · bezel 0,88 mm', diagonalInci: 55, bezelMm: 0.88 },
];

/** Susunan kolom × baris panel 16:9 yang paling mendekati ukuran target. */
export function videowallUntuk(lebarTargetM: number, tinggiTargetM: number, panel: PanelVideowall) {
  const p = ukuranDariDiagonal(panel.diagonalInci, 16, 9);
  const b = panel.bezelMm / 1000;
  const kolom = Math.max(1, Math.round((lebarTargetM + b) / (p.lebarM + b)));
  const baris = Math.max(1, Math.round((tinggiTargetM + b) / (p.tinggiM + b)));
  const lebarM = kolom * p.lebarM + (kolom - 1) * b;
  const tinggiM = baris * p.tinggiM + (baris - 1) * b;
  return { kolom, baris, jumlah: kolom * baris, lebarM, tinggiM, diagonalInci: (Math.hypot(lebarM, tinggiM) * 1000) / 25.4, resX: kolom * 1920, resY: baris * 1080 };
}

// ── Proyektor ─────────────────────────────────────────────────────────────────

/**
 * Kategori kontras ANSI/INFOCOMM 3M-2011 (Projected Image System Contrast Ratio). Kontras di layar =
 * (cahaya proyektor + cahaya ruang) / cahaya ruang.
 */
export const KONTRAS_ANSI = [
  { v: 'pasif', l: 'Tontonan pasif (signage, hiburan)', rasio: 7 },
  { v: 'dasar', l: 'Keputusan dasar (presentasi, rapat)', rasio: 15 },
  { v: 'analitis', l: 'Keputusan analitis (spreadsheet, CAD)', rasio: 50 },
  { v: 'video', l: 'Video gerak penuh (sinema)', rasio: 80 },
] as const;
export type KategoriKontras = (typeof KONTRAS_ANSI)[number]['v'];

/**
 * Lumen agar kontras tercapai: dari (Lp + La) / La = C -> lumen = lux_ruang_di_layar × luas × (C − 1).
 * Gain layar menaikkan pantulan proyektor ke arah penonton; cahaya ruang dianggap datang menyebar
 * (tidak ikut diperkuat gain) - pendekatan yang umum dipakai kalkulator pabrikan.
 */
export function lumenUntukKontras(luasM2: number, luxDiLayar: number, rasio: number, gainLayar = 1): number {
  return (luasM2 * Math.max(0, luxDiLayar) * Math.max(0, rasio - 1)) / Math.max(0.3, gainLayar);
}

/** Lumen spesifikasi: kebutuhan dibagi sisa cahaya di akhir umur (laser ±20%, lampu ±30-50% susut). */
export function lumenSpesifikasi(lumenPerlu: number, susutPersen: number): number {
  return lumenPerlu / Math.max(0.1, 1 - Math.min(90, Math.max(0, susutPersen)) / 100);
}

/** Rentang jarak lensa ke layar untuk lebar gambar tertentu (lensa zoom: throw ratio min..maks). */
export function rentangJarakLempar(lebarGambarM: number, trMin: number, trMaks: number) {
  return { dekatM: lebarGambarM * Math.min(trMin, trMaks), jauhM: lebarGambarM * Math.max(trMin, trMaks) };
}

/**
 * Rentang tinggi (dari lantai) pusat lensa yang masih menghasilkan gambar tegak tanpa keystone, dengan
 * lens shift vertikal ±`shiftPersen` dari tinggi gambar (dihitung dari pusat gambar).
 */
export function rentangTinggiLensa(bawahGambarM: number, tinggiGambarM: number, shiftAtasPersen: number, shiftBawahPersen: number) {
  const pusat = bawahGambarM + tinggiGambarM / 2;
  return { terendahM: pusat - (tinggiGambarM * shiftBawahPersen) / 100, tertinggiM: pusat + (tinggiGambarM * shiftAtasPersen) / 100 };
}

/**
 * Edge blending kolom × baris proyektor identik. Tiap tumpang-tindih memakan `overlapPersen` lebar /
 * tinggi satu gambar; resolusi total dihitung dengan cara yang sama.
 */
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
