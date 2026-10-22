/**
 * av-hitung-display.ts - daftar material (BOM) videowall LCD & interactive flat panel (IFP).
 *
 * LCD / videowall / IFP adalah jenis produk terbanyak di Request Schedule, tetapi sebelum ini hanya
 * LED Videotron yang punya alur hitung -> daftar material -> penawaran. Pola dan bentuk barisnya sama
 * dengan bomLED (av-hitung-bom.ts) supaya tabel harga, totalPenawaran dan lembar cetaknya dipakai
 * bersama. Semua jumlah kabel, bracket & daya adalah perkiraan lapangan - verifikasi dengan datasheet.
 */
import { type BarisBOM, cadangan } from './av-hitung-bom';
import { hitungDaya, type JenisPandang, layarDariJarak } from './av-hitung-ruang';

// ── Videowall LCD ─────────────────────────────────────────────────────────────

/** Cara pasang panel: bracket pop-out (servis dari depan), bracket tetap, atau floor stand. */
export type PasangVideowall = 'pop-out' | 'tetap' | 'standfloor';
/**
 * Jalur sinyal: video wall controller (tiap panel 1 output), loop-through (sinyal diteruskan antar
 * panel, gambar dibagi oleh scaler di panel), atau matrix switcher berfitur videowall.
 */
export type SinyalVideowall = 'controller' | 'loop' | 'matrix';

export const PASANG_VIDEOWALL: { v: PasangVideowall; l: string }[] = [
  { v: 'pop-out', l: 'Bracket pop-out (servis dari depan)' },
  { v: 'tetap', l: 'Bracket tetap (fixed)' },
  { v: 'standfloor', l: 'Floor stand' },
];
export const SINYAL_VIDEOWALL: { v: SinyalVideowall; l: string }[] = [
  { v: 'controller', l: 'Video wall controller' },
  { v: 'loop', l: 'Loop-through antar panel' },
  { v: 'matrix', l: 'Matrix switcher (fitur videowall)' },
];

/** Daya umum panel videowall 55" bila Pustaka tidak mencantumkannya (W). */
export const WATT_PANEL_BAWAAN = 180;
/** Daya umum perangkat pendukung (W) - hanya untuk perkiraan sirkuit. */
const WATT_CONTROLLER = 150, WATT_MATRIX = 100, WATT_PLAYER = 60, WATT_OPS = 60;
/** Satu sirkuit = MCB 16 A dibebani maksimal 80%. */
const MCB_SIRKUIT = 16, BEBAN_SIRKUIT = 0.8;
/** Panjang kabel USB 2.0 pasif yang masih andal untuk sinyal sentuh (m). */
export const USB_PASIF_MAKS_M = 5;

export interface MasukanVideowall {
  namaPanel: string; kolom: number; baris: number;
  /** Jumlah videowall identik. */ screen: number;
  /** Cadangan panel (%). */ cadanganPanel: number;
  pasang: PasangVideowall; sinyal: SinyalVideowall;
  /** Jumlah sumber yang masuk ke controller / matrix. */ input: number;
  /** Panjang kabel dari controller / sumber ke layar (m). */ panjangSinyal: number;
  /** Daya maksimum per panel (W). */ wattPanel: number;
  /** Media player / PC sumber per videowall. */ mediaPlayer: number;
  tegangan?: number;
}

/** Ukuran matrix standar terkecil yang cukup untuk n port. */
const portMatrix = (n: number) => [4, 8, 16, 24, 32, 36, 48, 64, 72, 80, 128, 160].find(x => x >= n) ?? n;

/** Daya & sirkuit SATU videowall (panel + perangkat sinyal + media player). */
export function dayaVideowall(m: MasukanVideowall) {
  const panel = m.kolom * m.baris;
  const d = hitungDaya([
    { nama: 'panel', watt: m.wattPanel, jumlah: panel },
    { nama: 'controller', watt: m.sinyal === 'controller' ? WATT_CONTROLLER : m.sinyal === 'matrix' ? WATT_MATRIX : 0, jumlah: 1 },
    { nama: 'player', watt: WATT_PLAYER, jumlah: m.mediaPlayer },
  ], m.tegangan ?? 220);
  return { ...d, sirkuit: Math.max(1, Math.ceil(d.arusA / (MCB_SIRKUIT * BEBAN_SIRKUIT))) };
}

export function bomVideowall(m: MasukanVideowall): BarisBOM[] {
  const n = Math.max(1, m.screen);
  const perLayar = m.kolom * m.baris, panel = perLayar * n;
  const sambung = Math.max(0, perLayar - 1) * n;
  const daya = dayaVideowall(m);
  const stopKontak = Math.ceil((perLayar + m.mediaPlayer + (m.sinyal === 'loop' ? 0 : 1)) / 8) * n;
  const kabelSinyal = (item: string, qty: number): BarisBOM =>
    ({ kunci: 'kabel-sinyal', item, qty, satuan: 'pcs', ket: `@ ${m.panjangSinyal} m${m.panjangSinyal > 15 ? ' - di atas 15 m pakai HDMI extender / fiber' : ''}` });
  const b: BarisBOM[] = [
    { kunci: 'panel', item: `Panel videowall ${m.namaPanel}`.trim(), qty: panel, satuan: 'pcs', ket: `${m.kolom} × ${m.baris}${n > 1 ? ` · ${n} videowall` : ''}` },
    { kunci: 'panel-cadangan', item: 'Panel cadangan (spare)', qty: cadangan(panel, m.cadanganPanel), satuan: 'pcs', ket: `${m.cadanganPanel}% dari ${panel}` },
    m.pasang === 'standfloor'
      ? { kunci: 'pasang', item: `Floor stand videowall ${m.kolom} × ${m.baris}`, qty: n, satuan: 'set', ket: '' }
      : { kunci: 'pasang', item: m.pasang === 'pop-out' ? 'Bracket videowall pop-out' : 'Bracket videowall tetap', qty: panel, satuan: 'pcs', ket: '1 per panel' },
  ];
  if (m.sinyal === 'controller') {
    b.push({ kunci: 'controller', item: `Video wall controller ${m.input} input × ${perLayar} output`, qty: n, satuan: 'unit', ket: n > 1 ? '1 / videowall' : '' });
    b.push(kabelSinyal('Kabel HDMI controller ke panel', panel));
  } else if (m.sinyal === 'matrix') {
    b.push({ kunci: 'controller', item: `Matrix switcher ${portMatrix(m.input)} × ${portMatrix(perLayar)} (fitur videowall)`, qty: n, satuan: 'unit', ket: `${m.input} input, ${perLayar} output terpakai` });
    b.push(kabelSinyal('Kabel HDMI matrix ke panel', panel));
  } else {
    b.push(kabelSinyal('Kabel HDMI sumber ke panel pertama', n));
    b.push({ kunci: 'loop', item: 'Kabel DisplayPort / HDMI loop-through antar panel', qty: sambung, satuan: 'pcs', ket: 'pendek; panel wajib mendukung loop-through' });
  }
  b.push(
    { kunci: 'kontrol', item: 'Kabel RS-232 / LAN kontrol antar panel', qty: sambung, satuan: 'pcs', ket: 'daisy chain' },
    { kunci: 'player', item: 'Media player / PC sumber', qty: m.mediaPlayer * n, satuan: 'unit', ket: n > 1 ? `${m.mediaPlayer} / videowall` : '' },
    { kunci: 'stop-kontak', item: 'Stop kontak / PDU 8 lubang', qty: stopKontak, satuan: 'pcs', ket: '' },
    { kunci: 'sirkuit', item: `Jalur power + MCB ${MCB_SIRKUIT} A`, qty: daya.sirkuit * n, satuan: 'jalur', ket: `±${Math.round(daya.totalW)} W / videowall, beban maks ${BEBAN_SIRKUIT * 100}%` },
  );
  return b.filter(x => x.qty > 0);
}

// ── Interactive flat panel (IFP) ──────────────────────────────────────────────

export interface UkuranIFP { diagonal: number; watt: number }
/** Ukuran IFP umum & daya maksimumnya bila Pustaka kosong. */
export const IFP_BAWAAN: UkuranIFP[] = [
  { diagonal: 55, watt: 150 }, { diagonal: 65, watt: 200 }, { diagonal: 75, watt: 250 },
  { diagonal: 86, watt: 350 }, { diagonal: 98, watt: 450 }, { diagonal: 110, watt: 600 },
];

/**
 * Ukuran IFP dari jarak penonton terjauh (aturan 4-6-8): diagonal minimum, lalu ukuran tersedia
 * terkecil yang memenuhi. null = tidak ada yang cukup besar (pertimbangkan LED / videowall).
 */
export function saranIFP(jarakTerjauhM: number, jenis: JenisPandang, tersedia: number[]) {
  const diagonalMin = layarDariJarak(jarakTerjauhM, jenis).diagonalInci;
  const saran = [...tersedia].sort((a, b) => a - b).find(d => d >= diagonalMin) ?? null;
  return { diagonalMin, saran };
}

export interface MasukanIFP {
  namaUnit: string; diagonal: number;
  /** Jumlah ruang / unit IFP. */ ruang: number;
  pasang: 'dinding' | 'troli';
  ops: boolean; kamera: boolean; mic: boolean;
  /** Wireless presentation dongle per ruang. */ dongle: number;
  /** Jarak meja / laptop ke IFP (m) - kabel HDMI & USB sentuh. */ panjangMeja: number;
  wattUnit: number;
  tegangan?: number;
}

/** Daya SATU ruang (IFP + OPS). */
export function dayaIFP(m: MasukanIFP) {
  return hitungDaya([{ nama: 'ifp', watt: m.wattUnit, jumlah: 1 }, { nama: 'ops', watt: WATT_OPS, jumlah: m.ops ? 1 : 0 }], m.tegangan ?? 220);
}

export function bomIFP(m: MasukanIFP): BarisBOM[] {
  const n = Math.max(1, m.ruang);
  const usbPasif = m.panjangMeja <= USB_PASIF_MAKS_M;
  const b: BarisBOM[] = [
    { kunci: 'ifp', item: `Interactive flat panel ${m.namaUnit}`.trim(), qty: n, satuan: 'unit', ket: n > 1 ? `${n} ruang` : '' },
    m.pasang === 'troli'
      ? { kunci: 'pasang', item: `Mobile stand / troli IFP ${m.diagonal}"`, qty: n, satuan: 'unit', ket: '' }
      : { kunci: 'pasang', item: `Bracket dinding IFP ${m.diagonal}"`, qty: n, satuan: 'pcs', ket: '' },
    { kunci: 'ops', item: 'OPS PC (modul slot IFP)', qty: m.ops ? n : 0, satuan: 'unit', ket: '' },
    { kunci: 'kamera', item: 'Kamera conference USB', qty: m.kamera ? n : 0, satuan: 'unit', ket: '' },
    { kunci: 'mic', item: 'Speakerphone / microphone conference', qty: m.mic ? n : 0, satuan: 'unit', ket: '' },
    { kunci: 'dongle', item: 'Wireless presentation dongle', qty: m.dongle * n, satuan: 'pcs', ket: n > 1 ? `${m.dongle} / ruang` : '' },
    { kunci: 'hdmi', item: 'Kabel HDMI meja ke IFP', qty: n, satuan: 'pcs', ket: `@ ${m.panjangMeja} m${m.panjangMeja > 15 ? ' - di atas 15 m pakai HDMI extender' : ''}` },
    usbPasif
      ? { kunci: 'usb', item: 'Kabel USB-A ke USB-B (sentuh)', qty: n, satuan: 'pcs', ket: `@ ${m.panjangMeja} m - sentuh layar dari laptop di meja` }
      : { kunci: 'usb', item: 'USB extender aktif (sentuh)', qty: n, satuan: 'set', ket: `${m.panjangMeja} m melebihi ${USB_PASIF_MAKS_M} m kabel USB pasif` },
    { kunci: 'lan', item: 'Kabel LAN ke IFP', qty: n, satuan: 'pcs', ket: 'CAT6' },
    { kunci: 'stop-kontak', item: 'Stop kontak 4 lubang', qty: n, satuan: 'pcs', ket: '' },
  ];
  return b.filter(x => x.qty > 0);
}
