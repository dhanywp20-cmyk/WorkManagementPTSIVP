/**
 * lib/av-hitung.ts - rumus Tools Team PTS (Audio Visual). Murni, tanpa
 * React / jaringan, supaya bisa diuji (uji/av-hitung.ts) dan dipakai ulang.
 *
 * Angka bawaan (daya/berat per m², kapasitas port controller) adalah NILAI
 * UMUM industri dan selalu bisa ditimpa di form. Untuk penawaran resmi,
 * gunakan datasheet produk yang ditawarkan.
 */

// ── LED Videotron ──────────────────────────────────────────────────────────

export interface MasukanLED {
  /** mm */ pitch: number;
  /** mm */ cabLebar: number;
  /** mm */ cabTinggi: number;
  kolom: number;
  baris: number;
  /** W per cabinet saat putih penuh. */ dayaMaksCab: number;
  /** Rata-rata pemakaian terhadap maksimum, 0..1 (konten video umumnya 0.3-0.4). */ faktorRata: number;
  /** kg per cabinet */ beratCab: number;
  /** Hz */ refresh: 60 | 120 | 144 | 240;
  /** bit */ bit: 8 | 10 | 12;
  /** V */ tegangan: number;
}

export interface HasilLED {
  lebarM: number; tinggiM: number; luasM2: number; diagonalInci: number;
  pxCabX: number; pxCabY: number; resX: number; resY: number; totalPx: number;
  rasio: string; rasioTerdekat: string;
  jarakMinM: number; jarakIdealM: number;
  jumlahCab: number;
  dayaMaksW: number; dayaRataW: number; arusMaksA: number; mcbSaranA: number; panasBTU: number;
  beratKg: number;
  pxPerPort: number; portLAN: number;
}

/** Kapasitas 1 port Gigabit (Novastar & sejenis): ~655.360 px pada 60 Hz 8-bit. */
export const PX_PER_PORT_DASAR = 655_360;

const MCB_STANDAR = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250];

function fpb(a: number, b: number): number { return b === 0 ? a : fpb(b, a % b); }

const RASIO_UMUM: [string, number][] = [
  ['32:9', 32 / 9], ['21:9', 21 / 9], ['2:1', 2], ['16:9', 16 / 9], ['16:10', 1.6],
  ['3:2', 1.5], ['4:3', 4 / 3], ['5:4', 1.25], ['1:1', 1], ['9:16', 9 / 16],
];

export function rasioTerdekat(lebar: number, tinggi: number): string {
  const r = lebar / tinggi;
  return RASIO_UMUM.reduce((best, cur) => (Math.abs(cur[1] - r) < Math.abs(best[1] - r) ? cur : best))[0];
}

export function hitungLED(m: MasukanLED): HasilLED {
  const kolom = Math.max(1, Math.round(m.kolom));
  const baris = Math.max(1, Math.round(m.baris));
  const lebarM = (kolom * m.cabLebar) / 1000;
  const tinggiM = (baris * m.cabTinggi) / 1000;
  const pxCabX = Math.round(m.cabLebar / m.pitch);
  const pxCabY = Math.round(m.cabTinggi / m.pitch);
  const resX = pxCabX * kolom;
  const resY = pxCabY * baris;
  const g = fpb(resX, resY) || 1;
  const jumlahCab = kolom * baris;
  const dayaMaksW = jumlahCab * m.dayaMaksCab;
  const dayaRataW = dayaMaksW * m.faktorRata;
  const arusMaksA = dayaMaksW / Math.max(1, m.tegangan);
  //  MCB: arus maksimum + cadangan 25% (beban kontinu), dibulatkan ke rating standar.
  const mcbSaranA = MCB_STANDAR.find(r => r >= arusMaksA * 1.25) ?? Math.ceil((arusMaksA * 1.25) / 10) * 10;
  const pxPerPort = Math.floor(PX_PER_PORT_DASAR * (60 / m.refresh) * (8 / m.bit));
  return {
    lebarM, tinggiM, luasM2: lebarM * tinggiM,
    diagonalInci: (Math.hypot(lebarM, tinggiM) * 1000) / 25.4,
    pxCabX, pxCabY, resX, resY, totalPx: resX * resY,
    rasio: `${resX / g}:${resY / g}`, rasioTerdekat: rasioTerdekat(resX, resY),
    //  Aturan praktis: jarak minimum (m) ≈ pitch (mm); nyaman ≈ 3× pitch.
    jarakMinM: m.pitch, jarakIdealM: m.pitch * 3,
    jumlahCab, dayaMaksW, dayaRataW, arusMaksA, mcbSaranA,
    panasBTU: dayaRataW * 3.412,
    beratKg: jumlahCab * m.beratCab,
    pxPerPort, portLAN: Math.ceil((resX * resY) / pxPerPort),
  };
}

/** Kolom/baris terdekat untuk ukuran target (m). */
export function cabinetUntukUkuran(lebarM: number, tinggiM: number, cabLebar: number, cabTinggi: number) {
  return {
    kolom: Math.max(1, Math.round((lebarM * 1000) / cabLebar)),
    baris: Math.max(1, Math.round((tinggiM * 1000) / cabTinggi)),
  };
}

export interface Controller { nama: string; maksPx: number; port: number; maksLebar: number; maksTinggi: number }

/** Acuan Novastar (kapasitas umum dari datasheet; selalu cek versi terbaru). */
export const CONTROLLER_NOVASTAR: Controller[] = [
  { nama: 'MCTRL300', maksPx: 1_300_000, port: 2, maksLebar: 3840, maksTinggi: 1920 },
  { nama: 'VX400', maksPx: 2_600_000, port: 4, maksLebar: 10240, maksTinggi: 8192 },
  { nama: 'MCTRL660 Pro', maksPx: 2_300_000, port: 6, maksLebar: 3840, maksTinggi: 1920 },
  { nama: 'VX600', maksPx: 3_900_000, port: 6, maksLebar: 10240, maksTinggi: 8192 },
  { nama: 'VX1000', maksPx: 6_500_000, port: 10, maksLebar: 10240, maksTinggi: 8192 },
  { nama: 'VX16s', maksPx: 10_400_000, port: 16, maksLebar: 10240, maksTinggi: 8192 },
  { nama: 'MCTRL4K', maksPx: 8_800_000, port: 16, maksLebar: 7680, maksTinggi: 7680 },
];

export function saranController(resX: number, resY: number, portLAN: number, daftar = CONTROLLER_NOVASTAR): Controller[] {
  return daftar
    .filter(c => c.maksPx >= resX * resY && c.port >= portLAN && c.maksLebar >= resX && c.maksTinggi >= resY)
    .sort((a, b) => a.maksPx - b.maksPx);
}

/** Kecerahan yang disarankan (nits) per lingkungan. */
export const KECERAHAN: Record<string, string> = {
  indoor: '600-1.000 nits (ruang rapat/lobi); 1.200-1.500 nits untuk ruang sangat terang',
  'semi-outdoor': '2.500-4.000 nits (etalase, area beratap terkena cahaya luar)',
  outdoor: '5.000-7.000 nits atau lebih (terkena matahari langsung)',
};

// ── Ukuran layar & jarak pandang (aturan 4-6-8) ────────────────────────────

/**
 * Tinggi gambar minimum dari jarak penonton terjauh:
 *  - Inspeksi detail (gambar teknik, angka kecil): D = 4 × H
 *  - Analitis (spreadsheet, dokumen): D = 6 × H
 *  - Tontonan umum (video, presentasi): D = 8 × H
 */
export const FAKTOR_PANDANG = { detail: 4, analitis: 6, umum: 8 } as const;
export type JenisPandang = keyof typeof FAKTOR_PANDANG;

export function layarDariJarak(jarakTerjauhM: number, jenis: JenisPandang, rasioLebar = 16, rasioTinggi = 9) {
  const tinggiM = jarakTerjauhM / FAKTOR_PANDANG[jenis];
  const lebarM = (tinggiM * rasioLebar) / rasioTinggi;
  return { tinggiM, lebarM, diagonalInci: (Math.hypot(lebarM, tinggiM) * 1000) / 25.4 };
}

export function ukuranDariDiagonal(diagonalInci: number, rasioLebar = 16, rasioTinggi = 9) {
  const d = (diagonalInci * 25.4) / 1000;
  const k = Math.hypot(rasioLebar, rasioTinggi);
  return { lebarM: (d * rasioLebar) / k, tinggiM: (d * rasioTinggi) / k };
}

export function jarakMaksDariLayar(tinggiLayarM: number, jenis: JenisPandang) {
  return tinggiLayarM * FAKTOR_PANDANG[jenis];
}

// ── Proyektor ──────────────────────────────────────────────────────────────

export function jarakLempar(throwRatio: number, lebarGambarM: number) { return throwRatio * lebarGambarM; }

/**
 * Lumen yang dibutuhkan: luas layar (m²) × target kecerahan (lux di layar)
 * / gain layar. Target kecerahan disarankan >= 5-10× cahaya ruangan agar
 * kontras cukup (AVIXA: rasio kontras 15:1 untuk analitis).
 */
export function lumenDibutuhkan(luasM2: number, cahayaRuanganLux: number, gainLayar = 1, kelipatanKontras = 7) {
  return Math.ceil((luasM2 * cahayaRuanganLux * kelipatanKontras) / Math.max(0.3, gainLayar));
}

// ── Bandwidth sinyal video ─────────────────────────────────────────────────

export type Chroma = '4:4:4' | '4:2:2' | '4:2:0';

/** Total piksel termasuk blanking (CVT-RB umum untuk resolusi populer). */
const TIMING: Record<string, [number, number]> = {
  '1280x720': [1650, 750], '1920x1080': [2200, 1125], '2560x1440': [2720, 1481],
  '3840x2160': [4400, 2250], '4096x2160': [4400, 2250], '5120x2880': [5280, 2962], '7680x4320': [9000, 4400],
};

/** Gbps data video mentah termasuk blanking (perkiraan). */
export function bandwidthGbps(lebar: number, tinggi: number, hz: number, bit: number, chroma: Chroma) {
  const [ht, vt] = TIMING[`${lebar}x${tinggi}`] ?? [Math.round(lebar * 1.08), Math.round(tinggi * 1.04)];
  const faktorChroma = chroma === '4:4:4' ? 3 : chroma === '4:2:2' ? 2 : 1.5;
  const bitPerPx = bit * faktorChroma;
  const dataGbps = (ht * vt * hz * bitPerPx) / 1e9;
  return { dataGbps, pixelClockMHz: (ht * vt * hz) / 1e6 };
}

/** Kapasitas data efektif per antarmuka (setelah overhead encoding). */
export const ANTARMUKA: { nama: string; gbps: number; panjang: string }[] = [
  { nama: 'HDMI 1.4', gbps: 8.16, panjang: '±10 m pasif; lebih jauh pakai AOC/extender' },
  { nama: 'HDMI 2.0', gbps: 14.4, panjang: '±5-7 m pasif; AOC sampai 50 m+' },
  { nama: 'HDMI 2.1 (FRL)', gbps: 42.6, panjang: '±3 m pasif (Ultra High Speed); AOC untuk lebih jauh' },
  { nama: 'HDBaseT 1.0/2.0', gbps: 10.2, panjang: '100 m (CAT6A); 4K60 hanya 4:2:0 8-bit' },
  { nama: 'HDBaseT 3.0', gbps: 16, panjang: '100 m (CAT6A)' },
  { nama: 'DisplayPort 1.4 (HBR3)', gbps: 25.92, panjang: '±2-3 m pasif' },
  { nama: 'SDI 12G', gbps: 11.88, panjang: '±50-70 m coax' },
];

// ── Audio ──────────────────────────────────────────────────────────────────

/** SPL pada jarak tertentu (hukum kuadrat terbalik, medan bebas). */
export function splPadaJarak(spl1m: number, jarakM: number) { return spl1m - 20 * Math.log10(Math.max(0.1, jarakM)); }

/** SPL maksimum speaker dari sensitivitas (dB @1W/1m) dan daya (W). */
export function splMaks(sensitivitas: number, dayaW: number) { return sensitivitas + 10 * Math.log10(Math.max(0.01, dayaW)); }

/**
 * Speaker plafon: diameter cakupan di ketinggian telinga =
 * 2 × (tinggi plafon − tinggi telinga) × tan(sudut/2). Jarak antar speaker
 * untuk tumpang-tindih tepi ke tepi = diameter; untuk merata (minimum
 * overlap) dipakai ~0.7 × diameter.
 */
export function speakerPlafon(panjangM: number, lebarM: number, tinggiPlafonM: number, telingaM: number, sudutDerajat: number, rapat = true) {
  const h = Math.max(0.3, tinggiPlafonM - telingaM);
  const diameter = 2 * h * Math.tan((sudutDerajat * Math.PI) / 360);
  const jarak = diameter * (rapat ? 0.7 : 1);
  const kolom = Math.max(1, Math.ceil(panjangM / jarak));
  const baris = Math.max(1, Math.ceil(lebarM / jarak));
  return { diameterM: diameter, jarakM: jarak, kolom, baris, jumlah: kolom * baris };
}

// ── Daya, UPS & panas ──────────────────────────────────────────────────────

export interface Beban { nama: string; watt: number; jumlah: number }

export function hitungDaya(beban: Beban[], tegangan = 220, faktorDaya = 0.9, cadangan = 0.25) {
  const totalW = beban.reduce((n, b) => n + Math.max(0, b.watt) * Math.max(0, b.jumlah), 0);
  const va = totalW / faktorDaya;
  const arusA = va / tegangan;
  return {
    totalW, va, arusA,
    upsVA: Math.ceil((va * (1 + cadangan)) / 500) * 500,
    mcbA: MCB_STANDAR.find(r => r >= arusA * 1.25) ?? Math.ceil((arusA * 1.25) / 10) * 10,
    btu: totalW * 3.412,
    /** PK AC perkiraan: 1 PK ≈ 9.000 BTU/h - hanya untuk beban perangkat. */
    pkAC: (totalW * 3.412) / 9000,
  };
}
