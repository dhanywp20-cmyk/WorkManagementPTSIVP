import type { ModulLED, Hardware, BrandLED } from '@/lib/av/hitung';
import { bersihkanIsiRak } from '@/lib/av/perangkat-rak';
import { bacaKoefRasio, bacaPoligonShift } from '@/lib/pustaka';

export interface RefLED { modul: ModulLED[]; kartu: Hardware[]; vp: Hardware[];  brand?: BrandLED[] }

export const KUNCI_REFERENSI_LED = 'tools_team_referensi_led';

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
  const brand = teks(m.brand ?? '', 60), model = teks(m.model ?? '', 80);
  if (brand === null || model === null) return null;
  const hasil: ModulLED = { kode, pitch, w, h, pxW, pxH, tipe, guna };
  if (brand.trim()) hasil.brand = brand.trim();
  if (model.trim()) hasil.model = model.trim();
  if (m.unit === 'cabinet') hasil.unit = 'cabinet';
  return hasil;
}

function bersihkanHardware(x: unknown): Hardware | null {
  const hw = x as Record<string, unknown>;
  if (!hw || typeof hw !== 'object') return null;
  const nama = teks(hw.nama, 60), ket = teks(hw.ket ?? '', 200);
  const maksPx = bulat(hw.maksPx, 1, 1e9), port = bulat(hw.port, 0, 200);
  if (!nama || ket === null || maksPx === null || port === null || typeof hw.senderBawaan !== 'boolean') return null;
  const merek = teks(hw.merek ?? '', 60);
  return { nama, ket, maksPx, port, senderBawaan: hw.senderBawaan, ...(merek ? { merek } : {}) };
}

export function bersihkanReferensiLED(x: unknown): RefLED | null {
  const r = x as Record<string, unknown>;
  if (!r || !Array.isArray(r.modul) || !Array.isArray(r.kartu) || !Array.isArray(r.vp)) return null;
  if (!r.modul.length || r.modul.length > 500 || r.kartu.length > 200 || r.vp.length > 200) return null;
  const modul = r.modul.map(bersihkanModul), kartu = r.kartu.map(bersihkanHardware), vp = r.vp.map(bersihkanHardware);
  if (modul.includes(null) || kartu.includes(null) || vp.includes(null)) return null;
  if (r.brand !== undefined && (!Array.isArray(r.brand) || r.brand.length > 100)) return null;
  const brand: BrandLED[] = [];
  for (const b of (r.brand as unknown[] | undefined) ?? []) {
    const o = b as Record<string, unknown>;
    const nama = teks(o?.nama, 60)?.trim();
    if (!nama || brand.some(x => x.nama === nama)) continue;
    brand.push({ nama, sendiri: o.sendiri === true });
  }
  return { modul: modul as ModulLED[], kartu: kartu as Hardware[], vp: vp as Hardware[], ...(brand.length ? { brand } : {}) };
}

export const MAKS_GAMBAR_LAYAR = 6;
export const MAKS_BYTE_LAYAR = 200_000;

export const MAKS_TEKSTUR_RUANG = 4;
const POLA_KUNCI_TEKSTUR = /^tx-[a-z0-9]{6,32}$/;
export const POLA_REF_GAMBAR = /^ref:[0-9a-f]{40}$/;
const gambarAtauRef = (v: unknown, maks: number) => (typeof v === 'string' && POLA_REF_GAMBAR.test(v) ? v : bersihkanGambar(v, maks));

type DataDesain = { ruang: unknown; benda: unknown[]; layar?: Record<string, string>; tekstur?: Record<string, string> };

export function periksaDesain(x: unknown): { ok: true; data: DataDesain; jumlah: number } | { ok: false; alasan: string } {
  const d = x as Record<string, unknown>;
  if (!d || typeof d !== 'object' || !d.ruang || typeof d.ruang !== 'object' || !Array.isArray(d.benda)) {
    return { ok: false, alasan: 'Data desain tidak sah.' };
  }
  if (d.benda.length > MAKS_BENDA) return { ok: false, alasan: `Maksimal ${MAKS_BENDA} benda per desain.` };
  if (d.benda.some(b => !b || typeof b !== 'object' || typeof (b as { jenis?: unknown }).jenis !== 'string')) {
    return { ok: false, alasan: 'Data benda tidak sah.' };
  }
  const data: DataDesain = { ruang: d.ruang, benda: d.benda };
  if (JSON.stringify(data).length > MAKS_BYTE_DESAIN) return { ok: false, alasan: 'Desain terlalu besar untuk disimpan.' };
  if (d.layar !== undefined) {
    if (!d.layar || typeof d.layar !== 'object' || Array.isArray(d.layar)) return { ok: false, alasan: 'Gambar layar tidak sah.' };
    const ids = new Set(d.benda.map(b => String((b as { id?: unknown }).id ?? '')));
    const masuk = Object.entries(d.layar as Record<string, unknown>);
    if (masuk.length > MAKS_GAMBAR_LAYAR) return { ok: false, alasan: `Maksimal ${MAKS_GAMBAR_LAYAR} gambar layar per desain.` };
    const layar: Record<string, string> = {};
    for (const [id, url] of masuk) {
      const g = gambarAtauRef(url, MAKS_BYTE_LAYAR);
      if (!ids.has(id) || !g) return { ok: false, alasan: 'Gambar layar terlalu besar atau tidak sah.' };
      layar[id] = g;
    }
    if (masuk.length) data.layar = layar;
  }
  if (d.tekstur !== undefined) {
    if (!d.tekstur || typeof d.tekstur !== 'object' || Array.isArray(d.tekstur)) return { ok: false, alasan: 'Tekstur tidak sah.' };
    const masuk = Object.entries(d.tekstur as Record<string, unknown>);
    if (masuk.length > MAKS_TEKSTUR_RUANG) return { ok: false, alasan: `Maksimal ${MAKS_TEKSTUR_RUANG} tekstur per desain.` };
    const tekstur: Record<string, string> = {};
    for (const [kunci, url] of masuk) {
      const g = gambarAtauRef(url, MAKS_BYTE_LAYAR);
      if (!POLA_KUNCI_TEKSTUR.test(kunci) || !g) return { ok: false, alasan: 'Tekstur terlalu besar atau tidak sah.' };
      tekstur[kunci] = g;
    }
    if (masuk.length) data.tekstur = tekstur;
  }
  return { ok: true, data, jumlah: d.benda.length };
}

export const MAKS_BYTE_GAMBAR = 80_000;
export const MAKS_BYTE_GAMBAR_HD = 560_000;

export const urlGambarDesain = (id: string, versi: number, hd = false) =>
  `/api/tools-team/desain/gambar?id=${encodeURIComponent(id)}&v=${versi}${hd ? '&hd=1' : ''}`;

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

const URUT_KATEGORI = ['Display', 'Kamera & konferensi', 'Audio & kontrol', 'Perangkat & share nirkabel', 'Furnitur', 'Lainnya'];
export function kategoriBenda(jenis: string): string {
  if (['videowall', 'led', 'layar', 'ifp', 'tv', 'proyektor'].includes(jenis)) return 'Display';
  if (jenis === 'kamera' || jenis === 'lift') return 'Kamera & konferensi';
  if (['speaker', 'speaker-plafon', 'mic', 'touchpanel', 'rak'].includes(jenis)) return 'Audio & kontrol';
  if (['meja', 'kursi', 'tribun', 'panggung'].includes(jenis)) return 'Furnitur';
  if (jenis === 'lampu') return 'Interior & pencahayaan';
  if (jenis === 'perangkat') return 'Perangkat & share nirkabel';
  if (jenis === 'bidang') return 'Display';
  return 'Lainnya';
}

export function ringkasanDesain(data: { ruang: unknown; benda: unknown[] }): RingkasanDesain {
  const r = (data.ruang ?? {}) as Record<string, unknown>;
  const ukur = (x: Record<string, unknown> | undefined) => ({ p: Number(x?.p) || 0, l: Number(x?.l) || 0, t: Number(x?.t) || 0 });
  const ruang = [ukur(r)];
  for (const x of [r.r2, ...(Array.isArray(r.lain) ? r.lain : [])].slice(0, 3) as (Record<string, unknown> | null | undefined)[]) {
    if (!x || !x.aktif) break;
    ruang.push(ukur(x));
  }
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

export function statusRuangan(req: { status: string; rooms?: { status?: string }[] | null }, roomIdx: number): string {
  if (roomIdx === 0) return req.status;
  return req.rooms?.[roomIdx - 1]?.status ?? req.status;
}

export const PERAN_PTS = ['admin', 'superadmin', 'team_pts', 'team'];

export function bolehUbahTautan(role: string | null | undefined, status: string): { ok: true } | { ok: false; alasan: string } {
  if (!PERAN_PTS.includes((role ?? '').toLowerCase())) return { ok: false, alasan: 'Hanya tim PTS yang bisa menautkan Design 3D.' };
  if (status === 'pending' || status === 'rejected') return { ok: false, alasan: 'Ruangan ini belum diterima untuk dikerjakan.' };
  if (status === 'completed') {
    return { ok: false, alasan: 'Ruangan sudah Completed - tautan Design 3D terkunci. Ubah status ruangan bila perlu revisi.' };
  }
  return { ok: true };
}

export const MAKS_BYTE_LED = 120_000;

export interface RingkasanLED {
  project: string; customer: string; kode: string; lebarM: number; tinggiM: number;
  resX: number; resY: number; jumlahCab: number; screen: number;
}

export function periksaIsianLED(x: unknown): { ok: true; data: Record<string, unknown> } | { ok: false; alasan: string } {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return { ok: false, alasan: 'Isian kalkulator tidak sah.' };
  const data = x as Record<string, unknown>;
  if (Object.keys(data).length > 60) return { ok: false, alasan: 'Isian kalkulator tidak sah.' };
  if (JSON.stringify(data).length > MAKS_BYTE_LED) return { ok: false, alasan: 'Isian kalkulator terlalu besar.' };
  return { ok: true, data };
}

export const MAKS_SVG_KONEKSI = 3_000_000;

export function bersihkanSvgKoneksi(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const s = x.trim();
  if (!s.startsWith('<svg') || !s.endsWith('</svg>') || s.length > MAKS_SVG_KONEKSI) return null;
  if (/<script|<foreignObject|javascript:|\son[a-z]+\s*=|<iframe|<image[^>]+href\s*=\s*["']?(?!data:image\/)/i.test(s)) return null;
  return s;
}

export function bersihkanRingkasanLED(x: unknown): RingkasanLED {
  const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const t = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
  const a = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    project: t(r.project, 120), customer: t(r.customer, 120), kode: t(r.kode, 30),
    lebarM: a(r.lebarM), tinggiM: a(r.tinggiM), resX: a(r.resX), resY: a(r.resY), jumlahCab: a(r.jumlahCab), screen: a(r.screen) || 1,
  };
}

export const KUNCI_PRODUK = 'tools_team_produk';
export const MAKS_PRODUK = 300;
export const MAKS_BYTE_PRODUK = 6_000;

export const JENIS_PRODUK = ['videowall', 'led', 'layar', 'ifp', 'tv', 'meja', 'kursi', 'speaker', 'speaker-plafon', 'mic',
  'touchpanel', 'kamera', 'proyektor', 'rak', 'lift', 'tribun', 'panggung', 'bidang', 'lampu', 'perangkat'] as const;

export interface ProdukTim {
  id: string; label: string; ket: string; jenis: (typeof JENIS_PRODUK)[number];
  atur: Record<string, unknown>;
  oleh: string; olehId: string; dibuat: string;
}

const ENUM_PRODUK: Record<string, readonly string[]> = {
  rasio: ['16:9', '16:10', '4:3', '21:9'], vw: ['55BDL2105X', '49BDL2105X', 'custom'], pasang: ['dinding', 'hollow', 'standfloor'],
  mic: ['gooseneck', 'boundary'], bentukMeja: ['rapat', 'bulat', 'kelas', 'dosen', 'podium', 'kredensa', 'operator'], bentukBidang: ['datar', 'lengkung', 'cembung'], finish: ['walnut', 'oak', 'putih'],
  tipeKursi: ['kantor', 'kelas'], tipeKamera: ['ptz', 'ptz-ai', 'xbar'], pasangProyektor: ['plafon', 'meja'], konten: ['pola', 'mati', 'cctv', 'dashboard', 'campuran', 'desktop', 'putih'], tipeRak: ['kaca', 'tertutup', 'open'], tipeLampu: ['downlight', 'spot', 'panel', 'linear', 'gantung'],
  tipeSpeaker: ['kotak', 'dinding6', 'kolom', 'linearray'],
  tipePerangkat: ['pc', 'laptop', 'dongle', 'hp', 'tablet'],
  rasioProyektor: ['16:9', '16:10', '17:9', '4:3', '21:9'],
  resolusiProyektor: ['XGA', 'SXGAP', 'WXGAH', 'WXGA', 'FHD', 'WUXGA', 'WQXGA', '4K', '4KP', '4KDCI'],
};
const ANGKA_PRODUK: Record<string, [number, number]> = {
  w: [0.001, 40], h: [0.001, 40], d: [0.001, 40], elev: [0, 40], diag: [10, 500], pitch: [0.1, 50], cabW: [50, 3000], cabH: [50, 3000],
  kol: [1, 30], bar: [1, 30], rakU: [1, 80], throwRatio: [0.1, 50], tilt: [-90, 45], trMin: [0.1, 50], trMax: [0.1, 50],
  baris: [1, 60], kursiBaris: [1, 80], tinggiAnak: [0.1, 1], jariBidang: [0.2, 50], busur: [10, 360], jangkauan: [0.5, 60], sebaran: [10, 180], sebaranV: [4, 180],
  modul: [1, 24], sudutModul: [0, 15], tiltLA: [-30, 60],
  offsetLensa: [-0.5, 1.5], geserLensaH: [-0.6, 0.6], lumen: [0, 100000], monitorMeja: [0, 12],
  koreksiJarak: [-5, 5], koreksiJarakTele: [-5, 5], offsetTetap: [-0.5, 1.5], kontrasAsli: [1, 1e8], shiftAtasMaks: [0, 1.5], shiftBawahMaks: [0, 1.5], shiftHMaks: [0, 1], gainLayar: [0.1, 5], sudutLampu: [10, 160], dimmer: [0, 100], kelvin: [2000, 7000], gantungLampu: [0, 3],
};
const ANGKA_PANEL: Record<string, [number, number]> = {
  w: [0.05, 5], h: [0.05, 5], d: [0.001, 1], bezelMm: [0, 100], resX: [1, 16000], resY: [1, 16000], wTipikal: [0, 5000], wMaks: [0, 5000],
};

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
  const isiRak = bersihkanIsiRak(a.isiRak);
  if (isiRak) hasil.isiRak = isiRak;
  const poligon = bacaPoligonShift(a.poligonShift);
  if (poligon) hasil.poligonShift = poligon;
  const koef = bacaKoefRasio(a.koefRasio);
  if (koef) hasil.koefRasio = koef;
  if (typeof a.sumberLensa === 'string' && a.sumberLensa.trim()) hasil.sumberLensa = a.sumberLensa.trim().slice(0, 60);
  if (a.panel && typeof a.panel === 'object') {
    const p = a.panel as Record<string, unknown>, panel: Record<string, number> = {};
    for (const [k, batas] of Object.entries(ANGKA_PANEL)) { const v = angka(p[k], batas); if (v !== undefined) panel[k] = v; }
    if (Object.keys(panel).length === Object.keys(ANGKA_PANEL).length) hasil.panel = panel;
  }
  return hasil;
}

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

export const ID_KATEGORI_RUANG = [
  'meeting', 'auditorium', 'control-room', 'kelas', 'mapping-lengkung', 'mapping-cembung', 'mapping-objek', 'immersive',
] as const;
export const kategoriRuangSah = (x: unknown): x is (typeof ID_KATEGORI_RUANG)[number] =>
  typeof x === 'string' && (ID_KATEGORI_RUANG as readonly string[]).includes(x);
