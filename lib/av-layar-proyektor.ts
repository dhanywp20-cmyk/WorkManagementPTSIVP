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
export function lumenUntukKontras(luasM2: number, luxDiLayar: number, rasio: number, gainLayar = 1, kontrasAsli?: number): number {
  //  Kontras asli proyektor C (kalkulator Panasonic: (Lp + La) / (Lp / C + La)) -> Lp = La x (rasio - 1) / (1 - rasio / C).
  //  Rasio >= C tidak tercapai berapa pun lumennya.
  const C = kontrasAsli && kontrasAsli > 1 ? kontrasAsli : Infinity;
  if (rasio >= C) return Infinity;
  return (luasM2 * Math.max(0, luxDiLayar) * Math.max(0, rasio - 1)) / (1 - rasio / C) / Math.max(0.3, gainLayar);
}

/** Lumen spesifikasi: kebutuhan dibagi sisa cahaya di akhir umur (laser ±20%, lampu ±30-50% susut). */
export function lumenSpesifikasi(lumenPerlu: number, susutPersen: number): number {
  return lumenPerlu / Math.max(0.1, 1 - Math.min(90, Math.max(0, susutPersen)) / 100);
}

/** Rentang jarak lensa ke layar untuk lebar gambar tertentu (lensa zoom: throw ratio min..maks). */
export function rentangJarakLempar(lebarGambarM: number, trMin: number, trMaks: number, koreksiM = 0, koreksiTeleM = koreksiM) {
  //  Rumus lensa datasheet L = TR x lebar - b (mis. Panasonic ET-D3QW200: L = 0,566 x SW - 0,082); b = 0 -> L = TR x lebar.
  //  Kalkulator Panasonic memakai b sendiri di ujung wide (TR terlebar) & tele (TR terpanjang).
  return { dekatM: lebarGambarM * Math.min(trMin, trMaks) - koreksiM, jauhM: lebarGambarM * Math.max(trMin, trMaks) - koreksiTeleM };
}

/**
 * Rumus lensa L = TR x lebar - b dari DUA hasil kalkulator pabrikan / tabel datasheet pada zoom yang sama
 * (mis. Panasonic 100" -> 1,189 m & 200" -> 2,460 m): TR = selisih jarak / selisih lebar, b = TR x lebar - jarak.
 * null bila kedua lebar sama / masukan tidak sah.
 */
export function rumusLensaDariDuaTitik(lebar1M: number, jarak1M: number, lebar2M: number, jarak2M: number): { tr: number; b: number } | null {
  if (![lebar1M, jarak1M, lebar2M, jarak2M].every(v => Number.isFinite(v) && v > 0)) return null;
  if (Math.abs(lebar2M - lebar1M) < 1e-6) return null;
  const tr = (jarak2M - jarak1M) / (lebar2M - lebar1M);
  if (!(tr > 0)) return null;
  return { tr, b: tr * lebar1M - jarak1M };
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

export interface MasukanBlending {
  kolom: number; baris: number;
  /** Resolusi native satu proyektor (px). */ resX: number; resY: number;
  /** Overlap kiri-kanan (% lebar satu gambar) & atas-bawah (% tinggi satu gambar). */ overlapH: number; overlapV: number;
  /**
   * 'proyektor' = lebar gambar satu proyektor diketahui (`lebarSatuM`).
   * 'target' = ukuran layar yang harus tertutup (`targetLebarM` × `targetTinggiM`): gambar per proyektor
   * dibesarkan sampai susunan menutup target di kedua arah; kelebihan di salah satu arah di-mask.
   */
  mode: 'proyektor' | 'target';
  lebarSatuM?: number; targetLebarM?: number; targetTinggiM?: number;
  /** Throw ratio lensa (0 = tidak dihitung). */ throwRatio?: number;
}

/**
 * Rencana edge blending lengkap untuk proyeksi immersive. Overlap dibulatkan ke piksel utuh (seperti
 * di media server / prosesor blending), lalu semua ukuran diturunkan dari piksel itu:
 * kanvas = kolom × resX − (kolom − 1) × overlapPx.
 */
export function rencanaBlending(m: MasukanBlending) {
  const k = Math.max(1, Math.round(m.kolom)), b = Math.max(1, Math.round(m.baris));
  const rx = Math.max(1, Math.round(m.resX)), ry = Math.max(1, Math.round(m.resY));
  const oHpx = k > 1 ? Math.round((rx * Math.min(50, Math.max(0, m.overlapH))) / 100) : 0;
  const oVpx = b > 1 ? Math.round((ry * Math.min(50, Math.max(0, m.overlapV))) / 100) : 0;
  const kanvasX = k * rx - (k - 1) * oHpx, kanvasY = b * ry - (b - 1) * oVpx;
  const target = m.mode === 'target' && (m.targetLebarM ?? 0) > 0 && (m.targetTinggiM ?? 0) > 0;
  //  Meter per piksel: dari lebar satu gambar, atau yang cukup besar untuk menutup target di dua arah.
  const mPerPx = target
    ? Math.max(m.targetLebarM! / kanvasX, m.targetTinggiM! / kanvasY)
    : Math.max(0, m.lebarSatuM ?? 0) / rx;
  const lebarSatuM = rx * mPerPx, tinggiSatuM = ry * mPerPx;
  const lebarM = kanvasX * mPerPx, tinggiM = kanvasY * mPerPx;
  //  Area konten: ukuran target (mode target) atau seluruh kanvas.
  const kontenX = target ? Math.min(kanvasX, Math.round(m.targetLebarM! / mPerPx)) : kanvasX;
  const kontenY = target ? Math.min(kanvasY, Math.round(m.targetTinggiM! / mPerPx)) : kanvasY;
  const tr = m.throwRatio ?? 0;
  return {
    kolom: k, baris: b, jumlah: k * b, resX: rx, resY: ry,
    lebarSatuM, tinggiSatuM, lebarM, tinggiM, kanvasX, kanvasY,
    overlapHpx: oHpx, overlapVpx: oVpx, overlapHM: oHpx * mPerPx, overlapVM: oVpx * mPerPx,
    /** Overlap sebenarnya setelah dibulatkan ke piksel (%). */ overlapHPersen: (oHpx / rx) * 100, overlapVPersen: (oVpx / ry) * 100,
    kontenX, kontenY, maskX: kanvasX - kontenX, maskY: kanvasY - kontenY,
    /** Piksel kanvas yang benar-benar dipakai konten / seluruh piksel native semua proyektor. */
    efisiensiPersen: ((kontenX * kontenY) / (k * b * rx * ry)) * 100,
    pxPerM: mPerPx > 0 ? 1 / mPerPx : 0, pitchMm: mPerPx * 1000,
    zonaKiriKanan: (k - 1) * b, zonaAtasBawah: (b - 1) * k, zonaSudut: (k - 1) * (b - 1),
    jarakLemparM: tr > 0 ? tr * lebarSatuM : 0,
    /** Posisi tiap proyektor di kanvas (px) - untuk setting output media server. */
    peta: Array.from({ length: k * b }, (_, i) => {
      const c = i % k, r = Math.floor(i / k);
      const x = c * (rx - oHpx), y = r * (ry - oVpx);
      return { nama: `P${i + 1}`, kolom: c + 1, baris: r + 1, x, y, x2: x + rx, y2: y + ry };
    }),
  };
}

export type RencanaBlending = ReturnType<typeof rencanaBlending>;

/**
 * Tangga pilihan susunan kolom × baris untuk ukuran target: dari jumlah proyektor paling sedikit, hanya
 * susunan yang resolusi kontennya NAIK dibanding pilihan sebelumnya (4 × 1 yang tertahan tinggi
 * target tidak lebih baik dari 3 × 1, jadi dilewati) dan efisiensi pikselnya ≥ `efisiensiMin` %.
 */
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
    //  Naik minimal 5% supaya selisih pembulatan tidak dianggap pilihan baru.
    if (px > terbaik * 1.05) { hasil.push(r); terbaik = px; }
  }
  return hasil.slice(0, maks);
}

/** Rasio lebar : tinggi sebagai "2,96 : 1". */
export const teksRasio = (x: number, y: number) => (y > 0 ? `${(x / y).toLocaleString('id-ID', { maximumFractionDigits: 2 })} : 1` : '-');
