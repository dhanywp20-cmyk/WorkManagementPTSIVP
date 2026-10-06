/**
 * lib/tools-team.ts - bentuk & validasi data Tools Team yang disimpan di
 * server (desain ruang 3D, tabel referensi LED bersama).
 *
 * Dipakai DUA sisi: route server (app/api/tools-team/*) memvalidasi apa yang
 * dikirim peramban sebelum menyimpannya, dan peramban memakai bentuk yang
 * sama. Tanpa React / jaringan supaya aman diimpor dari mana saja.
 */
import type { ModulLED, Hardware } from '@/lib/av-hitung';

export interface RefLED { modul: ModulLED[]; kartu: Hardware[]; vp: Hardware[] }

/** Baris app_settings tempat referensi LED bersama disimpan. */
export const KUNCI_REFERENSI_LED = 'tools_team_referensi_led';

/** Batas ukuran satu desain tersimpan (JSON) & jumlah benda. */
export const MAKS_BYTE_DESAIN = 400_000;
export const MAKS_BENDA = 600;

const teks = (v: unknown, maks: number) => (typeof v === 'string' ? v.slice(0, maks) : null);
const angka = (v: unknown, min: number, maks: number) =>
  (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= maks ? v : null);
const bulat = (v: unknown, min: number, maks: number) => {
  const n = angka(v, min, maks);
  return n === null ? null : Math.round(n);
};

function bersihkanModul(x: unknown): ModulLED | null {
  const m = x as Record<string, unknown>;
  if (!m || typeof m !== 'object') return null;
  const kode = teks(m.kode, 40), guna = teks(m.guna ?? '', 200);
  const pitch = angka(m.pitch, 0.1, 100), w = angka(m.w, 1, 5000), h = angka(m.h, 1, 5000);
  const pxW = bulat(m.pxW, 1, 20000), pxH = bulat(m.pxH, 1, 20000);
  const tipe = m.tipe === 'Indoor' || m.tipe === 'Indoor/Outdoor' || m.tipe === 'Outdoor' ? m.tipe : null;
  if (!kode || guna === null || pitch === null || w === null || h === null || pxW === null || pxH === null || !tipe) return null;
  return { kode, pitch, w, h, pxW, pxH, tipe, guna };
}

function bersihkanHardware(x: unknown): Hardware | null {
  const hw = x as Record<string, unknown>;
  if (!hw || typeof hw !== 'object') return null;
  const nama = teks(hw.nama, 60), ket = teks(hw.ket ?? '', 200);
  const maksPx = bulat(hw.maksPx, 1, 1e9), port = bulat(hw.port, 0, 200);
  if (!nama || ket === null || maksPx === null || port === null || typeof hw.senderBawaan !== 'boolean') return null;
  return { nama, ket, maksPx, port, senderBawaan: hw.senderBawaan };
}

/** Referensi LED yang sah (semua baris valid, maks 200 per tabel), atau null. */
export function bersihkanReferensiLED(x: unknown): RefLED | null {
  const r = x as Record<string, unknown>;
  if (!r || !Array.isArray(r.modul) || !Array.isArray(r.kartu) || !Array.isArray(r.vp)) return null;
  if (!r.modul.length || r.modul.length > 200 || r.kartu.length > 200 || r.vp.length > 200) return null;
  const modul = r.modul.map(bersihkanModul), kartu = r.kartu.map(bersihkanHardware), vp = r.vp.map(bersihkanHardware);
  if (modul.includes(null) || kartu.includes(null) || vp.includes(null)) return null;
  return { modul: modul as ModulLED[], kartu: kartu as Hardware[], vp: vp as Hardware[] };
}

/** Data desain 3D yang sah ({ ruang, benda }) beserta jumlah benda, atau alasan penolakan. */
export function periksaDesain(x: unknown): { ok: true; data: { ruang: unknown; benda: unknown[] }; jumlah: number } | { ok: false; alasan: string } {
  const d = x as Record<string, unknown>;
  if (!d || typeof d !== 'object' || !d.ruang || typeof d.ruang !== 'object' || !Array.isArray(d.benda)) {
    return { ok: false, alasan: 'Data desain tidak sah.' };
  }
  if (d.benda.length > MAKS_BENDA) return { ok: false, alasan: `Maksimal ${MAKS_BENDA} benda per desain.` };
  if (d.benda.some(b => !b || typeof b !== 'object' || typeof (b as { jenis?: unknown }).jenis !== 'string')) {
    return { ok: false, alasan: 'Data benda tidak sah.' };
  }
  const data = { ruang: d.ruang, benda: d.benda };
  if (JSON.stringify(data).length > MAKS_BYTE_DESAIN) return { ok: false, alasan: 'Desain terlalu besar untuk disimpan.' };
  return { ok: true, data, jumlah: d.benda.length };
}

// ── Versi desain & tautan ke Request Design Project ────────────────────────

/** Gambar pratinjau per versi: data URL JPEG/WebP kecil (bukan file terpisah). */
export const MAKS_BYTE_GAMBAR = 80_000;
/** Gambar resolusi tinggi (±1400 px) untuk cetak/ZIP Request Design - diambil hanya saat ekspor. */
export const MAKS_BYTE_GAMBAR_HD = 560_000;

/**
 * Alamat gambar satu versi desain. Gambar tidak pernah ikut JSON daftar;
 * dimuat terpisah & di-cache peramban selamanya (versi tidak berubah).
 */
export const urlGambarDesain = (id: string, versi: number, hd = false) =>
  `/api/tools-team/desain/gambar?id=${encodeURIComponent(id)}&v=${versi}${hd ? '&hd=1' : ''}`;

/** Riwayat yang disimpan per desain: versi lebih lama dari ini (dan tidak ditautkan) dihapus. */
export const SIMPAN_VERSI = 10;
export function bersihkanGambar(x: unknown, maks = MAKS_BYTE_GAMBAR): string | null {
  if (typeof x !== 'string' || x.length > maks) return null;
  return /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(x) ? x : null;
}

export interface RingkasanDesain {
  ruang: { p: number; l: number; t: number }[];
  perangkat: { kategori: string; nama: string; jumlah: number }[];
  jumlah: number;
}

const URUT_KATEGORI = ['Display', 'Kamera & konferensi', 'Audio & kontrol', 'Furnitur', 'Lainnya'];
export function kategoriBenda(jenis: string): string {
  if (['videowall', 'led', 'layar', 'ifp', 'tv', 'proyektor'].includes(jenis)) return 'Display';
  if (jenis === 'kamera' || jenis === 'lift') return 'Kamera & konferensi';
  if (['speaker', 'speaker-plafon', 'mic', 'touchpanel', 'rak'].includes(jenis)) return 'Audio & kontrol';
  if (['meja', 'kursi', 'tribun', 'panggung'].includes(jenis)) return 'Furnitur';
  if (jenis === 'bidang') return 'Display';
  return 'Lainnya';
}

/**
 * Ringkasan sebuah desain untuk ditampilkan/dicetak di Request Design tanpa
 * memuat data 3D: ukuran tiap ruang dan daftar perangkat per kategori (benda
 * bernama sama dijumlah; "Meja kelas 2.3" dihitung sebagai "Meja kelas").
 * Hanya data yang memang ada di desain - tidak ada nilai yang dikarang.
 */
export function ringkasanDesain(data: { ruang: unknown; benda: unknown[] }): RingkasanDesain {
  const r = (data.ruang ?? {}) as Record<string, unknown>;
  const ukur = (x: Record<string, unknown> | undefined) => ({ p: Number(x?.p) || 0, l: Number(x?.l) || 0, t: Number(x?.t) || 0 });
  const ruang = [ukur(r)];
  const r2 = r.r2 as Record<string, unknown> | null | undefined;
  if (r2 && r2.aktif) ruang.push(ukur(r2));
  const peta = new Map<string, { kategori: string; nama: string; jumlah: number }>();
  for (const b of data.benda) {
    const x = b as { jenis?: unknown; nama?: unknown };
    const jenis = typeof x.jenis === 'string' ? x.jenis : '';
    const nama = (typeof x.nama === 'string' && x.nama.trim() ? x.nama.trim() : jenis).replace(/\s+\d+\.\d+$/, '').slice(0, 80);
    const kategori = kategoriBenda(jenis);
    const kunci = `${kategori}|${nama}`;
    const ada = peta.get(kunci);
    if (ada) ada.jumlah++; else peta.set(kunci, { kategori, nama, jumlah: 1 });
  }
  const perangkat = [...peta.values()].sort((a, b) =>
    URUT_KATEGORI.indexOf(a.kategori) - URUT_KATEGORI.indexOf(b.kategori) || a.nama.localeCompare(b.nama));
  return { ruang, perangkat, jumlah: data.benda.length };
}

/** Status tahap kerja satu ruangan request (sama dengan getRoomStatus di halaman Request Design). */
export function statusRuangan(req: { status: string; rooms?: { status?: string }[] | null }, roomIdx: number): string {
  if (roomIdx === 0) return req.status;
  return req.rooms?.[roomIdx - 1]?.status ?? req.status;
}

export const PERAN_PTS = ['admin', 'superadmin', 'team_pts', 'team'];

/**
 * Siapa yang boleh menautkan / melepas / memperbarui Design 3D di ruangan
 * request: tim PTS, pada ruangan yang sudah diterima dan belum Completed -
 * sama dengan aturan unggah SLD/BOQ/Design 3D yang sudah ada, ditambah kunci
 * saat Completed supaya catatan ruangan yang sudah selesai tidak berubah.
 * Desain tetap opsional: aturan ini TIDAK pernah dipakai untuk mewajibkannya.
 */
export function bolehUbahTautan(role: string | null | undefined, status: string): { ok: true } | { ok: false; alasan: string } {
  if (!PERAN_PTS.includes((role ?? '').toLowerCase())) return { ok: false, alasan: 'Hanya tim PTS yang bisa menautkan Design 3D.' };
  if (status === 'pending' || status === 'rejected') return { ok: false, alasan: 'Ruangan ini belum diterima untuk dikerjakan.' };
  if (status === 'completed') {
    return { ok: false, alasan: 'Ruangan sudah Completed - tautan Design 3D terkunci. Ubah status ruangan bila perlu revisi.' };
  }
  return { ok: true };
}

// ── Kalkulator LED tersimpan (/api/tools-team/led) ─────────────────────────

/** Batas ukuran satu hitungan LED tersimpan (semua isian kalkulator). */
export const MAKS_BYTE_LED = 20_000;

export interface RingkasanLED {
  project: string; customer: string; kode: string; lebarM: number; tinggiM: number;
  resX: number; resY: number; jumlahCab: number; screen: number;
}

/** Isian kalkulator LED yang sah (objek datar berukuran wajar), atau alasan penolakan. */
export function periksaIsianLED(x: unknown): { ok: true; data: Record<string, unknown> } | { ok: false; alasan: string } {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return { ok: false, alasan: 'Isian kalkulator tidak sah.' };
  const data = x as Record<string, unknown>;
  if (Object.keys(data).length > 60) return { ok: false, alasan: 'Isian kalkulator tidak sah.' };
  if (JSON.stringify(data).length > MAKS_BYTE_LED) return { ok: false, alasan: 'Isian kalkulator terlalu besar.' };
  return { ok: true, data };
}

/** Ringkasan untuk daftar - hanya field yang dikenal, teks dipotong, angka harus angka. */
export function bersihkanRingkasanLED(x: unknown): RingkasanLED {
  const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const t = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
  const a = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    project: t(r.project, 120), customer: t(r.customer, 120), kode: t(r.kode, 30),
    lebarM: a(r.lebarM), tinggiM: a(r.tinggiM), resX: a(r.resX), resY: a(r.resY), jumlahCab: a(r.jumlahCab), screen: a(r.screen) || 1,
  };
}

// ── Katalog "Produk saya" (template produk bersama tim) ─────────────────────

/** Baris app_settings tempat template produk tim disimpan: { daftar: ProdukTim[] }. */
export const KUNCI_PRODUK = 'tools_team_produk';
export const MAKS_PRODUK = 300;
export const MAKS_BYTE_PRODUK = 6_000;

/** Jenis benda yang boleh dijadikan template ('model' = GLB impor tidak, geometrinya hanya di memori). */
export const JENIS_PRODUK = ['videowall', 'led', 'layar', 'ifp', 'tv', 'meja', 'kursi', 'speaker', 'speaker-plafon', 'mic',
  'touchpanel', 'kamera', 'proyektor', 'rak', 'lift', 'tribun', 'panggung', 'bidang'] as const;

export interface ProdukTim {
  id: string; label: string; ket: string; jenis: (typeof JENIS_PRODUK)[number];
  /** Properti benda (tanpa id & posisi): ukuran, model, warna, spesifikasi, tinggi pasang. */
  atur: Record<string, unknown>;
  oleh: string; olehId: string; dibuat: string;
}

const ENUM_PRODUK: Record<string, readonly string[]> = {
  rasio: ['16:9', '16:10', '4:3', '21:9'], vw: ['55BDL2105X', '49BDL2105X', 'custom'], pasang: ['dinding', 'standfloor'],
  mic: ['gooseneck', 'boundary'], bentukMeja: ['rapat', 'bulat', 'kelas', 'dosen', 'podium'], bentukBidang: ['datar', 'lengkung', 'cembung'], finish: ['walnut', 'oak', 'putih'],
  tipeKursi: ['kantor', 'kelas'], tipeKamera: ['ptz', 'ptz-ai', 'xbar'], pasangProyektor: ['plafon', 'meja'], konten: ['pola', 'mati'],
  tipeSpeaker: ['kotak', 'dinding6', 'kolom', 'linearray'],
};
/** Angka yang boleh ada di template beserta batasnya. */
const ANGKA_PRODUK: Record<string, [number, number]> = {
  w: [0.001, 40], h: [0.001, 40], d: [0.001, 40], elev: [0, 40], diag: [10, 500], pitch: [0.1, 50], cabW: [50, 3000], cabH: [50, 3000],
  kol: [1, 30], bar: [1, 30], rakU: [1, 80], throwRatio: [0.1, 10], tilt: [-90, 45], trMin: [0.1, 10], trMax: [0.1, 10],
  baris: [1, 60], kursiBaris: [1, 80], tinggiAnak: [0.1, 1], jariBidang: [0.2, 50], busur: [10, 360], jangkauan: [0.5, 60], sebaran: [10, 180], sebaranV: [4, 180],
  modul: [1, 24], sudutModul: [0, 15], tiltLA: [-30, 60],
  offsetLensa: [-0.5, 1.5], geserLensaH: [-0.6, 0.6], lumen: [100, 100000],
};
const ANGKA_PANEL: Record<string, [number, number]> = {
  w: [0.05, 5], h: [0.05, 5], d: [0.001, 1], bezelMm: [0, 100], resX: [1, 16000], resY: [1, 16000], wTipikal: [0, 5000], wMaks: [0, 5000],
};

/** Properti benda yang sah untuk template - hanya kunci yang dikenal, angka dalam batas, enum yang dikenal. */
export function bersihkanAturProduk(x: unknown): Record<string, unknown> {
  const a = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const hasil: Record<string, unknown> = {};
  const angka = (v: unknown, [lo, hi]: [number, number]) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
  for (const [k, batas] of Object.entries(ANGKA_PRODUK)) { const v = angka(a[k], batas); if (v !== undefined) hasil[k] = v; }
  for (const [k, sah] of Object.entries(ENUM_PRODUK)) if (typeof a[k] === 'string' && sah.includes(a[k] as string)) hasil[k] = a[k];
  if (typeof a.nama === 'string' && a.nama.trim()) hasil.nama = a.nama.trim().slice(0, 80);
  if (typeof a.naik === 'boolean') hasil.naik = a.naik;
  if (typeof a.gantung === 'boolean') hasil.gantung = a.gantung;
  if (typeof a.warna === 'string' && /^#[0-9a-f]{6}$/i.test(a.warna)) hasil.warna = a.warna.toLowerCase();
  if (a.panel && typeof a.panel === 'object') {
    const p = a.panel as Record<string, unknown>, panel: Record<string, number> = {};
    for (const [k, batas] of Object.entries(ANGKA_PANEL)) { const v = angka(p[k], batas); if (v !== undefined) panel[k] = v; }
    if (Object.keys(panel).length === Object.keys(ANGKA_PANEL).length) hasil.panel = panel;
  }
  return hasil;
}

/** Template baru yang sah (label, keterangan, jenis, atur), atau alasan penolakan. */
export function periksaProduk(x: unknown): { ok: true; data: Pick<ProdukTim, 'label' | 'ket' | 'jenis' | 'atur'> } | { ok: false; alasan: string } {
  const d = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const label = typeof d.label === 'string' ? d.label.trim().slice(0, 80) : '';
  if (!label) return { ok: false, alasan: 'Nama produk wajib diisi.' };
  const jenis = d.jenis as ProdukTim['jenis'];
  if (!JENIS_PRODUK.includes(jenis)) return { ok: false, alasan: 'Jenis produk tidak bisa dijadikan template.' };
  const atur = bersihkanAturProduk(d.atur);
  if (!(typeof atur.w === 'number' && typeof atur.h === 'number' && typeof atur.d === 'number')) return { ok: false, alasan: 'Ukuran produk tidak sah.' };
  const data = { label, ket: typeof d.ket === 'string' ? d.ket.trim().slice(0, 120) : '', jenis, atur };
  if (JSON.stringify(data).length > MAKS_BYTE_PRODUK) return { ok: false, alasan: 'Data produk terlalu besar.' };
  return { ok: true, data };
}

/** Daftar template dari app_settings (baris rusak dibuang). */
export function bacaDaftarProduk(v: unknown): ProdukTim[] {
  const daftar = (v && typeof v === 'object' ? (v as { daftar?: unknown }).daftar : null);
  if (!Array.isArray(daftar)) return [];
  return daftar.flatMap((x): ProdukTim[] => {
    const p = periksaProduk(x);
    const r = x as Record<string, unknown>;
    if (!p.ok || typeof r.id !== 'string') return [];
    return [{ ...p.data, id: r.id, oleh: String(r.oleh ?? ''), olehId: String(r.olehId ?? ''), dibuat: String(r.dibuat ?? '') }];
  });
}
