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

export type Jenis =
  | 'videowall' | 'led' | 'layar' | 'ifp' | 'tv'
  | 'meja' | 'kursi'
  | 'speaker' | 'speaker-plafon' | 'mic' | 'touchpanel' | 'kamera' | 'proyektor' | 'rak'
  | 'lift' | 'model';

export type BentukMeja = 'rapat' | 'bulat' | 'kelas';
export type Finish = 'walnut' | 'oak' | 'putih';
export type TipeKursi = 'kantor' | 'kelas';
export type TipeKamera = 'ptz' | 'ptz-ai' | 'xbar';
export type PasangProyektor = 'plafon' | 'meja';

export type ModelVW = '55BDL2105X' | '49BDL2105X';
export type Pasang = 'dinding' | 'standfloor';

export interface Benda {
  id: string; jenis: Jenis; nama: string;
  x: number; z: number; /** derajat, 0 = menghadap +z (ke dalam ruangan) */ rot: number;
  /** m */ w: number; h: number; d: number; /** tinggi sisi bawah dari lantai */ elev: number;
  /** TV / IFP / layar: diagonal inci */ diag?: number;
  /** Layar proyektor */ rasio?: '16:9' | '4:3';
  /** LED: pitch mm; ukuran cabinet mm untuk garis cabinet */ pitch?: number; cabW?: number; cabH?: number;
  /** Videowall LCD */ vw?: ModelVW; kol?: number; bar?: number;
  /** Display: tempel dinding atau standfloor (berkaki/troli) */ pasang?: Pasang;
  /** Rak: tinggi dalam U */ rakU?: number;
  mic?: 'gooseneck' | 'boundary';
  /** Meja: bentuk & permukaan (bawaan: rapat, walnut; kelas: oak) */ bentukMeja?: BentukMeja; finish?: Finish;
  /** Kursi: kantor (beroda) / kelas (empat kaki) */ tipeKursi?: TipeKursi;
  /** Kamera: PTZ, PTZ AI (auto-tracking), atau camera soundbar */ tipeKamera?: TipeKamera;
  /** Display lift (paperless): layar sedang naik dari meja */ naik?: boolean;
  /** Proyektor: gantung plafon (bawaan) atau portabel di meja */ pasangProyektor?: PasangProyektor;
  /** Proyektor: throw ratio lensa (jarak lempar : lebar gambar), bawaan 1,5 */ throwRatio?: number;
  /** Proyektor: tilt (derajat, negatif = menunduk). Pan = rot. */ tilt?: number;
  /** Display: konten di layar ('pola' = pola uji bawaan; 'gambar' = unggahan, tidak disimpan) */ konten?: 'pola' | 'gambar' | 'mati';
  /** Model GLB impor: kunci ke cache objek di memori (tidak disimpan ke perangkat) */ modelKunci?: string;
}

export interface Ruang {
  p: number; l: number; t: number; lantai: 'kayu' | 'karpet' | 'keramik';
  /** Ruang ke-2 bersebelahan di sisi kanan (x = p .. p + r2.p). */
  r2?: { aktif: boolean; p: number; l: number; t: number; lantai: Ruang['lantai']; pintu: boolean;
    /** Sekat antara ruang 1 & 2: tembok (bawaan), kaca polos, atau kaca berpanel kotak (ruang sidang). */ sekat?: 'tembok' | 'kaca' | 'kaca-kotak' } | null;
}

/** Kotak satu ruang dalam koordinat dunia. */
export interface Kotak { x0: number; p: number; l: number; t: number }

export function daftarRuang(r: Ruang): Kotak[] {
  const satu = { x0: 0, p: r.p, l: r.l, t: r.t };
  return r.r2?.aktif ? [satu, { x0: r.p, p: r.r2.p, l: r.r2.l, t: r.r2.t }] : [satu];
}

/** Indeks ruang (0/1) tempat titik x berada. */
export function ruangDari(r: Ruang, x: number): number {
  return r.r2?.aktif && x > r.p ? 1 : 0;
}

// ── Katalog produk ─────────────────────────────────────────────────────────

/**
 * Videowall LCD Philips X-Line (datasheet: ukuran set W×H×D, bezel
 * 2,3 + 1,2 = 3,5 mm sisi ke sisi, resolusi 1920×1080 per panel).
 */
export const VIDEOWALL: Record<ModelVW, { nama: string; inci: number; w: number; h: number; d: number; bezelMm: number; wTipikal: number; wMaks: number }> = {
  '55BDL2105X': { nama: 'Philips 55BDL2105X', inci: 55, w: 1.2135, h: 0.6843, d: 0.0978, bezelMm: 3.5, wTipikal: 180, wMaks: 340 },
  '49BDL2105X': { nama: 'Philips 49BDL2105X', inci: 49, w: 1.0776, h: 0.6078, d: 0.0933, bezelMm: 3.5, wTipikal: 100, wMaks: 230 },
};

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

export function ukuranLayar(diag: number, rasio: '16:9' | '4:3') {
  const [a, b] = rasio === '16:9' ? [16, 9] : [4, 3];
  const u = ukuranDariDiagonal(diag, a, b);
  return { w: u.lebarM, h: u.tinggiM };
}

export const LABEL: Record<Jenis, string> = {
  videowall: 'Videowall', led: 'LED Videotron', layar: 'Layar proyektor', ifp: 'Interactive display', tv: 'TV / Display',
  meja: 'Meja', kursi: 'Kursi',
  speaker: 'Speaker dinding', 'speaker-plafon': 'Speaker plafon', mic: 'Mic', touchpanel: 'Touch panel',
  kamera: 'Kamera', proyektor: 'Proyektor', rak: 'Rack server', lift: 'Display lift', model: 'Model 3D (GLB)',
};
export const DISPLAY: Jenis[] = ['videowall', 'led', 'layar', 'ifp', 'tv'];
/** Benda yang bisa ditempel ke dinding (sisi belakang menyentuh dinding). */
export const BISA_TEMPEL: Jenis[] = ['videowall', 'led', 'layar', 'ifp', 'tv', 'speaker', 'kamera', 'rak', 'meja', 'model'];

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
      { kunci: 'tv', label: 'TV / Display', ket: 'Diagonal bebas', jenis: 'tv' },
    ],
  },
  {
    grup: 'Audio & kontrol', item: [
      { kunci: 'mic-g', label: 'Mic gooseneck', ket: 'Di meja', jenis: 'mic', atur: { mic: 'gooseneck' } },
      { kunci: 'mic-b', label: 'Mic boundary', ket: 'Di meja', jenis: 'mic', atur: { mic: 'boundary' } },
      { kunci: 'spk', label: 'Speaker dinding', ket: 'Kabinet + bracket dinding', jenis: 'speaker' },
      { kunci: 'spk-p', label: 'Speaker plafon', ket: 'In-ceiling, gril bulat', jenis: 'speaker-plafon' },
      { kunci: 'tp', label: 'Touch panel', ket: 'Kontrol di meja', jenis: 'touchpanel' },
      { kunci: 'rak', label: 'Rack server', ket: '12U - 42U', jenis: 'rak' },
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
    grup: 'Furnitur', item: [
      { kunci: 'meja', label: 'Meja rapat', ket: 'Sudut membulat, kaki panel', jenis: 'meja', atur: { bentukMeja: 'rapat' } },
      { kunci: 'meja-bulat', label: 'Meja bundar', ket: 'Meeting room kecil, kaki tunggal', jenis: 'meja', atur: { bentukMeja: 'bulat' } },
      { kunci: 'meja-kelas', label: 'Meja kelas', ket: 'Meja siswa 2 orang', jenis: 'meja', atur: { bentukMeja: 'kelas' } },
      { kunci: 'set-kelas', label: 'Set ruang kelas', ket: 'Deret meja & kursi siswa + meja pengajar', jenis: 'meja', set: k => setRuangKelas(k) },
      { kunci: 'kursi', label: 'Kursi kantor', ket: 'Beroda, sandaran melengkung', jenis: 'kursi', atur: { tipeKursi: 'kantor' } },
      { kunci: 'kursi-kelas', label: 'Kursi kelas', ket: 'Empat kaki, cangkang plastik', jenis: 'kursi', atur: { tipeKursi: 'kelas' } },
    ],
  },
];

let nomor = 0;
export const idBaru = () => `b${Date.now().toString(36)}${(nomor++).toString(36)}`;

/** Hitung ulang w/h/d dari properti produk (videowall, layar, IFP, TV, rak). */
export function terapkanUkuran(b: Benda): Benda {
  switch (b.jenis) {
    case 'videowall': {
      const m = VIDEOWALL[b.vw ?? '55BDL2105X'];
      const kol = Math.max(1, b.kol ?? 2), bar = Math.max(1, b.bar ?? 2);
      return { ...b, kol, bar, w: m.w * kol, h: m.h * bar, d: m.d };
    }
    case 'layar': { const u = ukuranLayar(b.diag ?? 120, b.rasio ?? '16:9'); return { ...b, w: u.w, h: u.h }; }
    case 'ifp': { const u = IFP[b.diag ?? 75] ?? IFP[75]; return { ...b, ...u }; }
    case 'tv': { const u = ukuranDariDiagonal(b.diag ?? 65); return { ...b, w: u.lebarM, h: u.tinggiM }; }
    case 'rak': return { ...b, h: tinggiRak(b.rakU ?? 20) };
    default: return b;
  }
}

/** Benda baru di tengah ruang k (dinding depan untuk display). */
export function bendaBaru(jenis: Jenis, k: Kotak, atur: Partial<Benda> = {}): Benda {
  const dasar = { id: idBaru(), jenis, nama: LABEL[jenis], x: k.x0 + k.p / 2, z: k.l / 2, rot: 0, ...atur };
  const jadi = (b: Benda) => terapkanUkuran(b);
  switch (jenis) {
    case 'videowall': {
      const b = jadi({ ...dasar, w: 0, h: 0, d: 0, elev: 0.8, vw: '55BDL2105X', kol: 2, bar: 2, pasang: 'dinding', konten: 'pola', ...atur } as Benda);
      return { ...b, nama: `Videowall ${VIDEOWALL[b.vw!].inci}" ${b.kol}×${b.bar}`, z: b.d / 2 + 0.06 };
    }
    case 'led': return { ...dasar, z: 0.08, w: 4, h: 2.25, d: 0.1, elev: 0.6, pitch: 2.5, cabW: 500, cabH: 500, konten: 'pola', ...atur };
    case 'layar': { const b = jadi({ ...dasar, z: 0.05, w: 0, h: 0, d: 0.03, elev: 0.9, diag: 120, rasio: '16:9', konten: 'pola', ...atur } as Benda); return { ...b, nama: `Layar ${b.diag}" ${b.rasio}` }; }
    case 'ifp': {
      const stand = (atur.pasang ?? 'dinding') === 'standfloor';
      const b = jadi({ ...dasar, z: stand ? 0.5 : 0.07, w: 0, h: 0, d: 0, elev: stand ? 0.72 : 0.85, diag: 75, pasang: stand ? 'standfloor' : 'dinding', konten: 'pola', ...atur } as Benda);
      return { ...b, nama: `Interactive ${b.diag}"${stand ? ' standfloor' : ''}` };
    }
    case 'tv': { const b = jadi({ ...dasar, z: 0.05, w: 0, h: 0, d: 0.06, elev: 1.0, diag: 65, pasang: 'dinding', konten: 'pola', ...atur } as Benda); return b; }
    case 'meja': {
      const bentuk = atur.bentukMeja ?? 'rapat';
      if (bentuk === 'bulat') return { ...dasar, nama: 'Meja bundar', z: k.l * 0.55, w: 1.2, h: 0.75, d: 1.2, elev: 0, bentukMeja: 'bulat', finish: 'walnut', ...atur };
      if (bentuk === 'kelas') return { ...dasar, nama: 'Meja kelas', z: k.l * 0.5, w: 1.2, h: 0.75, d: 0.5, elev: 0, bentukMeja: 'kelas', finish: 'oak', ...atur };
      return { ...dasar, nama: 'Meja rapat', z: k.l * 0.55, w: 1.2, h: 0.75, d: 3.6, elev: 0, bentukMeja: 'rapat', finish: 'walnut', ...atur };
    }
    case 'kursi': return (atur.tipeKursi ?? 'kantor') === 'kelas'
      ? { ...dasar, nama: 'Kursi kelas', z: k.l * 0.8, w: 0.47, h: 0.82, d: 0.5, elev: 0, rot: 180, tipeKursi: 'kelas', ...atur }
      : { ...dasar, nama: 'Kursi', z: k.l * 0.8, w: 0.58, h: 1.02, d: 0.58, elev: 0, rot: 180, tipeKursi: 'kantor', ...atur };
    case 'speaker': return { ...dasar, x: k.x0 + 0.4, z: 0.17, w: 0.21, h: 0.32, d: 0.2, elev: 2.0, ...atur };
    case 'speaker-plafon': return { ...dasar, w: 0.24, h: 0.06, d: 0.24, elev: k.t - 0.06, ...atur };
    case 'mic': return (atur.mic ?? 'gooseneck') === 'boundary'
      ? { ...dasar, z: k.l * 0.55, w: 0.09, h: 0.025, d: 0.09, elev: 0.75, mic: 'boundary', nama: 'Mic boundary', ...atur }
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
      ? { ...dasar, nama: 'Proyektor portabel', z: k.l * 0.6, w: 0.3, h: 0.09, d: 0.23, elev: 0.75, rot: 180, pasangProyektor: 'meja', throwRatio: 1.5, ...atur }
      : { ...dasar, nama: 'Proyektor plafon', z: Math.min(4, k.l * 0.65), w: 0.44, h: 0.14, d: 0.36, elev: Math.max(0.5, k.t - 0.5), rot: 180, pasangProyektor: 'plafon', throwRatio: 1.6, ...atur };
    case 'rak': { const b = jadi({ ...dasar, x: k.x0 + k.p - 0.45, z: 0.45, w: 0.6, h: 0, d: 0.8, elev: 0, rakU: 20, ...atur } as Benda); return { ...b, nama: `Rack ${b.rakU}U` }; }
    case 'model': return { ...dasar, w: 1, h: 1, d: 1, elev: 0, ...atur };
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
export function setRuangKelas(k: Kotak): Benda[] {
  const lebar = 1.2, celah = 0.4, jarakBaris = 1.15;
  const kolom = Math.max(1, Math.min(4, Math.floor((k.p - 0.8 + celah) / (lebar + celah))));
  const zMulai = Math.min(2.4, Math.max(1.6, k.l * 0.3));
  const baris = Math.max(1, Math.min(6, Math.floor((k.l - zMulai - 0.7) / jarakBaris) + 1));
  const total = kolom * lebar + (kolom - 1) * celah;
  const hasil: Benda[] = [];
  for (let r = 0; r < baris; r++) {
    for (let c = 0; c < kolom; c++) {
      const x = k.x0 + k.p / 2 - total / 2 + lebar / 2 + c * (lebar + celah);
      const z = zMulai + r * jarakBaris;
      hasil.push({ ...bendaBaru('meja', k, { bentukMeja: 'kelas' }), x, z, nama: `Meja kelas ${r + 1}.${c + 1}` });
      for (const sx of [-0.3, 0.3]) hasil.push({ ...bendaBaru('kursi', k, { tipeKursi: 'kelas' }), x: x + sx, z: z + 0.45, rot: 180 });
    }
  }
  hasil.push({
    ...bendaBaru('meja', k, { bentukMeja: 'rapat', finish: 'oak' }),
    x: k.x0 + Math.min(1.3, k.p * 0.22), z: Math.max(0.9, zMulai - 0.95), w: 1.4, d: 0.7, nama: 'Meja pengajar',
  });
  return hasil;
}

/** Titik penonton: kursi, dan kursi bayangan di sekeliling meja yang belum berkursi. */
export function titikPenonton(b: Benda[]): { x: number; z: number; id: string }[] {
  const kursi = b.filter(x => x.jenis === 'kursi');
  if (kursi.length) return kursi.map(k => ({ x: k.x, z: k.z, id: k.id }));
  const hasil: { x: number; z: number; id: string }[] = [];
  for (const x of b.filter(m => m.jenis === 'meja')) {
    const r = (x.rot * Math.PI) / 180;
    const lokal = [[-x.w / 2 - 0.4, -x.d / 2 + 0.3], [x.w / 2 + 0.4, -x.d / 2 + 0.3], [-x.w / 2 - 0.4, x.d / 2 - 0.3], [x.w / 2 + 0.4, x.d / 2 - 0.3], [0, x.d / 2 + 0.4]];
    for (const [lx, lz] of lokal) hasil.push({ x: x.x + lx * Math.cos(r) + lz * Math.sin(r), z: x.z - lx * Math.sin(r) + lz * Math.cos(r), id: x.id });
  }
  return hasil;
}

/** Tanda tangan bentuk: berubah = model perlu dibangun ulang (posisi, rotasi, ketinggian tidak termasuk). */
export const tandaBentuk = (b: Benda) =>
  [b.jenis, b.w, b.h, b.d, b.pitch, b.cabW, b.cabH, b.vw, b.kol, b.bar, b.pasang, b.rakU, b.mic, b.konten, b.modelKunci,
    b.bentukMeja, b.finish, b.tipeKursi, b.tipeKamera, b.naik, b.pasangProyektor, b.tilt].join('|');

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

/** Tilt proyektor (derajat, negatif = menunduk), dibatasi ±45°. */
export const tiltDari = (b: Benda) => Math.max(-45, Math.min(45, b.tilt ?? 0));

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
      asal[0] + D[0] * t + Math.sin(rl) * 0.004,
      asal[1] + D[1] * t + naikTurun * tinggi * OFFSET_GAMBAR,
      asal[2] + D[2] * t + Math.cos(rl) * 0.004,
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
  const pusat: Titik = [asal[0] + D[0] * jarak, asal[1] + D[1] * jarak + naikTurun * tinggi * OFFSET_GAMBAR, asal[2] + D[2] * jarak];
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
  let lo = -45, hi = 45;
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

function kanvas(w: number, h: number, gambar: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  gambar(c.getContext('2d')!); return c;
}

export function teksturLantai(THREE: typeof T, jenis: Ruang['lantai'], p: number, l: number): T.Texture {
  const c = kanvas(512, 512, g => {
    if (jenis === 'kayu') {
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

/** Penyangga standfloor: dua tiang di belakang + alas berroda. */
function standfloor(THREE: typeof T, g: T.Group, b: Benda, tinggiTiang: number) {
  const besi = mat(THREE, 0x374151, { metalness: 0.7, roughness: 0.35 });
  const zT = -b.d / 2 - 0.03;
  for (const sx of [-0.28, 0.28]) {
    g.add(batang(THREE, 0.06, 0.06, besi, sx * b.w, zT, 'kaki', tinggiTiang));
    const alas = new THREE.Group();
    alas.add(kotak(THREE, 0.08, 0.05, 0.75, besi, sx * b.w, 0.09, zT + 0.05));
    for (const dz of [-0.32, 0.4]) {
      const roda = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.035, 16), mat(THREE, 0x111827));
      roda.rotation.z = Math.PI / 2; roda.position.set(sx * b.w, 0.04, zT + 0.05 + dz); alas.add(roda);
    }
    g.add(diLantai(alas));
  }
  g.add(kotak(THREE, b.w * 0.6, 0.05, 0.04, besi, 0, b.h * 0.25, zT));
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
  const bracket = () => g.add(kotak(THREE, b.w * 0.3, Math.min(0.4, b.h * 0.3), 0.04, mat(THREE, 0x374151), 0, b.h / 2, -b.d / 2 - 0.02));

  switch (b.jenis) {
    case 'videowall': {
      const kol = b.kol ?? 2, bar = b.bar ?? 2;
      const spek = VIDEOWALL[b.vw ?? '55BDL2105X'];
      g.add(kotak(THREE, b.w, b.h, b.d, mat(THREE, 0x0a0a0a, { roughness: 0.35, metalness: 0.5 }), 0, b.h / 2, 0));
      g.add(muka(b.w, b.h, b.d / 2 + 0.001, b.h / 2));
      //  Bezel 3,5 mm sisi ke sisi: tebal garis proporsional terhadap lebar tekstur 1024 px.
      const tebal = Math.max(2, (spek.bezelMm / 1000) * (1024 / b.w));
      const grid = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h),
        new THREE.MeshBasicMaterial({ map: teksturGrid(THREE, kol, bar, tebal, 'rgba(8,8,8,0.95)'), transparent: true, toneMapped: false }));
      grid.position.set(0, b.h / 2, b.d / 2 + 0.002); g.add(grid);
      if (b.pasang === 'standfloor') standfloor(THREE, g, b, b.h * 0.8);
      else for (let i = 0; i < kol; i++) g.add(kotak(THREE, 0.45, b.h * 0.8, 0.05, mat(THREE, 0x4b5563, { metalness: 0.6 }), -b.w / 2 + spek.w * (i + 0.5), b.h / 2, -b.d / 2 - 0.025));
      break;
    }
    case 'tv': case 'ifp': {
      const ifp = b.jenis === 'ifp';
      const bezel = mat(THREE, ifp ? 0x1f2937 : 0x111111, { roughness: 0.35, metalness: 0.5 });
      g.add(kotak(THREE, b.w, b.h, b.d, bezel, 0, b.h / 2, 0));
      const tepi = ifp ? 0.03 : 0.012;
      g.add(muka(b.w - tepi * 2, b.h - tepi * 2, b.d / 2 + 0.001, b.h / 2));
      if (ifp) {
        g.add(kotak(THREE, b.w * 0.25, 0.012, 0.03, mat(THREE, 0x9ca3af, { metalness: 0.6 }), 0, -0.006, b.d / 2 - 0.01)); // baki pena
        g.add(kotak(THREE, 0.12, 0.012, 0.012, mat(THREE, 0xe5e7eb), -b.w * 0.06, 0.006, b.d / 2));
      }
      if (b.pasang === 'standfloor') standfloor(THREE, g, b, b.h * 0.75);
      else bracket();
      break;
    }
    case 'led': {
      const rangka = mat(THREE, 0x1f2937, { metalness: 0.6, roughness: 0.4 });
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
      g.add(kotak(THREE, b.w + 0.12, b.h + 0.12, b.d, mat(THREE, 0x111827), 0, b.h / 2, 0));
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
        map: teksturKayu(THREE, fin, panjangZ), roughness: fin === 'putih' ? 0.5 : 0.42,
        clearcoat: fin === 'putih' ? 0.15 : 0.55, clearcoatRoughness: 0.3,
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
        const cangkang = mat(THREE, 0x334155, { roughness: 0.5 });
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
      const kain = new THREE.MeshStandardMaterial({ map: teksturKain(THREE, '#30353d', 0.12), roughness: 0.95 });
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
      const badan = mat(THREE, 0x16181c, { roughness: 0.55, metalness: 0.15 });
      const gril = new THREE.MeshStandardMaterial({ map: teksturGril(THREE, '#3a3e45', 'rgba(5,5,8,0.85)', 1 / 0.05), roughness: 0.65, metalness: 0.35 });
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
    case 'speaker-plafon': {
      const putih = mat(THREE, 0xf4f5f7, { roughness: 0.45 });
      const gril = new THREE.MeshStandardMaterial({ map: teksturGril(THREE, '#eef0f3', 'rgba(70,75,85,0.55)', b.w / 0.048), roughness: 0.6 });
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
        const kain = new THREE.MeshStandardMaterial({ map: teksturKain(THREE, '#4a4e55', 0.05), roughness: 0.95 });
        g.add(blok(THREE, b.w, b.h, b.d, b.h * 0.42, kain, 0.01));
        const lebarModul = Math.min(0.16, b.w * 0.2);
        g.add(blok(THREE, lebarModul, b.h * 0.5, 0.012, b.h * 0.22, hitamKilap, 0.003).translateY(b.h * 0.25).translateZ(b.d / 2 + 0.001));
        for (const [x, r] of [[-0.03, 0.0075], [0, 0.011], [0.03, 0.0075]] as const) g.add(lensa(r, x * (lebarModul / 0.16), b.h / 2, b.d / 2 + 0.008));
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 8, 6), mat(THREE, 0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 1 }));
        led.position.set(lebarModul * 0.38, b.h * 0.66, b.d / 2 + 0.008); g.add(led);
      } else if (tipe === 'ptz-ai') {
        //  PTZ AI: bar sensor di bawah, lengan L, kepala kotak membulat.
        const badan = mat(THREE, 0x25282d, { roughness: 0.4, metalness: 0.35 });
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
        const abu = mat(THREE, 0x50555d, { metalness: 0.55, roughness: 0.36 });
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
      const putih = mat(THREE, 0xf1f2f4, { roughness: 0.42, metalness: 0.05 });
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
      const hitam = mat(THREE, 0x111827, { metalness: 0.5, roughness: 0.4 });
      if (b.mic === 'boundary') {
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(b.w / 2, b.w / 2 + 0.008, b.h, 28), hitam).translateY(b.h / 2));
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.003, 12), mat(THREE, 0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 1 })).translateY(b.h + 0.001).translateZ(b.d * 0.3));
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
      const perak = mat(THREE, 0xc7ccd3, { metalness: 0.85, roughness: 0.28 });
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
      const besi = mat(THREE, 0x111827, { metalness: 0.6, roughness: 0.4 });
      g.add(kotak(THREE, b.w, b.h, b.d, besi, 0, b.h / 2, 0));
      const unit = mat(THREE, 0x374151, { metalness: 0.5 });
      const lampu = mat(THREE, 0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 0.8 });
      const u = 0.04445, n = Math.max(2, Math.floor((b.rakU ?? 20) / 3));
      for (let i = 0; i < n; i++) {
        const y = 0.1 + i * 3 * u + u;
        g.add(kotak(THREE, b.w * 0.86, u * 2 - 0.006, 0.02, unit, 0, y, b.d / 2 + 0.005));
        g.add(kotak(THREE, 0.03, 0.012, 0.005, lampu, b.w * 0.33, y, b.d / 2 + 0.016));
      }
      g.add(kotak(THREE, b.w * 0.96, b.h - 0.12, 0.01, new THREE.MeshStandardMaterial({ color: 0x334155, transparent: true, opacity: 0.25, roughness: 0.1 }), 0, b.h / 2, b.d / 2 + 0.03)); // pintu kaca
      break;
    }
    case 'lift': {
      const hitam = mat(THREE, 0x15171b, { metalness: 0.6, roughness: 0.32 });
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
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.008, 20), hitam).translateX(xMic).translateY(0.012).translateZ(b.d * 0.15));
      const kurva = new THREE.CatmullRomCurve3([
        new THREE.Vector3(xMic, 0.012, b.d * 0.15), new THREE.Vector3(xMic, b.h * 0.6, b.d * 0.12), new THREE.Vector3(xMic, b.h * 0.88, b.d * 0.02),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(kurva, 24, 0.005, 8, false), hitam));
      const kepala = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 14), hitamKilap);
      kepala.scale.set(1, 1.5, 1); kepala.position.set(xMic, b.h * 0.92, -b.d * 0.02); g.add(kepala);
      break;
    }
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
