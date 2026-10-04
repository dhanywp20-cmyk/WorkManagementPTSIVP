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
  | 'model';

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
  /** Display: konten di layar ('pola' = pola uji bawaan; 'gambar' = unggahan, tidak disimpan) */ konten?: 'pola' | 'gambar' | 'mati';
  /** Model GLB impor: kunci ke cache objek di memori (tidak disimpan ke perangkat) */ modelKunci?: string;
}

export interface Ruang {
  p: number; l: number; t: number; lantai: 'kayu' | 'karpet' | 'keramik';
  /** Ruang ke-2 bersebelahan di sisi kanan (x = p .. p + r2.p). */
  r2?: { aktif: boolean; p: number; l: number; t: number; lantai: Ruang['lantai']; pintu: boolean } | null;
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
  kamera: 'Kamera PTZ', proyektor: 'Proyektor', rak: 'Rack server', model: 'Model 3D (GLB)',
};
export const DISPLAY: Jenis[] = ['videowall', 'led', 'layar', 'ifp', 'tv'];
/** Benda yang bisa ditempel ke dinding (sisi belakang menyentuh dinding). */
export const BISA_TEMPEL: Jenis[] = ['videowall', 'led', 'layar', 'ifp', 'tv', 'speaker', 'kamera', 'rak', 'meja', 'model'];

export interface ItemKatalog { kunci: string; label: string; ket: string; jenis: Jenis; atur?: Partial<Benda> }

export const KATALOG: { grup: string; item: ItemKatalog[] }[] = [
  {
    grup: 'Display', item: [
      { kunci: 'vw55', label: 'Videowall 55"', ket: 'Philips 55BDL2105X · 2×2', jenis: 'videowall', atur: { vw: '55BDL2105X', kol: 2, bar: 2 } },
      { kunci: 'vw49', label: 'Videowall 49"', ket: 'Philips 49BDL2105X · 2×2', jenis: 'videowall', atur: { vw: '49BDL2105X', kol: 2, bar: 2 } },
      { kunci: 'led', label: 'LED Videotron', ket: 'Pitch & cabinet bebas', jenis: 'led' },
      { kunci: 'layar', label: 'Layar proyektor', ket: '100" / 120" / 200" · 16:9 / 4:3', jenis: 'layar' },
      { kunci: 'ifp-d', label: 'Interactive display', ket: '65" / 75" / 86" · dinding', jenis: 'ifp', atur: { pasang: 'dinding' } },
      { kunci: 'ifp-s', label: 'Interactive standfloor', ket: '65" / 75" / 86" · troli', jenis: 'ifp', atur: { pasang: 'standfloor' } },
      { kunci: 'tv', label: 'TV / Display', ket: 'Diagonal bebas', jenis: 'tv' },
    ],
  },
  {
    grup: 'Audio & kontrol', item: [
      { kunci: 'mic-g', label: 'Mic gooseneck', ket: 'Di meja', jenis: 'mic', atur: { mic: 'gooseneck' } },
      { kunci: 'mic-b', label: 'Mic boundary', ket: 'Di meja', jenis: 'mic', atur: { mic: 'boundary' } },
      { kunci: 'spk', label: 'Speaker dinding', ket: 'Bracket dinding', jenis: 'speaker' },
      { kunci: 'spk-p', label: 'Speaker plafon', ket: 'In-ceiling', jenis: 'speaker-plafon' },
      { kunci: 'tp', label: 'Touch panel', ket: 'Kontrol di meja', jenis: 'touchpanel' },
      { kunci: 'kam', label: 'Kamera PTZ', ket: 'Konferensi', jenis: 'kamera' },
      { kunci: 'proj', label: 'Proyektor', ket: 'Gantung plafon', jenis: 'proyektor' },
      { kunci: 'rak', label: 'Rack server', ket: '12U - 42U', jenis: 'rak' },
    ],
  },
  {
    grup: 'Furnitur', item: [
      { kunci: 'meja', label: 'Meja', ket: 'Meja rapat', jenis: 'meja' },
      { kunci: 'kursi', label: 'Kursi', ket: 'Posisi penonton', jenis: 'kursi' },
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
    case 'meja': return { ...dasar, z: k.l * 0.55, w: 1.2, h: 0.75, d: 3.6, elev: 0, ...atur };
    case 'kursi': return { ...dasar, z: k.l * 0.8, w: 0.55, h: 1.0, d: 0.55, elev: 0, rot: 180, ...atur };
    case 'speaker': return { ...dasar, x: k.x0 + 0.4, z: 0.15, w: 0.26, h: 0.42, d: 0.26, elev: 2.0, ...atur };
    case 'speaker-plafon': return { ...dasar, w: 0.24, h: 0.06, d: 0.24, elev: k.t - 0.06, ...atur };
    case 'mic': return (atur.mic ?? 'gooseneck') === 'boundary'
      ? { ...dasar, z: k.l * 0.55, w: 0.09, h: 0.025, d: 0.09, elev: 0.75, mic: 'boundary', nama: 'Mic boundary', ...atur }
      : { ...dasar, z: k.l * 0.55, w: 0.12, h: 0.42, d: 0.12, elev: 0.75, mic: 'gooseneck', nama: 'Mic gooseneck', ...atur };
    case 'touchpanel': return { ...dasar, z: k.l * 0.4, w: 0.26, h: 0.16, d: 0.17, elev: 0.75, rot: 180, ...atur };
    case 'kamera': return { ...dasar, z: 0.15, w: 0.18, h: 0.2, d: 0.18, elev: 0.4, ...atur };
    case 'proyektor': return { ...dasar, z: 4, w: 0.45, h: 0.16, d: 0.4, elev: k.t - 0.55, rot: 180, ...atur };
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
  [b.jenis, b.w, b.h, b.d, b.pitch, b.cabW, b.cabH, b.vw, b.kol, b.bar, b.pasang, b.rakU, b.mic, b.konten, b.modelKunci].join('|');

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
      const kayu = mat(THREE, 0x8b5a2b, { roughness: 0.45 });
      g.add(kotak(THREE, b.w, 0.04, b.d, kayu, 0, b.h - 0.02, 0));
      const kaki = mat(THREE, 0x52525b, { metalness: 0.7, roughness: 0.3 });
      g.add(kotak(THREE, 0.06, b.h - 0.04, b.d * 0.7, kaki, -b.w / 2 + 0.12, (b.h - 0.04) / 2, 0));
      g.add(kotak(THREE, 0.06, b.h - 0.04, b.d * 0.7, kaki, b.w / 2 - 0.12, (b.h - 0.04) / 2, 0));
      g.add(kotak(THREE, 0.18, 0.02, 0.12, mat(THREE, 0x111827), 0, b.h + 0.01, 0)); // kotak colokan meja
      break;
    }
    case 'kursi': {
      const jok = mat(THREE, 0x1f2937, { roughness: 0.85 });
      const besi = mat(THREE, 0x9ca3af, { metalness: 0.8, roughness: 0.3 });
      g.add(kotak(THREE, b.w, 0.08, b.d * 0.9, jok, 0, 0.47, 0));
      const sandaran = kotak(THREE, b.w * 0.95, 0.5, 0.06, jok, 0, 0.78, -b.d * 0.42); sandaran.rotation.x = -0.12; g.add(sandaran);
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.38, 12), besi).translateY(0.24));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const lengan = kotak(THREE, 0.3, 0.025, 0.04, besi, Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15);
        lengan.rotation.y = -a; g.add(lengan);
      }
      for (const sx of [-1, 1]) g.add(kotak(THREE, 0.04, 0.03, b.d * 0.55, jok, sx * (b.w / 2 - 0.02), 0.66, -0.02));
      break;
    }
    case 'speaker': {
      g.add(kotak(THREE, b.w, b.h, b.d, mat(THREE, 0x111827, { roughness: 0.8 }), 0, b.h / 2, 0));
      const cone = mat(THREE, 0x374151, { roughness: 0.5 });
      const woofer = new THREE.Mesh(new THREE.CylinderGeometry(b.w * 0.36, b.w * 0.36, 0.02, 28), cone);
      woofer.rotation.x = Math.PI / 2; woofer.position.set(0, b.h * 0.33, b.d / 2 + 0.005); g.add(woofer);
      const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(b.w * 0.13, b.w * 0.13, 0.02, 20), cone);
      tweeter.rotation.x = Math.PI / 2; tweeter.position.set(0, b.h * 0.78, b.d / 2 + 0.005); g.add(tweeter);
      g.add(kotak(THREE, 0.05, 0.12, 0.2, mat(THREE, 0x6b7280), 0, b.h / 2, -b.d / 2 - 0.08)); // bracket
      break;
    }
    case 'speaker-plafon': {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(b.w / 2 + 0.015, b.w / 2 + 0.015, 0.012, 32), mat(THREE, 0xf8fafc)).translateY(b.h - 0.006));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(b.w / 2, b.w / 2, b.h, 32), mat(THREE, 0xd1d5db, { metalness: 0.4 })).translateY(b.h / 2));
      break;
    }
    case 'kamera': {
      const putih = mat(THREE, 0xf3f4f6, { roughness: 0.4 });
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(b.w / 2, b.w / 2, b.h * 0.3, 24), putih).translateY(b.h * 0.15));
      g.add(kotak(THREE, b.w * 0.8, b.h * 0.55, b.d * 0.75, putih, 0, b.h * 0.62, 0));
      const lensa = new THREE.Mesh(new THREE.CylinderGeometry(b.w * 0.2, b.w * 0.2, 0.04, 24), mat(THREE, 0x0f172a, { metalness: 0.8, roughness: 0.15 }));
      lensa.rotation.x = Math.PI / 2; lensa.position.set(0, b.h * 0.62, b.d * 0.4); g.add(lensa);
      break;
    }
    case 'proyektor': {
      g.add(kotak(THREE, b.w, b.h, b.d, mat(THREE, 0xf3f4f6, { roughness: 0.5 }), 0, b.h / 2, 0));
      const lensa = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 24), mat(THREE, 0x111827, { metalness: 0.8, roughness: 0.2 }));
      lensa.rotation.x = Math.PI / 2; lensa.position.set(b.w * 0.25, b.h / 2, b.d / 2 + 0.03); g.add(lensa);
      g.add(batang(THREE, 0.04, 0.04, mat(THREE, 0x9ca3af, { metalness: 0.8, roughness: 0.3 }), 0, 0, 'tiang', 0, true));
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
      const badan = mat(THREE, 0x1f2937, { metalness: 0.4, roughness: 0.4 });
      g.add(kotak(THREE, b.w * 0.6, 0.025, b.d * 0.7, badan, 0, 0.0125, -b.d * 0.1)); // alas
      const layar = new THREE.Group();
      layar.add(kotak(THREE, b.w, b.h, 0.012, badan, 0, 0, 0));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 0.92, b.h * 0.88), new THREE.MeshBasicMaterial({ map: teksturPanel(THREE), toneMapped: false }));
      m.position.z = 0.007; layar.add(m);
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
    }
  }
}
