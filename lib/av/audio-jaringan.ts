
const naikKe = (daftar: readonly number[], nilai: number) => daftar.find(x => x >= nilai) ?? null;

export const AMPLIFIER_STANDAR = [60, 120, 240, 360, 480, 650, 1000, 1300, 2000] as const;

export function amplifierLine(taps: { watt: number; jumlah: number }[], teganganV: number, cadanganPersen = 25) {
  const totalW = taps.reduce((n, t) => n + Math.max(0, t.watt) * Math.max(0, t.jumlah), 0);
  const butuhW = totalW * (1 + cadanganPersen / 100);
  return {
    totalW, butuhW, ampW: naikKe(AMPLIFIER_STANDAR, butuhW),
    bebanOhm: totalW > 0 ? (teganganV * teganganV) / totalW : Infinity,
    jumlahSpeaker: taps.reduce((n, t) => n + Math.max(0, t.jumlah), 0),
  };
}

export type Susunan = 'paralel' | 'seri' | 'seri-paralel';
export function impedansiSpeaker(jumlah: number, ohm: number, susunan: Susunan, perCabang = 2): number {
  const n = Math.max(1, Math.round(jumlah));
  if (susunan === 'seri') return ohm * n;
  if (susunan === 'paralel') return ohm / n;
  const s = Math.max(1, Math.round(perCabang));
  return (ohm * s) / Math.max(1, Math.floor(n / s));
}

export const RESISTIVITAS_TEMBAGA = 0.0175;
export const UKURAN_KABEL_MM2 = [0.75, 1, 1.5, 2.5, 4, 6] as const;

export function rugiKabel(panjangM: number, luasMm2: number, bebanOhm: number) {
  const rKabel = (2 * Math.max(0, panjangM) * RESISTIVITAS_TEMBAGA) / Math.max(0.1, luasMm2);
  const z = Math.max(0.1, bebanOhm);
  return {
    rKabelOhm: rKabel,
    rugiDb: 20 * Math.log10((z + rKabel) / z),
    hilangPersen: (1 - (z * z) / ((z + rKabel) * (z + rKabel))) * 100,
  };
}

export function saranKabel(panjangM: number, bebanOhm: number, batasDb = 0.5): number | null {
  return UKURAN_KABEL_MM2.find(a => rugiKabel(panjangM, a, bebanOhm).rugiDb <= batasDb) ?? null;
}

export const MATERIAL_AKUSTIK = [
  { v: 'beton', l: 'Beton / bata plester', a: 0.02 },
  { v: 'keramik', l: 'Keramik / granit', a: 0.02 },
  { v: 'kaca', l: 'Kaca', a: 0.04 },
  { v: 'gipsum', l: 'Gipsum', a: 0.05 },
  { v: 'kayu', l: 'Panel kayu', a: 0.1 },
  { v: 'karpet', l: 'Karpet', a: 0.25 },
  { v: 'gorden', l: 'Gorden tebal', a: 0.5 },
  { v: 'plafon-akustik', l: 'Plafon akustik (mineral)', a: 0.7 },
  { v: 'panel-akustik', l: 'Panel akustik 50 mm', a: 0.9 },
] as const;
export type KodeMaterial = (typeof MATERIAL_AKUSTIK)[number]['v'];

export const SERAP_ORANG = 0.45;

export const TARGET_RT60: Record<string, { l: string; min: number; maks: number }> = {
  meeting: { l: 'Ruang rapat / video conference', min: 0.4, maks: 0.6 },
  kelas: { l: 'Kelas / training', min: 0.5, maks: 0.7 },
  auditorium: { l: 'Auditorium (pidato)', min: 0.8, maks: 1.2 },
  ibadah: { l: 'Rumah ibadah (musik)', min: 1.0, maks: 1.6 },
};

export function rt60Sabine(volumeM3: number, permukaan: { luasM2: number; a: number }[], orang = 0) {
  const A = permukaan.reduce((n, p) => n + Math.max(0, p.luasM2) * Math.max(0, p.a), 0) + Math.max(0, orang) * SERAP_ORANG;
  return { serapanM2: A, rt60: A > 0 ? (0.161 * Math.max(0, volumeM3)) / A : Infinity };
}

export function serapanTambahanM2(volumeM3: number, serapanM2: number, targetRt60: number): number {
  return Math.max(0, (0.161 * volumeM3) / Math.max(0.1, targetRt60) - serapanM2);
}

export function dayaUntukSPL(splTargetDb: number, sensitivitasDb: number, jarakM: number, headroomDb = 10): number {
  const perlu = splTargetDb + headroomDb - sensitivitasDb + 20 * Math.log10(Math.max(0.1, jarakM));
  return Math.pow(10, perlu / 10);
}

export const ALIRAN_IP = [
  { v: 'h264', l: 'H.264 1080p (encoder / streaming)', mbps: 12 },
  { v: 'h265-4k', l: 'H.265 4K', mbps: 25 },
  { v: 'ndi-hx', l: 'NDI|HX 1080p60', mbps: 20 },
  { v: 'ndi-1080', l: 'NDI (full) 1080p60', mbps: 150 },
  { v: 'ndi-4k', l: 'NDI (full) 4K60', mbps: 250 },
  { v: 'j2k-4k', l: 'JPEG2000 4K60 (AVoIP 1 GbE)', mbps: 900 },
  { v: 'sdvoe', l: 'SDVoE 4K60 tanpa kompresi (10 GbE)', mbps: 9500 },
] as const;

export function danteMbps(kanal: number, sampleRate = 48000): number {
  return (Math.max(0, kanal) * sampleRate * 32 * 1.1) / 1e6;
}

export function saranLink(totalMbps: number, bebanMaks = 0.7): string {
  if (totalMbps <= 1000 * bebanMaks) return '1 GbE';
  if (totalMbps <= 10000 * bebanMaks) return '10 GbE';
  if (totalMbps <= 25000 * bebanMaks) return '25 GbE';
  return '40/100 GbE (atau bagi ke beberapa uplink)';
}

export const KELAS_POE = [
  { v: 'af', l: '802.3af · PoE', w: 15.4, pd: 12.95 },
  { v: 'at', l: '802.3at · PoE+', w: 30, pd: 25.5 },
  { v: 'bt3', l: '802.3bt tipe 3', w: 60, pd: 51 },
  { v: 'bt4', l: '802.3bt tipe 4', w: 90, pd: 71.3 },
] as const;
export type KodePoE = (typeof KELAS_POE)[number]['v'];
export const PORT_SWITCH = [8, 16, 24, 48] as const;
export const ANGGARAN_POE_W = [65, 130, 240, 370, 740] as const;

export function hitungPoE<T extends { watt: number; jumlah: number; kelas: KodePoE }>(perangkat: T[], cadanganPersen = 20) {
  const port = perangkat.reduce((n, p) => n + Math.max(0, p.jumlah), 0);
  const totalW = perangkat.reduce((n, p) => n + Math.max(0, p.watt) * Math.max(0, p.jumlah), 0);
  const reservasiW = perangkat.reduce((n, p) => n + (KELAS_POE.find(k => k.v === p.kelas)?.w ?? 0) * Math.max(0, p.jumlah), 0);
  const butuhW = Math.max(totalW * (1 + cadanganPersen / 100), reservasiW);
  const urut = KELAS_POE.map(k => k.v);
  const kelasTertinggi = perangkat.reduce<KodePoE | null>((m, p) => (p.jumlah > 0 && (!m || urut.indexOf(p.kelas) > urut.indexOf(m)) ? p.kelas : m), null);
  const melebihi = perangkat.filter(p => p.jumlah > 0 && p.watt > (KELAS_POE.find(k => k.v === p.kelas)?.pd ?? 0));
  return { port, totalW, reservasiW, butuhW, kelasTertinggi, melebihi, portSwitch: naikKe(PORT_SWITCH, port), anggaranW: naikKe(ANGGARAN_POE_W, butuhW) };
}

export const UKURAN_RAK_U = [6, 9, 12, 15, 18, 20, 22, 27, 32, 37, 42, 47] as const;
export interface ItemRak { nama: string; u: number; kg: number; watt: number; jumlah: number }

export function hitungRak(item: ItemRak[], cadanganPersen = 25, ventilasi = true) {
  const uPerangkat = item.reduce((n, x) => n + Math.max(0, x.u) * Math.max(0, x.jumlah), 0);
  const uVentilasi = ventilasi ? item.reduce((n, x) => n + (x.watt >= 150 ? Math.max(0, x.jumlah) : 0), 0) : 0;
  const uButuh = Math.ceil((uPerangkat + uVentilasi) * (1 + cadanganPersen / 100));
  const beratKg = item.reduce((n, x) => n + Math.max(0, x.kg) * Math.max(0, x.jumlah), 0);
  const watt = item.reduce((n, x) => n + Math.max(0, x.watt) * Math.max(0, x.jumlah), 0);
  return { uPerangkat, uVentilasi, uButuh, rakU: naikKe(UKURAN_RAK_U, uButuh), beratKg, watt, btu: watt * 3.412 };
}

export function runtimeUPSMenit(bebanW: number, bateraiV: number, bateraiAh: number, jumlahBaterai: number, efisiensi = 0.85, dod = 0.8): number {
  if (bebanW <= 0) return Infinity;
  return ((bateraiV * bateraiAh * Math.max(0, jumlahBaterai) * efisiensi * dod) / bebanW) * 60;
}
