/**
 * desain3d/model.ts - data benda & pembuat model 3D prosedural untuk
 * Desain 3D Ruang AV. Semua geometri dibuat dari primitif three.js
 * (tanpa berkas model luar), jadi ringan, tanpa lisensi pihak ketiga, dan
 * ukurannya selalu mengikuti angka yang diisi engineer.
 *
 * THREE dioper sebagai parameter (bukan di-import di sini) supaya modul ini
 * tidak menarik three.js ke bundel halaman lain - three dimuat dinamis oleh
 * Desain3D.tsx.
 */
import type * as T from 'three';
import { ukuranDariDiagonal } from '@/lib/av-hitung';

export type Jenis =
  | 'led' | 'tv' | 'layar' | 'meja' | 'kursi' | 'speaker' | 'speaker-plafon'
  | 'kamera' | 'proyektor' | 'mic' | 'rak' | 'model';

export interface Benda {
  id: string; jenis: Jenis; nama: string;
  x: number; z: number; /** derajat, 0 = menghadap +z (ke dalam ruangan) */ rot: number;
  /** m */ w: number; h: number; d: number; /** tinggi sisi bawah dari lantai */ elev: number;
  /** TV: diagonal inci */ diag?: number;
  /** LED: pitch mm; ukuran cabinet mm untuk garis cabinet */ pitch?: number; cabW?: number; cabH?: number;
  /** Display: konten di layar ('pola' = pola uji bawaan; 'gambar' = unggahan, tidak disimpan) */ konten?: 'pola' | 'gambar' | 'mati';
  /** Model GLB impor: kunci ke cache objek di memori (tidak disimpan ke perangkat) */ modelKunci?: string;
}

export interface Ruang { p: number; l: number; t: number; lantai: 'kayu' | 'karpet' | 'keramik' }

export const LABEL: Record<Jenis, string> = {
  led: 'LED Videotron', tv: 'TV / Display', layar: 'Layar proyektor', meja: 'Meja', kursi: 'Kursi',
  speaker: 'Speaker dinding', 'speaker-plafon': 'Speaker plafon', kamera: 'Kamera PTZ', proyektor: 'Proyektor',
  mic: 'Mic meja', rak: 'Rak AV', model: 'Model 3D (GLB)',
};
export const DISPLAY: Jenis[] = ['led', 'tv', 'layar'];
export const DAPAT_DITAMBAH: Jenis[] = ['led', 'tv', 'layar', 'meja', 'kursi', 'speaker', 'speaker-plafon', 'kamera', 'proyektor', 'mic', 'rak'];

let nomor = 0;
export const idBaru = () => `b${Date.now().toString(36)}${(nomor++).toString(36)}`;

export function bendaBaru(jenis: Jenis, r: Ruang): Benda {
  const dasar = { id: idBaru(), jenis, nama: LABEL[jenis], x: r.p / 2, z: r.l / 2, rot: 0 };
  switch (jenis) {
    case 'led': return { ...dasar, z: 0.08, w: 4, h: 2.25, d: 0.1, elev: 0.6, pitch: 2.5, cabW: 500, cabH: 500, konten: 'pola' };
    case 'tv': { const u = ukuranDariDiagonal(86); return { ...dasar, z: 0.05, w: u.lebarM, h: u.tinggiM, d: 0.06, elev: 1.0, diag: 86, konten: 'pola' }; }
    case 'layar': return { ...dasar, z: 0.04, w: 3, h: 1.875, d: 0.03, elev: 0.8, konten: 'pola' };
    case 'meja': return { ...dasar, z: r.l * 0.55, w: 1.2, h: 0.75, d: 3.6, elev: 0 };
    case 'kursi': return { ...dasar, z: r.l * 0.8, w: 0.55, h: 1.0, d: 0.55, elev: 0, rot: 180 };
    case 'speaker': return { ...dasar, x: 0.4, z: 0.15, w: 0.26, h: 0.42, d: 0.26, elev: 2.0 };
    case 'speaker-plafon': return { ...dasar, w: 0.24, h: 0.06, d: 0.24, elev: r.t - 0.06 };
    case 'kamera': return { ...dasar, z: 0.15, w: 0.18, h: 0.2, d: 0.18, elev: 0.4 };
    case 'proyektor': return { ...dasar, z: 4, w: 0.45, h: 0.16, d: 0.4, elev: r.t - 0.55, rot: 180 };
    case 'mic': return { ...dasar, z: r.l * 0.55, w: 0.1, h: 0.05, d: 0.1, elev: 0.76 };
    case 'rak': return { ...dasar, x: r.p - 0.45, z: 0.45, w: 0.6, h: 1.2, d: 0.6, elev: 0 };
    case 'model': return { ...dasar, w: 1, h: 1, d: 1, elev: 0 };
  }
}

export function contohAwal(r: Ruang): Benda[] {
  const tv = bendaBaru('tv', r);
  const meja = bendaBaru('meja', r);
  const kam = { ...bendaBaru('kamera', r), elev: tv.elev - 0.3 };
  const kursi: Benda[] = [];
  for (let i = 0; i < 3; i++) {
    for (const sisi of [-1, 1]) {
      kursi.push({ ...bendaBaru('kursi', r), x: r.p / 2 + sisi * 1.05, z: meja.z - 1.1 + i * 1.1, rot: sisi < 0 ? 90 : -90 });
    }
  }
  return [tv, meja, kam, ...kursi, { ...bendaBaru('mic', r), z: meja.z },
    { ...bendaBaru('speaker-plafon', r), z: r.l / 3 }, { ...bendaBaru('speaker-plafon', r), z: (r.l * 2) / 3 }];
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

/** Tanda tangan bentuk: berubah = model perlu dibangun ulang (posisi/rotasi tidak termasuk). */
export const tandaBentuk = (b: Benda) =>
  [b.jenis, b.w, b.h, b.d, b.elev, b.pitch, b.cabW, b.cabH, b.konten, b.modelKunci].join('|');

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

/** Garis sambungan cabinet LED di atas konten. */
function teksturGridLED(THREE: typeof T, kolom: number, baris: number): T.Texture {
  const W = 1024, H = Math.max(64, Math.round((1024 * baris) / Math.max(1, kolom)));
  const c = kanvas(W, Math.min(2048, H), g => {
    g.clearRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2;
    for (let i = 1; i < kolom; i++) { const x = (i * W) / kolom; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let i = 1; i < baris; i++) { const y = (i * H) / baris; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
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
 * Model satu benda. Titik asal = tengah tapak di lantai; sumbu +z = arah
 * hadap. Semua mesh memberi & menerima bayangan.
 */
export function buatModel(b: Benda, bahan: Bahan): T.Group {
  const { THREE } = bahan;
  const g = new THREE.Group();
  const y0 = b.elev;
  const muka = (w: number, h: number, z: number, y: number) => {
    const tex = bahan.layar(b);
    const m = tex
      ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.25, metalness: 0.4 });
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(0, y, z); return o;
  };

  switch (b.jenis) {
    case 'tv': {
      const bezel = mat(THREE, 0x111111, { roughness: 0.35, metalness: 0.5 });
      g.add(kotak(THREE, b.w, b.h, b.d, bezel, 0, y0 + b.h / 2, 0));
      g.add(muka(b.w * 0.975, b.h * 0.955, b.d / 2 + 0.001, y0 + b.h / 2));
      g.add(kotak(THREE, b.w * 0.3, b.h * 0.3, 0.04, mat(THREE, 0x374151), 0, y0 + b.h / 2, -b.d / 2 - 0.02)); // bracket dinding
      break;
    }
    case 'led': {
      const rangka = mat(THREE, 0x1f2937, { metalness: 0.6, roughness: 0.4 });
      g.add(kotak(THREE, b.w, b.h, b.d, rangka, 0, y0 + b.h / 2, 0));
      g.add(muka(b.w, b.h, b.d / 2 + 0.001, y0 + b.h / 2));
      const kol = Math.max(1, Math.round((b.w * 1000) / (b.cabW ?? 500)));
      const bar = Math.max(1, Math.round((b.h * 1000) / (b.cabH ?? 500)));
      const grid = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h),
        new THREE.MeshBasicMaterial({ map: teksturGridLED(THREE, kol, bar), transparent: true, toneMapped: false }));
      grid.position.set(0, y0 + b.h / 2, b.d / 2 + 0.002); g.add(grid);
      if (y0 > 0.05) { // kaki / struktur penyangga lantai
        for (const sx of [-0.35, 0.35]) g.add(kotak(THREE, 0.06, y0, 0.3, rangka, sx * b.w, y0 / 2, -0.05));
      }
      break;
    }
    case 'layar': {
      g.add(kotak(THREE, b.w + 0.12, b.h + 0.12, b.d, mat(THREE, 0x111827), 0, y0 + b.h / 2, 0));
      const tex = bahan.layar(b);
      const m = tex ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : mat(THREE, 0xf8fafc, { roughness: 0.9 });
      const kain = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), m);
      kain.position.set(0, y0 + b.h / 2, b.d / 2 + 0.001); g.add(kain);
      g.add(kotak(THREE, b.w + 0.3, 0.12, 0.14, mat(THREE, 0xe5e7eb), 0, y0 + b.h + 0.12, 0)); // casing gulung
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
      g.add(kotak(THREE, b.w, b.h, b.d, mat(THREE, 0x111827, { roughness: 0.8 }), 0, y0 + b.h / 2, 0));
      const cone = mat(THREE, 0x374151, { roughness: 0.5 });
      const woofer = new THREE.Mesh(new THREE.CylinderGeometry(b.w * 0.36, b.w * 0.36, 0.02, 28), cone);
      woofer.rotation.x = Math.PI / 2; woofer.position.set(0, y0 + b.h * 0.33, b.d / 2 + 0.005); g.add(woofer);
      const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(b.w * 0.13, b.w * 0.13, 0.02, 20), cone);
      tweeter.rotation.x = Math.PI / 2; tweeter.position.set(0, y0 + b.h * 0.78, b.d / 2 + 0.005); g.add(tweeter);
      g.add(kotak(THREE, 0.05, 0.12, 0.2, mat(THREE, 0x6b7280), 0, y0 + b.h / 2, -b.d / 2 - 0.08)); // bracket
      break;
    }
    case 'speaker-plafon': {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(b.w / 2 + 0.015, b.w / 2 + 0.015, 0.012, 32), mat(THREE, 0xf8fafc)).translateY(y0 + b.h - 0.006));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(b.w / 2, b.w / 2, b.h, 32), mat(THREE, 0xd1d5db, { metalness: 0.4 })).translateY(y0 + b.h / 2));
      break;
    }
    case 'kamera': {
      const putih = mat(THREE, 0xf3f4f6, { roughness: 0.4 });
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(b.w / 2, b.w / 2, b.h * 0.3, 24), putih).translateY(y0 + b.h * 0.15));
      const kepala = kotak(THREE, b.w * 0.8, b.h * 0.55, b.d * 0.75, putih, 0, y0 + b.h * 0.62, 0); g.add(kepala);
      const lensa = new THREE.Mesh(new THREE.CylinderGeometry(b.w * 0.2, b.w * 0.2, 0.04, 24), mat(THREE, 0x0f172a, { metalness: 0.8, roughness: 0.15 }));
      lensa.rotation.x = Math.PI / 2; lensa.position.set(0, y0 + b.h * 0.62, b.d * 0.4); g.add(lensa);
      break;
    }
    case 'proyektor': {
      g.add(kotak(THREE, b.w, b.h, b.d, mat(THREE, 0xf3f4f6, { roughness: 0.5 }), 0, y0 + b.h / 2, 0));
      const lensa = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 24), mat(THREE, 0x111827, { metalness: 0.8, roughness: 0.2 }));
      lensa.rotation.x = Math.PI / 2; lensa.position.set(b.w * 0.25, y0 + b.h / 2, b.d / 2 + 0.03); g.add(lensa);
      break;
    }
    case 'mic': {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(b.w / 2, b.w / 2 + 0.01, b.h, 28), mat(THREE, 0x111827, { metalness: 0.5 })).translateY(y0 + b.h / 2));
      break;
    }
    case 'rak': {
      const besi = mat(THREE, 0x111827, { metalness: 0.6, roughness: 0.4 });
      g.add(kotak(THREE, b.w, b.h, b.d, besi, 0, b.h / 2, 0));
      const unit = mat(THREE, 0x374151, { metalness: 0.5 });
      const n = Math.max(2, Math.floor(b.h / 0.18));
      for (let i = 0; i < n; i++) {
        g.add(kotak(THREE, b.w * 0.9, 0.12, 0.02, unit, 0, 0.12 + i * (b.h - 0.2) / n, b.d / 2 + 0.01));
        g.add(kotak(THREE, 0.03, 0.015, 0.005, mat(THREE, 0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 0.8 }), b.w * 0.35, 0.12 + i * (b.h - 0.2) / n, b.d / 2 + 0.021));
      }
      break;
    }
    case 'model': {
      const asli = b.modelKunci ? bahan.model(b.modelKunci) : null;
      if (asli) {
        const salinan = asli.clone(true);
        //  Skala agar muat di kotak w×h×d, alas di lantai (elev).
        const kotakB = new THREE.Box3().setFromObject(salinan);
        const s = kotakB.getSize(new THREE.Vector3());
        const k = Math.min(b.w / Math.max(1e-3, s.x), b.h / Math.max(1e-3, s.y), b.d / Math.max(1e-3, s.z));
        salinan.scale.multiplyScalar(k);
        const k2 = new THREE.Box3().setFromObject(salinan); const c = k2.getCenter(new THREE.Vector3());
        salinan.position.sub(new THREE.Vector3(c.x, k2.min.y - y0, c.z));
        g.add(salinan);
      } else {
        g.add(kotak(THREE, b.w, b.h, b.d, mat(THREE, 0xa855f7, { transparent: true, opacity: 0.5 }), 0, y0 + b.h / 2, 0));
      }
      break;
    }
  }
  g.traverse(o => { if ((o as T.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Tiang plafon proyektor - dibuat terpisah karena butuh tinggi plafon. */
export function tiangPlafon(THREE: typeof T, b: Benda, tinggiPlafon: number): T.Object3D | null {
  if (b.jenis !== 'proyektor') return null;
  const panjang = Math.max(0.02, tinggiPlafon - (b.elev + b.h));
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, panjang, 12), new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.8, roughness: 0.3 }));
  m.position.y = b.elev + b.h + panjang / 2; m.castShadow = true;
  return m;
}
