import { type Ruang, warnaSah } from '../inti/index';
import type * as T from 'three';
/** Tekstur kanvas procedural (lantai, layar, rack, lampu) (dipisah dari model.ts). */

export function kanvas(w: number, h: number, gambar: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
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
export function acak(benih: number) {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gradasi bundar untuk kolam cahaya lampu di lantai. */
let kolamCache: T.Texture | null = null;

export function teksturKolamCahaya(THREE: typeof T): T.Texture {
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
export function teksturGrid(THREE: typeof T, kolom: number, baris: number, tebal = 2, warna = 'rgba(0,0,0,0.55)'): T.Texture {
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
export function teksturPanel(THREE: typeof T): T.Texture {
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
