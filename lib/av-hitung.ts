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
  /** Faktor daya power supply (0,5..1); bawaan 1. PSU LED umumnya >= 0,95. */ faktorDaya?: number;
  /** Piksel per unit bila diketahui (dari datasheet); default ukuran/pitch. */
  pxX?: number; pxY?: number;
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

/**
 * Kapasitas 1 port pada frame rate & kedalaman warna tertentu. Novastar
 * menyatakan kapasitas port 10/12-bit = SEPARUH 8-bit (data dikirim dua kali
 * lebar), bukan 8/10 seperti hitungan bit mentah - memakai 8/bit membuat
 * jumlah port & sending card untuk konten 10-bit terhitung kurang.
 */
export function pxPerPortPada(refresh: number, bit: number): number {
  return Math.floor(PX_PER_PORT_DASAR * (60 / refresh) * (bit > 8 ? 0.5 : 1));
}

/**
 * Port LAN yang dibutuhkan. Satu cabinet tidak bisa dibagi ke dua port, jadi
 * yang dihitung adalah cabinet per port - bukan total piksel / kapasitas,
 * yang bisa kurang 1 port bila sisa kapasitas tiap port tidak muat satu
 * cabinet utuh. Cabinet yang lebih besar dari kapasitas satu port memakai
 * beberapa port sendiri.
 */
export function portDibutuhkan(jumlahCab: number, pxPerCab: number, pxPerPort: number): number {
  if (jumlahCab <= 0 || pxPerCab <= 0) return 0;
  if (pxPerCab > pxPerPort) return jumlahCab * Math.ceil(pxPerCab / pxPerPort);
  return Math.ceil(jumlahCab / Math.floor(pxPerPort / pxPerCab));
}

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
  const pxCabX = m.pxX ?? Math.round(m.cabLebar / m.pitch);
  const pxCabY = m.pxY ?? Math.round(m.cabTinggi / m.pitch);
  const resX = pxCabX * kolom;
  const resY = pxCabY * baris;
  const g = fpb(resX, resY) || 1;
  const jumlahCab = kolom * baris;
  const dayaMaksW = jumlahCab * m.dayaMaksCab;
  const dayaRataW = dayaMaksW * m.faktorRata;
  //  Arus = daya nyata / (tegangan x faktor daya): PF < 1 menaikkan arus & MCB.
  const pf = Math.min(1, Math.max(0.5, m.faktorDaya ?? 1));
  const arusMaksA = dayaMaksW / (Math.max(1, m.tegangan) * pf);
  //  MCB: arus maksimum + cadangan 25% (beban kontinu), dibulatkan ke rating standar.
  const mcbSaranA = MCB_STANDAR.find(r => r >= arusMaksA * 1.25) ?? Math.ceil((arusMaksA * 1.25) / 10) * 10;
  const pxPerPort = pxPerPortPada(m.refresh, m.bit);
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
    pxPerPort, portLAN: portDibutuhkan(jumlahCab, pxCabX * pxCabY, pxPerPort),
  };
}

export type Pembulatan = 'round' | 'floor' | 'ceil';

/** Kolom/baris untuk ukuran target (m): terdekat, tidak melebihi, atau minimal menutup target. */
export function cabinetUntukUkuran(lebarM: number, tinggiM: number, cabLebar: number, cabTinggi: number, bulat: Pembulatan = 'round') {
  //  Buang galat floating point agar 8,0000001 tidak di-ceil jadi 9.
  const fn = (x: number) => Math.max(1, Math[bulat](Math.round(x * 1e6) / 1e6));
  return {
    kolom: fn((lebarM * 1000) / cabLebar),
    baris: fn((tinggiM * 1000) / cabTinggi),
  };
}

// ── Referensi modul LED & hardware Novastar (dari LED Calculator v1 - DWP) ──

export interface ModulLED {
  kode: string; /** mm */ pitch: number;
  /** mm */ w: number; /** mm */ h: number; pxW: number; pxH: number;
  tipe: 'Indoor' | 'Indoor/Outdoor' | 'Outdoor'; guna: string;
}

/**
 * Modul umum per pitch. Piksel/modul ditulis eksplisit (bukan ukuran/pitch)
 * karena pitch dagang dibulatkan, mis. "P1.86" = 320/172 mm.
 */
export const MODUL_LED: ModulLED[] = [
  { kode: 'P1.25', pitch: 1.25, w: 320, h: 160, pxW: 256, pxH: 128, tipe: 'Indoor', guna: 'Control room, studio broadcast, fine pitch indoor' },
  { kode: 'P1.53', pitch: 1.53, w: 320, h: 160, pxW: 208, pxH: 104, tipe: 'Indoor', guna: 'Ruang rapat, indoor high-end' },
  { kode: 'P1.86', pitch: 1.86, w: 320, h: 160, pxW: 172, pxH: 86, tipe: 'Indoor', guna: 'Display korporat, ruang meeting' },
  { kode: 'P2', pitch: 2, w: 320, h: 160, pxW: 160, pxH: 80, tipe: 'Indoor', guna: 'Retail indoor, showroom, lobi kantor' },
  { kode: 'P2.5', pitch: 2.5, w: 320, h: 160, pxW: 128, pxH: 64, tipe: 'Indoor', guna: 'Indoor / semi-outdoor, event' },
  { kode: 'P3', pitch: 3, w: 192, h: 192, pxW: 64, pxH: 64, tipe: 'Indoor', guna: 'Auditorium, panggung, arena indoor' },
  { kode: 'P3.84', pitch: 3.84, w: 307, h: 154, pxW: 80, pxH: 40, tipe: 'Indoor/Outdoor', guna: 'Rental event, konser, pameran' },
  { kode: 'P4', pitch: 4, w: 320, h: 160, pxW: 80, pxH: 40, tipe: 'Outdoor', guna: 'Outdoor jarak menengah (min 4 m)' },
  { kode: 'P5', pitch: 5, w: 320, h: 160, pxW: 64, pxH: 32, tipe: 'Outdoor', guna: 'Outdoor jarak menengah (min 5 m)' },
  { kode: 'P6', pitch: 6, w: 192, h: 192, pxW: 32, pxH: 32, tipe: 'Outdoor', guna: 'Billboard outdoor (min 6 m)' },
  { kode: 'P8', pitch: 8, w: 256, h: 128, pxW: 32, pxH: 16, tipe: 'Outdoor', guna: 'Outdoor format besar (min 8 m)' },
  { kode: 'P10', pitch: 10, w: 320, h: 160, pxW: 32, pxH: 16, tipe: 'Outdoor', guna: 'Billboard outdoor besar (min 10 m)' },
];

export interface Hardware { nama: string; maksPx: number; port: number; ket: string; senderBawaan: boolean }

/** Sending card (perlu video processor / sumber terpisah). */
export const SENDING_CARD: Hardware[] = [
  { nama: 'MCTRL300', maksPx: 1_300_000, port: 2, senderBawaan: true, ket: 'Entry-level; 2x Gigabit LAN' },
  { nama: 'MCTRL600', maksPx: 2_300_000, port: 4, senderBawaan: true, ket: 'Entry-level enhanced; 4x Gigabit LAN' },
  { nama: 'MCTRL660', maksPx: 2_300_000, port: 4, senderBawaan: true, ket: 'Mid-range; 4x Gigabit LAN' },
  { nama: 'MCTRL660 PRO', maksPx: 2_300_000, port: 6, senderBawaan: true, ket: 'Mid-range+; 6x LAN + fiber optic' },
  { nama: 'MCTRL4K', maksPx: 8_800_000, port: 16, senderBawaan: true, ket: 'Input 4K; 16x LAN + fiber' },
];

/** Video processor; senderBawaan = all-in-one (tidak perlu sending card). */
export const VIDEO_PROCESSOR: Hardware[] = [
  { nama: 'VX400', maksPx: 2_600_000, port: 4, senderBawaan: true, ket: 'All-in-one compact; layar kecil-menengah' },
  { nama: 'VX600', maksPx: 3_900_000, port: 6, senderBawaan: true, ket: 'All-in-one compact; 4K; single screen' },
  { nama: 'VX1000', maksPx: 6_500_000, port: 10, senderBawaan: true, ket: 'Mid-high all-in-one; input 4K' },
  { nama: 'NovaPro UHD Jr', maksPx: 10_400_000, port: 16, senderBawaan: true, ket: 'All-in-one; input 4K; layar besar' },
  { nama: 'V1260', maksPx: 7_680_000, port: 0, senderBawaan: false, ket: 'VP saja - perlu sending card terpisah' },
];

export interface Kapasitas {
  /** Unit yang dibutuhkan per screen (min 1). */ qty: number;
  /** Persentase terpakai dari total kapasitas qty unit. */ pakaiPx: number; pakaiPort: number;
  /** Batas yang menentukan jumlah unit. */ pembatas: 'pixel' | 'port' | null;
}

/**
 * Jumlah unit `hw` untuk memuat totalPx & portLAN. Port 0 = VP tanpa output
 * LAN (perlu sending card), jadi hanya dihitung dari kapasitas pixel.
 */
export function kapasitasHardware(hw: Hardware, totalPx: number, portLAN: number): Kapasitas {
  const qPx = Math.ceil(totalPx / Math.max(1, hw.maksPx));
  const qPort = hw.port > 0 ? Math.ceil(portLAN / hw.port) : 0;
  const qty = Math.max(1, qPx, qPort);
  return {
    qty,
    pakaiPx: (totalPx / (hw.maksPx * qty)) * 100,
    pakaiPort: hw.port > 0 ? (portLAN / (hw.port * qty)) * 100 : 0,
    pembatas: qty <= 1 ? null : qPort > qPx ? 'port' : 'pixel',
  };
}

export interface SaranHardware {
  /** All-in-one terkecil yang cukup, beserta jumlah unit per screen. */
  vp: { hw: Hardware; qty: number } | null;
  /** Sending card terkecil yang cukup bila memakai VP tanpa sender bawaan. */
  kartu: { hw: Hardware; qty: number } | null;
}

/**
 * Pilih hardware terkecil yang mampu (piksel & port). Bila tidak ada satu
 * unit yang cukup, ambil yang terbesar dan hitung jumlah unitnya.
 */
export function saranHardware(totalPx: number, portLAN: number, kartu = SENDING_CARD, vp = VIDEO_PROCESSOR): SaranHardware {
  const pilih = (daftar: Hardware[]) => {
    if (!daftar.length) return null;
    const urut = [...daftar].sort((a, b) => a.maksPx - b.maksPx);
    const cukup = urut.find(h => h.maksPx >= totalPx && h.port >= portLAN);
    if (cukup) return { hw: cukup, qty: 1 };
    const besar = urut[urut.length - 1];
    return { hw: besar, qty: kapasitasHardware(besar, totalPx, portLAN).qty };
  };
  return { vp: pilih(vp.filter(v => v.senderBawaan && v.port > 0)), kartu: pilih(kartu) };
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

// ── Screen connection LED (urutan kabel data, seperti NovaLCT) ─────────────

export type SudutMulai = 'kiri-atas' | 'kanan-atas' | 'kiri-bawah' | 'kanan-bawah';
/** Satu receiving card di grid: [kolom, baris], 0 = kiri / atas. */
export type SelRC = [number, number];
export interface OpsiKoneksi {
  /** Grid receiving card (satu sel = satu receiving card). */ kolom: number; baris: number;
  /** Pixel satu receiving card bila semua sama. */ pxPerRC?: number;
  /** Lebar tiap kolom & tinggi tiap baris receiving card (px) - menimpa pxPerRC (ukuran berbeda-beda). */
  lebarPx?: number[]; tinggiPx?: number[];
  /** Sel tanpa receiving card (layar tidak persegi / ada lubang). */ kosong?: SelRC[];
  /** Kabel manual: urutan receiving card per port (indeks 0 = port 1). Diisi = template diabaikan. */ manual?: SelRC[][] | null;
  pxPerPort: number;
  /** Receiving card pertama di pojok mana, kabel berjalan mendatar (per baris) atau tegak (per kolom). */
  mulai: SudutMulai; arah: 'horizontal' | 'vertikal';
  /** S = ular (bolak-balik), Z = tiap baris/kolom mulai dari sisi yang sama. */ pola: 'S' | 'Z';
  /** baris = tiap port mengambil baris/kolom utuh (kabel rapi; garis yang melebihi kapasitas port dibagi ke
   *  beberapa zona sama lebar); penuh = port diisi sampai batas (port paling hemat). */ bagi: 'baris' | 'penuh';
  /** Persentase kapasitas port yang boleh dipakai (bawaan 100). */ bebanMaks?: number;
  /** Port per controller / sending card - untuk penomoran "controller-port-RC". 0 = satu controller. */ portPerKartu?: number;
}
export interface SelKoneksi { c: number; r: number; port: number; urut: number; kartu: number; px: number }
export interface PortKoneksi { port: number; kartu: number; jumlah: number; px: number; beban: number; mulai: { c: number; r: number } | null }
export interface HasilKoneksi {
  /** Semua receiving card dalam urutan kabel (rantai port 1, lalu port 2, ...). */ sel: SelKoneksi[];
  port: PortKoneksi[];
  /** Receiving card terbesar yang muat per port (patokan). */ rcPerPortMaks: number; jumlahPort: number; jumlahKartu: number;
  /** Peringatan bila satu receiving card melebihi kapasitas satu port. */ galat: string | null;
  /** Receiving card yang belum tersambung ke port mana pun (mode manual). */ tanpaPort: { c: number; r: number }[];
  /** Port yang bebannya melewati batas. */ lewat: number[];
}

/**
 * Urutan kabel data receiving card & pembagian ke port LAN. Kolom c 0.. dari kiri,
 * baris r 0.. dari atas. Satu receiving card tidak bisa dibagi ke dua port; port dibatasi
 * jumlah PIXEL (receiving card boleh berbeda ukuran), bukan jumlah kartu.
 */
export function hitungKoneksi(o: OpsiKoneksi): HasilKoneksi {
  const K = Math.max(1, Math.round(o.kolom)), B = Math.max(1, Math.round(o.baris));
  const di = (c: number, r: number) => r * K + c;
  const dalam = ([c, r]: SelRC) => Number.isInteger(c) && Number.isInteger(r) && c >= 0 && c < K && r >= 0 && r < B;
  const kosong = new Set((o.kosong ?? []).filter(dalam).map(([c, r]) => di(c, r)));
  const ukuranBebas = !!o.lebarPx?.length && !!o.tinggiPx?.length;
  const pxSel = (c: number, r: number) => (kosong.has(di(c, r)) ? 0
    : ukuranBebas ? Math.max(0, o.lebarPx![c] ?? 0) * Math.max(0, o.tinggiPx![r] ?? 0) : Math.max(0, o.pxPerRC ?? 0));
  const batasPersen = Math.max(1, Math.min(100, o.bebanMaks ?? 100)) / 100;
  const batas = o.pxPerPort * batasPersen;
  let pxMaks = 0;
  for (let r = 0; r < B; r++) for (let c = 0; c < K; c++) pxMaks = Math.max(pxMaks, pxSel(c, r));
  const galat = pxMaks > batas
    ? `Satu receiving card (${Math.round(pxMaks).toLocaleString('id-ID')} px) melebihi ${Math.round(batasPersen * 100)}% kapasitas satu port (${Math.round(o.pxPerPort).toLocaleString('id-ID')} px) - perkecil area per receiving card atau turunkan refresh/bit.`
    : null;

  const potongan: { c: number; r: number }[][] = [];
  if (o.manual) {
    //  Manual: urutan dari pengguna; sel di luar grid, kosong, atau dobel diabaikan.
    const dipakai = new Set<number>();
    for (const rantai of o.manual) {
      const isi: { c: number; r: number }[] = [];
      for (const s of Array.isArray(rantai) ? rantai : []) {
        if (!Array.isArray(s) || !dalam(s)) continue;
        const i = di(s[0], s[1]);
        if (kosong.has(i) || dipakai.has(i)) continue;
        dipakai.add(i); isi.push({ c: s[0], r: s[1] });
      }
      potongan.push(isi);
    }
  } else {
    const kiri = o.mulai.startsWith('kiri'), atas = o.mulai.endsWith('atas');
    //  Garis = baris (horizontal) atau kolom (vertikal), urut dari pojok mulai. Posisi di sepanjang garis
    //  dihitung dari sisi mulai lalu dipetakan ke kolom/baris sebenarnya.
    const nGaris = o.arah === 'horizontal' ? B : K, panjang = o.arah === 'horizontal' ? K : B;
    const awalDiSisiMulai = o.arah === 'horizontal' ? kiri : atas;
    const selDi = (g: number, pos: number) => {
      const idxGaris = o.arah === 'horizontal' ? (atas ? g : B - 1 - g) : (kiri ? g : K - 1 - g);
      const ke = awalDiSisiMulai ? pos : panjang - 1 - pos;
      return o.arah === 'horizontal' ? { c: ke, r: idxGaris } : { c: idxGaris, r: ke };
    };
    const pxPos = (g: number, pos: number) => { const s = selDi(g, pos); return pxSel(s.c, s.r); };
    const ruas = (g: number, p0: number, p1: number, maju: boolean) => {
      const isi: { c: number; r: number }[] = [];
      for (let i = 0; i < p1 - p0; i++) {
        const s = selDi(g, maju ? p0 + i : p1 - 1 - i);
        if (!kosong.has(di(s.c, s.r))) isi.push(s);
      }
      return isi;
    };
    if (o.bagi === 'baris') {
      //  Zona: baris utuh yang lebih besar dari kapasitas port -> layar dibagi beberapa zona sama lebar,
      //  tiap zona dikabel sendiri dari sisi mulai (seperti layar lebar di lapangan).
      const batasZona = (z: number, n: number) => [Math.round((z * panjang) / n), Math.round(((z + 1) * panjang) / n)];
      const pxRuas = (g: number, p0: number, p1: number) => { let t = 0; for (let p = p0; p < p1; p++) t += pxPos(g, p); return t; };
      const muat = (n: number) => {
        for (let z = 0; z < n; z++) {
          const [p0, p1] = batasZona(z, n);
          for (let g = 0; g < nGaris; g++) if (pxRuas(g, p0, p1) > batas) return false;
        }
        return true;
      };
      let nZona = 1;
      while (nZona < panjang && !muat(nZona)) nZona++;
      for (let z = 0; z < nZona; z++) {
        const [p0, p1] = batasZona(z, nZona);
        //  Garis dikelompokkan per port selama muat; tiap port mulai lagi dari sisi mulai (kabel dari
        //  arah controller), pola S membalik arah di dalam port.
        let grup: number[] = [], jumlah = 0;
        const tutup = () => {
          if (grup.length) potongan.push(grup.flatMap((g, j) => ruas(g, p0, p1, o.pola === 'Z' || j % 2 === 0)));
          grup = []; jumlah = 0;
        };
        for (let g = 0; g < nGaris; g++) {
          const pxG = pxRuas(g, p0, p1);
          if (pxG <= 0) continue;
          if (grup.length && jumlah + pxG > batas) tutup();
          grup.push(g); jumlah += pxG;
        }
        tutup();
      }
    } else {
      //  Isi penuh: satu ular di seluruh layar, dipotong tiap kali port penuh.
      let isi: { c: number; r: number }[] = [], jumlah = 0;
      for (let g = 0; g < nGaris; g++) {
        for (const s of ruas(g, 0, panjang, o.pola === 'Z' || g % 2 === 0)) {
          const px = pxSel(s.c, s.r);
          if (isi.length && jumlah + px > batas) { potongan.push(isi); isi = []; jumlah = 0; }
          isi.push(s); jumlah += px;
        }
      }
      if (isi.length) potongan.push(isi);
    }
  }

  const ppk = Math.max(0, Math.round(o.portPerKartu ?? 0));
  const kartuDari = (port: number) => (ppk > 0 ? Math.ceil(port / ppk) : 1);
  const sel: SelKoneksi[] = [];
  const terhubung = new Set<number>();
  const port: PortKoneksi[] = potongan.map((isi, i) => {
    const p = i + 1;
    let px = 0;
    isi.forEach((x, j) => {
      const pxIni = pxSel(x.c, x.r);
      px += pxIni; terhubung.add(di(x.c, x.r));
      sel.push({ ...x, port: p, urut: j + 1, kartu: kartuDari(p), px: pxIni });
    });
    return { port: p, kartu: kartuDari(p), jumlah: isi.length, px, beban: (px / Math.max(1, o.pxPerPort)) * 100, mulai: isi[0] ?? null };
  });
  const tanpaPort: { c: number; r: number }[] = [];
  for (let r = 0; r < B; r++) for (let c = 0; c < K; c++) if (!kosong.has(di(c, r)) && !terhubung.has(di(c, r))) tanpaPort.push({ c, r });
  return {
    sel, port, rcPerPortMaks: Math.max(1, pxMaks > 0 ? Math.floor(batas / pxMaks) : 1), jumlahPort: port.length,
    jumlahKartu: port.length ? kartuDari(port.length) : 0, galat, tanpaPort, lewat: port.filter(p => p.px > batas).map(p => p.port),
  };
}
