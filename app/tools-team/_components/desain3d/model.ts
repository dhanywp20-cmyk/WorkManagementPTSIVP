/**
 * desain3d/model.ts - data benda & pembuat model 3D prosedural untuk
 * Desain 3D Ruang AV. Semua geometri dibuat dari primitif three.js
 * (tanpa berkas model luar), jadi ringan, tanpa lisensi pihak ketiga, dan
 * ukurannya selalu mengikuti angka yang diisi engineer.
 *
 * THREE dioper sebagai parameter (bukan di-import di sini) supaya modul ini
 * tidak menarik three.js ke bundel halaman lain - three dimuat dinamis oleh
 * Desain3D.tsx.
 *
 * Model dibangun dengan alas di y = 0; ketinggian (elev) diterapkan lewat
 * posisi grup. Bagian yang harus menyentuh lantai/plafon (kaki, tiang) diberi
 * userData dan disesuaikan oleh sesuaikanTinggi(), jadi benda bisa diseret
 * naik-turun tanpa membangun ulang model.
 */
import type * as T from 'three';
import { ukuranDariDiagonal } from '@/lib/av-hitung';

import { susunRak, type PerangkatRak } from './rak';

export type Jenis =
  | 'videowall' | 'led' | 'layar' | 'ifp' | 'tv'
  | 'meja' | 'kursi'
  | 'speaker' | 'speaker-plafon' | 'mic' | 'touchpanel' | 'kamera' | 'proyektor' | 'rak'
  | 'lift' | 'model' | 'tribun' | 'panggung' | 'bidang' | 'lampu';

export type BentukMeja = 'rapat' | 'bulat' | 'kelas' | 'dosen' | 'podium' | 'kredensa' | 'operator';
/** Konten layar: pola uji, unggahan, mati, atau konten contoh (CCTV, dashboard, campuran, home screen). */
export type KontenLayar = 'pola' | 'gambar' | 'mati' | 'cctv' | 'dashboard' | 'campuran' | 'desktop';
export type TipeRak = 'kaca' | 'tertutup' | 'open';
export type TipeLampu = 'downlight' | 'spot' | 'panel' | 'linear' | 'gantung';
export type Finish = 'walnut' | 'oak' | 'putih';
export type TipeKursi = 'kantor' | 'kelas';
export type TipeKamera = 'ptz' | 'ptz-ai' | 'xbar';
export type PasangProyektor = 'plafon' | 'meja';
/** Speaker: kotak dinding (lama), dinding 6" membulat + bracket putar, portable aktif (kolom + subwoofer), line array. */
export type TipeSpeaker = 'kotak' | 'dinding6' | 'kolom' | 'linearray';

export type ModelVW = '55BDL2105X' | '49BDL2105X' | 'custom';
/** Rasio layar proyektor (lebar:tinggi). */
export type RasioLayar = '16:9' | '16:10' | '4:3' | '21:9';
/** Panel videowall custom (merek/model lain): ukuran set & bezel dalam meter/mm. */
export interface PanelVW { w: number; h: number; d: number; bezelMm: number; resX: number; resY: number; wTipikal: number; wMaks: number }
export type Pasang = 'dinding' | 'standfloor';

export interface Benda {
  id: string; jenis: Jenis; nama: string;
  x: number; z: number; /** derajat, 0 = menghadap +z (ke dalam ruangan) */ rot: number;
  /** m */ w: number; h: number; d: number; /** tinggi sisi bawah dari lantai */ elev: number;
  /** TV / IFP / layar: diagonal inci */ diag?: number;
  /** Layar proyektor */ rasio?: RasioLayar;
  /** LED: pitch mm; ukuran cabinet mm untuk garis cabinet */ pitch?: number; cabW?: number; cabH?: number;
  /** Videowall LCD */ vw?: ModelVW; kol?: number; bar?: number;
  /** Videowall model 'custom': spesifikasi panel yang diisi sendiri */ panel?: PanelVW;
  /** Warna utama benda (#rrggbb) - menggantikan warna bawaan badan/kain/rangka/permukaan */ warna?: string;
  /** Speaker: jangkauan yang digambar (m) */ jangkauan?: number;
  /** Speaker: sudut sebaran horizontal (derajat, penuh) & vertikal */ sebaran?: number; sebaranV?: number;
  /** Speaker: bentuk/jenis */ tipeSpeaker?: TipeSpeaker;
  /** Line array: jumlah modul, sudut antar modul (°), kemiringan modul teratas (°, + = menunduk), digantung (flown) */
  modul?: number; sudutModul?: number; tiltLA?: number; gantung?: boolean;
  /** Speaker: tampilkan jangkauan suaranya (tanpa perlu centang global) */ tampilJangkauan?: boolean;
  /** Proyektor: rentang zoom lensa (throw ratio terlebar & terpanjang, datasheet). throwRatio = posisi zoom saat ini. */ trMin?: number; trMax?: number;
  /** Tribun: jumlah baris, kursi per baris, tinggi anak tangga (m) */ baris?: number; kursiBaris?: number; tinggiAnak?: number;
  /** Layar/bidang mapping: datar, lengkung (= cekung) atau cembung; jari-jari (m) & busur (derajat, 360 = pilar)
   *  untuk yang melengkung, lebar = w untuk yang datar. */
  bentukBidang?: 'datar' | 'lengkung' | 'cembung'; jariBidang?: number; busur?: number;
  /** Proyektor: offset vertikal lensa (0,5 = tepi gambar di sumbu lensa / offset 100%) */ offsetLensa?: number;
  /** Proyektor: lens shift horizontal (pecahan lebar gambar, + = ke kanan dilihat dari proyektor) */ geserLensaH?: number;
  /** Proyektor: kecerahan (ANSI lumen) */ lumen?: number;
  /** Display: tempel dinding atau standfloor (berkaki/troli) */ pasang?: Pasang;
  /** Rak: tinggi dalam U */ rakU?: number;
  /** Rak: isi per U dari atas (rack elevation); kosong = isi bawaan. */ isiRak?: PerangkatRak[];
  mic?: 'gooseneck' | 'boundary';
  /** Meja: bentuk & permukaan (bawaan: rapat, walnut; kelas: oak) */ bentukMeja?: BentukMeja; finish?: Finish;
  /** Kursi: kantor (beroda) / kelas (empat kaki) */ tipeKursi?: TipeKursi;
  /** Kamera: PTZ, PTZ AI (auto-tracking), atau camera soundbar */ tipeKamera?: TipeKamera;
  /** Display lift (paperless): layar sedang naik dari meja */ naik?: boolean;
  /** Proyektor: gantung plafon (bawaan) atau portabel di meja */ pasangProyektor?: PasangProyektor;
  /** Proyektor: throw ratio lensa (jarak lempar : lebar gambar), bawaan 1,5 */ throwRatio?: number;
  /** Proyektor: tilt (derajat, negatif = menunduk). Pan = rot. */ tilt?: number;
  /** Display: konten di layar ('pola' = pola uji bawaan; 'gambar' = unggahan, tidak disimpan) */ konten?: KontenLayar;
  /** Display: sembunyikan garis ukuran (mm) benda ini walau garis ukuran dinyalakan. */ sembunyiUkur?: boolean;
  /** Sembunyikan label produk benda ini walau label produk dinyalakan. */ sembunyiLabel?: boolean;
  /** Meja operator: jumlah monitor di atas meja. */ monitorMeja?: number;
  /** Rack: pintu kaca (isi terlihat), tertutup (pintu besi berlubang), atau open frame. */ tipeRak?: TipeRak;
  /** Lampu plafon: tipe, sudut sinar penuh (derajat), dimmer (%), suhu warna (K), jarak gantung dari plafon (m).
   *  Fluks memakai `lumen`. */
  tipeLampu?: TipeLampu; sudutLampu?: number; dimmer?: number; kelvin?: number; gantungLampu?: number;
  /** Model GLB impor: kunci ke cache objek di memori (tidak disimpan ke perangkat) */ modelKunci?: string;
}

export interface Ruang {
  p: number; l: number; t: number; lantai: 'kayu' | 'karpet' | 'keramik' | 'polos';
  /** Warna lantai 'polos' ruang 1 (#rrggbb) */ warnaLantai?: string;
  /** Warna dinding semua ruang (#rrggbb), bawaan putih tulang */ warnaDinding?: string;
  /** Finishing dinding depan (feature wall di belakang display) tiap ruang: polos (bawaan), marmer, atau panel kayu. */
  dindingDepan?: 'polos' | 'marmer' | 'kayu';
  /** Tingkat cahaya ruangan (bawaan terang). Gelap = ruang mapping / immersive, cahaya proyektor terlihat jelas. */ cahaya?: 'terang' | 'redup' | 'gelap';
  /** Dimmer semua lampu plafon (%), bawaan 100 - skenario presentasi. */ dimmer?: number;
  /** Cahaya siang lewat jendela dinding luar (bawaan malam = tidak dihitung) & tirai/blind tertutup (%). */
  siang?: Siang; tirai?: number;
  /** Pintu & jendela di dinding LUAR (sekat antar ruang punya pintu/jendela sendiri di r2 / lain). */ bukaan?: Bukaan[];
  /** Pengaturan analisis tampilan - ikut tersimpan bersama desain. */
  analisis?: { jenis: 'umum' | 'analitis' | 'detail' | 'custom'; faktor: number; sudut: number };
  /** Ruang ke-2 bersebelahan di sisi kanan (x = p .. p + r2.p). */
  r2?: RuangSambung | null;
  /** Ruang ke-3 dst., masing-masing di kanan ruang sebelumnya (maks MAKS_RUANG ruang). Sekatnya = sekat dengan ruang di kirinya. */
  lain?: RuangSambung[];
}

/**
 * Ruang tambahan yang menempel di kanan ruang sebelumnya, beserta sekat di sisi kirinya. Lebar (l)
 * boleh berbeda dari ruang sebelah: dengan sekat 'terbuka' dua ruang menjadi satu ruang bentuk L.
 */
export interface RuangSambung {
    aktif: boolean; p: number; l: number; t: number; lantai: Ruang['lantai']; pintu: boolean;
    /** Warna lantai 'polos' ruang 2 */ warnaLantai?: string;
    /** Pintu penghubung custom (meter): lebar, tinggi, z = pusat pintu dari dinding depan */ pintuUkuran?: { lebar: number; tinggi: number; z?: number };
    /** Sekat dengan ruang di kirinya: tembok (bawaan), kaca penuh, tembok dengan satu jendela kaca,
     *  atau terbuka (tanpa sekat - dua ruang menyatu, mis. ruang bentuk L). */ sekat?: 'tembok' | 'kaca' | 'jendela' | 'terbuka';
    /** Jendela kaca di sekat (sekat 'jendela'), dalam meter. geser = dari tengah sekat (+ ke belakang). */
    jendela?: { lebar: number; tinggi: number; ambang: number; geser: number };
}

export type SisiDinding = 'depan' | 'belakang' | 'kiri' | 'kanan';
/**
 * Pintu / jendela di dinding luar. posisi = pusat bukaan diukur dari ujung KIRI
 * dinding dilihat dari dalam ruang (m); ambang = tinggi sisi bawah jendela dari lantai.
 */
export interface Bukaan { id: string; ruang: number; sisi: SisiDinding; jenis: 'pintu' | 'jendela'; posisi: number; lebar: number; tinggi: number; ambang: number }

/** Kotak satu ruang dalam koordinat dunia. */
export interface Kotak { x0: number; p: number; l: number; t: number }

export const MAKS_RUANG = 4;
/** Ruang tambahan yang aktif, berurutan (ruang ke-2, ke-3, ...); berhenti di yang pertama tidak aktif. */
export function sambungan(r: Ruang): RuangSambung[] {
  const hasil: RuangSambung[] = [];
  for (const x of [r.r2, ...(r.lain ?? [])]) {
    if (!x?.aktif || hasil.length >= MAKS_RUANG - 1) break;
    hasil.push(x);
  }
  return hasil;
}
/** Ruang tambahan ke-j (j >= 1 = ruang indeks j) beserta sekat di kirinya. */
export const sambunganKe = (r: Ruang, j: number): RuangSambung | null => (j >= 1 ? sambungan(r)[j - 1] ?? null : null);

export function daftarRuang(r: Ruang): Kotak[] {
  const hasil: Kotak[] = [{ x0: 0, p: r.p, l: r.l, t: r.t }];
  let x = r.p;
  for (const s of sambungan(r)) { hasil.push({ x0: x, p: s.p, l: s.l, t: s.t }); x += s.p; }
  return hasil;
}

/** Indeks ruang tempat titik x berada (0 = ruang 1). */
export function ruangDari(r: Ruang, x: number): number {
  const k = daftarRuang(r);
  for (let i = k.length - 1; i > 0; i--) if (x > k[i].x0) return i;
  return 0;
}

/** Lebar & tinggi lubang pintu penghubung, dan posisi pusatnya di sepanjang sekat (z dunia). */
export const PINTU = { lebar: 0.9, tinggi: 2.1 };
/** Ukuran pintu penghubung (custom bila diisi), dijepit agar muat di sekat. */
export function ukuranPintu(r: Ruang, j = 1): { lebar: number; tinggi: number } {
  const k = daftarRuang(r), s = sambunganKe(r, j), kiri = k[j - 1] ?? k[0];
  const u = s?.pintuUkuran;
  const L = Math.min(kiri.l, s?.l ?? kiri.l), T = Math.min(kiri.t, s?.t ?? kiri.t);
  return {
    lebar: Math.max(0.5, Math.min(u?.lebar ?? PINTU.lebar, L - 0.4)),
    tinggi: Math.max(1.5, Math.min(u?.tinggi ?? PINTU.tinggi, T - 0.1)),
  };
}
/** Pusat pintu penghubung di sekat ke-j (kiri ruang j) sepanjang z dunia; bawaan 1 m dari dinding belakang. */
export function pintuSekat(r: Ruang, j = 1): number | null {
  const s = sambunganKe(r, j);
  if (!s || !s.pintu || s.sekat === 'terbuka') return null;
  const kiri = daftarRuang(r)[j - 1];
  const L = Math.min(kiri.l, s.l), setengah = ukuranPintu(r, j).lebar / 2;
  const z = s.pintuUkuran?.z ?? L - 1.0;
  return Math.max(setengah + 0.15, Math.min(L - setengah - 0.15, z));
}

export const JENDELA_AWAL = { lebar: 2.0, tinggi: 1.2, ambang: 0.9, geser: 0 };

export const ANALISIS_AWAL: NonNullable<Ruang['analisis']> = { jenis: 'analitis', faktor: 5, sudut: 45 };
export const analisisDari = (r: Ruang): NonNullable<Ruang['analisis']> => ({ ...ANALISIS_AWAL, ...(r.analisis ?? {}) });

export const BUKAAN_AWAL = { pintu: { lebar: 0.9, tinggi: 2.1, ambang: 0 }, jendela: { lebar: 1.5, tinggi: 1.2, ambang: 0.9 } };
/** Dinding luar ruang i - dinding sekat antar ruang tidak termasuk (pintu/jendelanya diatur di r2). */
export function sisiLuar(r: Ruang, i: number): SisiDinding[] {
  const n = daftarRuang(r).length;
  return (['depan', 'belakang', 'kiri', 'kanan'] as SisiDinding[]).filter(s => !(s === 'kiri' && i > 0) && !(s === 'kanan' && i < n - 1));
}
export const panjangDinding = (k: Kotak, sisi: SisiDinding) => (sisi === 'depan' || sisi === 'belakang' ? k.p : k.l);
/**
 * Bukaan di satu dinding luar, dijepit supaya utuh di dalam dinding (sisa >= 10 cm di tepi,
 * >= 5 cm di bawah plafon). x0..x1 dari ujung kiri dinding (dilihat dari dalam), y0..y1 dari lantai.
 */
export function bukaanDinding(r: Ruang, i: number, sisi: SisiDinding): { b: Bukaan; x0: number; x1: number; y0: number; y1: number }[] {
  if (!sisiLuar(r, i).includes(sisi)) return [];
  const k = daftarRuang(r)[i]; if (!k) return [];
  const P = panjangDinding(k, sisi);
  const jepit = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return (r.bukaan ?? []).filter(b => b.ruang === i && b.sisi === sisi).map(b => {
    const lebar = jepit(b.lebar, 0.3, Math.max(0.3, P - 0.2));
    const y0 = b.jenis === 'pintu' ? 0 : jepit(b.ambang, 0, Math.max(0, k.t - 0.35));
    const y1 = jepit(y0 + b.tinggi, y0 + 0.2, k.t - 0.05);
    const c = jepit(b.posisi, 0.1 + lebar / 2, Math.max(0.1 + lebar / 2, P - 0.1 - lebar / 2));
    return { b, x0: c - lebar / 2, x1: c + lebar / 2, y0, y1 };
  });
}

/**
 * Jendela kaca di sekat antar ruang (sekat 'jendela'), dalam koordinat dunia:
 * z0..z1 sepanjang sekat, y0..y1 dari lantai. Ukuran dibatasi supaya tetap
 * di dalam dinding (sisa >= 20 cm di tiap tepi) dan TIDAK menimpa pintu
 * penghubung - bila bertabrakan, jendela digeser menjauhi pintu.
 */
export function jendelaSekat(r: Ruang, ke = 1): { z0: number; z1: number; y0: number; y1: number } | null {
  const s = sambunganKe(r, ke);
  if (!s || s.sekat !== 'jendela') return null;
  const kiri = daftarRuang(r)[ke - 1];
  const j = { ...JENDELA_AWAL, ...(s.jendela ?? {}) };
  const L = Math.min(kiri.l, s.l), T = Math.min(kiri.t, s.t), tepi = 0.2;
  const lebar = Math.max(0.3, Math.min(j.lebar, L - 2 * tepi));
  const y0 = Math.max(0.1, Math.min(j.ambang, T - 0.4));
  const y1 = Math.max(y0 + 0.2, Math.min(y0 + j.tinggi, T - 0.15));
  let tengah = L / 2 + j.geser;
  tengah = Math.min(L - tepi - lebar / 2, Math.max(tepi + lebar / 2, tengah));
  const pintu = pintuSekat(r, ke);
  if (pintu !== null) {
    const lp = ukuranPintu(r, ke).lebar;
    const p0 = pintu - lp / 2 - 0.15, p1 = pintu + lp / 2 + 0.15;
    if (tengah + lebar / 2 > p0 && tengah - lebar / 2 < p1) {
      //  Pindah ke sisi yang lebih lega (depan / belakang pintu).
      const ruangDepan = p0 - tepi, ruangBelakang = L - tepi - p1;
      tengah = ruangDepan >= ruangBelakang ? Math.min(tengah, p0 - lebar / 2) : Math.max(tengah, p1 + lebar / 2);
      tengah = Math.min(L - tepi - lebar / 2, Math.max(tepi + lebar / 2, tengah));
    }
  }
  const b = (v: number) => Math.round(v * 1000) / 1000;
  return { z0: b(tengah - lebar / 2), z1: b(tengah + lebar / 2), y0: b(y0), y1: b(y1) };
}

// ── Katalog produk ─────────────────────────────────────────────────────────

/**
 * Videowall LCD Philips X-Line (datasheet: ukuran set W×H×D, bezel
 * 2,3 + 1,2 = 3,5 mm sisi ke sisi, resolusi 1920×1080 per panel).
 */
export const VIDEOWALL: Record<Exclude<ModelVW, 'custom'>, { nama: string; inci: number; w: number; h: number; d: number; bezelMm: number; wTipikal: number; wMaks: number }> = {
  '55BDL2105X': { nama: 'Philips 55BDL2105X', inci: 55, w: 1.2135, h: 0.6843, d: 0.0978, bezelMm: 3.5, wTipikal: 180, wMaks: 340 },
  '49BDL2105X': { nama: 'Philips 49BDL2105X', inci: 49, w: 1.0776, h: 0.6078, d: 0.0933, bezelMm: 3.5, wTipikal: 100, wMaks: 230 },
};

/** Panel awal untuk model videowall 'custom' (diisi ulang engineer sesuai datasheet). */
export const PANEL_VW_AWAL: PanelVW = { w: 1.2135, h: 0.6843, d: 0.0978, bezelMm: 3.5, resX: 1920, resY: 1080, wTipikal: 180, wMaks: 340 };

/** Spesifikasi panel videowall benda ini: katalog, atau isian sendiri untuk model 'custom'. */
export function spekVideowall(b: Pick<Benda, 'vw' | 'panel'>): PanelVW & { nama: string; inci: number } {
  if (b.vw === 'custom') {
    const p = { ...PANEL_VW_AWAL, ...(b.panel ?? {}) };
    return { ...p, nama: 'Panel custom', inci: Math.round(Math.hypot(p.w, p.h) / 0.0254) };
  }
  const m = VIDEOWALL[b.vw ?? '55BDL2105X'] ?? VIDEOWALL['55BDL2105X'];
  return { ...m, resX: 1920, resY: 1080 };
}

/** Interactive flat panel - ukuran set umum kelas 65/75/86" (cek datasheet merek). */
export const IFP: Record<number, { w: number; h: number; d: number }> = {
  65: { w: 1.49, h: 0.898, d: 0.09 },
  75: { w: 1.712, h: 1.023, d: 0.09 },
  86: { w: 1.957, h: 1.166, d: 0.093 },
};

export const LAYAR_DIAG = [100, 120, 150, 200];
export const RAK_U = [12, 20, 27, 32, 42];
export const PITCH_LED = [1.25, 1.53, 1.86, 2, 2.5, 3, 3.84, 4, 5, 6, 8, 10];

export const tinggiRak = (u: number) => u * 0.04445 + 0.16;
export const IFP_DIAG = [65, 75, 86];
/** Ukuran signage display / TV komersial yang umum. */
export const TV_DIAG = [55, 65, 75, 86];
/** Ukuran set IFP: tabel kelas 65/75/86", selain itu diperkirakan dari diagonal 16:9 + bezel 3 cm. */
export function ukuranIFP(diag: number): { w: number; h: number; d: number } {
  if (IFP[diag]) return IFP[diag];
  const u = ukuranDariDiagonal(diag);
  return { w: Math.round((u.lebarM + 0.06) * 1000) / 1000, h: Math.round((u.tinggiM + 0.06) * 1000) / 1000, d: 0.09 };
}

export const RASIO_LAYAR: RasioLayar[] = ['16:9', '16:10', '4:3', '21:9'];
export function ukuranLayar(diag: number, rasio: RasioLayar | string) {
  const [a, b] = (String(rasio).match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)?.slice(1).map(Number) ?? [16, 9]) as number[];
  const u = ukuranDariDiagonal(diag, a, b);
  return { w: u.lebarM, h: u.tinggiM };
}

export const LABEL: Record<Jenis, string> = {
  videowall: 'Videowall', led: 'LED Videotron', layar: 'Layar proyektor', ifp: 'Interactive display', tv: 'TV / Display',
  meja: 'Meja', kursi: 'Kursi',
  speaker: 'Speaker', 'speaker-plafon': 'Speaker plafon', mic: 'Mic', touchpanel: 'Touch panel',
  kamera: 'Kamera', proyektor: 'Proyektor', rak: 'Rack server', lift: 'Display lift', model: 'Model 3D (GLB)',
  tribun: 'Tribun', panggung: 'Panggung', bidang: 'Bidang mapping', lampu: 'Lampu plafon',
};
export const DISPLAY: Jenis[] = ['videowall', 'led', 'layar', 'ifp', 'tv'];
/** Benda yang bisa ditempel ke dinding (sisi belakang menyentuh dinding). */
export const BISA_TEMPEL: Jenis[] = ['videowall', 'led', 'layar', 'ifp', 'tv', 'speaker', 'kamera', 'rak', 'meja', 'model', 'tribun', 'panggung', 'bidang'];

export interface ItemKatalog {
  kunci: string; label: string; ket: string; jenis: Jenis; atur?: Partial<Benda>;
  /** Preset beberapa benda sekaligus (mis. set ruang kelas) - menggantikan satu benda `jenis`. */
  set?: (k: Kotak) => Benda[];
}

export const KATALOG: { grup: string; item: ItemKatalog[] }[] = [
  {
    grup: 'Display', item: [
      { kunci: 'vw55', label: 'Videowall 55"', ket: 'Philips 55BDL2105X · 2×2', jenis: 'videowall', atur: { vw: '55BDL2105X', kol: 2, bar: 2 } },
      { kunci: 'vw49', label: 'Videowall 49"', ket: 'Philips 49BDL2105X · 2×2', jenis: 'videowall', atur: { vw: '49BDL2105X', kol: 2, bar: 2 } },
      { kunci: 'led', label: 'LED Videotron', ket: 'Pitch & cabinet bebas', jenis: 'led' },
      { kunci: 'layar', label: 'Layar proyektor', ket: '100" / 120" / 200" · 16:9 / 4:3', jenis: 'layar' },
      { kunci: 'proj', label: 'Proyektor plafon', ket: 'Bracket gantung · sinar ke layar', jenis: 'proyektor', atur: { pasangProyektor: 'plafon' } },
      { kunci: 'proj-m', label: 'Proyektor portabel', ket: 'Diletakkan di meja · sinar ke layar', jenis: 'proyektor', atur: { pasangProyektor: 'meja' } },
      { kunci: 'ifp-d', label: 'Interactive display', ket: '65" / 75" / 86" · dinding', jenis: 'ifp', atur: { pasang: 'dinding' } },
      { kunci: 'ifp-s', label: 'Interactive standfloor', ket: '65" / 75" / 86" · troli', jenis: 'ifp', atur: { pasang: 'standfloor' } },
      { kunci: 'signage', label: 'Signage display', ket: '55" / 65" / 75" / 86" · bracket dinding', jenis: 'tv', atur: { diag: 55, pasang: 'dinding', nama: 'Signage 55"' } },
      { kunci: 'signage-s', label: 'Signage standfloor', ket: '55" - 86" · stand beroda', jenis: 'tv', atur: { diag: 65, pasang: 'standfloor', nama: 'Signage 65"' } },
      { kunci: 'tv', label: 'TV / Display', ket: 'Diagonal bebas', jenis: 'tv' },
    ],
  },
  {
    grup: 'Audio & kontrol', item: [
      { kunci: 'mic-g', label: 'Mic gooseneck', ket: 'Di meja', jenis: 'mic', atur: { mic: 'gooseneck' } },
      { kunci: 'mic-b', label: 'Mic boundary', ket: 'Di meja · cakram bundar', jenis: 'mic', atur: { mic: 'boundary' } },
      { kunci: 'spk6', label: 'Speaker dinding 6"', ket: 'Kabinet membulat + bracket putar', jenis: 'speaker', atur: { tipeSpeaker: 'dinding6' } },
      { kunci: 'spk', label: 'Speaker dinding kotak', ket: 'Kabinet + bracket dinding', jenis: 'speaker', atur: { tipeSpeaker: 'kotak' } },
      { kunci: 'spk-kolom', label: 'Speaker portable aktif', ket: 'Kolom + subwoofer, berdiri di lantai', jenis: 'speaker', atur: { tipeSpeaker: 'kolom' } },
      { kunci: 'spk-la', label: 'Line array', ket: 'Modul bertumpuk / digantung, jumlah modul bebas', jenis: 'speaker', atur: { tipeSpeaker: 'linearray' } },
      { kunci: 'spk-p', label: 'Speaker plafon', ket: 'In-ceiling, gril bulat', jenis: 'speaker-plafon' },
      { kunci: 'tp', label: 'Touch panel', ket: 'Kontrol di meja', jenis: 'touchpanel' },
      { kunci: 'rak', label: 'Rack server (pintu kaca)', ket: '12U - 42U, isi perangkat terlihat', jenis: 'rak', atur: { tipeRak: 'kaca' } },
      { kunci: 'rak-tutup', label: 'Rack server tertutup', ket: 'Pintu besi berlubang', jenis: 'rak', atur: { tipeRak: 'tertutup' } },
      { kunci: 'rak-open', label: 'Rack open frame', ket: 'Tanpa pintu & panel samping', jenis: 'rak', atur: { tipeRak: 'open' } },
    ],
  },
  {
    grup: 'Kamera & konferensi', item: [
      { kunci: 'kam', label: 'Kamera PTZ', ket: 'Pan-tilt-zoom, di dinding/rak', jenis: 'kamera', atur: { tipeKamera: 'ptz' } },
      { kunci: 'kam-ai', label: 'Kamera PTZ AI', ket: 'Auto-tracking, bar sensor', jenis: 'kamera', atur: { tipeKamera: 'ptz-ai' } },
      { kunci: 'xbar', label: 'Camera soundbar', ket: 'Video bar: kamera + speaker + mic', jenis: 'kamera', atur: { tipeKamera: 'xbar' } },
      { kunci: 'lift', label: 'Paperless display lift', ket: 'Layar naik dari meja + mic', jenis: 'lift' },
    ],
  },
  {
    grup: 'Interior & pencahayaan', item: [
      { kunci: 'lampu-down', label: 'Downlight', ket: 'Lampu plafon bulat ±1000 lm, sinar 60°', jenis: 'lampu', atur: { tipeLampu: 'downlight' } },
      { kunci: 'lampu-spot', label: 'Spotlight', ket: 'Sinar sempit 36°, aksen', jenis: 'lampu', atur: { tipeLampu: 'spot' } },
      { kunci: 'lampu-panel', label: 'Panel LED 60 × 60', ket: 'Lampu kantor ±3600 lm, sinar lebar', jenis: 'lampu', atur: { tipeLampu: 'panel' } },
      { kunci: 'lampu-linear', label: 'Lampu linear gantung', ket: 'Pendant linear 1,2 m, kabel gantung', jenis: 'lampu', atur: { tipeLampu: 'linear' } },
      { kunci: 'lampu-gantung', label: 'Lampu gantung dekoratif', ket: 'Pendant kap kubah 42 cm, 3000 K hangat (lobi, meja rapat)', jenis: 'lampu', atur: { tipeLampu: 'gantung' } },
      { kunci: 'set-lampu', label: 'Set downlight (grid)', ket: 'Downlight merata ±2,2 m di seluruh plafon', jenis: 'lampu', set: k => setLampuGrid(k) },
    ],
  },
  {
    grup: 'Furnitur', item: [
      { kunci: 'meja', label: 'Meja rapat', ket: 'Sudut membulat, kaki panel', jenis: 'meja', atur: { bentukMeja: 'rapat' } },
      { kunci: 'meja-bulat', label: 'Meja bundar', ket: 'Meeting room kecil, kaki tunggal', jenis: 'meja', atur: { bentukMeja: 'bulat' } },
      { kunci: 'meja-kelas', label: 'Meja kelas', ket: 'Meja siswa 2 orang', jenis: 'meja', atur: { bentukMeja: 'kelas' } },
      { kunci: 'set-kelas', label: 'Set ruang kelas', ket: 'Deret meja & kursi siswa + meja pengajar', jenis: 'meja', set: k => setRuangKelas(k) },
      { kunci: 'kursi', label: 'Kursi kantor', ket: 'Beroda, sandaran melengkung', jenis: 'kursi', atur: { tipeKursi: 'kantor' } },
      { kunci: 'kursi-kelas', label: 'Kursi kelas', ket: 'Empat kaki, cangkang plastik', jenis: 'kursi', atur: { tipeKursi: 'kelas' } },
      { kunci: 'meja-dosen', label: 'Meja dosen', ket: 'Meja pengajar berpanel depan', jenis: 'meja', atur: { bentukMeja: 'dosen' } },
      { kunci: 'podium', label: 'Podium', ket: 'Mimbar + mic gooseneck', jenis: 'meja', atur: { bentukMeja: 'podium' } },
      { kunci: 'kredensa', label: 'Kredensa', ket: 'Lemari rendah di bawah display', jenis: 'meja', atur: { bentukMeja: 'kredensa' } },
      { kunci: 'meja-operator', label: 'Meja operator', ket: 'Control room, multi monitor', jenis: 'meja', atur: { bentukMeja: 'operator' } },
    ],
  },
  {
    grup: 'Venue & mapping', item: [
      { kunci: 'tribun', label: 'Tribun', ket: 'Kursi teater bertingkat, baris & kursi bebas', jenis: 'tribun' },
      { kunci: 'panggung', label: 'Panggung', ket: 'Platform + tangga', jenis: 'panggung' },
      { kunci: 'bidang-datar', label: 'Layar mapping datar', ket: 'Bidang screen datar, lebar & tinggi bebas', jenis: 'bidang', atur: { bentukBidang: 'datar' } },
      { kunci: 'bidang-lengkung', label: 'Layar mapping cekung', ket: 'Screen melengkung ke dalam (curve), lebar & kedalaman lengkung bebas', jenis: 'bidang', atur: { bentukBidang: 'lengkung' } },
      { kunci: 'bidang-cembung', label: 'Layar mapping cembung', ket: 'Screen melengkung keluar ke arah penonton', jenis: 'bidang', atur: { bentukBidang: 'cembung', busur: 60, jariBidang: 5 } },
      { kunci: 'pilar', label: 'Pilar mapping 360°', ket: 'Silinder untuk mapping keliling', jenis: 'bidang', atur: { bentukBidang: 'cembung', busur: 360, jariBidang: 0.8 } },
    ],
  },
];

let nomor = 0;
export const idBaru = () => `b${Date.now().toString(36)}${(nomor++).toString(36)}`;

/** Hitung ulang w/h/d dari properti produk (videowall, layar, IFP, TV, rak). */
export function terapkanUkuran(b: Benda): Benda {
  switch (b.jenis) {
    case 'videowall': {
      const m = spekVideowall(b);
      const kol = Math.max(1, b.kol ?? 2), bar = Math.max(1, b.bar ?? 2);
      return { ...b, kol, bar, w: m.w * kol, h: m.h * bar, d: m.d };
    }
    case 'layar': { const u = ukuranLayar(b.diag ?? 120, b.rasio ?? '16:9'); return { ...b, w: u.w, h: u.h }; }
    case 'ifp': { const u = ukuranIFP(b.diag ?? 75); return { ...b, ...u }; }
    //  Area aktif 16:9 + bezel ±12 mm tiap sisi (signage / TV komersial).
    case 'tv': { const u = ukuranDariDiagonal(b.diag ?? 65); return { ...b, w: Math.round((u.lebarM + 0.024) * 1000) / 1000, h: Math.round((u.tinggiM + 0.024) * 1000) / 1000 }; }
    case 'rak': return { ...b, h: tinggiRak(b.rakU ?? 20) };
    case 'tribun': {
      const n = barisTribun(b), m = kursiTribunPerBaris(b), riser = Math.max(0.1, Math.min(1, b.tinggiAnak ?? 0.35));
      return { ...b, baris: n, kursiBaris: m, tinggiAnak: riser, w: Math.round((m * 0.55 + 0.6) * 100) / 100, d: Math.round(n * 0.9 * 100) / 100, h: Math.round(((n - 1) * riser + 0.95) * 100) / 100 };
    }
    case 'bidang': {
      const u = ukuranBidang(b);
      return { ...b, w: u.w, d: u.d };
    }
    default: return b;
  }
}

export const barisTribun = (b: Benda) => Math.max(1, Math.min(60, Math.round(b.baris ?? 8)));
export const kursiTribunPerBaris = (b: Benda) => Math.max(1, Math.min(80, Math.round(b.kursiBaris ?? 12)));
/** Jari-jari & busur bidang mapping, dan ukuran tapaknya (lebar tali busur x kedalaman). */
export function ukuranBidang(b: Benda) {
  if (b.bentukBidang === 'datar') return { R: 0, busur: 0, w: Math.max(0.2, Math.min(60, b.w || 5)), d: 0.06 };
  const R = Math.max(0.2, Math.min(50, b.jariBidang ?? 4)), busur = Math.max(10, Math.min(360, b.busur ?? 90));
  const t = (busur * Math.PI) / 180;
  const w = busur >= 180 ? 2 * R : 2 * R * Math.sin(t / 2);
  const d = R * (1 - Math.cos(t / 2));
  return { R, busur, w: Math.round(Math.max(0.05, w) * 1000) / 1000, d: Math.round(Math.max(0.05, d) * 1000) / 1000 };
}

/**
 * Jari-jari & busur dari lebar layar (tali busur) dan kedalaman lengkungnya - cara engineer
 * menyebut layar lengkung ("lebar 6 m, melengkung 40 cm"). Kedalaman maks = setengah lebar (180°).
 */
export function lengkungDari(lebar: number, kedalaman: number): { jariBidang: number; busur: number } {
  const c = Math.max(0.2, lebar), s = Math.max(0.01, Math.min(c / 2, kedalaman));
  const R = (c * c / 4 + s * s) / (2 * s);
  const busur = (2 * Math.asin(Math.min(1, c / (2 * R))) * 180) / Math.PI;
  return { jariBidang: Math.round(R * 1000) / 1000, busur: Math.round(busur * 100) / 100 };
}

/** Posisi kursi tribun di dunia (x, z, tinggi dudukan) - penonton untuk analisis tampilan. */
export function kursiTribun(b: Benda): { x: number; z: number; y: number }[] {
  const n = barisTribun(b), m = kursiTribunPerBaris(b);
  const tD = b.d / n, riser = n > 1 ? Math.max(0, (b.h - 0.95) / (n - 1)) : 0, pitch = (b.w - 0.6) / m;
  const r = (b.rot * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
  const hasil: { x: number; z: number; y: number }[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const lx = -b.w / 2 + 0.3 + (j + 0.5) * pitch, lz = b.d / 2 - tD * (i + 0.5);
    hasil.push({ x: b.x + lx * c + lz * sn, z: b.z - lx * sn + lz * c, y: b.elev + i * riser + 0.45 });
  }
  return hasil;
}

/** Benda baru di tengah ruang k (dinding depan untuk display). */
export function bendaBaru(jenis: Jenis, k: Kotak, atur: Partial<Benda> = {}): Benda {
  const dasar = { id: idBaru(), jenis, nama: LABEL[jenis], x: k.x0 + k.p / 2, z: k.l / 2, rot: 0, ...atur };
  const jadi = (b: Benda) => terapkanUkuran(b);
  switch (jenis) {
    case 'videowall': {
      const b = jadi({ ...dasar, w: 0, h: 0, d: 0, elev: 0.8, vw: '55BDL2105X', kol: 2, bar: 2, pasang: 'dinding', konten: 'pola', ...atur } as Benda);
      return { ...b, nama: `Videowall ${spekVideowall(b).inci}" ${b.kol}×${b.bar}`, z: b.d / 2 + 0.06 };
    }
    case 'led': return { ...dasar, z: 0.08, w: 4, h: 2.25, d: 0.1, elev: 0.6, pitch: 2.5, cabW: 500, cabH: 500, konten: 'pola', ...atur };
    case 'layar': { const b = jadi({ ...dasar, z: 0.05, w: 0, h: 0, d: 0.03, elev: 0.9, diag: 120, rasio: '16:9', konten: 'pola', ...atur } as Benda); return { ...b, nama: `Layar ${b.diag}" ${b.rasio}` }; }
    case 'ifp': {
      const stand = (atur.pasang ?? 'dinding') === 'standfloor';
      const b = jadi({ ...dasar, z: stand ? 0.5 : 0.07, w: 0, h: 0, d: 0, elev: stand ? 0.72 : 0.85, diag: 75, pasang: stand ? 'standfloor' : 'dinding', konten: 'pola', ...atur } as Benda);
      return { ...b, nama: `Interactive ${b.diag}"${stand ? ' standfloor' : ''}` };
    }
    case 'tv': {
      const stand = atur.pasang === 'standfloor';
      return jadi({ ...dasar, z: stand ? 0.5 : 0.09, w: 0, h: 0, d: 0.06, elev: stand ? 0.75 : 1.0, diag: 65, pasang: 'dinding', konten: 'pola', ...atur } as Benda);
    }
    case 'meja': {
      const bentuk = atur.bentukMeja ?? 'rapat';
      if (bentuk === 'bulat') return { ...dasar, nama: 'Meja bundar', z: k.l * 0.55, w: 1.2, h: 0.75, d: 1.2, elev: 0, bentukMeja: 'bulat', finish: 'walnut', ...atur };
      if (bentuk === 'kelas') return { ...dasar, nama: 'Meja kelas', z: k.l * 0.5, w: 1.2, h: 0.75, d: 0.5, elev: 0, bentukMeja: 'kelas', finish: 'oak', ...atur };
      if (bentuk === 'dosen') return { ...dasar, nama: 'Meja dosen', x: k.x0 + Math.min(1.8, k.p * 0.25), z: 1.5, w: 1.6, h: 0.75, d: 0.75, elev: 0, bentukMeja: 'dosen', finish: 'oak', ...atur };
      if (bentuk === 'podium') return { ...dasar, nama: 'Podium', x: k.x0 + Math.min(3, k.p * 0.35), z: 1.3, w: 0.6, h: 1.15, d: 0.5, elev: 0, bentukMeja: 'podium', finish: 'walnut', ...atur };
      if (bentuk === 'kredensa') return { ...dasar, nama: 'Kredensa', z: 0.25, w: Math.min(2.4, k.p * 0.5), h: 0.75, d: 0.45, elev: 0, bentukMeja: 'kredensa', finish: 'walnut', ...atur };
      if (bentuk === 'operator') return { ...dasar, nama: 'Meja operator', z: Math.min(k.l - 1, k.l * 0.55), w: 1.8, h: 0.75, d: 0.8, elev: 0, bentukMeja: 'operator', monitorMeja: 4, finish: 'walnut', ...atur };
      return { ...dasar, nama: 'Meja rapat', z: k.l * 0.55, w: 1.2, h: 0.75, d: 3.6, elev: 0, bentukMeja: 'rapat', finish: 'walnut', ...atur };
    }
    case 'kursi': return (atur.tipeKursi ?? 'kantor') === 'kelas'
      ? { ...dasar, nama: 'Kursi kelas', z: k.l * 0.8, w: 0.47, h: 0.82, d: 0.5, elev: 0, rot: 180, tipeKursi: 'kelas', ...atur }
      : { ...dasar, nama: 'Kursi', z: k.l * 0.8, w: 0.58, h: 1.02, d: 0.58, elev: 0, rot: 180, tipeKursi: 'kantor', ...atur };
    case 'speaker': {
      const tipe = atur.tipeSpeaker ?? 'kotak';
      if (tipe === 'dinding6') return { ...dasar, nama: 'Speaker dinding 6"', x: k.x0 + 0.4, z: 0.15, w: 0.2, h: 0.3, d: 0.24, elev: 2.0, tipeSpeaker: 'dinding6', ...atur };
      if (tipe === 'kolom') return { ...dasar, nama: 'Speaker portable aktif', x: k.x0 + 0.6, z: 0.6, w: 0.38, h: 2.0, d: 0.45, elev: 0, tipeSpeaker: 'kolom', ...atur };
      if (tipe === 'linearray') {
        const n = Math.max(1, Math.min(24, Math.round(atur.modul ?? 2)));
        return { ...dasar, nama: `Line array ${n} modul`, x: k.x0 + 0.8, z: 0.6, w: 0.7, h: 0.3 * n, d: 0.45, elev: 0, tipeSpeaker: 'linearray', modul: n, sudutModul: 0, tiltLA: 0, ...atur };
      }
      return { ...dasar, nama: 'Speaker dinding kotak', x: k.x0 + 0.4, z: 0.17, w: 0.21, h: 0.32, d: 0.2, elev: 2.0, tipeSpeaker: 'kotak', ...atur };
    }
    case 'speaker-plafon': return { ...dasar, w: 0.24, h: 0.06, d: 0.24, elev: k.t - 0.06, ...atur };
    case 'lampu': {
      const tipe = atur.tipeLampu ?? 'downlight', sp = SPEK_LAMPU[tipe];
      const gantung = sp.gantung > 0 ? atur.gantungLampu ?? sp.gantung : 0;
      return { ...dasar, nama: sp.label, w: sp.w, h: sp.h, d: sp.d, elev: Math.max(0.5, k.t - sp.h - gantung), tipeLampu: tipe, lumen: sp.lumen, sudutLampu: sp.sudut,
        dimmer: 100, kelvin: tipe === 'gantung' ? 3000 : 4000, ...(sp.gantung > 0 ? { gantungLampu: gantung } : {}), ...atur };
    }
    case 'mic': return (atur.mic ?? 'gooseneck') === 'boundary'
      ? { ...dasar, z: k.l * 0.55, w: 0.18, h: 0.032, d: 0.18, elev: 0.75, mic: 'boundary', nama: 'Mic boundary', ...atur }
      : { ...dasar, z: k.l * 0.55, w: 0.12, h: 0.42, d: 0.12, elev: 0.75, mic: 'gooseneck', nama: 'Mic gooseneck', ...atur };
    case 'touchpanel': return { ...dasar, z: k.l * 0.4, w: 0.26, h: 0.16, d: 0.17, elev: 0.75, rot: 180, ...atur };
    case 'kamera': {
      const tipe = atur.tipeKamera ?? 'ptz';
      if (tipe === 'xbar') return { ...dasar, nama: 'Camera soundbar', z: 0.12, w: 0.9, h: 0.1, d: 0.09, elev: 0.62, tipeKamera: 'xbar', ...atur };
      if (tipe === 'ptz-ai') return { ...dasar, nama: 'Kamera PTZ AI', z: 0.12, w: 0.28, h: 0.15, d: 0.09, elev: 0.4, tipeKamera: 'ptz-ai', ...atur };
      return { ...dasar, nama: 'Kamera PTZ', z: 0.15, w: 0.17, h: 0.19, d: 0.17, elev: 0.4, tipeKamera: 'ptz', ...atur };
    }
    case 'lift': return { ...dasar, nama: 'Paperless display lift', z: k.l * 0.55, w: 0.55, h: 0.3, d: 0.22, elev: 0.75, naik: true, ...atur };
    case 'proyektor': return (atur.pasangProyektor ?? 'plafon') === 'meja'
      ? { ...dasar, nama: 'Proyektor portabel', z: k.l * 0.6, w: 0.3, h: 0.09, d: 0.23, elev: 0.75, rot: 180, pasangProyektor: 'meja', throwRatio: 1.5, trMin: 1.48, trMax: 1.78, ...atur }
      : { ...dasar, nama: 'Proyektor plafon', z: Math.min(4, k.l * 0.65), w: 0.44, h: 0.14, d: 0.36, elev: Math.max(0.5, k.t - 0.5), rot: 180, pasangProyektor: 'plafon', throwRatio: 1.6, trMin: 1.39, trMax: 2.09, ...atur };
    case 'rak': { const b = jadi({ ...dasar, x: k.x0 + k.p - 0.45, z: 0.45, w: 0.6, h: 0, d: 0.8, elev: 0, rakU: 20, tipeRak: 'kaca', ...atur } as Benda); return { ...b, nama: `Rack ${b.rakU}U` }; }
    case 'model': return { ...dasar, w: 1, h: 1, d: 1, elev: 0, ...atur };
    case 'tribun': {
      const b = terapkanUkuran({ ...dasar, w: 0, h: 0, d: 0, elev: 0, rot: 180, baris: 8, kursiBaris: 12, tinggiAnak: 0.35, ...atur } as Benda);
      return { ...b, nama: `Tribun ${b.baris} baris × ${b.kursiBaris}`, z: Math.max(b.d / 2, k.l - b.d / 2 - 0.3), ...(atur.z !== undefined ? { z: atur.z } : {}) };
    }
    case 'panggung': {
      const w = Math.min(10, Math.max(2, k.p * 0.7)), d = Math.min(4, Math.max(1.5, k.l * 0.25));
      return { ...dasar, nama: 'Panggung', z: d / 2 + 0.1, w, h: 0.6, d, elev: 0, ...atur };
    }
    case 'bidang': {
      const bentuk = atur.bentukBidang ?? 'lengkung';
      if (bentuk === 'datar') {
        const b = terapkanUkuran({ ...dasar, nama: 'Layar mapping datar', w: 5, h: 2.8, d: 0.06, elev: 0.3, bentukBidang: 'datar', ...atur } as Benda);
        return { ...b, z: atur.z ?? b.d / 2 + 0.2 };
      }
      const lengkung = bentuk === 'lengkung';
      const b = terapkanUkuran({ ...dasar, nama: lengkung ? 'Layar mapping cekung' : 'Layar mapping cembung', w: 0, h: lengkung ? 2.5 : 3, d: 0, elev: lengkung ? 0.3 : 0,
        bentukBidang: lengkung ? 'lengkung' : 'cembung', jariBidang: lengkung ? 4 : 0.8, busur: lengkung ? 90 : 360, ...atur } as Benda);
      if ((b.busur ?? 90) >= 360) return { ...b, nama: atur.nama ?? 'Pilar mapping 360°', z: atur.z ?? k.l / 2 };
      return { ...b, z: atur.z ?? b.d / 2 + 0.2 };
    }
  }
}

export function contohAwal(r: Ruang): Benda[] {
  const k = daftarRuang(r)[0];
  const vw = bendaBaru('videowall', k);
  const meja = bendaBaru('meja', k);
  const kam = { ...bendaBaru('kamera', k), elev: vw.elev - 0.3 };
  const kursi: Benda[] = [];
  for (let i = 0; i < 3; i++) {
    for (const sisi of [-1, 1]) {
      kursi.push({ ...bendaBaru('kursi', k), x: k.p / 2 + sisi * 1.05, z: meja.z - 1.1 + i * 1.1, rot: sisi < 0 ? 90 : -90 });
    }
  }
  return [vw, meja, kam, ...kursi,
    { ...bendaBaru('mic', k), x: k.p / 2 - 0.3, z: meja.z - 0.6, rot: 270 }, { ...bendaBaru('mic', k), x: k.p / 2 + 0.3, z: meja.z + 0.6, rot: 90 },
    { ...bendaBaru('touchpanel', k), z: meja.z + meja.d / 2 - 0.2 },
    { ...bendaBaru('speaker-plafon', k), z: k.l / 3 }, { ...bendaBaru('speaker-plafon', k), z: (k.l * 2) / 3 },
    bendaBaru('rak', k)];
}

/**
 * Set ruang kelas: deret meja siswa (2 orang/meja) menghadap dinding depan
 * (tempat display), kursi di belakang tiap meja, dan meja pengajar di depan
 * kiri. Jumlah kolom/baris menyesuaikan ukuran ruang (maks 4 x 6 meja).
 */
/** Pilihan Set ruang kelas; yang kosong dihitung otomatis dari ukuran ruang. */
export interface OpsiKelas { kolom?: number; baris?: number; jarakBaris?: number; celah?: number; kursiPerMeja?: number; pengajar?: boolean }

/** Hitungan Set ruang kelas yang dipakai: isian sendiri, atau otomatis dari ukuran ruang. */
export function ukuranSetKelas(k: Kotak, o: OpsiKelas = {}) {
  const perMeja = Math.max(1, Math.min(3, Math.round(o.kursiPerMeja ?? 2)));
  const lebar = perMeja === 1 ? 0.7 : perMeja === 2 ? 1.2 : 1.7;
  const celah = Math.max(0.2, Math.min(3, o.celah ?? 0.4)), jarakBaris = Math.max(0.8, Math.min(4, o.jarakBaris ?? 1.15));
  const kolom = Math.max(1, Math.min(12, Math.round(o.kolom ?? Math.max(1, Math.min(4, Math.floor((k.p - 0.8 + celah) / (lebar + celah)))))));
  const zMulai = Math.min(2.4, Math.max(1.6, k.l * 0.3));
  const baris = Math.max(1, Math.min(20, Math.round(o.baris ?? Math.max(1, Math.min(6, Math.floor((k.l - zMulai - 0.7) / jarakBaris) + 1)))));
  return { perMeja, lebar, celah, jarakBaris, kolom, zMulai, baris };
}

export function setRuangKelas(k: Kotak, o: OpsiKelas = {}): Benda[] {
  const { perMeja, lebar, celah, jarakBaris, kolom, zMulai, baris } = ukuranSetKelas(k, o);
  const total = kolom * lebar + (kolom - 1) * celah;
  const hasil: Benda[] = [];
  for (let r = 0; r < baris; r++) {
    for (let c = 0; c < kolom; c++) {
      const x = k.x0 + k.p / 2 - total / 2 + lebar / 2 + c * (lebar + celah);
      const z = zMulai + r * jarakBaris;
      hasil.push({ ...bendaBaru('meja', k, { bentukMeja: 'kelas' }), x, z, w: lebar, nama: `Meja kelas ${r + 1}.${c + 1}` });
      for (let j = 0; j < perMeja; j++) {
        const sx = ((j + 0.5) / perMeja - 0.5) * lebar;
        hasil.push({ ...bendaBaru('kursi', k, { tipeKursi: 'kelas' }), x: x + sx, z: z + 0.45, rot: 180 });
      }
    }
  }
  if (o.pengajar !== false) hasil.push({
    ...bendaBaru('meja', k, { bentukMeja: 'rapat', finish: 'oak' }),
    x: k.x0 + Math.min(1.3, k.p * 0.22), z: Math.max(0.9, zMulai - 0.95), w: 1.4, d: 0.7, nama: 'Meja pengajar',
  });
  return hasil;
}

// ── Lampu plafon & perhitungan cahaya ───────────────────────────────────────

export const SPEK_LAMPU: Record<TipeLampu, { label: string; w: number; h: number; d: number; lumen: number; sudut: number; gantung: number }> = {
  downlight: { label: 'Downlight', w: 0.17, h: 0.06, d: 0.17, lumen: 1000, sudut: 60, gantung: 0 },
  spot: { label: 'Spotlight', w: 0.1, h: 0.1, d: 0.1, lumen: 700, sudut: 36, gantung: 0 },
  panel: { label: 'Panel LED 60×60', w: 0.6, h: 0.04, d: 0.6, lumen: 3600, sudut: 110, gantung: 0 },
  linear: { label: 'Lampu linear gantung', w: 1.2, h: 0.07, d: 0.06, lumen: 3500, sudut: 100, gantung: 0.6 },
  gantung: { label: 'Lampu gantung dekoratif', w: 0.42, h: 0.3, d: 0.42, lumen: 1500, sudut: 120, gantung: 0.9 },
};
/** Lampu yang tergantung kabel dari plafon (jarak gantung bisa diatur). */
export const lampuGantung = (t: TipeLampu | undefined) => SPEK_LAMPU[t ?? 'downlight'].gantung > 0;
export const lumenLampu = (b: Benda) => Math.max(0, b.lumen ?? SPEK_LAMPU[b.tipeLampu ?? 'downlight'].lumen);
export const sudutLampuDari = (b: Benda) => Math.max(10, Math.min(160, b.sudutLampu ?? SPEK_LAMPU[b.tipeLampu ?? 'downlight'].sudut));
/** Faktor nyala lampu 0..1 (dimmer lampu x dimmer semua lampu ruangan). */
export const nyalaLampu = (b: Benda, r: Ruang) => (Math.max(0, Math.min(100, b.dimmer ?? 100)) / 100) * (Math.max(0, Math.min(100, r.dimmer ?? 100)) / 100);
/** Warna cahaya dari suhu warna (K). */
export const warnaKelvin = (k = 4000) => (k <= 3200 ? 0xffd6a0 : k <= 4500 ? 0xfff1dc : 0xeef4ff);

/** Downlight merata di plafon satu ruang (jarak ±2,2 m, 0,6-1,1 m dari dinding). */
export function setLampuGrid(k: Kotak, atur: Partial<Benda> = {}): Benda[] {
  const nx = Math.max(1, Math.round(k.p / 2.2)), nz = Math.max(1, Math.round(k.l / 2.2));
  const hasil: Benda[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const b = bendaBaru('lampu', k, { tipeLampu: 'downlight', ...atur });
    hasil.push({ ...b, x: k.x0 + (k.p * (i + 0.5)) / nx, z: (k.l * (j + 0.5)) / nz, nama: `${b.nama} ${i * nz + j + 1}` });
  }
  return hasil;
}

/**
 * Iluminansi langsung (lux) dari satu lampu plafon di titik P berpermukaan normal n.
 * Lampu = sumber titik menghadap ke bawah dengan distribusi I = I0 cos^m(a): m dipilih supaya
 * intensitas 50% tepat di tepi sudut sinar, I0 supaya fluks total = lumen x dimmer.
 * Lampu linear dipecah 4 titik sepanjang badannya. E = I cos(b) / d^2.
 */
export function luxLampuLangsung(l: Benda, r: Ruang, P: Titik, n: Titik): number {
  const phi = lumenLampu(l) * nyalaLampu(l, r);
  if (phi <= 0) return 0;
  const setengah = (sudutLampuDari(l) / 2) * (Math.PI / 180);
  const m = Math.log(0.5) / Math.log(Math.cos(Math.min(1.5, setengah)));
  const linear = l.tipeLampu === 'linear', bagian = linear ? 4 : 1;
  const I0 = (phi * (m + 1)) / (2 * Math.PI) / bagian;
  const rr = (l.rot * Math.PI) / 180;
  let E = 0;
  for (let i = 0; i < bagian; i++) {
    const t = linear ? ((i + 0.5) / bagian - 0.5) * l.w : 0;
    const sx = l.x + t * Math.cos(rr), sz = l.z - t * Math.sin(rr), sy = l.elev;
    const vx = P[0] - sx, vy = P[1] - sy, vz = P[2] - sz;
    const d2 = vx * vx + vy * vy + vz * vz; if (d2 < 1e-4) continue;
    const d = Math.sqrt(d2), cosA = -vy / d;
    if (cosA <= 0) continue;
    const cosB = Math.max(0, -(vx * n[0] + vy * n[1] + vz * n[2]) / d);
    E += (I0 * Math.pow(cosA, m) * cosB) / d2;
  }
  return E;
}

/** Cahaya pantulan rata-rata di permukaan ruang (lux): fluks total x rho / (luas permukaan x (1 - rho)). */
export function luxPantul(lampu: Benda[], r: Ruang, k: Kotak, rho = 0.45): number {
  const phi = lampu.reduce((a, l) => a + lumenLampu(l) * nyalaLampu(l, r), 0);
  const luas = 2 * (k.p * k.l + k.p * k.t + k.l * k.t);
  return (phi * rho) / Math.max(1, luas * (1 - rho));
}

/** Cahaya langit di luar (lux horizontal, difus - tanpa sinar matahari langsung masuk) per kondisi. */
export const LUX_LUAR = { malam: 0, mendung: 8000, cerah: 20000, terik: 35000 } as const;
export type Siang = keyof typeof LUX_LUAR;

/**
 * Cahaya siang rata-rata di dalam ruang ri dari jendela dinding luar (lux), rumus average daylight
 * factor (BRE): DF% = T × Aw × θ × M / (A × (1 − R²)) dengan transmisi kaca T 0,7, sudut langit
 * terlihat θ 70°, faktor kotor M 0,9, pantulan rata-rata R 0,45, A = luas semua permukaan ruang.
 * Tirai/blind mengurangi sebanding persen tertutup. Jendela di sekat (ke ruang lain) tidak dihitung.
 */
export function luxSiang(r: Ruang, ri: number): { lux: number; df: number; luasJendela: number } {
  const k = daftarRuang(r)[ri] ?? daftarRuang(r)[0];
  let Aw = 0;
  for (const sisi of sisiLuar(r, ri)) for (const x of bukaanDinding(r, ri, sisi)) if (x.b.jenis === 'jendela') Aw += (x.x1 - x.x0) * (x.y1 - x.y0);
  const A = 2 * (k.p * k.l + k.p * k.t + k.l * k.t);
  const df = (0.7 * Aw * 70 * 0.9) / Math.max(1, A * (1 - 0.45 * 0.45));
  const tutup = Math.min(100, Math.max(0, r.tirai ?? 0)) / 100;
  return { lux: (LUX_LUAR[r.siang ?? 'malam'] * df) / 100 * (1 - tutup), df, luasJendela: Aw };
}

/** Perkiraan cahaya ruangan bila belum ada lampu di desain (dari pilihan Cahaya ruangan). */
export const LUX_PRESET: Record<'terang' | 'redup' | 'gelap', number> = { terang: 300, redup: 80, gelap: 5 };

/**
 * Cahaya ruangan yang jatuh di titik P (normal n): lampu (langsung + pantulan, atau perkiraan preset
 * bila belum ada lampu) ditambah cahaya siang dari jendela.
 */
export function luxCahayaDi(semua: Benda[], r: Ruang, P: Titik, n: Titik) {
  const ri = ruangDari(r, P[0]);
  const k = daftarRuang(r)[ri] ?? daftarRuang(r)[0];
  const lampu = semua.filter(b => b.jenis === 'lampu' && ruangDari(r, b.x) === ri);
  const siang = luxSiang(r, ri).lux;
  if (!lampu.length) {
    const preset = LUX_PRESET[r.cahaya ?? 'terang'];
    return { langsung: preset, pantul: 0, siang, total: preset + siang, dariLampu: false, jumlahLampu: 0 };
  }
  const langsung = lampu.reduce((a, l) => a + luxLampuLangsung(l, r, P, n), 0);
  const pantul = luxPantul(lampu, r, k);
  return { langsung, pantul, siang, total: langsung + pantul + siang, dariLampu: true, jumlahLampu: lampu.length };
}

/** Rata-rata iluminansi di bidang kerja (0,75 m) satu ruang - 8 x 6 titik. */
export function luxBidangKerja(semua: Benda[], r: Ruang, ri: number) {
  const k = daftarRuang(r)[ri] ?? daftarRuang(r)[0];
  const nilai: number[] = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) {
    nilai.push(luxCahayaDi(semua, r, [k.x0 + (k.p * (i + 0.5)) / 8, 0.75, (k.l * (j + 0.5)) / 6], [0, 1, 0]).total);
  }
  return { rata: nilai.reduce((a, b) => a + b, 0) / nilai.length, min: Math.min(...nilai), maks: Math.max(...nilai) };
}

/** Target kontras gambar proyeksi (ANSI/INFOCOMM 3M-2011, AVIXA). */
export const TARGET_KONTRAS: { v: number; l: string; ket: string }[] = [
  { v: 7, l: '7 : 1', ket: 'Passive viewing (tontonan santai)' },
  { v: 15, l: '15 : 1', ket: 'Basic decision making (presentasi, rapat)' },
  { v: 50, l: '50 : 1', ket: 'Analytical decision making (detail, spreadsheet)' },
  { v: 80, l: '80 : 1', ket: 'Full motion video (video, immersive)' },
];

/**
 * Kontras gambar proyektor terhadap cahaya ruangan: (lux gambar + lux ruangan) / lux ruangan,
 * dihitung di tengah gambar dengan normal permukaan yang dituju (layar, dinding, lantai).
 */
export function kontrasProyektor(p: Benda, semua: Benda[], r: Ruang, target: number) {
  const sn = sinarProyektor(p, semua, r);
  const P: Titik = [0, 1, 2].map(i => sn.sudut.reduce((a, c) => a + c[i], 0) / 4) as Titik;
  let n: Titik;
  if (sn.layar) { const rl = (sn.layar.rot * Math.PI) / 180; n = [Math.sin(rl), 0, Math.cos(rl)]; }
  else { const D = arahProyektor(p); n = [-D[0], -D[1], -D[2]]; }
  const luas = Math.max(0.05, sn.lebar * sn.tinggi);
  const luxGambar = lumenDari(p) / luas;
  const cahaya = luxCahayaDi(semua, r, P, n);
  const amb = Math.max(0.5, cahaya.total);
  const kontras = (luxGambar + amb) / amb;
  return { luxGambar, cahaya, kontras, cukup: kontras >= target, lumenPerlu: Math.ceil(((target - 1) * amb * luas) / 100) * 100, luas };
}

/** Titik penonton: kursi, dan kursi bayangan di sekeliling meja yang belum berkursi. */
export function titikPenonton(b: Benda[]): { x: number; z: number; id: string }[] {
  const tribun = b.filter(x => x.jenis === 'tribun').flatMap(t => kursiTribun(t).map((p, i) => ({ x: p.x, z: p.z, id: `${t.id}#${i}` })));
  const kursi = b.filter(x => x.jenis === 'kursi');
  if (kursi.length || tribun.length) return [...kursi.map(k => ({ x: k.x, z: k.z, id: k.id })), ...tribun];
  const hasil: { x: number; z: number; id: string }[] = [];
  for (const x of b.filter(m => m.jenis === 'meja' && !['kredensa', 'podium', 'dosen'].includes(m.bentukMeja ?? 'rapat'))) {
    const r = (x.rot * Math.PI) / 180;
    const lokal = [[-x.w / 2 - 0.4, -x.d / 2 + 0.3], [x.w / 2 + 0.4, -x.d / 2 + 0.3], [-x.w / 2 - 0.4, x.d / 2 - 0.3], [x.w / 2 + 0.4, x.d / 2 - 0.3], [0, x.d / 2 + 0.4]];
    for (const [lx, lz] of lokal) hasil.push({ x: x.x + lx * Math.cos(r) + lz * Math.sin(r), z: x.z - lx * Math.sin(r) + lz * Math.cos(r), id: x.id });
  }
  return hasil;
}

/** Tanda tangan bentuk: berubah = model perlu dibangun ulang (posisi, rotasi, ketinggian tidak termasuk). */
export const tandaBentuk = (b: Benda) =>
  [b.jenis, b.w, b.h, b.d, b.pitch, b.cabW, b.cabH, b.vw, b.kol, b.bar, b.pasang, b.rakU, b.mic, b.konten, b.modelKunci,
    b.bentukMeja, b.finish, b.tipeKursi, b.tipeKamera, b.naik, b.pasangProyektor, b.tilt, b.warna, b.panel ? JSON.stringify(b.panel) : '', b.diag, b.tipeSpeaker, b.modul, b.sudutModul, b.tiltLA, b.gantung,
    b.baris, b.kursiBaris, b.tinggiAnak, b.bentukBidang, b.jariBidang, b.busur, b.monitorMeja, b.tipeRak, b.tipeLampu, b.sudutLampu, b.kelvin, b.lumen,
    b.isiRak ? JSON.stringify(b.isiRak) : ''].join('|');

// ── Salin ke ruang sebelah ─────────────────────────────────────────────────

const bulat2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Salinan benda di ruang `tujuan` (id baru). Bila ukuran kedua ruang sama,
 * posisinya identik. Bila berbeda: benda yang menempel dinding (celah <= 25 cm)
 * tetap menempel dinding yang sama, perangkat plafon tetap tergantung dari
 * plafon, dan sisanya bergeser bersama titik tengah ruang - susunan meja &
 * kursi tidak ikut menyusut/merenggang.
 */
export function salinKeRuang(b: Benda, asal: Kotak, tujuan: Kotak): Benda {
  return { ...petakanKeKotak(b, asal, tujuan), id: idBaru() };
}

/** Posisi benda di kotak `tujuan` (aturan salinKeRuang), id tetap. */
export function petakanKeKotak(b: Benda, asal: Kotak, tujuan: Kotak): Benda {
  const r = (b.rot * Math.PI) / 180;
  //  Setengah jejak benda searah sumbu dunia (memperhitungkan rotasi).
  const ex = (Math.abs(Math.cos(r)) * b.w + Math.abs(Math.sin(r)) * b.d) / 2;
  const ez = (Math.abs(Math.sin(r)) * b.w + Math.abs(Math.cos(r)) * b.d) / 2;
  const TEMPEL = 0.25;
  const peta = (v: number, a0: number, aP: number, t0: number, tP: number, e: number) => {
    const rel = v - a0, celahA = rel - e, celahB = aP - rel - e;
    const baru = celahA <= TEMPEL && celahA <= celahB ? t0 + rel
      : celahB <= TEMPEL ? t0 + tP - (aP - rel)
        : t0 + tP / 2 + (rel - aP / 2);
    const m = Math.max(0.01, Math.min(e, tP / 2 - 0.01));
    return bulat2(Math.min(t0 + tP - m, Math.max(t0 + m, baru)));
  };
  const diPlafon = b.jenis === 'speaker-plafon' || (b.jenis === 'proyektor' && b.pasangProyektor !== 'meja') || b.elev + b.h >= asal.t - 0.05;
  const elev = diPlafon ? tujuan.t - (asal.t - b.elev) : Math.min(b.elev, tujuan.t - b.h);
  return {
    ...b,
    x: peta(b.x, asal.x0, asal.p, tujuan.x0, tujuan.p, ex),
    z: peta(b.z, 0, asal.l, 0, tujuan.l, ez),
    elev: bulat2(Math.max(0, elev)),
  };
}

// ── Proyektor: lensa, sinar ke layar, jarak lempar ─────────────────────────

export type Titik = [number, number, number];

/** Titik lokal benda (alas y = 0, +z = arah hadap) ke koordinat dunia. */
export function keDunia(b: Benda, [lx, ly, lz]: Titik): Titik {
  const r = (b.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [b.x + lx * c + lz * s, b.elev + ly, b.z - lx * s + lz * c];
}

/** Ujung kaca lensa sebelum tilt (lokal) - lensa di samping kanan muka, seperti produk umumnya. */
export const lensaDatar = (b: Benda): Titik => [b.w * 0.22, b.h * 0.5, b.d / 2 + 0.035];

/** Engsel tilt (lokal): plafon = sendi bola bracket di atas badan, meja = kaki belakang. */
export const engselProyektor = (b: Benda): Titik => (b.pasangProyektor === 'meja' ? [0, 0, -b.d / 2 + 0.04] : [0, b.h + 0.04, 0]);

/** Tilt proyektor (derajat, negatif = menunduk): -90° (tegak lurus ke lantai, immersive) .. +45°. */
export const tiltDari = (b: Benda) => Math.max(-90, Math.min(45, b.tilt ?? 0));
/** Rentang zoom lensa: [terlebar, terpanjang]. Tanpa isian = lensa tetap (rentang = throw ratio sekarang). */
export function zoomLensa(b: Benda): [number, number] {
  const tr = throwRatioDari(b);
  const lo = Math.max(0.1, b.trMin ?? tr), hi = Math.max(lo, b.trMax ?? tr);
  return [Math.min(lo, hi), Math.max(lo, hi)];
}
/**
 * Arahkan proyektor ke titik dunia (pan = rot, tilt). Lens shift dinolkan dulu oleh
 * pemanggil bila ingin pusat gambar tepat di titik itu (template mapping/immersive).
 */
export function arahkanKe(p: Benda, [tx, ty, tz]: Titik): Benda {
  const dx = tx - p.x, dz = tz - p.z, dy = ty - (p.elev + p.h / 2), datar = Math.hypot(dx, dz);
  const rot = datar > 1e-3 ? ((Math.atan2(dx, dz) * 180) / Math.PI + 360) % 360 : p.rot;
  const tilt = Math.max(-90, Math.min(45, (Math.atan2(dy, Math.max(1e-6, datar)) * 180) / Math.PI));
  return { ...p, rot: Math.round(rot * 10) / 10, tilt: Math.round(tilt * 10) / 10 };
}

/** Putar titik lokal di sekitar engsel sebesar tilt (sama dengan rotation.x = -tilt pada model). */
function miringkan(b: Benda, [x, y, z]: Titik): Titik {
  const t = (tiltDari(b) * Math.PI) / 180;
  if (!t) return [x, y, z];
  const [, py, pz] = engselProyektor(b);
  const dy = y - py, dz = z - pz;
  return [x, py + dy * Math.cos(t) + dz * Math.sin(t), pz - dy * Math.sin(t) + dz * Math.cos(t)];
}

/** Ujung lensa (lokal) setelah tilt. */
export const lensaProyektor = (b: Benda): Titik => miringkan(b, lensaDatar(b));

/** Arah sumbu lensa di dunia: pan = rot, tilt = naik/turun. */
export function arahProyektor(b: Benda): Titik {
  const r = (b.rot * Math.PI) / 180, t = (tiltDari(b) * Math.PI) / 180;
  return [Math.sin(r) * Math.cos(t), Math.sin(t), Math.cos(r) * Math.cos(t)];
}

export const throwRatioDari = (b: Benda) => Math.max(0.1, b.throwRatio ?? 1.5);

/** Tinggi telinga/mata penonton duduk (m) - acuan cakupan speaker. */
export const TINGGI_DENGAR = 1.2;
export const tipeSpeakerDari = (b: Benda): TipeSpeaker => b.tipeSpeaker ?? 'kotak';
export const modulLA = (b: Benda) => Math.max(1, Math.min(24, Math.round(b.modul ?? 2)));
export const sudutModulLA = (b: Benda) => Math.max(0, Math.min(15, b.sudutModul ?? 0));
export const tiltLADari = (b: Benda) => Math.max(-30, Math.min(60, b.tiltLA ?? 0));
/** Sudut sebaran horizontal speaker (derajat, penuh) - datasheet; bawaan per tipe bila tidak diisi. */
export const sebaranSpeaker = (b: Benda) => Math.min(180, Math.max(10, b.sebaran ?? (b.jenis === 'speaker-plafon' ? 110
  : ({ kotak: 90, dinding6: 90, kolom: 120, linearray: 100 } as const)[tipeSpeakerDari(b)])));
/** Sudut sebaran vertikal. Line array: per modul (bawaan 10°); lainnya: sama dengan horizontal, kolom 30°. */
export const sebaranVSpeaker = (b: Benda) => Math.min(180, Math.max(4, b.sebaranV ?? (b.jenis === 'speaker-plafon' ? sebaranSpeaker(b)
  : ({ kotak: sebaranSpeaker(b), dinding6: sebaranSpeaker(b), kolom: 30, linearray: 10 } as const)[tipeSpeakerDari(b)])));
/** Jangkauan suara yang digambar (m); bawaan per tipe bila tidak diisi. */
export const jangkauanDari = (b: Benda) => Math.min(60, Math.max(0.5, b.jangkauan ?? ({ kotak: 8, dinding6: 10, kolom: 25, linearray: 40 } as const)[tipeSpeakerDari(b)]));

/**
 * Berkas suara tiap modul line array (dunia): titik pancar di muka modul, arah sumbunya
 * (mengikuti kemiringan atas + sudut antar modul), dan titik jatuh sumbu di tinggi telinga
 * (null bila sumbu tidak turun ke tinggi itu). Dipakai untuk menggambar jangkauan per modul.
 */
export function berkasLineArray(b: Benda): { asal: Titik; arah: Titik; jatuh: Titik | null; jarak: number | null }[] {
  const n = modulLA(b), hm = b.h / n, r = (b.rot * Math.PI) / 180;
  const maju: Titik = [Math.sin(r), 0, Math.cos(r)];
  const hasil: { asal: Titik; arah: Titik; jatuh: Titik | null; jarak: number | null }[] = [];
  //  Engsel di tepi depan-atas tiap modul (lihat buatModel 'linearray'): y lokal turun, z lokal mundur.
  let y = b.h, z = b.d / 2;
  for (let i = 0; i < n; i++) {
    const a = ((tiltLADari(b) + i * sudutModulLA(b)) * Math.PI) / 180;
    const yTengah = y - (hm / 2) * Math.cos(a), zTengah = z - (hm / 2) * Math.sin(a);
    const asal: Titik = [b.x + maju[0] * zTengah, b.elev + yTengah, b.z + maju[2] * zTengah];
    const arah: Titik = [maju[0] * Math.cos(a), -Math.sin(a), maju[2] * Math.cos(a)];
    let jatuh: Titik | null = null, jarak: number | null = null;
    if (arah[1] < -1e-3 && asal[1] > TINGGI_DENGAR) {
      const t = (asal[1] - TINGGI_DENGAR) / -arah[1];
      jatuh = [asal[0] + arah[0] * t, TINGGI_DENGAR, asal[2] + arah[2] * t];
      jarak = Math.hypot(jatuh[0] - b.x, jatuh[2] - b.z);
    }
    hasil.push({ asal, arah, jatuh, jarak });
    y -= hm * Math.cos(a); z -= hm * Math.sin(a);
  }
  return hasil;
}
/** Jari-jari cakupan speaker plafon di tinggi dengar (m). */
export const cakupanSpeakerPlafon = (b: Benda) => Math.max(0, b.elev - TINGGI_DENGAR) * Math.tan((sebaranSpeaker(b) / 2) * Math.PI / 180);

/** Offset vertikal lensa proyektor (pecahan tinggi gambar). */
export const offsetLensaDari = (p: Benda) => Math.min(1.5, Math.max(-0.5, p.offsetLensa ?? OFFSET_GAMBAR));
/** Lens shift horizontal (pecahan lebar gambar). */
export const geserLensaDari = (p: Benda) => Math.min(0.6, Math.max(-0.6, p.geserLensaH ?? 0));
/** Lumen bawaan bila tidak diisi. */
export const lumenDari = (p: Benda) => Math.max(100, p.lumen ?? (p.pasangProyektor === 'meja' ? 3500 : 5000));
/**
 * Perkiraan kecerahan gambar: iluminansi (lux = lumen / luas gambar) dan luminans layar
 * gain 1 (nits = lux / pi). Panduan kasar ruang rapat: < 150 lux hanya ruang gelap,
 * 150-300 lampu diredupkan, >= 300 lampu menyala.
 */
export function kecerahanProyektor(p: Benda, luasM2: number) {
  const lux = lumenDari(p) / Math.max(0.05, luasM2);
  return { lux, nits: lux / Math.PI, nada: (lux >= 300 ? 'baik' : lux >= 150 ? 'awas' : 'buruk') as 'baik' | 'awas' | 'buruk' };
}

/**
 * Offset vertikal lensa: proyektor memancarkan gambar di atas sumbu lensanya
 * (meja) atau di bawahnya (gantung plafon, terbalik). 0,5 = tepi gambar tepat
 * di sumbu lensa (offset 100%, umum pada proyektor tanpa lens shift).
 */
export const OFFSET_GAMBAR = 0.5;

export interface Sinar {
  /** Lensa (dunia). */ asal: Titik;
  /** Pojok gambar (dunia): kiri-bawah, kanan-bawah, kanan-atas, kiri-atas. */ sudut: [Titik, Titik, Titik, Titik];
  /** Layar sasaran; null = gambar jatuh di dinding/lantai/plafon. */ layar: Benda | null;
  /** Jarak lempar lensa ke bidang gambar sepanjang sumbu lensa (m). */ jarak: number;
  lebar: number; tinggi: number;
  /** Throw ratio agar gambar tepat selebar layar sasaran. */ trPas: number | null;
  /** Pusat gambar - pusat layar: + = terlalu tinggi / terlalu ke kanan (m). null tanpa layar. */
  selisihV: number | null; selisihH: number | null;
}

/**
 * Sinar satu proyektor. Sasaran = layar proyektor terdekat di ruang yang sama
 * yang berada di depan lensa (maks 50° dari arah hadap) dan menghadap balik
 * ke proyektor. Gambar jatuh di titik sumbu lensa (pan & tilt) mengenai bidang
 * layar, digeser offset vertikal; lebar = jarak lempar / throw ratio. Jadi
 * gambar terlihat melebihi/kurang dari layar bila jaraknya tidak pas, dan
 * terlalu tinggi/rendah bila tilt-nya tidak pas. Tanpa layar, gambar jatuh di
 * permukaan ruang yang dituju lensa.
 */
export function sinarProyektor(p: Benda, semua: Benda[], ruang: Ruang): Sinar {
  const asal = keDunia(p, lensaProyektor(p));
  const D = arahProyektor(p);
  const r = (p.rot * Math.PI) / 180;
  const maju = [Math.sin(r), Math.cos(r)];
  const ri = ruangDari(ruang, p.x);
  const tr = throwRatioDari(p);
  const naikTurun = p.pasangProyektor === 'meja' ? 1 : -1;
  const offV = offsetLensaDari(p), geserH = geserLensaDari(p);
  /** Kanan proyektor (dilihat dari belakang proyektor) di dunia. */
  const kananP: Titik = [-Math.cos(r), 0, Math.sin(r)];
  const persegi = (pusat: Titik, kanan: Titik, lebar: number, tinggi: number): Sinar['sudut'] => {
    const t = (u: number, v: number): Titik => [pusat[0] + kanan[0] * u, pusat[1] + v, pusat[2] + kanan[2] * u];
    return [t(-lebar / 2, -tinggi / 2), t(lebar / 2, -tinggi / 2), t(lebar / 2, tinggi / 2), t(-lebar / 2, tinggi / 2)];
  };

  let sasaran: { l: Benda; tegak: number; t: number; pusat: Titik } | null = null;
  for (const l of semua) {
    if (l.jenis !== 'layar' || ruangDari(ruang, l.x) !== ri) continue;
    const rl = (l.rot * Math.PI) / 180, n = [Math.sin(rl), 0, Math.cos(rl)];
    const pusat = keDunia(l, [0, l.h / 2, l.d / 2]);
    const dx = asal[0] - pusat[0], dz = asal[2] - pusat[2];
    const tegak = dx * n[0] + dz * n[2];
    if (tegak < 0.3) continue;
    const cos = (-dx * maju[0] - dz * maju[1]) / Math.max(1e-6, Math.hypot(dx, dz));
    if (cos < Math.cos((50 * Math.PI) / 180)) continue;
    const dn = D[0] * n[0] + D[2] * n[2];
    if (dn > -0.2) continue;
    const t = -tegak / dn;
    if (!sasaran || tegak < sasaran.tegak) sasaran = { l, tegak, t, pusat };
  }
  if (sasaran) {
    const { l, t, pusat: S } = sasaran;
    const rl = (l.rot * Math.PI) / 180;
    const lebar = t / tr, tinggi = lebar * (l.h / Math.max(0.01, l.w));
    const kanan: Titik = [Math.cos(rl), 0, -Math.sin(rl)];
    //  Sedikit di depan kain layar supaya tidak berkedip (z-fighting).
    const pusat: Titik = [
      asal[0] + D[0] * t + Math.sin(rl) * 0.004 + kananP[0] * lebar * geserH,
      asal[1] + D[1] * t + naikTurun * tinggi * offV,
      asal[2] + D[2] * t + Math.cos(rl) * 0.004 + kananP[2] * lebar * geserH,
    ];
    const selisihH = (pusat[0] - S[0]) * kanan[0] + (pusat[2] - S[2]) * kanan[2];
    return {
      asal, sudut: persegi(pusat, kanan, lebar, tinggi), layar: l, jarak: t, lebar, tinggi,
      trPas: t / Math.max(0.01, l.w), selisihV: pusat[1] - S[1], selisihH,
    };
  }
  const k = daftarRuang(ruang)[ri] ?? daftarRuang(ruang)[0];
  const ke = (v: number, a: number, lo: number, hi: number) => (a > 1e-6 ? (hi - v) / a : a < -1e-6 ? (lo - v) / a : Infinity);
  const jarak = Math.min(15, Math.max(0.3, Math.min(ke(asal[0], D[0], k.x0, k.x0 + k.p), ke(asal[2], D[2], 0, k.l), ke(asal[1], D[1], 0, k.t)) - 0.005));
  const lebar = jarak / tr, tinggi = (lebar * 9) / 16;
  const pusat: Titik = [asal[0] + D[0] * jarak + kananP[0] * lebar * geserH, asal[1] + D[1] * jarak + naikTurun * tinggi * offV, asal[2] + D[2] * jarak + kananP[2] * lebar * geserH];
  return { asal, sudut: persegi(pusat, [Math.cos(r), 0, -Math.sin(r)], lebar, tinggi), layar: null, jarak, lebar, tinggi, trPas: null, selisihV: null, selisihH: null };
}

/**
 * Salin seluruh isi satu ruang ke ruang sebelah. Sama dengan salinKeRuang per
 * benda, ditambah: proyektor yang sedang menembak layar di ruang asal
 * diletakkan pada posisi & arah yang sama relatif terhadap salinan layarnya,
 * jadi jarak lempar dan ukuran gambar tidak berubah walau ruangnya beda ukuran.
 */
export function salinIsi(isi: Benda[], ruang: Ruang, asal: Kotak, tujuan: Kotak): Benda[] {
  return petakanIsi(isi, ruang, asal, tujuan).map(b => ({ ...b, id: idBaru() }));
}

/** Seperti salinIsi, tapi id tetap (dipakai saat ukuran ruang diubah). */
function petakanIsi(isi: Benda[], ruang: Ruang, asal: Kotak, tujuan: Kotak): Benda[] {
  const baru = isi.map(b => petakanKeKotak(b, asal, tujuan));
  const indeks = new Map(isi.map((b, i) => [b.id, i]));
  isi.forEach((p, i) => {
    if (p.jenis !== 'proyektor') return;
    const layar = sinarProyektor(p, isi, ruang).layar;
    const j = layar ? indeks.get(layar.id) : undefined;
    if (!layar || j === undefined) return;
    const ke = baru[j];
    //  Posisi proyektor dalam koordinat lokal layar asal (kebalikan keDunia), lalu ke layar salinan.
    const r0 = (layar.rot * Math.PI) / 180, dx = p.x - layar.x, dz = p.z - layar.z;
    const [x, , z] = keDunia(ke, [dx * Math.cos(r0) - dz * Math.sin(r0), 0, dx * Math.sin(r0) + dz * Math.cos(r0)]);
    baru[i] = {
      ...baru[i], rot: (((p.rot - layar.rot + ke.rot) % 360) + 360) % 360,
      x: bulat2(Math.min(tujuan.x0 + tujuan.p - 0.1, Math.max(tujuan.x0 + 0.1, x))),
      z: bulat2(Math.min(tujuan.l - 0.1, Math.max(0.1, z))),
    };
  });
  return baru;
}

/**
 * Ukuran ruang diubah: isi tiap ruang ikut menyesuaikan dengan aturan yang
 * sama seperti salin ke ruang sebelah - yang menempel dinding tetap menempel,
 * perangkat plafon tetap di plafon, susunan meja-kursi bergeser bersama titik
 * tengah ruang (tidak tertinggal di posisi lama), proyektor tetap pada jarak
 * lemparnya ke layar. Isi Ruang 2 ikut bergeser bila Ruang 1 memanjang/
 * memendek. Ruang yang ukurannya tidak berubah tidak disentuh.
 */
export function sesuaikanUkuranRuang(benda: Benda[], lama: Ruang, baru: Ruang): Benda[] {
  const kLama = daftarRuang(lama), kBaru = daftarRuang(baru);
  const hasil = new Map<string, Benda>();
  kLama.forEach((asal, i) => {
    const tujuan = kBaru[i];
    if (!tujuan || (asal.x0 === tujuan.x0 && asal.p === tujuan.p && asal.l === tujuan.l && asal.t === tujuan.t)) return;
    const isi = benda.filter(b => ruangDari(lama, b.x) === i);
    petakanIsi(isi, lama, asal, tujuan).forEach(b => hasil.set(b.id, b));
  });
  return hasil.size ? benda.map(b => hasil.get(b.id) ?? b) : benda;
}

export type SumbuPusat = 'x' | 'z' | 'xz';

/**
 * Pusatkan isi tiap ruang (tombol "Pusatkan isi").
 *
 * Yang digeser hanya benda yang BEBAS di sumbu itu: benda yang menempel
 * dinding kiri/kanan (celah <= 25 cm) tidak digeser kiri-kanan, yang menempel
 * dinding depan/belakang tidak digeser maju-mundur - jadi videowall tetap di
 * dindingnya tetapi ikut ke tengah sepanjang dinding itu.
 *
 * Patokan titik tengah = susunan meja & kursi (yang memang ingin di tengah);
 * bila ruang tidak punya furnitur bebas, semua benda bebas. Seluruh benda
 * bebas digeser sejauh yang sama, jadi jarak antar benda tidak berubah.
 * Proyektor yang menembak layar ikut bergeser bersama layarnya (bukan
 * sendiri), supaya jarak lempar & arah tidak rusak.
 */
export function pusatkanIsi(benda: Benda[], ruang: Ruang, sumbu: SumbuPusat = 'xz'): Benda[] {
  const TEMPEL = 0.25;
  const hasil = new Map<string, Benda>();
  daftarRuang(ruang).forEach((k, ri) => {
    const isi = benda.filter(b => ruangDari(ruang, b.x) === ri);
    if (!isi.length) return;
    const jejak = (b: Benda) => {
      const r = (b.rot * Math.PI) / 180;
      return {
        ex: (Math.abs(Math.cos(r)) * b.w + Math.abs(Math.sin(r)) * b.d) / 2,
        ez: (Math.abs(Math.sin(r)) * b.w + Math.abs(Math.cos(r)) * b.d) / 2,
      };
    };
    const bebasX = (b: Benda) => { const { ex } = jejak(b); return b.x - k.x0 - ex > TEMPEL && k.x0 + k.p - b.x - ex > TEMPEL; };
    const bebasZ = (b: Benda) => { const { ez } = jejak(b); return b.z - ez > TEMPEL && k.l - b.z - ez > TEMPEL; };
    //  Proyektor yang menembak layar mengikuti layarnya.
    const ikutLayar = new Map<string, Benda>();
    for (const p of isi) {
      if (p.jenis !== 'proyektor') continue;
      const l = sinarProyektor(p, isi, ruang).layar;
      if (l) ikutLayar.set(p.id, l);
    }
    const geser = (axis: 'x' | 'z') => {
      const bebas = axis === 'x' ? bebasX : bebasZ;
      const gerak = isi.filter(b => !ikutLayar.has(b.id) && bebas(b));
      if (!gerak.length) return 0;
      const furnitur = gerak.filter(b => b.jenis === 'meja' || b.jenis === 'kursi');
      const patokan = furnitur.length ? furnitur : gerak;
      let min = Infinity, maks = -Infinity;
      for (const b of patokan) {
        const e = axis === 'x' ? jejak(b).ex : jejak(b).ez;
        min = Math.min(min, b[axis] - e); maks = Math.max(maks, b[axis] + e);
      }
      const tengah = axis === 'x' ? k.x0 + k.p / 2 : k.l / 2;
      return bulat2(tengah - (min + maks) / 2);
    };
    const dx = sumbu.includes('x') ? geser('x') : 0;
    const dz = sumbu.includes('z') ? geser('z') : 0;
    if (!dx && !dz) return;
    const pindah = (b: Benda, gx: boolean, gz: boolean): Benda => {
      const { ex, ez } = jejak(b);
      const lx = Math.min(ex, k.p / 2 - 0.01), lz = Math.min(ez, k.l / 2 - 0.01);
      return {
        ...b,
        x: gx && dx ? bulat2(Math.min(k.x0 + k.p - lx, Math.max(k.x0 + lx, b.x + dx))) : b.x,
        z: gz && dz ? bulat2(Math.min(k.l - lz, Math.max(lz, b.z + dz))) : b.z,
      };
    };
    for (const b of isi) {
      const l = ikutLayar.get(b.id);
      const baru = l ? pindah(b, bebasX(l), bebasZ(l)) : pindah(b, bebasX(b), bebasZ(b));
      if (baru.x !== b.x || baru.z !== b.z) hasil.set(b.id, baru);
    }
  });
  return hasil.size ? benda.map(b => hasil.get(b.id) ?? b) : benda;
}

/** Layar proyektor terdekat di ruang yang sama (tanpa syarat arah). */
export function layarTerdekat(p: Benda, semua: Benda[], ruang: Ruang): Benda | null {
  const ri = ruangDari(ruang, p.x);
  return semua.filter(l => l.jenis === 'layar' && ruangDari(ruang, l.x) === ri)
    .reduce<Benda | null>((m, l) => (!m || Math.hypot(l.x - p.x, l.z - p.z) < Math.hypot(m.x - p.x, m.z - p.z) ? l : m), null);
}

/**
 * Tilt agar pusat gambar tepat setinggi pusat layar (posisi & pan tidak
 * diubah). Dicari bertahap (bisection) karena tinggi pusat gambar naik
 * monoton bersama tilt.
 */
export function tiltKeLayar(p: Benda, l: Benda, ruang: Ruang): Benda {
  let lo = -60, hi = 45;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const coba = { ...p, tilt: mid };
    const sv = sinarProyektor(coba, [l, coba], ruang).selisihV;
    if (sv === null) break;
    if (sv > 0) hi = mid; else lo = mid;
  }
  return { ...p, tilt: Math.round(((lo + hi) / 2) * 10) / 10 };
}

/**
 * Pindahkan proyektor ke jarak lempar ideal (throw ratio x lebar layar) di
 * garis tengah layar, menghadap layar (pan), lalu atur tilt supaya gambar
 * tepat di tengah layar. Ketinggian pemasangan tidak diubah.
 */
export function proyektorKeLayar(p: Benda, l: Benda, k: Kotak, ruang: Ruang): Benda {
  const rl = (l.rot * Math.PI) / 180;
  const n = [Math.sin(rl), Math.cos(rl)];
  const ideal = throwRatioDari(p) * l.w;
  const S = keDunia(l, [0, l.h / 2, l.d / 2]);
  const rot = (((l.rot + 180) % 360) + 360) % 360;
  const taruh = (q: Benda, jarak: number): Benda => {
    //  Titik benda = posisi lensa yang diinginkan - offset lensa (dengan tilt q) pada rotasi ini.
    const [ox, , oz] = keDunia({ ...q, rot, x: 0, z: 0, elev: 0 }, lensaProyektor(q));
    return { ...q, rot, x: S[0] + n[0] * jarak - ox, z: S[2] + n[1] * jarak - oz };
  };
  let q = taruh({ ...p, tilt: 0 }, ideal);
  let jarakTegak = ideal;
  for (let i = 0; i < 4; i++) {
    q = tiltKeLayar(q, l, ruang);
    const sn = sinarProyektor(q, [l, q], ruang);
    if (!sn.layar) break;
    //  Jarak sepanjang sumbu lensa sedikit lebih panjang bila menunduk - koreksi jarak tegaknya.
    jarakTegak += (ideal - sn.jarak) * Math.cos((tiltDari(q) * Math.PI) / 180);
    q = taruh(q, jarakTegak);
  }
  q = tiltKeLayar(q, l, ruang);
  return { ...q, x: bulat2(Math.min(k.x0 + k.p - 0.1, Math.max(k.x0 + 0.1, q.x))), z: bulat2(Math.min(k.l - 0.1, Math.max(0.1, q.z))) };
}

// ── Tekstur kanvas ──────────────────────────────────────────────────────────

/** Warna #rrggbb yang sah, atau undefined (nilai rusak/asing diabaikan, kembali ke warna bawaan). */
export function warnaSah(w: unknown): string | undefined {
  return typeof w === 'string' && /^#[0-9a-f]{6}$/i.test(w) ? w.toLowerCase() : undefined;
}

function kanvas(w: number, h: number, gambar: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  gambar(c.getContext('2d')!); return c;
}

export function teksturLantai(THREE: typeof T, jenis: Ruang['lantai'], p: number, l: number, warna?: string): T.Texture {
  const c = kanvas(512, 512, g => {
    if (jenis === 'polos') {
      //  Lantai polos berwarna bebas (vinyl, epoxy, karpet warna perusahaan) + bintik halus supaya tidak datar.
      g.fillStyle = warnaSah(warna) ?? '#9ca3af'; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 5000; i++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    } else if (jenis === 'kayu') {
      const warna = ['#9a6b43', '#a5754b', '#8f633d', '#ab7c52', '#956840'];
      for (let i = 0; i < 8; i++) {
        g.fillStyle = warna[i % warna.length]; g.fillRect(0, i * 64, 512, 64);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, i * 64, 512, 2);
        const putus = (i * 173) % 512; g.fillRect(putus, i * 64, 2, 64);
        for (let s = 0; s < 14; s++) { g.fillStyle = 'rgba(60,35,15,0.07)'; g.fillRect(0, i * 64 + 4 + s * 4, 512, 1); }
      }
    } else if (jenis === 'karpet') {
      g.fillStyle = '#4b5563'; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    } else {
      g.fillStyle = '#e7e5e4'; g.fillRect(0, 0, 512, 512);
      g.strokeStyle = '#a8a29e'; g.lineWidth = 3;
      for (let i = 0; i <= 512; i += 256) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  //  Satu ubin tekstur = 2 m (kayu/karpet) atau 1,2 m (keramik 60×60 cm × 2).
  const ukuran = jenis === 'keramik' ? 1.2 : 2;
  t.repeat.set(p / ukuran, l / ukuran);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Pola uji layar (color bars + label) - konten bawaan display. */
export function teksturPolaUji(THREE: typeof T, judul: string, rasio: number): T.Texture {
  const W = 1024, H = Math.max(256, Math.round(W / Math.max(0.3, rasio)));
  const c = kanvas(W, H, g => {
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0b1d51'); grad.addColorStop(1, '#1d4ed8');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    const bar = ['#ffffff', '#facc15', '#22d3ee', '#22c55e', '#d946ef', '#ef4444', '#2563eb'];
    const bw = W / bar.length;
    bar.forEach((w, i) => { g.fillStyle = w; g.fillRect(i * bw, H * 0.68, bw, H * 0.18); });
    g.fillStyle = '#ffffff'; g.font = `bold ${Math.round(H * 0.11)}px sans-serif`; g.textAlign = 'center';
    g.fillText(judul, W / 2, H * 0.4);
    g.font = `${Math.round(H * 0.06)}px sans-serif`; g.globalAlpha = 0.8;
    g.fillText('PTS IndoVisual · pratinjau', W / 2, H * 0.53);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Bilangan acak berbenih (konten contoh sama setiap kali model dibangun ulang). */
function acak(benih: number) {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const kotakBulat = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath();
  if (typeof g.roundRect === 'function') g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
};

/** Satu kamera CCTV: jalan dari sudut tinggi dengan marka & kendaraan, label kamera, REC, cap waktu. */
function gambarCCTV(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, no: number) {
  const r = acak(no * 977 + 13);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = ['#6f7a5f', '#7a7c70', '#66705c', '#7f8173'][no % 4]; g.fillRect(x, y, w, h);
  for (let i = 0; i < 22; i++) {
    g.fillStyle = `rgba(${(35 + r() * 40) | 0},${(70 + r() * 50) | 0},${(35 + r() * 30) | 0},0.6)`;
    g.beginPath(); g.ellipse(x + r() * w, y + r() * h * 0.55, w * (0.03 + r() * 0.06), h * (0.03 + r() * 0.05), 0, 0, Math.PI * 2); g.fill();
  }
  //  Jalan: trapesium perspektif menuju titik hilang.
  const hx = x + w * (0.3 + r() * 0.4), hy = y + h * (0.04 + r() * 0.16), la = w * (0.07 + r() * 0.08);
  const kiri = x - w * (0.05 + r() * 0.2), kanan = x + w * (1.05 + r() * 0.2), bawah = y + h;
  const titik = (f: number, t: number) => [(hx - la + f * 2 * la) * (1 - t) + (kiri + f * (kanan - kiri)) * t, hy * (1 - t) + bawah * t];
  g.fillStyle = '#585c63';
  g.beginPath(); g.moveTo(kiri, bawah); g.lineTo(hx - la, hy); g.lineTo(hx + la, hy); g.lineTo(kanan, bawah); g.closePath(); g.fill();
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.07})`; g.fillRect(x + r() * w, hy + r() * (bawah - hy), 2, 2); }
  g.strokeStyle = 'rgba(235,235,235,0.85)'; g.lineWidth = Math.max(1, w * 0.006);
  for (const f of [0.04, 0.25, 0.5, 0.75, 0.96]) {
    g.setLineDash(f === 0.04 || f === 0.96 ? [] : [w * 0.035, w * 0.03]);
    const [x0, y0] = titik(f, 0.02), [x1, y1] = titik(f, 1);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  g.setLineDash([]);
  //  Kendaraan: makin dekat makin besar.
  const warna = ['#f8fafc', '#cbd5e1', '#111827', '#b91c1c', '#1d4ed8', '#6b7280', '#e5e7eb', '#334155'];
  const mobil = 5 + Math.floor(r() * 7);
  for (let i = 0; i < mobil; i++) {
    const f = [0.125, 0.375, 0.625, 0.875][Math.floor(r() * 4)], t = 0.12 + r() * 0.85;
    const [px, py] = titik(f, t);
    const lw = w * (0.012 + 0.07 * t), lh = lw * (1.4 + r() * 0.5);
    const motor = r() < 0.25;
    g.fillStyle = 'rgba(0,0,0,0.25)'; kotakBulat(g, px - lw / 2 + lw * 0.08, py - lh / 2 + lh * 0.08, motor ? lw * 0.35 : lw, lh, lw * 0.2); g.fill();
    g.fillStyle = warna[Math.floor(r() * warna.length)];
    kotakBulat(g, px - lw / 2, py - lh / 2, motor ? lw * 0.35 : lw, lh, lw * 0.2); g.fill();
    if (!motor) { g.fillStyle = 'rgba(15,23,42,0.75)'; g.fillRect(px - lw * 0.38, py - lh * 0.25, lw * 0.76, lh * 0.2); }
  }
  //  Nuansa kamera: sedikit pudar + vignet.
  g.fillStyle = 'rgba(30,41,59,0.10)'; g.fillRect(x, y, w, h);
  const vg = g.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = vg; g.fillRect(x, y, w, h);
  const f = Math.max(8, h * 0.075);
  g.font = `600 ${f}px sans-serif`; g.textBaseline = 'top';
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x + f * 0.4, y + f * 0.4, g.measureText(`CAM ${String(no + 1).padStart(2, '0')}`).width + f * 0.6, f * 1.3);
  g.fillStyle = '#ffffff'; g.fillText(`CAM ${String(no + 1).padStart(2, '0')}`, x + f * 0.7, y + f * 0.55);
  g.fillStyle = '#ef4444'; g.beginPath(); g.arc(x + w - f * 2.6, y + f * 1.05, f * 0.32, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.fillText('REC', x + w - f * 2.1, y + f * 0.55);
  g.font = `${f * 0.85}px monospace`; g.textBaseline = 'bottom'; g.textAlign = 'right';
  g.fillText(`2026-10-06 10:${String(10 + (no * 7) % 49).padStart(2, '0')}:${String((no * 13) % 60).padStart(2, '0')}`, x + w - f * 0.5, y + h - f * 0.4);
  g.textAlign = 'left';
  g.restore();
  g.strokeStyle = '#0b0f14'; g.lineWidth = Math.max(1, w * 0.006); g.strokeRect(x, y, w, h);
}

/** Satu kartu grafik dashboard (donut, batang bertumpuk, batang mendatar, area, angka). */
function gambarWidget(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, jenis: number, r: () => number, gelap: boolean) {
  const kartu = gelap ? '#111827' : '#ffffff', garis = gelap ? '#1f2937' : '#e2e8f0', teks = gelap ? '#e5e7eb' : '#334155';
  const biru = ['#2563eb', '#0ea5e9', '#22c55e', '#f59e0b', '#a855f7', '#ef4444'];
  g.fillStyle = kartu; g.fillRect(x, y, w, h); g.strokeStyle = garis; g.lineWidth = Math.max(1, w * 0.004); g.strokeRect(x, y, w, h);
  const f = Math.max(7, Math.min(w, h) * 0.07);
  g.fillStyle = teks; g.font = `600 ${f}px sans-serif`; g.textBaseline = 'top';
  g.fillText(['Status perangkat', 'Kejadian per jam', 'Lalu lintas per ruas', 'Tren harian', 'Ringkasan', 'Kapasitas'][jenis % 6], x + f * 0.6, y + f * 0.5);
  const ix = x + f * 0.8, iy = y + f * 2.2, iw = w - f * 1.6, ih = h - f * 3;
  switch (jenis % 6) {
    case 0: {
      const cx = ix + iw * 0.35, cy = iy + ih / 2, rr = Math.min(iw * 0.3, ih * 0.45);
      let a0 = -Math.PI / 2;
      [0.45, 0.25, 0.18, 0.12].forEach((v, i) => {
        g.strokeStyle = biru[i]; g.lineWidth = rr * 0.35; g.beginPath(); g.arc(cx, cy, rr * 0.8, a0, a0 + v * Math.PI * 2); g.stroke(); a0 += v * Math.PI * 2;
      });
      g.fillStyle = teks; g.font = `700 ${rr * 0.45}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(20 + Math.floor(r() * 70)), cx, cy); g.textAlign = 'left';
      for (let i = 0; i < 4; i++) { g.fillStyle = biru[i]; g.fillRect(ix + iw * 0.72, iy + ih * (0.2 + i * 0.18), f * 0.8, f * 0.8); g.fillStyle = teks; g.font = `${f * 0.8}px sans-serif`; g.textBaseline = 'top'; g.fillText(['Aktif', 'Siaga', 'Rawat', 'Mati'][i], ix + iw * 0.72 + f, iy + ih * (0.2 + i * 0.18)); }
      break;
    }
    case 1: {
      const n = 6, bw = iw / (n * 1.6);
      for (let i = 0; i < n; i++) {
        let yy = iy + ih;
        for (let k = 0; k < 4; k++) { const hh = ih * (0.05 + r() * 0.2); g.fillStyle = biru[k]; g.fillRect(ix + i * bw * 1.6 + bw * 0.3, yy - hh, bw, hh); yy -= hh; }
      }
      break;
    }
    case 2: {
      const n = 8;
      for (let i = 0; i < n; i++) { const v = (1 - i / n) * (0.55 + r() * 0.45); g.fillStyle = gelap ? '#38bdf8' : '#2563eb'; g.fillRect(ix + iw * 0.25, iy + i * (ih / n) + ih / n * 0.2, iw * 0.72 * v, ih / n * 0.6); g.fillStyle = teks; g.font = `${f * 0.7}px sans-serif`; g.textBaseline = 'middle'; g.fillText(`Ruas ${i + 1}`, ix, iy + i * (ih / n) + ih / n * 0.5); }
      break;
    }
    case 3: {
      const n = 14, titik: [number, number][] = [];
      for (let i = 0; i < n; i++) titik.push([ix + (iw * i) / (n - 1), iy + ih * (0.85 - (i === 9 ? 0.75 : 0.15 + r() * 0.35))]);
      g.fillStyle = gelap ? 'rgba(56,189,248,0.25)' : 'rgba(37,99,235,0.15)';
      g.beginPath(); g.moveTo(ix, iy + ih); titik.forEach(([a, b]) => g.lineTo(a, b)); g.lineTo(ix + iw, iy + ih); g.closePath(); g.fill();
      g.strokeStyle = gelap ? '#38bdf8' : '#2563eb'; g.lineWidth = Math.max(1, f * 0.18); g.beginPath(); titik.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.stroke();
      break;
    }
    case 4: {
      const warna = ['#22c55e', '#facc15', '#38bdf8', '#22c55e'];
      for (let i = 0; i < 4; i++) {
        const kx = ix + (i % 2) * iw / 2, ky = iy + Math.floor(i / 2) * ih / 2;
        g.fillStyle = warna[i]; g.fillRect(kx + 2, ky + 2, iw / 2 - 4, ih / 2 - 4);
        g.fillStyle = '#0f172a'; g.font = `700 ${Math.min(iw, ih) * 0.14}px sans-serif`; g.textBaseline = 'middle';
        g.fillText(`${60 + Math.floor(r() * 40)}%`, kx + iw * 0.06, ky + ih / 4);
      }
      break;
    }
    default: {
      for (let i = 0; i < 5; i++) {
        const v = 0.3 + r() * 0.65;
        g.fillStyle = gelap ? '#1f2937' : '#e2e8f0'; g.fillRect(ix, iy + i * ih / 5 + ih / 20, iw, ih / 10);
        g.fillStyle = v > 0.85 ? '#ef4444' : v > 0.7 ? '#f59e0b' : '#22c55e'; g.fillRect(ix, iy + i * ih / 5 + ih / 20, iw * v, ih / 10);
      }
    }
  }
}

/** Dashboard lengkap: kepala, 3 x 2 grafik, deret indikator. */
function gambarDashboard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, benih: number, gelap = false) {
  const r = acak(benih);
  g.fillStyle = gelap ? '#0b1220' : '#eef2f7'; g.fillRect(x, y, w, h);
  const kh = h * 0.07;
  g.fillStyle = gelap ? '#111827' : '#ffffff'; g.fillRect(x, y, w, kh);
  g.fillStyle = '#dc2626'; g.fillRect(x + kh * 0.3, y + kh * 0.2, kh * 0.6, kh * 0.6);
  g.fillStyle = gelap ? '#e5e7eb' : '#1e293b'; g.font = `700 ${kh * 0.45}px sans-serif`; g.textBaseline = 'middle';
  g.fillText('Command Center · Dashboard', x + kh * 1.2, y + kh / 2);
  const pad = Math.max(2, w * 0.008), top = y + kh + pad, tinggiGrafik = (h - kh - pad * 4) * 0.82;
  const cw = (w - pad * 4) / 3, ch = (tinggiGrafik - pad) / 2;
  for (let i = 0; i < 6; i++) gambarWidget(g, x + pad + (i % 3) * (cw + pad), top + Math.floor(i / 3) * (ch + pad), cw, ch, i, r, gelap);
  const by = top + tinggiGrafik + pad, bh = y + h - by - pad, n = 6, bw = (w - pad * (n + 1)) / n;
  const warna = ['#86efac', '#fde68a', '#93c5fd', '#86efac', '#bae6fd', '#86efac'];
  for (let i = 0; i < n; i++) {
    g.fillStyle = warna[i]; g.fillRect(x + pad + i * (bw + pad), by, bw, bh);
    g.fillStyle = '#0f172a'; g.font = `700 ${Math.min(bh * 0.45, bw * 0.22)}px sans-serif`; g.textBaseline = 'middle';
    g.fillText(`${60 + Math.floor(r() * 40)}%`, x + pad + i * (bw + pad) + bw * 0.08, by + bh / 2);
  }
}

/** Home screen interactive display (jam, ikon aplikasi, dok). */
function gambarDesktop(g: CanvasRenderingContext2D, W: number, H: number) {
  const gr = g.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, '#0b1d3a'); gr.addColorStop(0.55, '#1e3a8a'); gr.addColorStop(1, '#0f172a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(W * (0.4 + i * 0.1), 0); g.lineTo(W * (0.55 + i * 0.1), 0); g.lineTo(W * (0.25 + i * 0.1), H); g.lineTo(W * (0.1 + i * 0.1), H); g.closePath(); g.fill(); }
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `300 ${H * 0.16}px sans-serif`; g.fillText('10:55', W * 0.58, H * 0.22);
  g.font = `${H * 0.035}px sans-serif`; g.fillText('Selasa, 6 Oktober 2026', W * 0.58, H * 0.33);
  const ikon = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];
  const nama = ['Whiteboard', 'Meeting', 'Browser', 'Files', 'Screen Share', 'Kamera', 'Galeri', 'Catatan', 'Setting', 'Apps'];
  const s = H * 0.1;
  ikon.forEach((c, i) => {
    const cx = W * 0.58 + (i % 5 - 2) * s * 1.9, cy = H * 0.5 + Math.floor(i / 5) * s * 1.7;
    g.fillStyle = c; kotakBulat(g, cx - s / 2, cy - s / 2, s, s, s * 0.22); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = `${s * 0.2}px sans-serif`; g.fillText(nama[i], cx, cy + s * 0.75);
  });
  g.fillStyle = 'rgba(255,255,255,0.12)'; kotakBulat(g, W * 0.03, H * 0.08, W * 0.2, H * 0.84, H * 0.02); g.fill();
  g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = `${H * 0.03}px sans-serif`;
  ['Rapat 09:00', 'Review desain', 'Presentasi', 'Video call'].forEach((t, i) => g.fillText(t, W * 0.05, H * (0.16 + i * 0.08)));
  g.fillStyle = 'rgba(255,255,255,0.15)'; kotakBulat(g, W * 0.32, H * 0.88, W * 0.52, H * 0.07, H * 0.035); g.fill();
}

/**
 * Konten layar contoh: CCTV (grid kamera), dashboard grafik, campuran (grafik + CCTV, ala
 * command center) atau home screen. Videowall: grid kamera mengikuti panel (2 x 2 per panel).
 */
export function teksturKonten(THREE: typeof T, b: Benda): T.Texture {
  const konten = b.konten ?? 'pola';
  const rasio = b.w / Math.max(0.01, b.h);
  if (konten !== 'cctv' && konten !== 'dashboard' && konten !== 'campuran' && konten !== 'desktop') return teksturPolaUji(THREE, b.nama, rasio);
  let W = 2048, H = Math.round(W / Math.max(0.3, rasio));
  if (H > 2048) { H = 2048; W = Math.round(H * rasio); }
  H = Math.max(256, H);
  const benih = [...b.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const c = kanvas(W, H, g => {
    const gridCCTV = (x: number, y: number, w: number, h: number, kol: number, bar: number, mulai: number) => {
      for (let j = 0; j < bar; j++) for (let i = 0; i < kol; i++) gambarCCTV(g, x + (i * w) / kol, y + (j * h) / bar, w / kol, h / bar, mulai + j * kol + i);
    };
    const vw = b.jenis === 'videowall' ? { kol: Math.max(1, b.kol ?? 2), bar: Math.max(1, b.bar ?? 2) } : null;
    if (konten === 'cctv') {
      const k = vw && vw.kol * vw.bar <= 6 ? 2 : 1;
      const kol = vw ? vw.kol * k : Math.max(2, Math.round(Math.sqrt(9 * rasio)));
      const bar = vw ? vw.bar * k : Math.max(1, Math.round((kol / rasio) * (16 / 9) * 0.5625 * 1.0));
      gridCCTV(0, 0, W, H, kol, bar, 0);
    } else if (konten === 'dashboard') {
      gambarDashboard(g, 0, 0, W, H, benih);
    } else if (konten === 'campuran') {
      //  Kiri: dashboard; kanan: 3 x 3 kamera di atas, peta & daftar kejadian di bawah.
      const bagi = vw && vw.kol >= 2 ? Math.round(vw.kol / 2) / vw.kol : 0.5;
      gambarDashboard(g, 0, 0, W * bagi, H, benih);
      const xk = W * bagi, wk = W - xk, hk = H * 0.74;
      gridCCTV(xk, 0, wk, hk, 3, 3, 0);
      g.fillStyle = '#0b1220'; g.fillRect(xk, hk, wk / 2, H - hk);
      const r = acak(benih + 7);
      for (let i = 0; i < 40; i++) { g.fillStyle = ['#22d3ee', '#f472b6', '#a3e635', '#fbbf24'][i % 4]; g.beginPath(); g.arc(xk + r() * wk / 2, hk + r() * (H - hk), Math.max(2, H * 0.006), 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#f8fafc'; g.fillRect(xk + wk / 2, hk, wk / 2, H - hk);
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#e2e8f0' : '#dbeafe'; g.fillRect(xk + wk / 2 + wk * 0.02, hk + (H - hk) * (0.08 + i * 0.15), wk * 0.46, (H - hk) * 0.1); }
    } else {
      gambarDesktop(g, W, H);
    }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Layar monitor meja operator: dashboard gelap atau 2 x 2 kamera. */
function teksturMonitor(THREE: typeof T, cctv: boolean, benih: number): T.Texture {
  const c = kanvas(640, 360, g => {
    if (cctv) for (let i = 0; i < 4; i++) gambarCCTV(g, (i % 2) * 320, Math.floor(i / 2) * 180, 320, 180, benih + i);
    else gambarDashboard(g, 0, 0, 640, 360, benih, true);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/**
 * Isi rack tampak depan (1 U = 48 px): patch panel, switch, server, NAS, amplifier, DSP,
 * matrix, cable manager, blank panel, dan UPS di bawah - lengkap dengan port & LED.
 */
/** Tekstur isi rack dari rack elevation (perangkat per U dari atas; sisa U = blank panel). */
function teksturIsiRak(THREE: typeof T, b: Benda): T.Texture {
  const s = susunRak(b), u = s.U;
  const pxU = 48, W = 512, H = Math.max(1, u) * pxU;
  const c = kanvas(W, H, g => {
    g.fillStyle = '#0b0d10'; g.fillRect(0, 0, W, H);
    const r = acak(u * 31 + 5);
    for (const x of s.posisi) {
      if (x.uAtas < 1) break;
      const bawah = Math.max(1, x.uBawah);
      gambarPerangkat(g, x.p.jenis, (u - x.uAtas) * pxU, (x.uAtas - bawah + 1) * pxU, r);
    }
    for (let i = 0; i < s.sisa; i++) gambarPerangkat(g, 'kosong', (u - s.sisa + i) * pxU, pxU, r);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function gambarPerangkat(g: CanvasRenderingContext2D, jenis: string, y: number, h: number, r: () => number) {
  const W = 512, telinga = 22;
  const badan = jenis === 'server' || jenis === 'nas' ? '#c9ccd1' : jenis === 'kosong' ? '#14171b' : '#23272e';
  g.fillStyle = badan; g.fillRect(2, y + 1, W - 4, h - 2);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(2, y + 1, W - 4, 2);
  //  Telinga rack + baut.
  g.fillStyle = jenis === 'server' || jenis === 'nas' ? '#9ca3af' : '#1a1d22'; g.fillRect(2, y + 1, telinga, h - 2); g.fillRect(W - 2 - telinga, y + 1, telinga, h - 2);
  g.fillStyle = '#6b7280';
  for (const by of h > 60 ? [y + 12, y + h - 12] : [y + h / 2]) { g.beginPath(); g.arc(13, by, 3.5, 0, Math.PI * 2); g.arc(W - 13, by, 3.5, 0, Math.PI * 2); g.fill(); }
  const x0 = telinga + 10, x1 = W - telinga - 10;
  const led = (x: number, yy: number, w = 4, warna = r() > 0.15 ? '#22c55e' : '#f59e0b') => { g.fillStyle = warna; g.fillRect(x, yy, w, 3); };
  switch (jenis) {
    case 'patch': case 'switch': {
      const n = 24, lebar = (x1 - x0 - 60) / n;
      for (let i = 0; i < n; i++) {
        const px = x0 + i * lebar + (i >= 12 ? 8 : 0);
        g.fillStyle = '#0a0a0a'; g.fillRect(px + 1, y + h * 0.42, lebar - 3, h * 0.38);
        if (jenis === 'switch') led(px + 2, y + h * 0.22, lebar - 5);
        else { g.fillStyle = '#e5e7eb'; g.fillRect(px + 1, y + h * 0.18, lebar - 3, 4); }
      }
      if (jenis === 'switch') for (let i = 0; i < 4; i++) { g.fillStyle = '#111827'; g.fillRect(x1 - 52 + i * 13, y + h * 0.35, 10, h * 0.45); }
      break;
    }
    case 'kabel': {
      g.fillStyle = '#0f1115'; g.fillRect(x0, y + h * 0.3, x1 - x0, h * 0.4);
      g.strokeStyle = '#2b2f36'; g.lineWidth = 1; for (let x = x0; x < x1; x += 4) { g.beginPath(); g.moveTo(x, y + h * 0.3); g.lineTo(x + 2, y + h * 0.7); g.stroke(); }
      break;
    }
    case 'server': case 'nas': {
      const n = jenis === 'nas' ? 8 : 12, bw = (x1 - x0 - 70) / n;
      for (let i = 0; i < n; i++) {
        g.fillStyle = '#2f3540'; g.fillRect(x0 + i * bw + 1, y + 8, bw - 3, h - 16);
        g.fillStyle = '#4b5563'; g.fillRect(x0 + i * bw + 3, y + 12, bw - 7, h - 24);
        led(x0 + i * bw + 4, y + h - 14, 5, r() > 0.1 ? '#22c55e' : '#3b82f6');
      }
      g.fillStyle = '#1f2937'; g.fillRect(x1 - 60, y + 10, 50, h - 20);
      led(x1 - 50, y + 18, 6, '#3b82f6'); led(x1 - 40, y + 18, 6);
      g.fillStyle = '#e5e7eb'; g.beginPath(); g.arc(x1 - 28, y + h - 22, 6, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'amp': {
      g.fillStyle = '#16191e';
      for (let x = x0; x < x0 + (x1 - x0) * 0.55; x += 6) g.fillRect(x, y + 10, 3, h - 20);
      g.fillStyle = '#0ea5e9'; g.fillRect(x0 + (x1 - x0) * 0.6, y + h * 0.3, 70, h * 0.3);
      for (let i = 0; i < 4; i++) { g.fillStyle = '#9ca3af'; g.beginPath(); g.arc(x0 + (x1 - x0) * 0.6 + 100 + i * 26, y + h / 2, 9, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'dsp': case 'matrix': {
      g.fillStyle = '#0b1220'; g.fillRect(x0, y + h * 0.2, 90, h * 0.6);
      g.fillStyle = '#38bdf8'; g.font = `${Math.max(9, h * 0.22)}px monospace`; g.textBaseline = 'middle'; g.fillText(jenis === 'dsp' ? 'DSP 12x8' : 'MATRIX', x0 + 6, y + h / 2);
      const n = jenis === 'matrix' ? 16 : 12;
      for (let i = 0; i < n; i++) {
        const tinggi = (h * 0.6) * (0.2 + r() * 0.8);
        g.fillStyle = tinggi > h * 0.45 ? '#f59e0b' : '#22c55e'; g.fillRect(x0 + 110 + i * 14, y + h * 0.8 - tinggi, 8, tinggi);
      }
      break;
    }
    case 'codec': {
      g.fillStyle = '#0b1220'; g.fillRect(x0, y + h * 0.2, 110, h * 0.6);
      g.fillStyle = '#5eead4'; g.font = `${Math.max(9, h * 0.22)}px monospace`; g.textBaseline = 'middle'; g.fillText('CODEC VC', x0 + 6, y + h / 2);
      for (let i = 0; i < 6; i++) { g.fillStyle = '#111827'; g.fillRect(x1 - 120 + i * 18, y + h * 0.3, 12, h * 0.4); }
      led(x0 + 130, y + h / 2 - 2, 6, '#3b82f6');
      break;
    }
    case 'pdu': {
      for (let i = 0; i < 8; i++) {
        const px = x0 + 20 + i * ((x1 - x0 - 40) / 8);
        g.fillStyle = '#0a0a0a'; g.fillRect(px, y + h * 0.22, 26, h * 0.56);
        g.fillStyle = '#374151'; g.fillRect(px + 8, y + h * 0.4, 3, h * 0.2); g.fillRect(px + 15, y + h * 0.4, 3, h * 0.2);
      }
      led(x0 + 4, y + h / 2 - 2, 6, '#ef4444');
      break;
    }
    case 'shelf': {
      g.fillStyle = '#0f1115'; g.fillRect(x0, y + h * 0.6, x1 - x0, h * 0.3);
      g.fillStyle = '#2b2f36'; g.fillRect(x0 + 30, y + h * 0.15, 150, h * 0.45);
      break;
    }
    case 'ups': {
      g.fillStyle = '#1a1d22'; g.fillRect(x0, y + 6, x1 - x0, h - 12);
      g.fillStyle = '#0b1220'; g.fillRect(x0 + 20, y + h * 0.25, 120, h * 0.35);
      g.fillStyle = '#4ade80'; g.font = `${Math.max(10, h * 0.12)}px monospace`; g.textBaseline = 'middle'; g.fillText('UPS 100%', x0 + 28, y + h * 0.42);
      g.fillStyle = '#2b3038'; for (let x = x0 + 170; x < x1 - 20; x += 8) g.fillRect(x, y + 14, 4, h - 28);
      led(x0 + 20, y + h * 0.75, 10);
      break;
    }
    default: {
      g.fillStyle = '#1b1e23'; for (let x = x0; x < x1; x += 10) g.fillRect(x, y + h * 0.35, 5, h * 0.3);
    }
  }
}

/** Gradasi bundar untuk kolam cahaya lampu di lantai. */
let kolamCache: T.Texture | null = null;
function teksturKolamCahaya(THREE: typeof T): T.Texture {
  if (kolamCache) return kolamCache.clone();
  const c = kanvas(128, 128, g => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  kolamCache = new THREE.CanvasTexture(c);
  return kolamCache.clone();
}

/** Terang lampu mengikuti dimmer: emisif muka lampu & kolam cahaya di lantai. */
export function aturNyalaLampu(g: T.Object3D, faktor: number) {
  g.traverse(o => {
    if (!o.userData.cahaya) return;
    const m = (o as T.Mesh).material as T.MeshStandardMaterial & T.MeshBasicMaterial;
    const dasar = (m.userData.dasar as number | undefined) ?? 1;
    if ('emissiveIntensity' in m && m.emissive) m.emissiveIntensity = dasar * faktor;
    else m.opacity = dasar * faktor;
    o.visible = faktor > 0.001 || !!m.emissive;
  });
}

/** Garis sambungan (cabinet LED / bezel videowall) di atas konten. */
function teksturGrid(THREE: typeof T, kolom: number, baris: number, tebal = 2, warna = 'rgba(0,0,0,0.55)'): T.Texture {
  const W = 1024, H = Math.min(2048, Math.max(64, Math.round((1024 * baris) / Math.max(1, kolom))));
  const c = kanvas(W, H, g => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = warna;
    for (let i = 1; i < kolom; i++) g.fillRect((i * W) / kolom - tebal / 2, 0, tebal, H);
    for (let i = 1; i < baris; i++) g.fillRect(0, (i * H) / baris - tebal / 2, W, tebal);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Tampilan antarmuka touch panel. */
function teksturPanel(THREE: typeof T): T.Texture {
  const c = kanvas(512, 320, g => {
    g.fillStyle = '#0f172a'; g.fillRect(0, 0, 512, 320);
    g.fillStyle = '#1d4ed8'; g.fillRect(0, 0, 512, 44);
    g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.fillText('Ruang Meeting', 16, 30);
    const tombol = ['Presentasi', 'Video Call', 'Kamera', 'Audio', 'Layar', 'Mati'];
    tombol.forEach((t, i) => {
      const x = 16 + (i % 3) * 164, y = 64 + Math.floor(i / 3) * 124;
      g.fillStyle = i === 0 ? '#2563eb' : '#1e293b'; g.fillRect(x, y, 148, 108);
      g.fillStyle = '#e2e8f0'; g.font = '18px sans-serif'; g.fillText(t, x + 12, y + 96);
    });
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ── Pembuat model ──────────────────────────────────────────────────────────

interface Bahan { THREE: typeof T; layar: (b: Benda) => T.Texture | null; model: (kunci: string) => T.Object3D | null }

function mat(THREE: typeof T, warna: number, opsi: Partial<T.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color: warna, roughness: 0.6, metalness: 0.1, ...opsi });
}

function kotak(THREE: typeof T, w: number, h: number, d: number, m: T.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o;
}

// ── Bentuk halus: sudut membulat & tepi bevel (bukan kotak tajam) ──────────

/** Persegi panjang bersudut membulat di bidang XY, berpusat di (0, 0). */
function persegiBulat(THREE: typeof T, w: number, h: number, r: number): T.Shape {
  const a = Math.max(0.001, w / 2), b = Math.max(0.001, h / 2);
  const R = Math.max(0.0005, Math.min(r, a - 0.0002, b - 0.0002));
  const s = new THREE.Shape();
  s.moveTo(-a + R, -b);
  s.lineTo(a - R, -b); s.absarc(a - R, -b + R, R, -Math.PI / 2, 0, false);
  s.lineTo(a, b - R); s.absarc(a - R, b - R, R, 0, Math.PI / 2, false);
  s.lineTo(-a + R, b); s.absarc(-a + R, b - R, R, Math.PI / 2, Math.PI, false);
  s.lineTo(-a, -b + R); s.absarc(-a + R, -b + R, R, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Bevel yang muat: tidak lebih dari separuh ukuran terkecil. */
const bevelAman = (bevel: number, ...ukuran: number[]) => Math.max(0, Math.min(bevel, ...ukuran.map(u => u / 2 - 0.0006)));

function ekstrusi(THREE: typeof T, bentuk: T.Shape, tebal: number, bv: number, lengkung = 14) {
  return new THREE.ExtrudeGeometry(bentuk, {
    depth: Math.max(0.0005, tebal - 2 * bv), bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv,
    bevelSegments: bv > 0 ? 3 : 1, curveSegments: lengkung,
  });
}

/** Lempeng mendatar dari bentuk tampak atas (bentuk x -> x, bentuk y -> z); y = 0 .. tebal. */
function lempeng(THREE: typeof T, bentuk: T.Shape, tebal: number, bv: number, m: T.Material, lengkung = 14) {
  const geo = ekstrusi(THREE, bentuk, tebal, bv, lengkung);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, tebal - bv, 0);
  return new THREE.Mesh(geo, m);
}

/** Papan tampak atas bersudut membulat: w (x) x d (z), tebal ke atas dari y = 0. */
function papan(THREE: typeof T, w: number, d: number, tebal: number, r: number, m: T.Material, bevel = 0.006) {
  const bv = bevelAman(bevel, tebal, w, d);
  return lempeng(THREE, persegiBulat(THREE, w - 2 * bv, d - 2 * bv, r - bv), tebal, bv, m);
}

/** Blok tampak depan bersudut membulat: w (x) x h (y), tebal d berpusat di z = 0, alas y = 0. */
function blok(THREE: typeof T, w: number, h: number, d: number, r: number, m: T.Material, bevel = 0.004) {
  const bv = bevelAman(bevel, d, w, h);
  const geo = ekstrusi(THREE, persegiBulat(THREE, w - 2 * bv, h - 2 * bv, r - bv), d, bv, 12);
  geo.translate(0, h / 2, -(d - 2 * bv) / 2);
  return new THREE.Mesh(geo, m);
}

/** Pipa melalui titik-titik dengan sudut tertekuk membulat (rangka meja, sandaran tangan). */
function pipa(THREE: typeof T, titik: [number, number, number][], jari: number, tekuk: number, m: T.Material, tutup = false) {
  const p = titik.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const n = p.length;
  const sudut = (i: number) => {
    const sblm = p[(i - 1 + n) % n], ini = p[i], ssdh = p[(i + 1) % n];
    return [
      ini.clone().add(sblm.clone().sub(ini).setLength(Math.min(tekuk, sblm.distanceTo(ini) / 2))),
      ini.clone().add(ssdh.clone().sub(ini).setLength(Math.min(tekuk, ssdh.distanceTo(ini) / 2))),
    ] as const;
  };
  const jalur = new THREE.CurvePath<T.Vector3>();
  if (tutup) {
    let mulai = sudut(0)[1];
    for (let i = 1; i <= n; i++) {
      const [a, b] = sudut(i % n);
      jalur.add(new THREE.LineCurve3(mulai, a));
      jalur.add(new THREE.QuadraticBezierCurve3(a, p[i % n], b));
      mulai = b;
    }
  } else {
    let mulai = p[0];
    for (let i = 1; i < n - 1; i++) {
      const [a, b] = sudut(i);
      jalur.add(new THREE.LineCurve3(mulai, a));
      jalur.add(new THREE.QuadraticBezierCurve3(a, p[i], b));
      mulai = b;
    }
    jalur.add(new THREE.LineCurve3(mulai, p[n - 1]));
  }
  return new THREE.Mesh(new THREE.TubeGeometry(jalur, Math.max(24, n * 14), jari, 10, tutup), m);
}

/**
 * Lengkungkan geometri menjadi cekung ke +z: tiap verteks maju sebanding x^2
 * (busur berjari R). Dipakai sandaran kursi supaya memeluk punggung, bukan
 * papan datar.
 */
function lengkungkan(geo: T.BufferGeometry, R: number) {
  const pos = geo.attributes.position as T.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + (pos.getX(i) ** 2) / (2 * R));
  pos.needsUpdate = true; geo.computeVertexNormals();
  return geo;
}

/** Silinder dari titik a ke b (kaki miring, lengan kaki bintang). */
function tiangAntara(THREE: typeof T, a: T.Vector3, b: T.Vector3, jari: number, m: T.Material, jariUjung = jari) {
  const arah = b.clone().sub(a);
  const o = new THREE.Mesh(new THREE.CylinderGeometry(jariUjung, jari, arah.length(), 12), m);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arah.normalize());
  return o;
}

/**
 * Sandaran melengkung: pita busur selebar `lebar`, cekung ke +z (ke arah
 * yang duduk), tinggi ke atas dari y = 0, bagian tengah pita di z = 0.
 */
function sandaran(THREE: typeof T, lebar: number, tinggi: number, tebal: number, R: number, m: T.Material) {
  const sud = Math.asin(Math.min(0.95, lebar / (2 * R)));
  const s = new THREE.Shape();
  s.absarc(0, 0, R, Math.PI / 2 + sud, Math.PI / 2 - sud, true);
  s.absarc(0, 0, R - tebal, Math.PI / 2 - sud, Math.PI / 2 + sud, false);
  const bv = bevelAman(0.012, tebal, tinggi);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.001, tinggi - 2 * bv), bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv * 0.6,
    bevelSegments: 3, curveSegments: 24,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bv, R - tebal / 2);
  return new THREE.Mesh(geo, m);
}

// ── Tekstur material: kayu, kain, gril, layar lift ─────────────────────────

const WARNA_KAYU: Record<Finish, [string, string, string]> = {
  walnut: ['#583824', '#6c452b', '#2a170b'],
  oak: ['#c49a65', '#d5ad79', '#6e4b28'],
  putih: ['#f3f4f6', '#e9ebef', '#ffffff'],
};

/**
 * Serat kayu prosedural yang menyambung mulus (frekuensi gelombang = jumlah
 * siklus bulat sepanjang ubin), searah sisi panjang meja. Satu ubin = 1,6 m
 * searah serat x 0,4 m melintang; UV ekstrusi dalam meter.
 */
function teksturKayu(THREE: typeof T, fin: Finish, sepanjangZ: boolean): T.Texture {
  const P = 1024, L = 256;
  const c = kanvas(sepanjangZ ? L : P, sepanjangZ ? P : L, g => {
    const [a, b, serat] = WARNA_KAYU[fin];
    if (sepanjangZ) { g.translate(L, 0); g.rotate(Math.PI / 2); }
    const gr = g.createLinearGradient(0, 0, 0, L);
    gr.addColorStop(0, a); gr.addColorStop(0.5, b); gr.addColorStop(1, a);
    g.fillStyle = gr; g.fillRect(0, 0, P, L);
    if (fin === 'putih') return;
    g.strokeStyle = serat;
    for (let i = 0; i < 90; i++) {
      const y0 = Math.random() * L, amp = 1.5 + Math.random() * 5, fase = Math.random() * 6.3;
      const fr = (2 * Math.PI * (1 + Math.floor(Math.random() * 4))) / P;
      g.globalAlpha = 0.05 + Math.random() * 0.16; g.lineWidth = 0.5 + Math.random() * 1.8;
      g.beginPath();
      for (let x = 0; x <= P; x += 8) {
        const y = y0 + Math.sin(x * fr + fase) * amp + Math.sin(x * fr * 3 + fase) * amp * 0.25;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(sepanjangZ ? 1 / 0.4 : 1 / 1.6, sepanjangZ ? 1 / 1.6 : 1 / 0.4);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/**
 * Tekstur feature wall: marmer putih berurat abu (slab 1,2 × 2,4 m dengan nat tipis) atau panel
 * kayu walnut. Satu ubin tekstur = satu slab; UV bidang dinding dihitung dalam meter (repeat).
 */
export function teksturDindingAksen(THREE: typeof T, jenis: 'marmer' | 'kayu'): { tex: T.Texture; ubinW: number; ubinH: number } {
  if (jenis === 'kayu') {
    const tex = teksturKayu(THREE, 'walnut', true);
    tex.repeat.set(1, 1);
    return { tex, ubinW: 0.4, ubinH: 1.6 };
  }
  const W = 512, H = 1024;
  const c = kanvas(W, H, g => {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#f4f2ee'); gr.addColorStop(0.5, '#ebe8e2'); gr.addColorStop(1, '#f6f4f0');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const r = acak(77);
    for (let i = 0; i < 14; i++) {
      let x = r() * W, y = 0;
      g.strokeStyle = r() > 0.6 ? 'rgba(120,120,125,0.55)' : 'rgba(160,158,155,0.4)';
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath(); g.moveTo(x, y);
      while (y < H) { x += (r() - 0.5) * 60; y += 20 + r() * 50; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(90,90,90,0.35)'; g.fillRect(0, 0, W, 2); g.fillRect(0, 0, 2, H);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, ubinW: 1.2, ubinH: 2.4 };
}

/** Anyaman kain (jok kursi, soundbar). `ubin` = ukuran satu ubin dalam meter. */
function teksturKain(THREE: typeof T, dasar: string, ubin: number): T.Texture {
  const c = kanvas(128, 128, g => {
    g.fillStyle = dasar; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 2) { g.fillStyle = (y / 2) % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.07)'; g.fillRect(0, y, 128, 1); }
    for (let x = 1; x < 128; x += 2) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(x, 0, 1, 128); }
    for (let i = 0; i < 700; i++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1); }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / ubin, 1 / ubin); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Gril logam berlubang (speaker). `ulang` = jumlah ubin pada UV 0..1. */
function teksturGril(THREE: typeof T, dasar: string, lubang: string, ulang: number): T.Texture {
  const c = kanvas(128, 128, g => {
    g.fillStyle = dasar; g.fillRect(0, 0, 128, 128); g.fillStyle = lubang;
    for (let r = 0; r < 16; r++) {
      for (let q = 0; q < 16; q++) {
        const x = q * 8 + (r % 2 ? 4 : 0), y = r * 8 + 4;
        for (const dx of [-128, 0, 128]) { g.beginPath(); g.arc(x + dx, y, 2.3, 0, Math.PI * 2); g.fill(); }
      }
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(ulang, ulang); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/**
 * Mic boundary cakram bundar (kain abu-abu berpola konsentris + cincin LED hijau + ikon mic).
 * 'kain' = tutup atas yang berkain; 'ikon' = lapisan transparan cincin & ikon yang menyala.
 * Keduanya dipetakan ke lingkaran: pusat tekstur = pusat cakram, sisi kanvas = tepi cakram.
 */
function teksturMicBoundary(THREE: typeof T, bagian: 'kain' | 'ikon', dasar = '#6d6e72'): T.Texture {
  const U = 512, C = U / 2;
  const c = kanvas(U, U, g => {
    if (bagian === 'kain') {
      g.fillStyle = dasar; g.fillRect(0, 0, U, U);   // gelap sedikit: pencahayaan adegan menerangkan ~1,4x
      //  Anyaman melingkar: ratusan lingkaran tipis berselang-seling terang/gelap -> pola moire seperti kain asli.
      for (let r = 3; r < C * 1.45; r += 2.1) {
        g.strokeStyle = Math.round(r / 2.1) % 2 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)';
        g.lineWidth = 1; g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke();
      }
      for (let i = 0; i < 1800; i++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'; g.fillRect(Math.random() * U, Math.random() * U, 1.4, 1.4); }
      return;
    }
    const hijau = '#6bf2b0';
    g.shadowColor = '#2dff9a'; g.shadowBlur = 16; g.strokeStyle = hijau; g.fillStyle = hijau;
    g.lineWidth = 13; g.beginPath(); g.arc(C, C, 88, 0, Math.PI * 2); g.stroke();   // cincin LED
    g.shadowBlur = 8; g.lineWidth = 7; g.lineCap = 'round';
    const w = 17;                                                       // ikon mic: kapsul + busur + tiang + dasar
    g.beginPath(); g.moveTo(C - w, C - 22); g.arc(C, C - 22, w, Math.PI, 0); g.lineTo(C + w, C + 4); g.arc(C, C + 4, w, 0, Math.PI); g.closePath(); g.fill();
    g.beginPath(); g.arc(C, C + 4, w + 13, 0.12 * Math.PI, 0.88 * Math.PI); g.stroke();
    g.beginPath(); g.moveTo(C, C + 4 + w + 13); g.lineTo(C, C + 52); g.moveTo(C - 17, C + 52); g.lineTo(C + 17, C + 52); g.stroke();
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/** Layar paperless display lift: halaman masuk sistem rapat. */
function teksturLift(THREE: typeof T): T.Texture {
  const c = kanvas(512, 300, g => {
    const gr = g.createLinearGradient(0, 0, 512, 300);
    gr.addColorStop(0, '#0b2a5b'); gr.addColorStop(1, '#0e6f8f');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 300);
    g.fillStyle = '#ffffff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center';
    g.fillText('PAPERLESS', 256, 74);
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillRect(166, 108, 180, 26); g.fillRect(166, 146, 180, 26);
    g.fillStyle = '#38bdf8'; g.fillRect(166, 190, 180, 30);
    g.fillStyle = '#ffffff'; g.font = '17px sans-serif'; g.fillText('Masuk', 256, 211);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/**
 * Batang setinggi 1 m yang alasnya di y = 0; skala-y diatur sesuaikanTinggi().
 * peran 'kaki' = dari lantai sampai `atas` (lokal); 'tiang' = dari puncak benda ke plafon.
 */
function batang(THREE: typeof T, w: number, d: number, m: T.Material, x: number, z: number, peran: 'kaki' | 'tiang', atas = 0, bulat = false) {
  const geo = bulat ? new THREE.CylinderGeometry(w / 2, w / 2, 1, 12) : new THREE.BoxGeometry(w, 1, d);
  geo.translate(0, 0.5, 0);
  const o = new THREE.Mesh(geo, m); o.position.set(x, 0, z);
  o.userData.peran = peran; o.userData.atas = atas;
  return o;
}

/** Bagian yang selalu di lantai (alas troli, roda). */
function diLantai(o: T.Object3D) { o.userData.peran = 'lantai'; return o; }

/**
 * Tribun: baris bertingkat (baris 0 di lantai, depan = +z), kursi teater per baris digambar
 * dengan InstancedMesh (ratusan kursi tetap ringan), lis tangga terang di tiap tepi anak tangga.
 */
function tribunModel(THREE: typeof T, g: T.Group, b: Benda, warnaKain: string) {
  const n = barisTribun(b), m = kursiTribunPerBaris(b);
  const tD = b.d / n, riser = n > 1 ? Math.max(0, (b.h - 0.95) / (n - 1)) : 0, pitch = (b.w - 0.6) / m;
  const beton = mat(THREE, 0x4b5058, { roughness: 0.9 });
  const lis = mat(THREE, 0xfef3c7, { emissive: 0xfde68a, emissiveIntensity: 0.5 });
  for (let i = 1; i < n; i++) {
    const z = b.d / 2 - tD * (i + 0.5), tinggi = i * riser;
    g.add(kotak(THREE, b.w, tinggi, tD, beton, 0, tinggi / 2, z));
    g.add(kotak(THREE, b.w, 0.012, 0.02, lis, 0, tinggi + 0.006, z + tD / 2 - 0.012));
  }
  const kain = new THREE.MeshStandardMaterial({ map: teksturKain(THREE, warnaKain, 0.08), roughness: 0.95 });
  const rangka = mat(THREE, 0x1f2227, { roughness: 0.5, metalness: 0.3 });
  const geoDuduk = new THREE.BoxGeometry(pitch * 0.82, 0.08, 0.44), geoSandar = new THREE.BoxGeometry(pitch * 0.86, 0.56, 0.07);
  const geoLengan = new THREE.BoxGeometry(0.05, 0.62, 0.5);
  const duduk = new THREE.InstancedMesh(geoDuduk, kain, n * m), sandar = new THREE.InstancedMesh(geoSandar, kain, n * m);
  const lengan = new THREE.InstancedMesh(geoLengan, rangka, n * (m + 1));
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3();
  const miring = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.18), lurus = new THREE.Quaternion();
  let k = 0;
  for (let i = 0; i < n; i++) {
    const y0 = i * riser, z0 = b.d / 2 - tD * (i + 0.5) + tD * 0.12;
    for (let j = 0; j < m; j++, k++) {
      const x = -b.w / 2 + 0.3 + (j + 0.5) * pitch;
      duduk.setMatrixAt(k, M.compose(P.set(x, y0 + 0.42, z0 + 0.02), lurus, S));
      sandar.setMatrixAt(k, M.compose(P.set(x, y0 + 0.72, z0 - 0.22), miring, S));
    }
    for (let j = 0; j <= m; j++) lengan.setMatrixAt(i * (m + 1) + j, M.compose(P.set(-b.w / 2 + 0.3 + j * pitch, y0 + 0.31, z0 - 0.02), Q.identity(), S));
  }
  for (const im of [duduk, sandar, lengan]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); g.add(im); }
}

/**
 * Bidang mapping: potongan silinder tegak (jari-jari R, busur). Lengkung = cekung, pusat
 * kelengkungan di depan (sisi penonton, +z); cembung = pusat di belakang; busur 360 = pilar.
 * Permukaan putih doff dua sisi, lis atas-bawah, tiang penyangga dari lantai bila melayang.
 */
function bidangMapping(THREE: typeof T, g: T.Group, b: Benda, warna: number) {
  const lis = mat(THREE, 0x1f2227, { metalness: 0.4, roughness: 0.5 });
  if (b.bentukBidang === 'datar') {
    //  Screen datar: permukaan doff + bingkai tipis + dua kaki penyangga di belakang.
    const { w } = ukuranBidang(b), muka = new THREE.Mesh(new THREE.PlaneGeometry(w, b.h), new THREE.MeshStandardMaterial({ color: warna, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }));
    muka.position.set(0, b.h / 2, 0.02); g.add(muka);
    const r = 0.02;
    for (const [x, y, lw, lh] of [[0, 0, w, r], [0, b.h, w, r], [-w / 2, b.h / 2, r, b.h], [w / 2, b.h / 2, r, b.h]] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(lw + r, lh + r, 0.04), lis); m.position.set(x, y, 0); g.add(m);
    }
    for (const x of [-w * 0.35, w * 0.35]) g.add(batang(THREE, 0.05, 0.05, lis, x, -0.05, 'kaki', b.h * 0.5));
    return;
  }
  const { R, busur, d } = ukuranBidang(b);
  const t = (busur * Math.PI) / 180, cembung = b.bentukBidang === 'cembung';
  const mulai = cembung ? -t / 2 : Math.PI - t / 2, zPusat = cembung ? d / 2 - R : R - d / 2;
  const seg = Math.max(24, Math.round(busur / 2.5));
  const geo = new THREE.CylinderGeometry(R, R, b.h, seg, 1, true, mulai, t);
  geo.translate(0, b.h / 2, zPusat);
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: warna, roughness: 0.92, metalness: 0, side: THREE.DoubleSide })));
  const busurTitik = (y: number) => {
    const n = Math.max(8, Math.round(busur / 4)), p: T.Vector3[] = [];
    for (let i = 0; i <= n; i++) { const a = mulai + (t * i) / n; p.push(new THREE.Vector3(R * Math.sin(a), y, zPusat + R * Math.cos(a))); }
    return p;
  };
  for (const y of [0, b.h]) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(busurTitik(y), busur >= 360), Math.max(16, Math.round(busur / 3)), 0.02, 6, busur >= 360), lis));
  if (busur >= 360) {
    const tutup = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshStandardMaterial({ color: warna, roughness: 0.9 }));
    tutup.rotation.x = -Math.PI / 2; tutup.position.set(0, b.h, zPusat); g.add(tutup);
  }
  //  Tiang penyangga di belakang permukaan (sisi luar lengkung) bila tidak berdiri di lantai.
  if (busur < 360) {
    for (const f of [0.08, 0.5, 0.92]) {
      const a = mulai + t * f, luar = cembung ? -0.06 : 0.06;
      const x = (R + luar) * Math.sin(a), z = zPusat + (R + luar) * Math.cos(a);
      g.add(batang(THREE, 0.05, 0.05, lis, x, z, 'kaki', b.h * 0.5));
    }
  }
}

/**
 * Badan meruncing ke belakang: penampang persegi membulat di muka (w x h, z = 0) mengecil
 * ke belakang (skala, z = -panjang). Tutup belakang ikut; muka dibiarkan terbuka untuk gril.
 */
function badanRuncing(THREE: typeof T, w: number, h: number, r: number, panjang: number, skala: number, m: T.Material, yBelakang = 0): T.Mesh {
  const titik = persegiBulat(THREE, w, h, r).getPoints(8);
  if (titik.length > 1 && titik[0].distanceTo(titik[titik.length - 1]) < 1e-6) titik.pop();
  const n = titik.length, pos: number[] = [], idx: number[] = [];
  for (const t of titik) pos.push(t.x, t.y, 0);
  for (const t of titik) pos.push(t.x * skala, t.y * skala + yBelakang, -panjang);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, n + i, j, j, n + i, n + j); }
  const pusat = pos.length / 3; pos.push(0, yBelakang, -panjang);
  for (let i = 0; i < n; i++) idx.push(pusat, n + (i + 1) % n, n + i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo, m);
}

/** Muka gril bersudut membulat (ShapeGeometry, UV = meter) menghadap +z. */
function mukaGril(THREE: typeof T, w: number, h: number, r: number, dasar: string, lubang: string, ulang: number) {
  const geo = new THREE.ShapeGeometry(persegiBulat(THREE, w, h, r), 10);
  const t = teksturGril(THREE, dasar, lubang, ulang);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.3 }));
}

/**
 * Speaker dinding 6": kabinet membulat yang meruncing ke belakang, gril logam penuh di muka
 * (bayangan woofer & tweeter di baliknya), bracket putar: pelat dinding + lengan + kenop + tali pengaman.
 */
function speakerDinding6(THREE: typeof T, g: T.Group, b: Benda, warna: number, warnaGril: string) {
  const badan = mat(THREE, warna, { roughness: 0.62, metalness: 0.12 });
  const besi = mat(THREE, 0x1d2025, { metalness: 0.55, roughness: 0.4 });
  const dBadan = Math.max(0.06, b.d - 0.06), zMuka = b.d / 2, r = Math.min(b.w, b.h) * 0.2;
  const yT = b.h / 2;
  const kab = badanRuncing(THREE, b.w, b.h, r, dBadan, 0.72, badan, b.h * 0.04);
  kab.position.set(0, yT, zMuka - 0.006); g.add(kab);
  //  Bibir muka sedikit menonjol + gril.
  const bibir = new THREE.Mesh(new THREE.ShapeGeometry(persegiBulat(THREE, b.w, b.h, r), 10), badan);
  bibir.position.set(0, yT, zMuka - 0.006); g.add(bibir);
  const gril = mukaGril(THREE, b.w - 0.012, b.h - 0.012, r * 0.9, warnaGril, 'rgba(4,4,6,0.9)', 1 / 0.045);
  gril.position.set(0, yT, zMuka); g.add(gril);
  const bayang = mat(THREE, 0x0f1012, { roughness: 0.6, metalness: 0.3 });
  for (const [fy, fr] of [[0.36, 0.36], [0.78, 0.1]] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(b.w * fr, 0.0035, 8, 40), bayang);
    ring.position.set(0, b.h * fy, zMuka + 0.003); g.add(ring);
  }
  //  Bracket putar di punggung: pelat dinding tegak, lengan ke kabinet, kenop engsel, tali pengaman.
  const zDinding = -b.d / 2, zPunggung = zMuka - 0.006 - dBadan, yB = b.h * 0.55;
  g.add(blok(THREE, 0.075, 0.17, 0.014, 0.012, besi, 0.003).translateY(yB - 0.085).translateZ(zDinding + 0.007));
  const panjangLengan = Math.max(0.01, zPunggung - (zDinding + 0.014) + 0.01);
  g.add(kotak(THREE, 0.034, 0.05, panjangLengan, besi, 0, yB, zDinding + 0.014 + panjangLengan / 2));
  for (const sx of [-1, 1]) {
    const kenop = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 14), besi);
    kenop.rotation.z = Math.PI / 2; kenop.position.set(sx * 0.024, yB, zDinding + 0.04); g.add(kenop);
  }
  const tali = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, yB - 0.07, zDinding + 0.016), new THREE.Vector3(0.05, yB - 0.13, zDinding + 0.05),
    new THREE.Vector3(0.03, yB - 0.06, zPunggung + 0.004),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(tali, 20, 0.0016, 6, false), mat(THREE, 0xd1d5db, { metalness: 0.8, roughness: 0.3 })));
}

/**
 * Speaker portable aktif: subwoofer di lantai, tiang, dan kolom ramping di atasnya
 * (tinggi total = b.h, lebar/kedalaman subwoofer = b.w x b.d).
 */
function speakerKolom(THREE: typeof T, g: T.Group, b: Benda, warna: number, warnaGril: string) {
  const badan = mat(THREE, warna, { roughness: 0.6, metalness: 0.12 });
  const besi = mat(THREE, 0x1b1d21, { metalness: 0.65, roughness: 0.35 });
  const hSub = Math.min(0.6, Math.max(0.25, b.h * 0.27));
  const hKol = Math.min(0.85, Math.max(0.3, b.h * 0.36));
  const wKol = Math.min(0.13, Math.max(0.06, b.w * 0.27)), dKol = Math.min(0.14, Math.max(0.07, b.d * 0.28));
  g.add(blok(THREE, b.w, hSub, b.d, 0.02, badan, 0.008));
  const gSub = mukaGril(THREE, b.w * 0.9, hSub * 0.86, 0.012, warnaGril, 'rgba(3,3,5,0.9)', 1 / 0.06);
  gSub.position.set(0, hSub * 0.5, b.d / 2 + 0.002); g.add(gSub);
  g.add(kotak(THREE, 0.05, 0.016, 0.004, mat(THREE, 0xe5e7eb), b.w * 0.36, hSub * 0.12, b.d / 2 + 0.004)); // logo
  //  Cangkir tiang + tiang ke kolom.
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.03, 20), besi).translateY(hSub + 0.015));
  const yKol = b.h - hKol, panjangTiang = Math.max(0.05, yKol - hSub);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, panjangTiang, 16), besi).translateY(hSub + panjangTiang / 2));
  g.add(blok(THREE, wKol, hKol, dKol, wKol * 0.25, badan, 0.004).translateY(yKol));
  const gKol = mukaGril(THREE, wKol * 0.84, hKol * 0.95, wKol * 0.2, warnaGril, 'rgba(3,3,5,0.9)', 1 / 0.04);
  gKol.position.set(0, yKol + hKol / 2, dKol / 2 + 0.002); g.add(gKol);
}

/**
 * Line array: n modul berpenampang trapesium bertumpuk dari atas ke bawah, tiap modul
 * menunduk (kemiringan atas + i x sudut antar modul) pada engsel di tepi depan-atasnya.
 * Pelat rigging & pin di kedua sisi; digantung = bumper di atas + dua tali ke plafon.
 */
function lineArray(THREE: typeof T, g: T.Group, b: Benda, warna: number, warnaGril: string) {
  const badan = mat(THREE, warna, { roughness: 0.66, metalness: 0.1 });
  const plat = mat(THREE, 0x3a3f47, { metalness: 0.75, roughness: 0.35 });
  const n = modulLA(b), hm = b.h / n, W = b.w, D = b.d;
  //  Penampang samping trapesium (belakang lebih pendek supaya bisa menekuk), diekstrusi selebar W.
  const bentuk = new THREE.Shape();
  bentuk.moveTo(0, 0); bentuk.lineTo(0, -hm); bentuk.lineTo(D, -hm * 0.88); bentuk.lineTo(D, -hm * 0.12); bentuk.lineTo(0, 0);
  const geoModul = new THREE.ExtrudeGeometry(bentuk, { depth: W, bevelEnabled: false });
  geoModul.rotateY(Math.PI / 2); geoModul.translate(-W / 2, 0, 0);   // x: -W/2..W/2, z: 0..-D
  let y = b.h, z = D / 2;
  for (let i = 0; i < n; i++) {
    const a = ((tiltLADari(b) + i * sudutModulLA(b)) * Math.PI) / 180;
    const engsel = new THREE.Group(); engsel.position.set(0, y, z); engsel.rotation.x = a;
    engsel.add(new THREE.Mesh(geoModul, badan));
    const gril = mukaGril(THREE, W * 0.9, hm * 0.84, 0.006, warnaGril, 'rgba(2,2,4,0.92)', 1 / 0.08);
    gril.position.set(0, -hm / 2, 0.002); engsel.add(gril);
    for (const sx of [-1, 1]) {
      engsel.add(kotak(THREE, 0.008, hm * 0.8, D * 0.42, plat, sx * (W / 2 + 0.004), -hm / 2, -D * 0.7));
      for (const fy of [0.2, 0.8]) {
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 10), plat);
        pin.rotation.z = Math.PI / 2; pin.position.set(sx * (W / 2 + 0.014), -hm * fy, -D * 0.12); engsel.add(pin);
      }
      engsel.add(kotak(THREE, 0.004, hm * 0.28, D * 0.22, mat(THREE, 0x070809), sx * (W / 2 + 0.001), -hm * 0.55, -D * 0.4)); // pegangan
    }
    g.add(engsel);
    y -= hm * Math.cos(a); z -= hm * Math.sin(a);
  }
  if (b.gantung) {
    g.add(kotak(THREE, W * 1.08, 0.04, D * 0.95, plat, 0, b.h + 0.02, 0));                         // bumper / frame
    for (const sx of [-0.35, 0.35]) g.add(batang(THREE, 0.008, 0.008, plat, sx * W, -D * 0.1, 'tiang', 0, true)); // tali ke plafon
  }
}

/**
 * Bracket pop-out (videowall & signage): rel dinding atas-bawah berkenop penyetel,
 * rangka tegak di punggung display, dan lengan gunting X di antaranya. Display
 * menempel dinding dengan celah 6 cm (lihat tempel() di Desain3D), jadi bracket
 * membentang dari punggung display (zPunggung) sampai bidang dinding.
 */
function bracketPopOut(THREE: typeof T, lebar: number, tinggi: number, x: number, yTengah: number, zPunggung: number): T.Group {
  const g = new THREE.Group();
  const hitam = mat(THREE, 0x1c1f24, { metalness: 0.55, roughness: 0.45 });
  const kenop = mat(THREE, 0x0d0f12, { roughness: 0.65 });
  const zDinding = zPunggung - 0.06;
  const W = Math.max(0.2, Math.min(0.62, lebar * 0.55)), H = Math.max(0.18, Math.min(0.5, tinggi * 0.62));
  for (const sy of [1, -1]) {
    const y = yTengah + sy * (H / 2);
    g.add(kotak(THREE, W + 0.1, 0.05, 0.014, hitam, x, y, zDinding + 0.007));            // rel dinding
    g.add(kotak(THREE, W + 0.1, 0.012, 0.03, hitam, x, y + sy * 0.019, zDinding + 0.02)); // bibir rel
    for (const sx of [-1, 1]) {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.022, 14), kenop);
      k.position.set(x + sx * (W / 2 - 0.03), y + sy * 0.045, zDinding + 0.024); g.add(k);
    }
  }
  for (const sx of [-1, 1]) {
    g.add(kotak(THREE, 0.04, H + 0.16, 0.012, hitam, x + sx * W * 0.4, yTengah, zPunggung - 0.007)); // tiang punggung
    //  Lengan gunting X di bidang kedalaman (dari dinding ke punggung display).
    const xa = x + sx * W * 0.24;
    const atas = yTengah + H / 2 - 0.04, bawah = yTengah - H / 2 + 0.04;
    g.add(tiangAntara(THREE, new THREE.Vector3(xa, atas, zDinding + 0.016), new THREE.Vector3(xa, bawah, zPunggung - 0.015), 0.008, hitam));
    g.add(tiangAntara(THREE, new THREE.Vector3(xa, bawah, zDinding + 0.016), new THREE.Vector3(xa, atas, zPunggung - 0.015), 0.008, hitam));
  }
  for (const sy of [1, -1]) g.add(kotak(THREE, W * 0.8 + 0.04, 0.035, 0.01, hitam, x, yTengah + sy * H * 0.36, zPunggung - 0.005)); // palang punggung
  return g;
}

/**
 * Standfloor beroda (gaya stand interactive/signage): dua tiang tegak di
 * belakang display, dua palang dudukan, kaki bercabang depan-belakang dengan
 * roda, dan palang bawah. Tiang memanjang ke lantai mengikuti ketinggian.
 */
function standfloor(THREE: typeof T, g: T.Group, b: Benda, tinggiTiang: number) {
  const hitam = mat(THREE, 0x15171a, { metalness: 0.5, roughness: 0.42 });
  const abu = mat(THREE, 0xd4d7dc, { metalness: 0.3, roughness: 0.5 });
  const karet = mat(THREE, 0x0b0c0e, { roughness: 0.8 });
  const xT = Math.max(0.22, Math.min(b.w / 2 - 0.1, Math.max(0.3, b.w * 0.36)));
  const zT = -b.d / 2 - 0.03;
  for (const sx of [-1, 1]) g.add(batang(THREE, 0.065, 0.035, hitam, sx * xT, zT, 'kaki', tinggiTiang));
  //  Palang dudukan display (di depan tiang, menempel punggung display).
  for (const fy of [0.78, 0.22]) g.add(kotak(THREE, xT * 2 + 0.065, 0.075, 0.012, hitam, 0, b.h * fy, -b.d / 2 - 0.008));
  const alas = new THREE.Group();
  for (const sx of [-1, 1]) {
    const x = sx * xT;
    for (const dz of [0.34, -0.3]) {
      alas.add(tiangAntara(THREE, new THREE.Vector3(x, 0.36, zT), new THREE.Vector3(x, 0.075, zT + dz), 0.022, hitam, 0.018));
      const rumah = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.03, 12), hitam);
      rumah.position.set(x, 0.065, zT + dz); alas.add(rumah);
      const roda = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.024, 16), karet);
      roda.rotation.z = Math.PI / 2; roda.position.set(x, 0.032, zT + dz); alas.add(roda);
    }
  }
  alas.add(kotak(THREE, xT * 2, 0.035, 0.03, abu, 0, 0.34, zT - 0.045)); // palang bawah
  g.add(diLantai(alas));
}

/**
 * Model satu benda. Titik asal = tengah tapak, alas di y = 0; sumbu +z = arah
 * hadap. Semua mesh memberi & menerima bayangan.
 */
export function buatModel(b: Benda, bahan: Bahan): T.Group {
  const { THREE } = bahan;
  const g = new THREE.Group();
  const muka = (w: number, h: number, z: number, y: number) => {
    const tex = bahan.layar(b);
    const m = tex
      ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.25, metalness: 0.4 });
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(0, y, z); return o;
  };
  //  Warna utama pilihan engineer (badan/bezel/rangka/kain/permukaan); tanpa pilihan = warna bawaan model.
  const warnaB = warnaSah(b.warna);
  const W = (bawaan: number) => (warnaB ? new THREE.Color(warnaB).getHex() : bawaan);
  const WS = (bawaan: string) => warnaB ?? bawaan;

  switch (b.jenis) {
    case 'videowall': {
      const kol = b.kol ?? 2, bar = b.bar ?? 2;
      const spek = spekVideowall(b);
      g.add(kotak(THREE, b.w, b.h, b.d, mat(THREE, W(0x0a0a0a), { roughness: 0.35, metalness: 0.5 }), 0, b.h / 2, 0));
      g.add(muka(b.w, b.h, b.d / 2 + 0.001, b.h / 2));
      //  Bezel 3,5 mm sisi ke sisi: tebal garis proporsional terhadap lebar tekstur 1024 px.
      const tebal = Math.max(2, (spek.bezelMm / 1000) * (1024 / b.w));
      const grid = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h),
        new THREE.MeshBasicMaterial({ map: teksturGrid(THREE, kol, bar, tebal, 'rgba(8,8,8,0.95)'), transparent: true, toneMapped: false }));
      grid.position.set(0, b.h / 2, b.d / 2 + 0.002); g.add(grid);
      if (b.pasang === 'standfloor') standfloor(THREE, g, b, b.h * 0.8);
      else {
        //  Satu bracket pop-out per panel (bisa ditarik keluar untuk servis).
        const pw = b.w / kol, ph = b.h / bar;
        for (let i = 0; i < kol; i++) for (let j = 0; j < bar; j++) {
          g.add(bracketPopOut(THREE, pw, ph, -b.w / 2 + pw * (i + 0.5), ph * (j + 0.5), -b.d / 2));
        }
      }
      break;
    }
    case 'tv': case 'ifp': {
      const ifp = b.jenis === 'ifp';
      const bezel = mat(THREE, W(ifp ? 0x1f2937 : 0x111111), { roughness: 0.35, metalness: 0.5 });
      g.add(kotak(THREE, b.w, b.h, b.d, bezel, 0, b.h / 2, 0));
      const tepi = ifp ? 0.03 : 0.012;
      g.add(muka(b.w - tepi * 2, b.h - tepi * 2, b.d / 2 + 0.001, b.h / 2));
      if (ifp) {
        g.add(kotak(THREE, b.w * 0.25, 0.012, 0.03, mat(THREE, 0x9ca3af, { metalness: 0.6 }), 0, -0.006, b.d / 2 - 0.01)); // baki pena
        g.add(kotak(THREE, 0.12, 0.012, 0.012, mat(THREE, 0xe5e7eb), -b.w * 0.06, 0.006, b.d / 2));
      }
      if (b.pasang === 'standfloor') standfloor(THREE, g, b, b.h * 0.78);
      else g.add(bracketPopOut(THREE, b.w, b.h, 0, b.h / 2, -b.d / 2));
      break;
    }
    case 'led': {
      const rangka = mat(THREE, W(0x1f2937), { metalness: 0.6, roughness: 0.4 });
      g.add(kotak(THREE, b.w, b.h, b.d, rangka, 0, b.h / 2, 0));
      g.add(muka(b.w, b.h, b.d / 2 + 0.001, b.h / 2));
      const kol = Math.max(1, Math.round((b.w * 1000) / (b.cabW ?? 500)));
      const bar = Math.max(1, Math.round((b.h * 1000) / (b.cabH ?? 500)));
      const grid = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h),
        new THREE.MeshBasicMaterial({ map: teksturGrid(THREE, kol, bar), transparent: true, toneMapped: false }));
      grid.position.set(0, b.h / 2, b.d / 2 + 0.002); g.add(grid);
      for (const sx of [-0.35, 0.35]) g.add(batang(THREE, 0.06, 0.3, rangka, sx * b.w, -0.05, 'kaki'));
      break;
    }
    case 'layar': {
      g.add(kotak(THREE, b.w + 0.12, b.h + 0.12, b.d, mat(THREE, W(0x111827)), 0, b.h / 2, 0));
      const tex = bahan.layar(b);
      const m = tex ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : mat(THREE, 0xf8fafc, { roughness: 0.9 });
      const kain = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), m);
      kain.position.set(0, b.h / 2, b.d / 2 + 0.001); g.add(kain);
      g.add(kotak(THREE, b.w + 0.3, 0.12, 0.14, mat(THREE, 0xe5e7eb), 0, b.h + 0.12, 0)); // casing gulung
      break;
    }
    case 'meja': {
      const bentuk = b.bentukMeja ?? 'rapat';
      const fin: Finish = b.finish ?? (bentuk === 'kelas' ? 'oak' : 'walnut');
      const panjangZ = b.d >= b.w;
      const atas = new THREE.MeshPhysicalMaterial({
        //  Warna custom = laminasi polos: tekstur 'putih' (nyaris rata) dikalikan warna pilihan.
        map: teksturKayu(THREE, warnaB ? 'putih' : fin, panjangZ), color: warnaB ? new THREE.Color(warnaB) : 0xffffff,
        roughness: fin === 'putih' || warnaB ? 0.5 : 0.42,
        clearcoat: fin === 'putih' || warnaB ? 0.15 : 0.55, clearcoatRoughness: 0.3,
      });
      const logam = mat(THREE, 0x2a2e35, { metalness: 0.75, roughness: 0.3 });
      if (bentuk === 'bulat') {
        //  Bundar/oval (w x d) dengan kaki tunggal: piring alas melebar,
        //  tiang ramping, dudukan atas - satu profil putar (LatheGeometry).
        const tebal = 0.04, bv = 0.008;
        const s = new THREE.Shape(); s.absellipse(0, 0, b.w / 2 - bv, b.d / 2 - bv, 0, Math.PI * 2, false, 0);
        g.add(lempeng(THREE, s, tebal, bv, atas, 64).translateY(b.h - tebal));
        const r0 = Math.min(b.w, b.d) * 0.3, yAtas = b.h - tebal, rAtas = Math.min(0.2, r0 * 0.8);
        const profil: [number, number][] = [[0.001, 0], [r0, 0], [r0, 0.012], [r0 * 0.6, 0.03], [0.07, 0.075], [0.042, 0.15],
          [0.038, yAtas - 0.14], [0.06, yAtas - 0.06], [rAtas, yAtas - 0.02], [rAtas, yAtas], [0.001, yAtas]];
        g.add(new THREE.Mesh(new THREE.LatheGeometry(profil.map(([x, y]) => new THREE.Vector2(x, y)), 48), logam));
      } else if (bentuk === 'kelas') {
        //  Meja siswa: papan laminasi, rangka pipa ditekuk di kedua sisi,
        //  panel penutup di depan (menghadap papan tulis) & rak buku.
        const tebal = 0.025;
        g.add(papan(THREE, b.w, b.d, tebal, 0.035, atas, 0.005).translateY(b.h - tebal));
        const rangka = mat(THREE, 0x3f454f, { metalness: 0.7, roughness: 0.35 });
        for (const sx of [-1, 1]) {
          const x = sx * (b.w / 2 - 0.06);
          g.add(pipa(THREE, [[x, 0.014, -b.d / 2 + 0.05], [x, 0.014, b.d / 2 - 0.05], [x, b.h - tebal - 0.012, b.d / 2 - 0.07], [x, b.h - tebal - 0.012, -b.d / 2 + 0.07]], 0.013, 0.06, rangka, true));
        }
        g.add(blok(THREE, b.w - 0.16, 0.28, 0.012, 0.01, mat(THREE, 0xcbd5e1, { roughness: 0.6 }), 0.003).translateY(b.h - tebal - 0.3).translateZ(-b.d / 2 + 0.06));
        g.add(papan(THREE, b.w - 0.16, b.d * 0.62, 0.012, 0.01, mat(THREE, 0x94a3b8, { roughness: 0.6 }), 0.003).translateY(b.h - 0.15).translateZ(-b.d * 0.12));
      } else if (bentuk === 'dosen') {
        //  Meja dosen: daun meja kayu, panel depan (menghadap mahasiswa) & panel samping, laci di kanan.
        const tebal = 0.03, panel = mat(THREE, warnaB ? 0xe5e7eb : 0xd6d9de, { roughness: 0.55 });
        g.add(papan(THREE, b.w, b.d, tebal, 0.02, atas, 0.004).translateY(b.h - tebal));
        g.add(kotak(THREE, b.w - 0.04, b.h - tebal - 0.06, 0.02, panel, 0, (b.h - tebal) / 2 + 0.03, b.d / 2 - 0.05));
        for (const sx of [-1, 1]) g.add(kotak(THREE, 0.03, b.h - tebal, b.d - 0.04, panel, sx * (b.w / 2 - 0.015), (b.h - tebal) / 2, 0));
        const laci = Math.min(0.42, b.w * 0.28);
        g.add(kotak(THREE, laci, b.h - tebal - 0.1, b.d - 0.12, panel, b.w / 2 - 0.03 - laci / 2, (b.h - tebal) / 2 + 0.03, -0.02));
        for (let i = 0; i < 3; i++) g.add(kotak(THREE, laci * 0.4, 0.012, 0.012, logam, b.w / 2 - 0.03 - laci / 2, 0.16 + i * 0.2, -b.d / 2 + 0.04));
      } else if (bentuk === 'podium') {
        //  Podium / mimbar: alas, badan meruncing, bidang baca miring ke arah pembicara (-z), panel logo & mic gooseneck.
        const kayu = new THREE.MeshPhysicalMaterial({ map: teksturKayu(THREE, warnaB ? 'putih' : fin, false), color: warnaB ? new THREE.Color(warnaB) : 0xffffff, roughness: 0.45, clearcoat: 0.4 });
        const tAlas = 0.06, tBaca = b.h - 0.06;
        g.add(papan(THREE, b.w, b.d, tAlas, 0.02, logam, 0.006));
        g.add(blok(THREE, b.w * 0.86, tBaca - tAlas, b.d * 0.82, 0.04, kayu, 0.008).translateY(tAlas));
        g.add(blok(THREE, b.w * 0.6, (tBaca - tAlas) * 0.35, 0.006, 0.01, mat(THREE, 0xe7e5e4, { roughness: 0.4 }), 0.002).translateY(tAlas + (tBaca - tAlas) * 0.45).translateZ(b.d * 0.41 + 0.004));
        const baca = papan(THREE, b.w, b.d * 0.9, 0.035, 0.02, kayu, 0.006);
        baca.position.set(0, tBaca, 0); baca.rotation.x = -0.22; g.add(baca);
        const hitamMic = mat(THREE, 0x111827, { metalness: 0.5, roughness: 0.4 });
        const kurva = new THREE.CatmullRomCurve3([
          new THREE.Vector3(b.w * 0.3, tBaca + 0.03, b.d * 0.3), new THREE.Vector3(b.w * 0.3, tBaca + 0.2, b.d * 0.22), new THREE.Vector3(b.w * 0.26, tBaca + 0.33, b.d * 0.02),
        ]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(kurva, 20, 0.005, 8, false), hitamMic));
        const kepala = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), hitamMic);
        kepala.scale.set(1, 1.5, 1); kepala.position.set(b.w * 0.25, tBaca + 0.35, -b.d * 0.02); g.add(kepala);
      } else if (bentuk === 'kredensa') {
        //  Kredensa: badan lemari gelap, pintu berpanel dengan handle, plint tersembunyi, daun atas.
        const badan = mat(THREE, W(0x1d2026), { roughness: 0.5 });
        const pegangan = mat(THREE, 0x9ca3af, { metalness: 0.9, roughness: 0.25 });
        const tebal = 0.025, plint = 0.06;
        g.add(papan(THREE, b.w, b.d, tebal, 0.01, warnaB ? badan : atas, 0.003).translateY(b.h - tebal));
        g.add(kotak(THREE, b.w - 0.08, plint, b.d - 0.08, mat(THREE, 0x0b0c0f), 0, plint / 2, -0.01));
        g.add(kotak(THREE, b.w, b.h - tebal - plint, b.d - 0.02, badan, 0, plint + (b.h - tebal - plint) / 2, -0.01));
        const nPintu = Math.max(2, Math.round(b.w / 0.6)), lebarPintu = (b.w - 0.02) / nPintu;
        for (let i = 0; i < nPintu; i++) {
          const x = -b.w / 2 + 0.01 + lebarPintu * (i + 0.5);
          g.add(blok(THREE, lebarPintu - 0.006, b.h - tebal - plint - 0.012, 0.018, 0.004, badan, 0.002).translateX(x).translateY(plint + 0.006).translateZ(b.d / 2 - 0.02));
          const sisi = i % 2 === 0 ? 1 : -1;
          g.add(kotak(THREE, 0.012, Math.min(0.22, (b.h - plint) * 0.35), 0.02, pegangan, x + sisi * (lebarPintu / 2 - 0.04), plint + (b.h - tebal - plint) * 0.62, b.d / 2 + 0.002));
        }
      } else if (bentuk === 'operator') {
        //  Meja operator control room: daun hitam, panel kaki putih (ujung & tengah), panel penutup
        //  di sisi depan (-z, ke arah videowall), monitor berderet di lengan, keyboard per 2 monitor.
        const daun = mat(THREE, W(0x15171b), { roughness: 0.4 });
        const panel = mat(THREE, 0xe5e7eb, { roughness: 0.5 });
        const tebal = 0.03;
        g.add(papan(THREE, b.w, b.d, tebal, 0.015, daun, 0.004).translateY(b.h - tebal));
        const nKaki = Math.max(2, Math.ceil(b.w / 1.8) + 1);
        for (let i = 0; i < nKaki; i++) g.add(kotak(THREE, 0.04, b.h - tebal, b.d - 0.06, panel, -b.w / 2 + 0.03 + (i * (b.w - 0.06)) / (nKaki - 1), (b.h - tebal) / 2, 0));
        g.add(kotak(THREE, b.w - 0.1, (b.h - tebal) * 0.55, 0.02, panel, 0, (b.h - tebal) * 0.6, -b.d / 2 + 0.05));
        const n = Math.max(0, Math.min(12, Math.round(b.monitorMeja ?? 4)));
        const hitam = mat(THREE, 0x0f1115, { roughness: 0.35, metalness: 0.3 });
        const ruas = (b.w - 0.1) / Math.max(1, n), lebarMon = Math.min(0.55, ruas - 0.02), tinggiMon = lebarMon * 0.6;
        const layarA = teksturMonitor(THREE, false, n * 3 + 1), layarB = teksturMonitor(THREE, true, n * 5 + 2);
        for (let i = 0; i < n; i++) {
          const mon = new THREE.Group();
          mon.add(kotak(THREE, 0.2, 0.01, 0.16, hitam, 0, 0.005, 0));
          mon.add(kotak(THREE, 0.03, 0.14, 0.02, hitam, 0, 0.08, -0.04));
          const badanMon = blok(THREE, lebarMon, tinggiMon, 0.02, 0.006, hitam, 0.002);
          badanMon.position.set(0, 0.12, -0.03); mon.add(badanMon);
          const kaca = new THREE.Mesh(new THREE.PlaneGeometry(lebarMon * 0.96, tinggiMon * 0.92), new THREE.MeshBasicMaterial({ map: i % 2 ? layarB : layarA, toneMapped: false }));
          kaca.position.set(0, 0.12 + tinggiMon / 2, -0.019); mon.add(kaca);
          mon.position.set(-b.w / 2 + 0.05 + ruas * (i + 0.5), b.h, -b.d / 2 + 0.2);
          mon.rotation.y = ((i + 0.5) / n - 0.5) * -0.3;
          g.add(mon);
        }
        const nKey = Math.max(1, Math.round(n / 2));
        for (let i = 0; i < nKey; i++) {
          const x = -b.w / 2 + (b.w / nKey) * (i + 0.5);
          g.add(kotak(THREE, 0.44, 0.018, 0.14, mat(THREE, 0x2b3038, { roughness: 0.6 }), x - 0.04, b.h + 0.009, b.d / 2 - 0.25));
          g.add(kotak(THREE, 0.06, 0.02, 0.1, mat(THREE, 0x2b3038, { roughness: 0.6 }), x + 0.27, b.h + 0.01, b.d / 2 - 0.25));
        }
      } else {
        //  Meja rapat: papan sudut membulat bertepi bevel + dua kaki panel,
        //  balok penghubung, dan kotak kabel rata permukaan.
        const tebal = 0.045;
        g.add(papan(THREE, b.w, b.d, tebal, Math.min(0.3, Math.min(b.w, b.d) * 0.3), atas, 0.008).translateY(b.h - tebal));
        const panjang = Math.max(b.w, b.d), lebar = Math.min(b.w, b.d);
        const jarakKaki = Math.max(0.15, panjang / 2 - Math.min(0.45, panjang * 0.16));
        const tinggiKaki = b.h - tebal;
        for (const sisi of [-1, 1]) {
          const kaki = blok(THREE, lebar * 0.62, tinggiKaki, 0.055, 0.02, logam, 0.006);
          if (panjangZ) kaki.position.z = sisi * jarakKaki;
          else { kaki.rotation.y = Math.PI / 2; kaki.position.x = sisi * jarakKaki; }
          g.add(kaki);
        }
        g.add(panjangZ
          ? kotak(THREE, 0.08, 0.05, jarakKaki * 2, logam, 0, tinggiKaki - 0.08, 0)
          : kotak(THREE, jarakKaki * 2, 0.05, 0.08, logam, 0, tinggiKaki - 0.08, 0));
        const kabel = papan(THREE, 0.26, 0.12, 0.006, 0.02, mat(THREE, 0xb8bec7, { metalness: 0.85, roughness: 0.25 }), 0.002);
        if (panjangZ) kabel.rotation.y = Math.PI / 2;
        g.add(kabel.translateY(b.h));
      }
      break;
    }
    case 'kursi': {
      const krom = mat(THREE, 0xc9ced6, { metalness: 0.95, roughness: 0.18 });
      if ((b.tipeKursi ?? 'kantor') === 'kelas') {
        const cangkang = mat(THREE, W(0x334155), { roughness: 0.5 });
        const yDuduk = 0.45;
        g.add(papan(THREE, b.w * 0.92, b.d * 0.82, 0.03, 0.06, cangkang, 0.01).translateY(yDuduk - 0.03));
        const s = sandaran(THREE, b.w * 0.9, 0.28, 0.022, 0.55, cangkang);
        s.position.set(0, yDuduk + 0.09, -b.d * 0.38); s.rotation.x = -0.12; g.add(s);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          g.add(tiangAntara(THREE, new THREE.Vector3(sx * (b.w / 2 - 0.02), 0, sz * (b.d / 2 - 0.03)),
            new THREE.Vector3(sx * (b.w / 2 - 0.07), yDuduk - 0.03, sz * (b.d / 2 - 0.1)), 0.011, krom));
        }
        for (const sx of [-1, 1]) {
          g.add(tiangAntara(THREE, new THREE.Vector3(sx * (b.w / 2 - 0.07), yDuduk - 0.03, -b.d / 2 + 0.1),
            new THREE.Vector3(sx * b.w * 0.3, yDuduk + 0.13, -b.d * 0.39), 0.009, krom));
        }
        break;
      }
      const kain = new THREE.MeshStandardMaterial({ map: teksturKain(THREE, WS('#30353d'), 0.12), roughness: 0.95 });
      const plastik = mat(THREE, 0x1b1e23, { roughness: 0.5 });
      const yDuduk = 0.48;
      //  Kaki bintang lima beroda + tabung gas.
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 10;
        const ujung = new THREE.Vector3(Math.cos(a) * 0.3, 0.058, Math.sin(a) * 0.3);
        g.add(tiangAntara(THREE, new THREE.Vector3(0, 0.085, 0), ujung, 0.02, krom, 0.013));
        const roda = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), plastik);
        roda.position.set(ujung.x, 0.026, ujung.z); g.add(roda);
      }
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 20), krom).translateY(0.085));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 16), plastik).translateY(0.18));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 16), krom).translateY(0.32));
      g.add(kotak(THREE, 0.22, 0.045, 0.24, plastik, 0, yDuduk - 0.06, 0));
      //  Dudukan empuk (bevel besar = tepi bantalan) & sandaran melengkung.
      g.add(papan(THREE, b.w * 0.9, b.d * 0.86, 0.085, 0.1, kain, 0.03).translateY(yDuduk - 0.04));
      //  Sandaran: bantalan kain bersudut membulat (bevel besar = empuk) yang
      //  dilengkungkan memeluk punggung, cangkang plastik di belakangnya.
      const tinggiS = Math.max(0.3, b.h - yDuduk - 0.1);
      const grupS = new THREE.Group();
      const bantal = blok(THREE, b.w * 0.84, tinggiS, 0.06, 0.11, kain, 0.022);
      lengkungkan(bantal.geometry, 0.5); grupS.add(bantal);
      const cangkang = blok(THREE, b.w * 0.8, tinggiS * 0.96, 0.016, 0.1, plastik, 0.005);
      lengkungkan(cangkang.geometry, 0.5); cangkang.position.set(0, tinggiS * 0.02, -0.036); grupS.add(cangkang);
      grupS.position.set(0, yDuduk + 0.1, -b.d * 0.4); grupS.rotation.x = -0.14; g.add(grupS);
      g.add(blok(THREE, 0.07, 0.26, 0.025, 0.02, plastik).translateY(yDuduk - 0.02).translateZ(-b.d * 0.43));
      for (const sx of [-1, 1]) {
        const x = sx * (b.w / 2 - 0.035);
        g.add(pipa(THREE, [[x, yDuduk, -0.12], [x, yDuduk + 0.2, -0.1], [x, yDuduk + 0.2, 0.1]], 0.011, 0.04, plastik));
        g.add(papan(THREE, 0.06, 0.24, 0.022, 0.025, plastik, 0.008).translateX(x).translateY(yDuduk + 0.205).translateZ(0.0));
      }
      break;
    }
    case 'speaker': {
      const tipe = tipeSpeakerDari(b);
      if (tipe === 'dinding6') { speakerDinding6(THREE, g, b, W(0x17191d), WS('#26292e')); break; }
      if (tipe === 'kolom') { speakerKolom(THREE, g, b, W(0x16181b), WS('#2a2d33')); break; }
      if (tipe === 'linearray') { lineArray(THREE, g, b, W(0x141619), WS('#25282d')); break; }
      const badan = mat(THREE, W(0x16181c), { roughness: 0.55, metalness: 0.15 });
      const gril = new THREE.MeshStandardMaterial({ map: teksturGril(THREE, WS('#3a3e45'), 'rgba(5,5,8,0.85)', 1 / 0.05), roughness: 0.65, metalness: 0.35 });
      const besi = mat(THREE, 0x22252a, { metalness: 0.6, roughness: 0.4 });
      const dBadan = b.d * 0.82, belakangBadan = b.d / 2 - dBadan;
      g.add(blok(THREE, b.w, b.h, dBadan, b.w * 0.16, badan, 0.012).translateZ(b.d / 2 - dBadan / 2));
      g.add(blok(THREE, b.w * 0.9, b.h * 0.93, 0.008, b.w * 0.13, gril, 0.003).translateY(b.h * 0.035).translateZ(b.d / 2 + 0.002));
      //  Bayangan woofer & tweeter di balik gril (seperti foto produk).
      const bayang = mat(THREE, 0x1c1e22, { roughness: 0.6, metalness: 0.3 });
      for (const [fy, fr] of [[0.34, 0.33], [0.78, 0.11]] as const) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(b.w * fr, 0.003, 8, 40), bayang);
        ring.position.set(0, b.h * fy, b.d / 2 + 0.0065); g.add(ring);
      }
      //  Bracket: pelat dinding di sisi belakang + lengan ke punggung kabinet.
      g.add(blok(THREE, 0.07, 0.11, 0.012, 0.012, besi).translateY(b.h / 2 - 0.055).translateZ(-b.d / 2 + 0.006));
      const panjangLengan = Math.max(0.01, belakangBadan - (-b.d / 2 + 0.012));
      g.add(kotak(THREE, 0.028, 0.028, panjangLengan, besi, 0, b.h / 2, -b.d / 2 + 0.012 + panjangLengan / 2));
      break;
    }
    case 'lampu': {
      //  Lampu plafon: rumah lampu + permukaan menyala (emisif, ikut dimmer) + kolam cahaya di lantai.
      const tipe = b.tipeLampu ?? 'downlight', warnaC = warnaKelvin(b.kelvin);
      const nyala = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: warnaC, emissiveIntensity: 1.6, roughness: 0.4 });
      nyala.userData.dasar = 1.6;
      const rumah = mat(THREE, W(tipe === 'linear' ? 0x2b2f36 : 0xf4f5f7), { metalness: tipe === 'linear' ? 0.6 : 0.2, roughness: 0.4 });
      const tandai = (m: T.Mesh) => { m.userData.cahaya = true; return m; };
      if (tipe === 'downlight' || tipe === 'spot') {
        const rr = b.w / 2;
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.012, 32), rumah).translateY(b.h - 0.006));
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.78, rr * 0.7, b.h - 0.012, 32), mat(THREE, tipe === 'spot' ? 0x111318 : 0xe5e7eb, { roughness: 0.5 })).translateY((b.h - 0.012) / 2));
        const muka = tandai(new THREE.Mesh(new THREE.CircleGeometry(rr * (tipe === 'spot' ? 0.4 : 0.66), 32), nyala));
        muka.rotation.x = Math.PI / 2; muka.position.y = 0.002; g.add(muka);
      } else if (tipe === 'panel') {
        g.add(kotak(THREE, b.w, b.h, b.d, rumah, 0, b.h / 2, 0));
        const muka = tandai(new THREE.Mesh(new THREE.PlaneGeometry(b.w - 0.03, b.d - 0.03), nyala));
        muka.rotation.x = Math.PI / 2; muka.position.y = -0.001; g.add(muka);
      } else if (tipe === 'gantung') {
        //  Pendant dekoratif: kap kubah logam gelap (dalam keemasan), bohlam menyala, kabel ke plafon.
        const kap = mat(THREE, W(0x1f2328), { metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide });
        const dalam = mat(THREE, 0xd4a35a, { metalness: 0.8, roughness: 0.3, side: THREE.BackSide });
        const rr = b.w / 2, profil: [number, number][] = [];
        for (let i = 0; i <= 16; i++) { const a = (i / 16) * (Math.PI / 2); profil.push([Math.max(0.012, rr * Math.sin(a)), b.h * Math.cos(a) * 0.85 + 0.03]); }
        const bentuk = profil.map(([x, y]) => new THREE.Vector2(x, y));
        g.add(new THREE.Mesh(new THREE.LatheGeometry(bentuk, 40), kap));
        g.add(new THREE.Mesh(new THREE.LatheGeometry(bentuk, 40), dalam));
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.05, 16), kap).translateY(b.h * 0.85 + 0.05));
        const bohlam = tandai(new THREE.Mesh(new THREE.SphereGeometry(rr * 0.22, 20, 12), nyala));
        bohlam.position.y = 0.06; g.add(bohlam);
        g.add(batang(THREE, 0.006, 0.006, mat(THREE, 0x111111), 0, 0, 'tiang', 0, true));
      } else {
        g.add(kotak(THREE, b.w, b.h, b.d, rumah, 0, b.h / 2, 0));
        const muka = tandai(new THREE.Mesh(new THREE.PlaneGeometry(b.w - 0.02, b.d * 0.6), nyala));
        muka.rotation.x = Math.PI / 2; muka.position.y = -0.001; g.add(muka);
        const kawat = mat(THREE, 0x9ca3af, { metalness: 0.9, roughness: 0.3 });
        for (const sx of [-1, 1]) g.add(batang(THREE, 0.004, 0.004, kawat, sx * (b.w / 2 - 0.1), 0, 'tiang', 0, true));
      }
      //  Kolam cahaya di lantai (aditif, tidak menghalangi sinar proyektor).
      const jari = Math.max(0.3, Math.min(3, b.elev * Math.tan((sudutLampuDari(b) / 2) * (Math.PI / 180))));
      const kolamTex = teksturKolamCahaya(THREE);
      const kolam = new THREE.Mesh(new THREE.PlaneGeometry(jari * 2 + (tipe === 'linear' ? b.w : 0), jari * 2),
        new THREE.MeshBasicMaterial({ map: kolamTex, color: warnaC, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
      kolam.rotation.x = -Math.PI / 2; kolam.position.y = 0.006;
      kolam.userData.cahaya = true; (kolam.material as T.MeshBasicMaterial).userData.dasar = 0.16;
      const lantai = new THREE.Group(); lantai.userData.peran = 'lantai'; lantai.add(kolam); g.add(lantai);
      break;
    }
    case 'speaker-plafon': {
      const putih = mat(THREE, W(0xf4f5f7), { roughness: 0.45 });
      const gril = new THREE.MeshStandardMaterial({ map: teksturGril(THREE, WS('#eef0f3'), 'rgba(70,75,85,0.55)', b.w / 0.048), roughness: 0.6 });
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(b.w / 2 - 0.01, b.w / 2 - 0.01, Math.max(0.01, b.h - 0.012), 32), mat(THREE, 0x1f2125)).translateY(0.012 + (b.h - 0.012) / 2));
      const cincin = new THREE.Mesh(new THREE.TorusGeometry(b.w / 2 + 0.006, 0.008, 10, 48), putih);
      cincin.rotation.x = Math.PI / 2; cincin.position.y = 0.008; g.add(cincin);
      const muka = new THREE.Mesh(new THREE.CircleGeometry(b.w / 2, 48), gril);
      muka.rotation.x = Math.PI / 2; muka.position.y = 0.004; g.add(muka);
      break;
    }
    case 'kamera': {
      const tipe = b.tipeKamera ?? 'ptz';
      const kaca = new THREE.MeshPhysicalMaterial({ color: 0x0c1730, metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 });
      const hitamKilap = mat(THREE, 0x0a0b0d, { roughness: 0.18, metalness: 0.35 });
      /** Lensa: cincin hitam mengilap + kubah kaca, menghadap +z. */
      const lensa = (r: number, x: number, y: number, z: number) => {
        const l = new THREE.Group();
        const cincin = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.012, 32), hitamKilap); cincin.rotation.x = Math.PI / 2; l.add(cincin);
        const kubah = new THREE.Mesh(new THREE.SphereGeometry(r * 0.78, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), kaca);
        kubah.rotation.x = Math.PI / 2; kubah.position.z = 0.004; l.add(kubah);
        l.position.set(x, y, z); return l;
      };
      if (tipe === 'xbar') {
        //  Video bar: batang berlapis kain, modul kamera hitam di tengah.
        const kain = new THREE.MeshStandardMaterial({ map: teksturKain(THREE, WS('#4a4e55'), 0.05), roughness: 0.95 });
        g.add(blok(THREE, b.w, b.h, b.d, b.h * 0.42, kain, 0.01));
        const lebarModul = Math.min(0.16, b.w * 0.2);
        g.add(blok(THREE, lebarModul, b.h * 0.5, 0.012, b.h * 0.22, hitamKilap, 0.003).translateY(b.h * 0.25).translateZ(b.d / 2 + 0.001));
        for (const [x, r] of [[-0.03, 0.0075], [0, 0.011], [0.03, 0.0075]] as const) g.add(lensa(r, x * (lebarModul / 0.16), b.h / 2, b.d / 2 + 0.008));
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 8, 6), mat(THREE, 0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 1 }));
        led.position.set(lebarModul * 0.38, b.h * 0.66, b.d / 2 + 0.008); g.add(led);
      } else if (tipe === 'ptz-ai') {
        //  PTZ AI: bar sensor di bawah, lengan L, kepala kotak membulat.
        const badan = mat(THREE, W(0x25282d), { roughness: 0.4, metalness: 0.35 });
        const tAlas = b.h * 0.26, sKepala = Math.min(0.09, b.h * 0.55);
        g.add(blok(THREE, b.w, tAlas, b.d, tAlas * 0.3, badan, 0.004));
        g.add(lensa(0.009, 0, tAlas / 2, b.d / 2 + 0.002));
        for (const fx of [-0.36, -0.18, 0.18, 0.36]) {
          const titik = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.004, 10), hitamKilap);
          titik.rotation.x = Math.PI / 2; titik.position.set(fx * b.w, tAlas / 2, b.d / 2 + 0.001); g.add(titik);
        }
        g.add(blok(THREE, 0.03, Math.max(0.02, b.h - tAlas - sKepala * 0.5), 0.035, 0.012, badan, 0.004).translateX(sKepala * 0.78).translateY(tAlas));
        g.add(kotak(THREE, sKepala * 0.5, 0.024, 0.03, badan, sKepala * 0.62, b.h - sKepala * 0.5, 0));
        g.add(blok(THREE, sKepala, sKepala, sKepala * 0.95, sKepala * 0.22, badan, 0.006).translateY(b.h - sKepala).translateZ(0.005));
        g.add(lensa(sKepala * 0.32, 0, b.h - sKepala / 2, sKepala * 0.475 + 0.008));
      } else {
        //  PTZ: alas kotak (strip depan hitam), garpu, kepala membulat, lensa besar.
        const abu = mat(THREE, W(0x50555d), { metalness: 0.55, roughness: 0.36 });
        const tAlas = b.h * 0.22, yKepala = tAlas + 0.03 + b.h * 0.08;
        g.add(blok(THREE, b.w, tAlas, b.d, 0.012, abu, 0.004));
        g.add(blok(THREE, b.w * 0.9, tAlas * 0.42, 0.004, 0.004, hitamKilap, 0.0015).translateY(tAlas * 0.25).translateZ(b.d / 2 + 0.0015));
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(b.w * 0.36, b.w * 0.38, 0.014, 32), abu).translateY(tAlas + 0.007));
        for (const sx of [-1, 1]) g.add(blok(THREE, b.w * 0.13, b.h * 0.56, b.d * 0.5, b.w * 0.05, abu, 0.004).translateX(sx * b.w * 0.36).translateY(tAlas + 0.01));
        g.add(blok(THREE, b.w * 0.56, b.h * 0.46, b.d * 0.82, b.w * 0.16, abu, 0.008).translateY(yKepala));
        g.add(lensa(b.w * 0.21, 0, yKepala + b.h * 0.23, b.d * 0.41 + 0.006));
      }
      break;
    }
    case 'proyektor': {
      //  Badan cangkang plastik membulat (tampak atas) bertepi bevel lebar,
      //  muka gelap berisi lensa menyamping + gril ventilasi, panel tombol di
      //  atas. Plafon: bracket laba-laba + pipa ke plafon + pelat plafon.
      //  Meja: empat kaki karet.
      const meja = b.pasangProyektor === 'meja';
      //  Badan (beserta lensa & kaki) dibangun di grup `badan` yang diputar di
      //  engselnya untuk tilt; bracket plafon tetap tegak di grup utama.
      const utama = g;
      const badan = new THREE.Group();
      {
      const g = badan;
      const putih = mat(THREE, W(0xf1f2f4), { roughness: 0.42, metalness: 0.05 });
      const abu = mat(THREE, 0x2f343b, { roughness: 0.45, metalness: 0.3 });
      const hitamKilap = mat(THREE, 0x0a0b0d, { roughness: 0.15, metalness: 0.4 });
      const kaca = new THREE.MeshPhysicalMaterial({ color: 0x1b2a44, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0xc7d6ff, emissiveIntensity: 0.35 });
      const kaki = meja ? Math.min(0.012, b.h * 0.12) : 0;
      const tb = b.h - kaki;
      g.add(papan(THREE, b.w, b.d, tb, Math.min(b.w, b.d) * 0.16, putih, Math.min(0.02, tb * 0.28)).translateY(kaki));
      const zMuka = b.d / 2;
      g.add(blok(THREE, b.w * 0.84, tb * 0.62, 0.004, Math.min(0.012, tb * 0.2), abu, 0.0015).translateY(kaki + tb * 0.19).translateZ(zMuka + 0.001));
      //  Gril ventilasi di sisi kiri muka.
      const gril = new THREE.MeshStandardMaterial({ map: teksturGril(THREE, '#3a3f47', 'rgba(0,0,0,0.9)', 5), roughness: 0.6, metalness: 0.3 });
      g.add(blok(THREE, b.w * 0.34, tb * 0.44, 0.003, Math.min(0.008, tb * 0.12), gril, 0.001).translateX(-b.w * 0.2).translateY(kaki + tb * 0.28).translateZ(zMuka + 0.004));
      //  Lensa: laras menonjol, cincin fokus, kaca bercahaya.
      const [lx, ly] = lensaDatar(b);
      const rL = Math.min(0.05, tb * 0.36);
      const laras = new THREE.Mesh(new THREE.CylinderGeometry(rL, rL * 1.08, 0.03, 32), hitamKilap);
      laras.rotation.x = Math.PI / 2; laras.position.set(lx, ly, zMuka + 0.015); g.add(laras);
      for (const [dz, rr] of [[0.006, 1.14], [0.024, 1.02]] as const) {
        const cincin = new THREE.Mesh(new THREE.TorusGeometry(rL * rr, Math.max(0.002, rL * 0.08), 8, 36), abu);
        cincin.position.set(lx, ly, zMuka + dz); g.add(cincin);
      }
      const kubah = new THREE.Mesh(new THREE.SphereGeometry(rL * 0.82, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), kaca);
      kubah.rotation.x = Math.PI / 2; kubah.scale.set(1, 0.45, 1); kubah.position.set(lx, ly, zMuka + 0.03); g.add(kubah);
      //  Celah ventilasi samping.
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          g.add(kotak(THREE, 0.003, tb * 0.07, b.d * 0.34, hitamKilap, sx * (b.w / 2 + 0.0005), kaki + tb * (0.3 + i * 0.1), -b.d * 0.05));
        }
      }
      //  Panel tombol & lampu daya di atas.
      g.add(papan(THREE, b.w * 0.26, b.d * 0.2, 0.003, 0.01, abu, 0.001).translateX(-b.w * 0.24).translateY(b.h - 0.0005).translateZ(b.d * 0.18));
      const lampu = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8), mat(THREE, 0x60a5fa, { emissive: 0x60a5fa, emissiveIntensity: 1.4 }));
      lampu.position.set(-b.w * 0.33, b.h + 0.002, b.d * 0.18); g.add(lampu);
      if (meja) {
        const karet = mat(THREE, 0x15171b, { roughness: 0.8 });
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, kaki, 16), karet).translateX(sx * (b.w / 2 - 0.045)).translateY(kaki / 2).translateZ(sz * (b.d / 2 - 0.04)));
        }
      } else {
        //  Pelat & lengan laba-laba menempel di badan, ikut miring bersamanya.
        const besi = mat(THREE, 0x25282e, { metalness: 0.75, roughness: 0.35 });
        const hub = new THREE.Vector3(0, b.h + 0.022, 0);
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.016, 24), besi).translateY(b.h + 0.016));
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          const ujung = new THREE.Vector3(sx * b.w * 0.3, b.h + 0.004, sz * b.d * 0.28);
          g.add(tiangAntara(THREE, hub, ujung, 0.006, besi));
          g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 12), besi).translateX(ujung.x).translateY(b.h + 0.003).translateZ(ujung.z));
        }
      }
      }
      const [, ey, ez] = engselProyektor(b);
      const pivot = new THREE.Group(); pivot.position.set(0, ey, ez);
      badan.position.set(0, -ey, -ez); pivot.add(badan);
      pivot.rotation.x = -(tiltDari(b) * Math.PI) / 180;
      utama.add(pivot);
      if (!meja) {
        const g = utama;
        const besi = mat(THREE, 0x25282e, { metalness: 0.75, roughness: 0.35 });
        //  Sendi bola (engsel tilt), pipa sampai plafon, pelat plafon - tetap tegak.
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), besi).translateY(b.h + 0.04));
        g.add(batang(THREE, 0.04, 0.04, besi, 0, 0, 'tiang', 0, true));
        const geoPelat = new THREE.CylinderGeometry(0.08, 0.08, 0.012, 32); geoPelat.translate(0, -0.006, 0);
        const pelat = new THREE.Mesh(geoPelat, besi); pelat.userData.peran = 'plafon'; g.add(pelat);
      }
      break;
    }
    case 'mic': {
      const hitam = mat(THREE, W(0x111827), { metalness: 0.5, roughness: 0.4 });
      if (b.mic === 'boundary') {
        //  Cakram bundar berkain abu-abu dengan cincin LED hijau + ikon mic di tengah (mic konferensi puck).
        const R = b.w / 2, alas = 0.004;
        const kain = new THREE.MeshStandardMaterial({ map: teksturMicBoundary(THREE, 'kain', WS('#6d6e72')), roughness: 1, metalness: 0 });
        const sisi = new THREE.MeshStandardMaterial({ color: W(0x66676b), roughness: 0.95 });
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.93, R * 0.93, alas, 48), mat(THREE, 0x2a2d31, { roughness: 0.8 })).translateY(alas / 2));
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.97, R, b.h - alas, 64), [sisi, kain, sisi]).translateY(alas + (b.h - alas) / 2));
        const ikon = new THREE.Mesh(new THREE.CircleGeometry(R * 0.97, 48),
          new THREE.MeshBasicMaterial({ map: teksturMicBoundary(THREE, 'ikon'), transparent: true, toneMapped: false, depthWrite: false }));
        ikon.rotation.x = -Math.PI / 2; ikon.position.y = b.h + 0.0006; g.add(ikon);
      } else {
        g.add(kotak(THREE, b.w, 0.03, b.d * 0.9, hitam, 0, 0.015, 0)); // dasar + tombol
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 12), mat(THREE, 0xef4444, { emissive: 0xef4444, emissiveIntensity: 0.9 })).translateY(0.032).translateZ(b.d * 0.25));
        const kurva = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.03, -b.d * 0.2), new THREE.Vector3(0, b.h * 0.55, -b.d * 0.15),
          new THREE.Vector3(0, b.h * 0.9, b.d * 0.15), new THREE.Vector3(0, b.h * 0.95, b.d * 0.45),
        ]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(kurva, 24, 0.006, 8, false), hitam));
        const kapsul = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.06, 16), hitam);
        kapsul.rotation.x = Math.PI / 2 - 0.3; kapsul.position.set(0, b.h * 0.94, b.d * 0.5); g.add(kapsul);
      }
      break;
    }
    case 'touchpanel': {
      const perak = mat(THREE, W(0xc7ccd3), { metalness: 0.85, roughness: 0.28 });
      const hitam = mat(THREE, 0x0b0d10, { roughness: 0.2, metalness: 0.3 });
      g.add(blok(THREE, b.w * 0.5, 0.035, b.d * 0.55, 0.012, perak, 0.006).translateZ(-b.d * 0.05));
      const layar = new THREE.Group();
      layar.add(blok(THREE, b.w, b.h, 0.014, 0.012, perak, 0.004).translateY(-b.h / 2));
      layar.add(blok(THREE, b.w * 0.965, b.h * 0.94, 0.004, 0.008, hitam, 0.0015).translateY(-b.h * 0.47).translateZ(0.007));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 0.86, b.h * 0.8), new THREE.MeshBasicMaterial({ map: teksturPanel(THREE), toneMapped: false }));
      m.position.z = 0.0095; layar.add(m);
      layar.rotation.x = -0.95; layar.position.set(0, b.h * 0.45, 0); g.add(layar);
      break;
    }
    case 'rak': {
      //  Rack 19": rangka & panel besi, rel depan, isi perangkat (tekstur per U) di belakang pintu.
      //  Kaca = isi terlihat; tertutup = pintu besi berlubang; open frame = tanpa pintu & panel samping.
      const tipe = b.tipeRak ?? 'kaca';
      const besi = mat(THREE, W(0x15171b), { metalness: 0.55, roughness: 0.45 });
      const U = Math.max(4, b.rakU ?? 20), u = 0.04445, yRel = 0.08, tinggiRel = U * u;
      const tiang = 0.035, sisi = 0.012;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(kotak(THREE, tiang, b.h, tiang, besi, sx * (b.w / 2 - tiang / 2), b.h / 2, sz * (b.d / 2 - tiang / 2)));
      for (const y of [0.04, b.h - 0.02]) g.add(kotak(THREE, b.w, y < 0.1 ? 0.08 : 0.04, b.d, besi, 0, y, 0));
      if (tipe !== 'open') {
        for (const sx of [-1, 1]) g.add(kotak(THREE, sisi, b.h - 0.12, b.d - 0.04, besi, sx * (b.w / 2 - sisi / 2), b.h / 2, 0));
        g.add(kotak(THREE, b.w - 0.04, b.h - 0.12, sisi, besi, 0, b.h / 2, -b.d / 2 + sisi / 2));
        //  Ventilasi atas.
        for (let i = 0; i < 2; i++) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.004, 24), mat(THREE, 0x0a0b0d)).translateX((i - 0.5) * b.w * 0.4).translateY(b.h + 0.001));
      }
      //  Rel 19" & isi perangkat.
      const lebarIsi = Math.min(0.4826, b.w - 0.08), zIsi = b.d / 2 - 0.09;
      const rel = mat(THREE, 0x9ca3af, { metalness: 0.85, roughness: 0.3 });
      for (const sx of [-1, 1]) g.add(kotak(THREE, 0.018, tinggiRel, 0.02, rel, sx * (lebarIsi / 2 + 0.006), yRel + tinggiRel / 2, zIsi));
      const isi = new THREE.Mesh(new THREE.PlaneGeometry(lebarIsi, tinggiRel), new THREE.MeshStandardMaterial({ map: teksturIsiRak(THREE, b), roughness: 0.55, metalness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.08 }));
      isi.position.set(0, yRel + tinggiRel / 2, zIsi + 0.006); g.add(isi);
      g.add(kotak(THREE, lebarIsi, tinggiRel, 0.004, mat(THREE, 0x08090b), 0, yRel + tinggiRel / 2, zIsi - 0.004));
      //  Pintu depan.
      if (tipe !== 'open') {
        const zPintu = b.d / 2 - 0.01, lebarRangka = 0.035;
        const rangka = mat(THREE, W(0x15171b), { metalness: 0.5, roughness: 0.4 });
        g.add(kotak(THREE, b.w - 0.01, lebarRangka, 0.02, rangka, 0, b.h - 0.06, zPintu));
        g.add(kotak(THREE, b.w - 0.01, lebarRangka, 0.02, rangka, 0, 0.1, zPintu));
        for (const sx of [-1, 1]) g.add(kotak(THREE, lebarRangka, b.h - 0.16, 0.02, rangka, sx * (b.w / 2 - 0.0225), b.h / 2 + 0.02, zPintu));
        const lebarDaun = b.w - 0.08, tinggiDaun = b.h - 0.2;
        if (tipe === 'kaca') {
          g.add(kotak(THREE, lebarDaun, tinggiDaun, 0.005, new THREE.MeshPhysicalMaterial({ color: 0x1e293b, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, clearcoat: 1 }), 0, b.h / 2 + 0.02, zPintu));
        } else {
          const lubang = kanvas(256, 512, gg => {
            gg.fillStyle = '#16181c'; gg.fillRect(0, 0, 256, 512);
            gg.fillStyle = '#050607';
            for (let y = 6; y < 512; y += 9) for (let x = (y / 9) % 2 ? 6 : 10.5; x < 256; x += 9) { gg.beginPath(); gg.arc(x, y, 2.6, 0, Math.PI * 2); gg.fill(); }
          });
          const tl = new THREE.CanvasTexture(lubang); tl.colorSpace = THREE.SRGBColorSpace;
          g.add(new THREE.Mesh(new THREE.BoxGeometry(lebarDaun, tinggiDaun, 0.006), new THREE.MeshStandardMaterial({ map: tl, metalness: 0.5, roughness: 0.45 })).translateY(b.h / 2 + 0.02).translateZ(zPintu));
        }
        g.add(kotak(THREE, 0.015, 0.16, 0.025, mat(THREE, 0xb8bec7, { metalness: 0.9, roughness: 0.2 }), b.w / 2 - 0.06, b.h * 0.55, zPintu + 0.018));
      }
      //  Kaki / roda.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 14), mat(THREE, 0x0a0b0d)).translateX(sx * (b.w / 2 - 0.05)).translateY(0.01).translateZ(sz * (b.d / 2 - 0.05)));
      break;
    }
    case 'lift': {
      const hitam = mat(THREE, W(0x15171b), { metalness: 0.6, roughness: 0.32 });
      const hitamKilap = mat(THREE, 0x0a0b0d, { roughness: 0.15, metalness: 0.3 });
      g.add(papan(THREE, b.w, b.d, 0.008, 0.01, hitam, 0.002));
      const lebarMon = Math.min(0.36, b.w * 0.66), xMon = -b.w / 2 + lebarMon / 2 + 0.03;
      g.add(kotak(THREE, lebarMon + 0.01, 0.0015, 0.014, hitamKilap, xMon, 0.0085, -b.d * 0.18));
      if (b.naik !== false) {
        const tinggiMon = lebarMon * 0.6;
        const mon = new THREE.Group();
        mon.add(blok(THREE, lebarMon, tinggiMon, 0.012, 0.008, hitam, 0.003));
        const layar = new THREE.Mesh(new THREE.PlaneGeometry(lebarMon * 0.95, tinggiMon * 0.86), new THREE.MeshBasicMaterial({ map: teksturLift(THREE), toneMapped: false }));
        layar.position.set(0, tinggiMon * 0.53, 0.0065); mon.add(layar);
        mon.add(blok(THREE, lebarMon + 0.012, 0.03, 0.03, 0.01, hitam, 0.004));
        mon.position.set(xMon, 0.008, -b.d * 0.18); mon.rotation.x = -0.16; g.add(mon);
      }
      const xMic = b.w / 2 - 0.06;
      if (b.naik !== false) {
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.008, 20), hitam).translateX(xMic).translateY(0.012).translateZ(b.d * 0.15));
        const kurva = new THREE.CatmullRomCurve3([
          new THREE.Vector3(xMic, 0.012, b.d * 0.15), new THREE.Vector3(xMic, b.h * 0.6, b.d * 0.12), new THREE.Vector3(xMic, b.h * 0.88, b.d * 0.02),
        ]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(kurva, 24, 0.005, 8, false), hitam));
        const kepala = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 14), hitamKilap);
        kepala.scale.set(1, 1.5, 1); kepala.position.set(xMic, b.h * 0.92, -b.d * 0.02); g.add(kepala);
      } else {
        //  Layar turun = mic gooseneck ikut masuk ke meja (hide); tinggal lubang/tutup rata di tempatnya.
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.0015, 24), hitamKilap).translateX(xMic).translateY(0.0085).translateZ(b.d * 0.15));
      }
      break;
    }
    case 'tribun': { tribunModel(THREE, g, b, WS('#8b1e2b')); break; }
    case 'panggung': {
      //  Platform: lantai panggung kayu gelap, rok depan hitam, tangga di sisi kiri depan.
      const lantaiP = new THREE.MeshStandardMaterial({ map: teksturKayu(THREE, 'walnut', false), color: warnaB ? new THREE.Color(warnaB) : 0x6b6b6b, roughness: 0.6 });
      const rok = mat(THREE, 0x0d0e10, { roughness: 0.9 });
      g.add(kotak(THREE, b.w, b.h - 0.03, b.d, rok, 0, (b.h - 0.03) / 2, 0));
      g.add(papan(THREE, b.w, b.d, 0.03, 0.005, lantaiP, 0.003).translateY(b.h - 0.03));
      g.add(kotak(THREE, b.w, 0.012, 0.01, mat(THREE, 0xf5f5f4, { emissive: 0xf5f5f4, emissiveIntensity: 0.25 }), 0, b.h - 0.006, b.d / 2 + 0.002)); // tepi terang
      const nAnak = Math.max(1, Math.round(b.h / 0.18)), tAnak = b.h / (nAnak + 0), lebarT = Math.min(1.2, b.w * 0.2);
      for (let i = 0; i < nAnak; i++) {
        const tinggi = tAnak * (i + 1) - 0.0001;
        g.add(kotak(THREE, lebarT, tinggi, 0.28, rok, -b.w / 2 + lebarT / 2 + 0.3, tinggi / 2, b.d / 2 + 0.28 * (nAnak - i) - 0.14));
      }
      break;
    }
    case 'bidang': { bidangMapping(THREE, g, b, W(0xf3f4f6)); break; }
    case 'model': {
      const asli = b.modelKunci ? bahan.model(b.modelKunci) : null;
      if (asli) {
        const salinan = asli.clone(true);
        //  Skala agar muat di kotak w×h×d, alas di y = 0.
        const kotakB = new THREE.Box3().setFromObject(salinan);
        const s = kotakB.getSize(new THREE.Vector3());
        const k = Math.min(b.w / Math.max(1e-3, s.x), b.h / Math.max(1e-3, s.y), b.d / Math.max(1e-3, s.z));
        salinan.scale.multiplyScalar(k);
        const k2 = new THREE.Box3().setFromObject(salinan); const c = k2.getCenter(new THREE.Vector3());
        salinan.position.sub(new THREE.Vector3(c.x, k2.min.y, c.z));
        g.add(salinan);
      } else {
        g.add(kotak(THREE, b.w, b.h, b.d, mat(THREE, 0xa855f7, { transparent: true, opacity: 0.5 }), 0, b.h / 2, 0));
      }
      break;
    }
  }
  g.traverse(o => { if ((o as T.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/**
 * Terapkan ketinggian: grup di y = elev; kaki memanjang ke lantai, tiang ke
 * plafon, alas troli tetap di lantai. Murah - dipanggil tiap frame seret.
 */
export function sesuaikanTinggi(g: T.Object3D, b: Benda, plafon: number) {
  g.position.y = b.elev;
  for (const o of g.children) {
    const peran = o.userData.peran as string | undefined;
    if (!peran) continue;
    if (peran === 'lantai') { o.position.y = -b.elev; o.visible = b.elev > 0.05; continue; }
    if (peran === 'kaki') {
      const panjang = b.elev + (o.userData.atas as number);
      o.position.y = -b.elev; o.scale.y = Math.max(0.001, panjang); o.visible = b.elev > 0.05;
    } else if (peran === 'tiang') {
      const panjang = plafon - b.elev - b.h;
      o.position.y = b.h; o.scale.y = Math.max(0.001, panjang); o.visible = panjang > 0.02;
    } else if (peran === 'plafon') {
      //  Pelat yang menempel di plafon (bracket proyektor).
      o.position.y = plafon - b.elev; o.visible = plafon - b.elev - b.h > 0.02;
    }
  }
}

// ── Kategori ruangan (template siap pakai) ─────────────────────────────────

export type KategoriRuang = 'meeting' | 'auditorium' | 'kelas' | 'control-room' | 'mapping-lengkung' | 'mapping-cembung' | 'mapping-objek' | 'immersive';
export const KATEGORI_RUANG: { id: KategoriRuang; judul: string; ket: string; ikon: string }[] = [
  { id: 'meeting', judul: 'Ruangan Meeting', ket: 'Videowall, meja rapat, kamera, mic & speaker plafon', ikon: '🤝' },
  { id: 'auditorium', judul: 'Auditorium', ket: 'Panggung, LED videotron, line array, podium & tribun bertingkat', ikon: '🎭' },
  { id: 'control-room', judul: 'Control room', ket: 'Videowall 4 × 3 (grafik + CCTV), meja operator multi monitor, rack server, kredensa', ikon: '🖥️' },
  { id: 'kelas', judul: 'Smart Classroom', ket: 'Interactive display, meja dosen di depan, kamera tracking, meja mahasiswa', ikon: '🎓' },
  { id: 'mapping-lengkung', judul: 'Mapping - layar cekung', ket: 'Screen melengkung ke dalam + 3 proyektor blending; bentuk & warna bisa diganti', ikon: '🌙' },
  { id: 'mapping-cembung', judul: 'Mapping - layar cembung', ket: 'Screen melengkung keluar + 2 proyektor blending; bentuk & warna bisa diganti', ikon: '🏛️' },
  { id: 'mapping-objek', judul: 'Mapping - objek upload', ket: 'Alas di tengah + 3 proyektor; impor objek .glb lalu cek sinarnya', ikon: '🧩' },
  { id: 'immersive', judul: 'Immersive room', ket: 'Proyeksi 4 dinding + lantai: 4 proyektor UST dinding & 2 lantai (bisa ditambah)', ikon: '🌐' },
];

/** Warna bawaan ruang mapping: abu-abu netral (bukan hitam) supaya ruang & sinar tetap terlihat. */
const ABU_DINDING = '#9ca3af', ABU_LANTAI = '#6b7280';

/** Proyektor gantung plafon tanpa lens shift (pusat gambar = sumbu), diarahkan ke `target`. */
function proyektorKe(k: Kotak, x: number, z: number, elev: number, target: Titik, tr: number, nama: string, zoom: [number, number] = [tr, tr]): Benda {
  const p0 = bendaBaru('proyektor', k, { pasangProyektor: 'plafon' });
  return arahkanKe({ ...p0, x, z, elev, offsetLensa: 0, throwRatio: tr, trMin: zoom[0], trMax: zoom[1], nama }, target);
}

/** Ruangan + isi untuk satu kategori. Semuanya tetap bisa diubah setelah dipasang. */
export function templateRuang(id: KategoriRuang): { nama: string; ruang: Ruang; benda: Benda[] } {
  if (id === 'auditorium') {
    const ruang: Ruang = { p: 16, l: 20, t: 7, lantai: 'karpet', cahaya: 'redup', r2: null };
    const k = daftarRuang(ruang)[0];
    const panggung = { ...bendaBaru('panggung', k), x: 8, z: 2.2, w: 11, d: 4.2, h: 0.8 };
    const led = { ...bendaBaru('led', k), x: 8, z: 0.08, w: 6.5, h: 3.5, elev: 1.6, pitch: 2.5, nama: 'LED videotron 6,5 × 3,5 m' };
    const la = (x: number, nama: string) => ({ ...bendaBaru('speaker', k, { tipeSpeaker: 'linearray', modul: 8 }), x, z: 1.2, rot: 0, gantung: true,
      elev: 7 - 0.6 - 2.4, tiltLA: 4, sudutModul: 2, nama });
    const tribun = bendaBaru('tribun', k, { baris: 12, kursiBaris: 18, tinggiAnak: 0.3 });
    const podium = { ...bendaBaru('meja', k, { bentukMeja: 'podium' }), x: 11.5, z: 2.6, elev: 0.8, rot: 0 };
    const kam = { ...bendaBaru('kamera', k, { tipeKamera: 'ptz' }), x: 8, z: 19.8, elev: 4.2, rot: 180 };
    return { nama: 'Auditorium', ruang, benda: [panggung, led, la(1.6, 'Line array kiri'), la(14.4, 'Line array kanan'), { ...tribun, x: 8, z: 20 - tribun.d / 2 - 0.4 }, podium, kam] };
  }
  if (id === 'kelas') {
    const ruang: Ruang = { p: 10, l: 8, t: 3.2, lantai: 'keramik', r2: null };
    const k = daftarRuang(ruang)[0];
    const ifp = { ...bendaBaru('ifp', k, { diag: 86, pasang: 'dinding' }), x: 5 };
    const signage = { ...bendaBaru('tv', k, { diag: 65, pasang: 'dinding', nama: 'Signage 65"' }), x: 8.4, elev: 1.1 };
    const dosen = { ...bendaBaru('meja', k, { bentukMeja: 'dosen' }), x: 2.2, z: 1.7, rot: 0 };
    const podium = { ...bendaBaru('meja', k, { bentukMeja: 'podium' }), x: 3.7, z: 1.4, rot: 0 };
    const mic = { ...bendaBaru('mic', k, { mic: 'gooseneck' }), x: 2.5, z: 1.6, elev: 0.75, rot: 0 };
    const tp = { ...bendaBaru('touchpanel', k), x: 1.8, z: 1.75, elev: 0.75, rot: 0 };
    const kam = { ...bendaBaru('kamera', k, { tipeKamera: 'ptz-ai' }), x: 5, z: 7.88, elev: 2.2, rot: 180, nama: 'Kamera PTZ AI (tracking dosen)' };
    const spk = [[2.5, 2.2], [7.5, 2.2], [2.5, 5.8], [7.5, 5.8]].map(([x, z]) => ({ ...bendaBaru('speaker-plafon', k), x, z }));
    const kelas = setRuangKelas(k, { kolom: 4, baris: 4, pengajar: false });
    return { nama: 'Smart Classroom', ruang, benda: [ifp, signage, dosen, podium, mic, tp, kam, ...spk, ...kelas] };
  }
  if (id === 'control-room') {
    const ruang: Ruang = { p: 10, l: 9, t: 3.4, lantai: 'karpet', cahaya: 'redup', r2: null };
    const k = daftarRuang(ruang)[0];
    const vw = { ...bendaBaru('videowall', k, { kol: 4, bar: 3, konten: 'campuran' }), x: 5, elev: 0.75, nama: 'Videowall 55" 4×3' };
    const kredensa = { ...bendaBaru('meja', k, { bentukMeja: 'kredensa' }), x: 5, w: Math.min(4.8, vw.w), h: 0.6, d: 0.45, z: 0.25 };
    const meja: Benda[] = [], kursi: Benda[] = [];
    for (const [z, xs] of [[4.1, [2.6, 5, 7.4]], [6.2, [2.6, 5, 7.4]]] as [number, number[]][]) {
      for (const x of xs) {
        meja.push({ ...bendaBaru('meja', k, { bentukMeja: 'operator' }), x, z, w: 1.8, monitorMeja: 4 });
        for (const dx of [-0.45, 0.45]) kursi.push({ ...bendaBaru('kursi', k, { tipeKursi: 'kantor' }), x: x + dx, z: z + 0.75, rot: 180 });
      }
    }
    const rak = [8.3, 9.0].map(x => ({ ...bendaBaru('rak', k, { rakU: 42, tipeRak: 'kaca' as const }), x, z: 8.4, rot: 180 }));
    const lampu: Benda[] = [];
    for (const x of [2.6, 5, 7.4]) for (const z of [3.2, 5.6, 7.6]) lampu.push({ ...bendaBaru('lampu', k, { tipeLampu: 'linear', dimmer: 60 }), x, z, nama: `Lampu linear ${lampu.length + 1}` });
    return { nama: 'Control room', ruang: { ...ruang, dimmer: 100 }, benda: [vw, kredensa, ...meja, ...kursi, ...rak, ...lampu] };
  }
  if (id === 'mapping-lengkung') {
    const ruang: Ruang = { p: 14, l: 12, t: 5, lantai: 'polos', warnaLantai: ABU_LANTAI, warnaDinding: ABU_DINDING, cahaya: 'redup', r2: null };
    const k = daftarRuang(ruang)[0];
    const bidang = { ...bendaBaru('bidang', k, { bentukBidang: 'lengkung', jariBidang: 7, busur: 100 }), x: 7, h: 3.5, elev: 0.3 };
    bidang.z = bidang.d / 2 + 0.2;
    const pusatZ = bidang.z + (7 - bidang.d / 2), yT = bidang.elev + bidang.h / 2;
    const titik = (deg: number): Titik => { const a = (deg * Math.PI) / 180; return [7 + 7 * Math.sin(a), yT, pusatZ - 7 * Math.cos(a)]; };
    const proj = [-33, 0, 33].map((deg, i) => proyektorKe(k, 7 + (i - 1) * 1.2, pusatZ, 4.3, titik(deg), 1.5, `Proyektor ${i + 1} (blending)`, [1.39, 2.09]));
    return { nama: 'Mapping layar cekung', ruang, benda: [bidang, ...proj] };
  }
  if (id === 'mapping-cembung') {
    const ruang: Ruang = { p: 12, l: 10, t: 5, lantai: 'polos', warnaLantai: ABU_LANTAI, warnaDinding: ABU_DINDING, cahaya: 'redup', r2: null };
    const k = daftarRuang(ruang)[0];
    //  Screen 6 m melengkung keluar 60 cm ke arah penonton.
    const bidang = { ...bendaBaru('bidang', k, { bentukBidang: 'cembung', ...lengkungDari(6, 0.6) }), x: 6, h: 2.2, elev: 0.8 };
    bidang.z = bidang.d / 2 + 0.5;
    const R = bidang.jariBidang ?? 5, pusatZ = bidang.z + bidang.d / 2 - R, yT = bidang.elev + bidang.h / 2;
    const titik = (deg: number): Titik => { const a = (deg * Math.PI) / 180; return [6 + R * Math.sin(a), yT, pusatZ + R * Math.cos(a)]; };
    //  Tiap proyektor membidik tengah separuh layarnya (seperempat busur), gambar ±3,5 m (separuh + blending).
    const seperempat = (bidang.busur ?? 60) / 4;
    const proj = [-seperempat, seperempat].map((deg, i) => proyektorKe(k, 6 + (i ? 1.5 : -1.5), 6.2, 4.3, titik(deg), 1.65, `Proyektor ${i + 1} (blending)`, [1.39, 2.09]));
    return { nama: 'Mapping layar cembung', ruang, benda: [bidang, ...proj] };
  }
  if (id === 'mapping-objek') {
    const ruang: Ruang = { p: 12, l: 10, t: 5, lantai: 'polos', warnaLantai: ABU_LANTAI, warnaDinding: ABU_DINDING, cahaya: 'redup', r2: null };
    const k = daftarRuang(ruang)[0];
    const alas = { ...bendaBaru('panggung', k), nama: 'Alas objek', x: 6, z: 5, w: 1.8, d: 1.8, h: 0.4 };
    const proj = [0, 120, 240].map((deg, i) => {
      const a = (deg * Math.PI) / 180;
      return proyektorKe(k, 6 + 4 * Math.sin(a), 5 + 3.5 * Math.cos(a), 4.2, [6, 1.2, 5], 1.6, `Proyektor ${i + 1}`, [1.39, 2.09]);
    });
    return { nama: 'Mapping objek', ruang, benda: [alas, ...proj] };
  }
  if (id === 'immersive') {
    //  Ruang 6 x 6 x 3,5 m. Tiap dinding disorot satu proyektor ultra short throw (TR 0,25) yang
    //  digantung 1,5 m dari dinding itu sendiri - gambar 6 x 3,375 m dari plafon sampai lantai dan
    //  tidak terhalang proyektor lain. Lantai: dua proyektor tegak ke bawah, lens shift 12% ke luar
    //  supaya keduanya menutup lantai dengan area blending di tengah.
    const ruang: Ruang = { p: 6, l: 6, t: 3.5, lantai: 'polos', warnaLantai: '#e5e7eb', warnaDinding: '#f8fafc', cahaya: 'gelap', r2: null };
    const k = daftarRuang(ruang)[0];
    /** Proyektor plafon dengan LENSA tepat di (x, z). */
    const diLensa = (atur: Partial<Benda>, x: number, z: number): Benda => {
      const p0 = { ...bendaBaru('proyektor', k, { pasangProyektor: 'plafon' }), x: 0, z: 0, ...atur } as Benda;
      const l = keDunia(p0, lensaProyektor(p0));
      return { ...p0, x: Math.round((x - l[0]) * 1000) / 1000, z: Math.round((z - l[2]) * 1000) / 1000 };
    };
    const ust = (rot: number, x: number, z: number, nama: string) =>
      diLensa({ elev: 3.3, rot, tilt: 0, offsetLensa: 0.5, throwRatio: 0.25, trMin: 0.25, trMax: 0.25, nama: `UST ${nama}` }, x, z);
    const lantai = (rot: number, z: number) =>
      diLensa({ elev: 3.3, rot, tilt: -90, offsetLensa: 0.12, throwRatio: 0.54, trMin: 0.5, trMax: 0.65, nama: 'Lantai' }, 3, z);
    const hasil: Benda[] = [
      ust(180, 3, 1.5, 'dinding depan'), ust(0, 3, 4.5, 'dinding belakang'), ust(270, 1.5, 3, 'dinding kiri'), ust(90, 4.5, 3, 'dinding kanan'),
      lantai(0, 2), lantai(180, 4),
    ];
    hasil.forEach((p, i) => { p.nama = `${p.nama} ${i + 1}`; });
    return { nama: 'Immersive room', ruang, benda: hasil };
  }
  const ruang: Ruang = { p: 8, l: 6, t: 3, lantai: 'kayu', r2: null };
  return { nama: 'Ruang Meeting', ruang, benda: contohAwal(ruang) };
}
