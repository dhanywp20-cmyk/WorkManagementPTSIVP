/** av-hitung-led.ts - dipecah dari av-hitung.ts (scripts/pecah-modul.mjs); av-hitung.ts tetap mengekspor ulang semuanya. */

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

export const MCB_STANDAR = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250];

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
  /** Brand / merek (Hikvision, Absen, brand sendiri, ...). Kosong = "Umum". */ brand?: string;
  /** Nama model / seri dari brand (opsional, mis. dari datasheet). */ model?: string;
  /** Satuan di datasheet: modul atau cabinet. Kosong = modul. */ unit?: 'modul' | 'cabinet';
  kode: string; /** mm */ pitch: number;
  /** mm */ w: number; /** mm */ h: number; pxW: number; pxH: number;
  tipe: 'Indoor' | 'Indoor/Outdoor' | 'Outdoor'; guna: string;
}

/** Brand modul LED; `sendiri` = brand buatan perusahaan sendiri (ditampilkan paling atas). */
export interface BrandLED { nama: string; sendiri: boolean }

export const BRAND_UMUM = 'Umum';

/** Daftar brand bawaan - modulnya diisi tim dari datasheet di Referensi. */
export const BRAND_LED: BrandLED[] = [
  { nama: BRAND_UMUM, sendiri: false }, { nama: 'Hikvision', sendiri: false }, { nama: 'Absen', sendiri: false },
];

export const brandModul = (m: ModulLED) => m.brand?.trim() || BRAND_UMUM;

/** Kunci unik satu baris referensi (brand + pitch + model). */
export const kunciModul = (m: ModulLED) => `${brandModul(m)}|${m.kode}|${m.model?.trim() ?? ''}`;

/**
 * Cari modul dari isian tersimpan: kunci baru (brand|kode|model), atau kode pitch saja
 * (hitungan lama sebelum ada brand - utamakan brand Umum).
 */
export function cariModul(daftar: ModulLED[], nilai: string): ModulLED | undefined {
  return daftar.find(m => kunciModul(m) === nilai)
    ?? daftar.find(m => m.kode === nilai && brandModul(m) === BRAND_UMUM)
    ?? daftar.find(m => m.kode === nilai);
}

/**
 * Brand untuk pilihan: brand sendiri dulu, lalu yang lain (urutan daftar), plus brand yang
 * hanya muncul di baris modul. `adaModul` = hanya brand yang punya modul.
 */
export function daftarBrand(brand: BrandLED[] | undefined, modul: ModulLED[], adaModul = false): (BrandLED & { jumlah: number })[] {
  const peta = new Map<string, BrandLED & { jumlah: number }>();
  for (const b of brand ?? []) if (b.nama.trim() && !peta.has(b.nama.trim())) peta.set(b.nama.trim(), { nama: b.nama.trim(), sendiri: b.sendiri, jumlah: 0 });
  for (const m of modul) {
    const n = brandModul(m), b = peta.get(n);
    if (b) b.jumlah++; else peta.set(n, { nama: n, sendiri: false, jumlah: 1 });
  }
  const semua = [...peta.values()].filter(b => !adaModul || b.jumlah > 0);
  return [...semua.filter(b => b.sendiri), ...semua.filter(b => !b.sendiri)];
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
