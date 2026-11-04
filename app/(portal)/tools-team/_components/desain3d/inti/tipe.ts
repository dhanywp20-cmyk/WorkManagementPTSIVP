import type { PerangkatRak } from './rak';
import type { Kontur } from '../impor/kontur';
import type { Satuan } from '../impor/berkas3d';
import type { Siang } from './cahaya';

export type GolonganKabelSinyal = 'lan' | 'hdmi' | 'audio' | 'speaker' | 'usb' | 'fiber';
export interface KabelCustom { golongan: GolonganKabelSinyal; jumlah: number }

export type Jenis =
  | 'videowall' | 'led' | 'layar' | 'ifp' | 'tv'
  | 'meja' | 'kursi'
  | 'speaker' | 'speaker-plafon' | 'mic' | 'touchpanel' | 'kamera' | 'proyektor' | 'rak'
  | 'lift' | 'model' | 'tribun' | 'panggung' | 'bidang' | 'lampu' | 'objek' | 'perangkat' | 'teks';
export type HadapTeks = 'berdiri' | 'lantai' | 'kamera';
export type TipePerangkat = 'pc' | 'laptop' | 'dongle' | 'hp' | 'tablet';
export type BentukObjek = 'kotak' | 'silinder' | 'bola' | 'kubah' | 'kerucut' | 'piramida' | 'prisma' | 'gambar';
export const LABEL_BENTUK_OBJEK: Record<BentukObjek, string> = {
  kotak: 'Kotak / balok', silinder: 'Silinder', bola: 'Bola', kubah: 'Kubah (setengah bola)', kerucut: 'Kerucut',
  piramida: 'Piramida', prisma: 'Prisma segitiga (atap)', gambar: 'Siluet dari gambar',
};
export type BentukMeja = 'rapat' | 'bulat' | 'kelas' | 'dosen' | 'podium' | 'kredensa' | 'operator';
export type KontenLayar = 'pola' | 'gambar' | 'mati' | 'cctv' | 'dashboard' | 'campuran' | 'desktop' | 'putih';
export type TipeRak = 'kaca' | 'tertutup' | 'open';
export type TipeLampu = 'downlight' | 'spot' | 'panel' | 'linear' | 'gantung';
export type Finish = 'walnut' | 'oak' | 'putih';
export type TipeKursi = 'kantor' | 'kelas';
export type TipeKamera = 'ptz' | 'ptz-ai' | 'xbar';
export type PasangProyektor = 'plafon' | 'meja';
export type RasioProyektor = '16:9' | '16:10' | '17:9' | '4:3' | '21:9';
export type ResolusiProyektor = 'XGA' | 'SXGAP' | 'WXGAH' | 'WXGA' | 'FHD' | 'WUXGA' | 'WQXGA' | '4K' | '4KP' | '4KDCI';
export type TipeSpeaker = 'kotak' | 'dinding6' | 'kolom' | 'linearray';
export type ModelVW = '55BDL2105X' | '49BDL2105X' | 'custom';
export type RasioLayar = '16:9' | '16:10' | '4:3' | '21:9';
export interface PanelVW { w: number; h: number; d: number; bezelMm: number; resX: number; resY: number; wTipikal: number; wMaks: number }
export type Pasang = 'dinding' | 'hollow' | 'standfloor';
export const BISA_PASANG: Jenis[] = ['videowall', 'ifp', 'tv', 'led'];
export const pasangDari = (b: Pick<Benda, 'jenis' | 'pasang'>): Pasang => b.pasang ?? (b.jenis === 'led' ? 'hollow' : 'dinding');
export const CELAH_PASANG: Record<Pasang, number> = { dinding: 0.1, hollow: 0.1, standfloor: 0.45 };
export const LABEL_PASANG: Record<Pasang, string> = { dinding: 'Wall bracket pop-up', hollow: 'Wall bracket + struktur hollow', standfloor: 'Standfloor portable beroda' };
export interface Benda {
  id: string; jenis: Jenis; nama: string;
  x: number; z: number;  rot: number;
   w: number; h: number; d: number;  elev: number;
   diag?: number;
   rasio?: RasioLayar;
   pitch?: number; cabW?: number; cabH?: number;
   satuanLED?: 'referensi' | 'cabinet';
   modulLED?: string; unitLED?: 'modul' | 'cabinet'; pxUnitX?: number; pxUnitY?: number;
   vw?: ModelVW; kol?: number; bar?: number;
   panel?: PanelVW;
   warna?: string;
   jangkauan?: number;
   sebaran?: number; sebaranV?: number;
   tipeSpeaker?: TipeSpeaker;
  modul?: number; sudutModul?: number; tiltLA?: number; gantung?: boolean;
   tampilJangkauan?: boolean;
   trMin?: number; trMax?: number;
   baris?: number; kursiBaris?: number; tinggiAnak?: number;
  bentukBidang?: 'datar' | 'lengkung' | 'cembung'; jariBidang?: number; busur?: number;
   offsetLensa?: number;
   geserLensaH?: number;
   warnaSinar?: string;
   lumen?: number;
   koreksiJarak?: number;
  koreksiJarakTele?: number;
   offsetTetap?: number;
  kontrasAsli?: number;
  koefRasio?: Partial<Record<RasioProyektor, [number, number, number, number]>>;
   sumberLensa?: string;
  shiftAtasMaks?: number; shiftBawahMaks?: number; shiftHMaks?: number;
   poligonShift?: number[];
   gainLayar?: number;
  gridKolom?: number; warnaGrid?: string;
  maskBidang?: boolean;
   pasang?: Pasang;
   rakU?: number;
   isiRak?: PerangkatRak[];
  mic?: 'gooseneck' | 'boundary';
   bentukMeja?: BentukMeja; finish?: Finish;
   tipeKursi?: TipeKursi;
   tipeKamera?: TipeKamera;
   naik?: boolean;
   pasangProyektor?: PasangProyektor;
   throwRatio?: number;
   rasioProyektor?: RasioProyektor;
   resolusiProyektor?: ResolusiProyektor;
   tilt?: number;
   konten?: KontenLayar;
   sembunyiUkur?: boolean;
  kabelCustom?: KabelCustom[];
   sembunyiLabel?: boolean;
   monitorMeja?: number;
   tipeRak?: TipeRak;
  tipeLampu?: TipeLampu; sudutLampu?: number; dimmer?: number; kelvin?: number; gantungLampu?: number;
   modelKunci?: string;
   putarModel?: number;
  ukuranFile?: [number, number, number]; satuanModel?: Satuan;
   bentukObjek?: BentukObjek;
   kontur?: Kontur;
   tipePerangkat?: TipePerangkat; pakaiDongle?: boolean;
   layarTujuan?: string;
  teks?: string; tinggiHuruf?: number; hadapTeks?: HadapTeks; latarTeks?: string;
   terkunci?: boolean;
}
export interface Ruang {
  p: number; l: number; t: number; lantai: 'kayu' | 'karpet' | 'keramik' | 'polos';
   warnaLantai?: string;
   warnaDinding?: string;
  teksturLantai?: TeksturRuang; teksturDinding?: TeksturRuang;
  penggaris?: { id: string; a: Titik; b: Titik }[];
  dindingDepan?: 'polos' | 'marmer' | 'kayu';
   cahaya?: 'terang' | 'redup' | 'gelap';
   dimmer?: number;
  siang?: Siang; tirai?: number;
   bukaan?: Bukaan[];
  analisis?: { jenis: 'umum' | 'analitis' | 'detail' | 'custom'; faktor: number; sudut: number };
  r2?: RuangSambung | null;
  lain?: RuangSambung[];
}
export interface RuangSambung {
    aktif: boolean; p: number; l: number; t: number; lantai: Ruang['lantai']; pintu: boolean;
     warnaLantai?: string;
     pintuUkuran?: { lebar: number; tinggi: number; z?: number };
     sekat?: 'tembok' | 'kaca' | 'jendela' | 'terbuka';
    jendela?: { lebar: number; tinggi: number; ambang: number; geser: number };
}
export type SisiDinding = 'depan' | 'belakang' | 'kiri' | 'kanan';
export interface TeksturRuang { kunci: string; ubin: number }
export interface Bukaan { id: string; ruang: number; sisi: SisiDinding; jenis: 'pintu' | 'jendela'; posisi: number; lebar: number; tinggi: number; ambang: number }
export interface Kotak { x0: number; p: number; l: number; t: number }
export const LABEL: Record<Jenis, string> = {
  videowall: 'Videowall', led: 'LED Videotron', layar: 'Layar proyektor', ifp: 'Interactive display', tv: 'TV / Display',
  meja: 'Meja', kursi: 'Kursi',
  speaker: 'Speaker', 'speaker-plafon': 'Speaker plafon', mic: 'Mic', touchpanel: 'Touch panel',
  kamera: 'Kamera', proyektor: 'Proyektor', rak: 'Rack server', lift: 'Display lift', model: 'Model 3D (GLB)',
  tribun: 'Tribun', panggung: 'Panggung', bidang: 'Bidang mapping', lampu: 'Lampu plafon', objek: 'Objek mapping',
  perangkat: 'Perangkat', teks: 'Teks',
};
export const DISPLAY: Jenis[] = ['videowall', 'led', 'layar', 'ifp', 'tv'];
export const BISA_TEMPEL: Jenis[] = ['videowall', 'led', 'layar', 'ifp', 'tv', 'speaker', 'kamera', 'rak', 'meja', 'model', 'tribun', 'panggung', 'bidang', 'objek', 'teks'];

export type Titik = [number, number, number];

export function warnaSah(w: unknown): string | undefined {
  return typeof w === 'string' && /^#[0-9a-f]{6}$/i.test(w) ? w.toLowerCase() : undefined;
}
