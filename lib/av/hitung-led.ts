import { MODUL_HIKVISION } from './modul-hikvision';


export interface MasukanLED {
   pitch: number;
   cabLebar: number;
   cabTinggi: number;
  kolom: number;
  baris: number;
   dayaMaksCab: number;
   faktorRata: number;
   beratCab: number;
   refresh: 60 | 120 | 144 | 240;
   bit: 8 | 10 | 12;
   tegangan: number;
   faktorDaya?: number;
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

export const PX_PER_PORT_DASAR = 650_000;

export const PITCH_NYATA: Readonly<Record<string, number>> = {
  '0.9': 0.9375, '1.2': 1.25, '1.5': 1.5625, '1.56': 1.5625, '1.8': 1.875, '1.87': 1.875, '1.9': 1.953125,
  '2.6': 2.604, '2.9': 2.976, '3.9': 3.90625, '3.91': 3.90625, '4.8': 4.807, '4.81': 4.807, '6.6': 6.667, '6.67': 6.667,
};

export const pitchNyata = (pitch: number): number => PITCH_NYATA[String(Math.round(pitch * 100) / 100)] ?? pitch;

export const pikselUnit = (ukuranMm: number, pitch: number): number => Math.max(1, Math.round(ukuranMm / pitchNyata(pitch)));

export function pxPerPortPada(refresh: number, bit: number): number {
  return Math.floor(PX_PER_PORT_DASAR * (60 / refresh) * (bit > 8 ? 0.5 : 1));
}

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
  const pxCabX = m.pxX ?? pikselUnit(m.cabLebar, m.pitch);
  const pxCabY = m.pxY ?? pikselUnit(m.cabTinggi, m.pitch);
  const resX = pxCabX * kolom;
  const resY = pxCabY * baris;
  const g = fpb(resX, resY) || 1;
  const jumlahCab = kolom * baris;
  const dayaMaksW = jumlahCab * m.dayaMaksCab;
  const dayaRataW = dayaMaksW * m.faktorRata;
  const pf = Math.min(1, Math.max(0.5, m.faktorDaya ?? 1));
  const arusMaksA = dayaMaksW / (Math.max(1, m.tegangan) * pf);
  const mcbSaranA = MCB_STANDAR.find(r => r >= arusMaksA * 1.25) ?? Math.ceil((arusMaksA * 1.25) / 10) * 10;
  const pxPerPort = pxPerPortPada(m.refresh, m.bit);
  return {
    lebarM, tinggiM, luasM2: lebarM * tinggiM,
    diagonalInci: (Math.hypot(lebarM, tinggiM) * 1000) / 25.4,
    pxCabX, pxCabY, resX, resY, totalPx: resX * resY,
    rasio: `${resX / g}:${resY / g}`, rasioTerdekat: rasioTerdekat(resX, resY),
    jarakMinM: m.pitch, jarakIdealM: m.pitch * 3,
    jumlahCab, dayaMaksW, dayaRataW, arusMaksA, mcbSaranA,
    panasBTU: dayaRataW * 3.412,
    beratKg: jumlahCab * m.beratCab,
    pxPerPort, portLAN: portDibutuhkan(jumlahCab, pxCabX * pxCabY, pxPerPort),
  };
}

export type Pembulatan = 'round' | 'floor' | 'ceil';

export function cabinetUntukUkuran(lebarM: number, tinggiM: number, cabLebar: number, cabTinggi: number, bulat: Pembulatan = 'round') {
  const fn = (x: number) => Math.max(1, Math[bulat](Math.round(x * 1e6) / 1e6));
  return {
    kolom: fn((lebarM * 1000) / cabLebar),
    baris: fn((tinggiM * 1000) / cabTinggi),
  };
}

export interface ModulLED {
   brand?: string;
   model?: string;
   unit?: 'modul' | 'cabinet';
  kode: string;  pitch: number;
   w: number;  h: number; pxW: number; pxH: number;
  tipe: 'Indoor' | 'Indoor/Outdoor' | 'Outdoor'; guna: string;
}

export interface BrandLED { nama: string; sendiri: boolean }

export const BRAND_UMUM = 'Umum';

export const BRAND_LED: BrandLED[] = [
  { nama: BRAND_UMUM, sendiri: false }, { nama: 'Hikvision', sendiri: false }, { nama: 'Absen', sendiri: false },
];

export const brandModul = (m: ModulLED) => m.brand?.trim() || BRAND_UMUM;

export const kunciModul = (m: ModulLED) => `${brandModul(m)}|${m.kode}|${m.model?.trim() ?? ''}`;

export function cariModul(daftar: ModulLED[], nilai: string): ModulLED | undefined {
  return daftar.find(m => kunciModul(m) === nilai)
    ?? daftar.find(m => m.kode === nilai && brandModul(m) === BRAND_UMUM)
    ?? daftar.find(m => m.kode === nilai);
}

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
  ...MODUL_HIKVISION,
];

export interface Hardware { nama: string; maksPx: number; port: number; ket: string; senderBawaan: boolean; merek?: string }

export const SENDING_CARD: Hardware[] = [
  { nama: 'MCTRL300', maksPx: 1_300_000, port: 2, senderBawaan: true, ket: 'Entry-level; 2x Gigabit LAN' },
  { nama: 'MCTRL600', maksPx: 2_300_000, port: 4, senderBawaan: true, ket: 'Entry-level enhanced; 4x Gigabit LAN' },
  { nama: 'MCTRL660', maksPx: 2_300_000, port: 4, senderBawaan: true, ket: 'Mid-range; 4x Gigabit LAN' },
  { nama: 'MCTRL660 PRO', maksPx: 2_300_000, port: 6, senderBawaan: true, ket: 'Mid-range+; 6x LAN + 2x fiber' },
  { nama: 'MCTRL700', maksPx: 2_300_000, port: 6, senderBawaan: true, ket: 'Input DVI & HDMI; 6x Gigabit LAN' },
  { nama: 'MCTRL4K', maksPx: 8_800_000, port: 16, senderBawaan: true, ket: 'Input 4K; 16x LAN + fiber' },
  { nama: 'DS-DT20C-01HI02NO', maksPx: 1_300_000, port: 2, senderBawaan: true, merek: 'Hikvision', ket: 'Hikvision; 1x HDMI 1.4; 2x RJ45' },
  { nama: 'DS-DT20C-01HI04NO', maksPx: 2_600_000, port: 4, senderBawaan: true, merek: 'Hikvision', ket: 'Hikvision; 1x HDMI 1.4; 4x RJ45' },
  { nama: 'DS-DT20C-01HI06NO', maksPx: 3_900_000, port: 6, senderBawaan: true, merek: 'Hikvision', ket: 'Hikvision; 1x HDMI 1.4; 6x RJ45' },
];

export const NAMA_VP_LAMA: Readonly<Record<string, string>> = { VX400: 'VX400 Pro', VX600: 'VX600 Pro', VX1000: 'VX1000 Pro' };

export const VIDEO_PROCESSOR: Hardware[] = [
  { nama: 'VX400 Pro', maksPx: 2_600_000, port: 4, senderBawaan: true, ket: 'All-in-one; 4x LAN; lebar maks 10.240 px' },
  { nama: 'VX600 Pro', maksPx: 3_900_000, port: 6, senderBawaan: true, ket: 'All-in-one; 6x LAN; lebar maks 10.240 px' },
  { nama: 'VX1000 Pro', maksPx: 6_500_000, port: 10, senderBawaan: true, ket: 'All-in-one; 10x LAN; lebar maks 10.240 px' },
  { nama: 'NovaPro UHD Jr', maksPx: 10_400_000, port: 16, senderBawaan: true, ket: 'All-in-one; 16x LAN + 4x fiber; input 4K' },
  { nama: 'V1260', maksPx: 10_400_000, port: 16, senderBawaan: true, ket: '2-in-1; 16x LAN + 4 fiber; data distributor, tidak ada di novastar.tech' },
  { nama: 'VX2000 Pro', maksPx: 13_000_000, port: 20, senderBawaan: true, ket: 'All-in-one; 20x LAN; lebar maks 16.384 px' },
];

export interface Kapasitas {
   qty: number;
   pakaiPx: number; pakaiPort: number;
   pembatas: 'pixel' | 'port' | null;
}

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
  vp: { hw: Hardware; qty: number } | null;
  kartu: { hw: Hardware; qty: number } | null;
}

export function saranHardware(totalPx: number, portLAN: number, kartu = SENDING_CARD, vp = VIDEO_PROCESSOR): SaranHardware {
  const pilih = (daftar: Hardware[]) => {
    if (!daftar.length) return null;
    const urut = daftar.filter(h => !h.merek).sort((a, b) => a.maksPx - b.maksPx);
    if (!urut.length) return null;
    const cukup = urut.find(h => h.maksPx >= totalPx && h.port >= portLAN);
    if (cukup) return { hw: cukup, qty: 1 };
    const besar = urut.find(h => h.maksPx === urut[urut.length - 1].maksPx)!;
    return { hw: besar, qty: kapasitasHardware(besar, totalPx, portLAN).qty };
  };
  return { vp: pilih(vp.filter(v => v.senderBawaan && v.port > 0)), kartu: pilih(kartu) };
}

export const KECERAHAN: Record<string, string> = {
  indoor: '600-1.000 nits (ruang rapat/lobi); 1.200-1.500 nits untuk ruang sangat terang',
  'semi-outdoor': '2.500-4.000 nits (etalase, area beratap terkena cahaya luar)',
  outdoor: '5.000-7.000 nits atau lebih (terkena matahari langsung)',
};
