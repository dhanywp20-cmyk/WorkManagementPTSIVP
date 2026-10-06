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
import { ukuranDariDiagonal } from '@/lib/av-hitung';

import { type PerangkatRak } from './rak';
/** API tekstur yang dipakai komponen lain lewat model.ts (tetap kompatibel). */
export { warnaSah, teksturLantai, teksturKonten, teksturPolaUji, aturNyalaLampu } from './tekstur';

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
