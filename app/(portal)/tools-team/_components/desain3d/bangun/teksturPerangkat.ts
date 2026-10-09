/**
 * desain3d/bangun/teksturPerangkat.ts - Isi layar perangkat (kanvas kecil, ≤ 512 px): desktop
 * (wallpaper, jendela aplikasi, taskbar) untuk PC & laptop; home screen (ikon aplikasi, dock) untuk
 * HP & tablet. Dibuat per model (dibuang bersama modelnya - tidak dibagi antar model).
 */
import type * as T from 'three';

function kanvas(w: number, h: number, gambar: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (g) gambar(g);
  return c;
}

function kotakBulat(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

const WARNA_IKON = ['#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

/** Layar desktop (rasio = lebar / tinggi layar). */
export function teksturDesktop(THREE: typeof T, rasio: number): T.Texture {
  const W = 512, H = Math.max(128, Math.round(W / Math.max(0.5, rasio)));
  const c = kanvas(W, H, g => {
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0f3d7a'); bg.addColorStop(0.55, '#1d6fb8'); bg.addColorStop(1, '#22b8c9');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    //  Lengkung cahaya wallpaper.
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = H * 0.05;
    g.beginPath(); g.ellipse(W * 0.7, H * 1.05, W * 0.6, H * 0.55, 0, Math.PI, Math.PI * 2); g.stroke();
    //  Jendela aplikasi (presentasi): bar judul, slide, panel samping.
    const x = W * 0.12, y = H * 0.1, w = W * 0.62, h = H * 0.66;
    g.fillStyle = '#f8fafc'; kotakBulat(g, x, y, w, h, 6); g.fill();
    g.fillStyle = '#e2e8f0'; g.fillRect(x, y, w, h * 0.08);
    ['#ef4444', '#f59e0b', '#22c55e'].forEach((wn, i) => { g.fillStyle = wn; g.beginPath(); g.arc(x + 10 + i * 12, y + h * 0.04, 3.5, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#cbd5e1'; g.fillRect(x + w * 0.03, y + h * 0.13, w * 0.18, h * 0.8);
    g.fillStyle = '#1e3a8a'; g.fillRect(x + w * 0.25, y + h * 0.13, w * 0.72, h * 0.5);
    g.fillStyle = '#fbbf24'; g.fillRect(x + w * 0.3, y + h * 0.2, w * 0.3, h * 0.05);
    g.fillStyle = '#93c5fd'; for (let i = 0; i < 3; i++) g.fillRect(x + w * 0.3, y + h * (0.3 + i * 0.08), w * (0.5 - i * 0.1), h * 0.035);
    g.fillStyle = '#94a3b8'; for (let i = 0; i < 3; i++) g.fillRect(x + w * 0.25, y + h * (0.68 + i * 0.09), w * 0.7, h * 0.04);
    //  Taskbar.
    g.fillStyle = 'rgba(15,23,42,0.85)'; g.fillRect(0, H * 0.92, W, H * 0.08);
    for (let i = 0; i < 7; i++) { g.fillStyle = WARNA_IKON[i]; kotakBulat(g, W * 0.36 + i * H * 0.075, H * 0.935, H * 0.05, H * 0.05, 3); g.fill(); }
    g.fillStyle = '#e2e8f0'; g.font = `${Math.round(H * 0.035)}px Arial`; g.textAlign = 'right'; g.fillText('09:41', W * 0.98, H * 0.972);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Home screen HP / tablet (rasio = lebar / tinggi layar, < 1 = tegak). */
export function teksturHomeScreen(THREE: typeof T, rasio: number): T.Texture {
  const H = 512, W = Math.max(160, Math.round(H * Math.min(2, rasio)));
  const c = kanvas(W, H, g => {
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#312e81'); bg.addColorStop(0.5, '#7c3aed'); bg.addColorStop(1, '#f472b6');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff'; g.textAlign = 'center';
    g.font = `bold ${Math.round(H * 0.075)}px Arial`; g.fillText('09:41', W / 2, H * 0.16);
    g.font = `${Math.round(H * 0.028)}px Arial`; g.fillText('Kamis, 9 Oktober', W / 2, H * 0.205);
    const kol = rasio > 1 ? 6 : 4, s = Math.min(W / (kol + 1.5), H * 0.1), jarak = (W - kol * s) / (kol + 1);
    for (let j = 0; j < 4; j++) for (let i = 0; i < kol; i++) {
      g.fillStyle = WARNA_IKON[(i + j * kol) % WARNA_IKON.length];
      kotakBulat(g, jarak + i * (s + jarak), H * 0.28 + j * s * 1.45, s, s, s * 0.24); g.fill();
    }
    //  Dock.
    g.fillStyle = 'rgba(255,255,255,0.28)'; kotakBulat(g, W * 0.06, H * 0.86, W * 0.88, s * 1.3, s * 0.4); g.fill();
    for (let i = 0; i < 4; i++) { g.fillStyle = ['#22c55e', '#3b82f6', '#f8fafc', '#f59e0b'][i]; kotakBulat(g, W * 0.1 + i * (W * 0.8 / 4) + (W * 0.2 - s) / 2, H * 0.86 + s * 0.15, s, s, s * 0.24); g.fill(); }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
