/**
 * desain3d/inti/tipe.ts - Tipe data benda & ruang, label, dan konstanta pemasangan - dipakai semua modul Desain 3D.
 * Murni: tanpa three.js / React / DOM (diuji di uji/desain3d.ts).
 */
import type { PerangkatRak } from './rak';
import type { Kontur } from '../impor/kontur';
import type { Satuan } from '../impor/berkas3d';
import type { Siang } from './cahaya';

/** Golongan kabel sinyal (warna legend) yang bisa dipilih manual - kabel power diatur centang "Kabel power". */
export type GolonganKabelSinyal = 'lan' | 'hdmi' | 'audio' | 'speaker' | 'usb' | 'fiber';
export interface KabelCustom { golongan: GolonganKabelSinyal; jumlah: number }

export type Jenis =
  | 'videowall' | 'led' | 'layar' | 'ifp' | 'tv'
  | 'meja' | 'kursi'
  | 'speaker' | 'speaker-plafon' | 'mic' | 'touchpanel' | 'kamera' | 'proyektor' | 'rak'
  | 'lift' | 'model' | 'tribun' | 'panggung' | 'bidang' | 'lampu' | 'objek';
/** Objek mapping: bentuk dasar, atau siluet dari gambar (patung, tampak gedung, logo) setebal `d`. */
export type BentukObjek = 'kotak' | 'silinder' | 'bola' | 'kubah' | 'kerucut' | 'piramida' | 'prisma' | 'gambar';
export const LABEL_BENTUK_OBJEK: Record<BentukObjek, string> = {
  kotak: 'Kotak / balok', silinder: 'Silinder', bola: 'Bola', kubah: 'Kubah (setengah bola)', kerucut: 'Kerucut',
  piramida: 'Piramida', prisma: 'Prisma segitiga (atap)', gambar: 'Siluet dari gambar',
};
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
/** Pemasangan display: bracket pop-up di dinding, wall bracket + struktur hollow, atau standfloor portable beroda. */
export type Pasang = 'dinding' | 'hollow' | 'standfloor';
/** Display yang punya pilihan pemasangan. */
export const BISA_PASANG: Jenis[] = ['videowall', 'ifp', 'tv', 'led'];
/** Pemasangan efektif: LED videotron lama (tanpa pilihan) = struktur hollow, display lain = bracket pop-up. */
export const pasangDari = (b: Pick<Benda, 'jenis' | 'pasang'>): Pasang => b.pasang ?? (b.jenis === 'led' ? 'hollow' : 'dinding');
/** Jarak punggung display ke dinding (m) untuk tiap pemasangan. */
//  Pop-up: kedalaman tertutup bracket pop-out videowall ±10 cm (seperti datasheet umumnya).
export const CELAH_PASANG: Record<Pasang, number> = { dinding: 0.1, hollow: 0.1, standfloor: 0.45 };
export const LABEL_PASANG: Record<Pasang, string> = { dinding: 'Wall bracket pop-up', hollow: 'Wall bracket + struktur hollow', standfloor: 'Standfloor portable beroda' };
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
  /** Display: bracket pop-up, wall bracket + struktur hollow, atau standfloor beroda */ pasang?: Pasang;
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
  /** Kabel sinyal ke rack diatur sendiri di panel Atur (jenis = warna legend & jumlah tarikan); tanpa = otomatis (inti/kabel.ts). */
  kabelCustom?: KabelCustom[];
  /** Sembunyikan label produk benda ini walau label produk dinyalakan. */ sembunyiLabel?: boolean;
  /** Meja operator: jumlah monitor di atas meja. */ monitorMeja?: number;
  /** Rack: pintu kaca (isi terlihat), tertutup (pintu besi berlubang), atau open frame. */ tipeRak?: TipeRak;
  /** Lampu plafon: tipe, sudut sinar penuh (derajat), dimmer (%), suhu warna (K), jarak gantung dari plafon (m).
   *  Fluks memakai `lumen`. */
  tipeLampu?: TipeLampu; sudutLampu?: number; dimmer?: number; kelvin?: number; gantungLampu?: number;
  /** Model GLB impor: kunci ke cache objek di memori (tidak disimpan ke perangkat) */ modelKunci?: string;
  /** Model impor: putar tegak (derajat sumbu X, kelipatan 90) - file Z-up (STL, 3DS, sebagian OBJ) rebah tanpa ini. */ putarModel?: number;
  /** Model impor: ukuran kotak batas dalam satuan berkas (x, y, z sebelum diputar) & satuannya - untuk ganti satuan di panel. */
  ukuranFile?: [number, number, number]; satuanModel?: Satuan;
  /** Objek mapping: bentuknya. */ bentukObjek?: BentukObjek;
  /** Objek 'gambar': siluet ternormalisasi 0..1 (lihat desain3d/kontur.ts); foto permukaan depan = konten 'gambar'. */ kontur?: Kontur;
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
export const LABEL: Record<Jenis, string> = {
  videowall: 'Videowall', led: 'LED Videotron', layar: 'Layar proyektor', ifp: 'Interactive display', tv: 'TV / Display',
  meja: 'Meja', kursi: 'Kursi',
  speaker: 'Speaker', 'speaker-plafon': 'Speaker plafon', mic: 'Mic', touchpanel: 'Touch panel',
  kamera: 'Kamera', proyektor: 'Proyektor', rak: 'Rack server', lift: 'Display lift', model: 'Model 3D (GLB)',
  tribun: 'Tribun', panggung: 'Panggung', bidang: 'Bidang mapping', lampu: 'Lampu plafon', objek: 'Objek mapping',
};
export const DISPLAY: Jenis[] = ['videowall', 'led', 'layar', 'ifp', 'tv'];
/** Benda yang bisa ditempel ke dinding (sisi belakang menyentuh dinding). */
export const BISA_TEMPEL: Jenis[] = ['videowall', 'led', 'layar', 'ifp', 'tv', 'speaker', 'kamera', 'rak', 'meja', 'model', 'tribun', 'panggung', 'bidang', 'objek'];
// ── Proyektor: lensa, sinar ke layar, jarak lempar ─────────────────────────

export type Titik = [number, number, number];
// ── Tekstur kanvas ──────────────────────────────────────────────────────────

/** Warna #rrggbb yang sah, atau undefined (nilai rusak/asing diabaikan, kembali ke warna bawaan). */
export function warnaSah(w: unknown): string | undefined {
  return typeof w === 'string' && /^#[0-9a-f]{6}$/i.test(w) ? w.toLowerCase() : undefined;
}
