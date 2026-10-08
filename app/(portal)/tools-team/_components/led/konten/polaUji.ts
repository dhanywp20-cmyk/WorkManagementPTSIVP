/**
 * Pola uji LED pada resolusi asli layar - diputar dari media player / controller saat commissioning:
 *   grid   kotak per cabinet + label K1B1 (cek urutan mapping & cabinet tertukar), diagonal & lingkaran
 *          (cek skala/rasio), garis tepi 1 px (cek piksel terpotong di pinggir)
 *   warna  bar warna + gradasi abu & RGB (cek kalibrasi, banding warna, kedalaman bit)
 *   polos  satu warna penuh (cek piksel mati / modul belang)
 * Digambar di koordinat piksel asli; pratinjau memakai skala yang sama.
 */
import { garisCabinet, labelCabinet } from '@/lib/led-banding';

export type JenisPola = 'grid' | 'warna' | 'polos';
export const WARNA_POLOS: { v: string; l: string }[] = [
  { v: '#ffffff', l: 'Putih' }, { v: '#ff0000', l: 'Merah' }, { v: '#00ff00', l: 'Hijau' }, { v: '#0000ff', l: 'Biru' }, { v: '#000000', l: 'Hitam' }, { v: '#808080', l: 'Abu 50%' },
];

export interface PolaUji { resX: number; resY: number; kolom: number; baris: number; pxCabX: number; pxCabY: number; jenis: JenisPola; warna: string; judul: string }

function gambarGrid(c: CanvasRenderingContext2D, p: PolaUji) {
  const { resX: W, resY: H } = p;
  for (let r = 0; r < p.baris; r++) for (let k = 0; k < p.kolom; k++) {
    c.fillStyle = (r + k) % 2 ? '#1e293b' : '#0f172a';
    c.fillRect(k * p.pxCabX, r * p.pxCabY, p.pxCabX, p.pxCabY);
  }
  const g = garisCabinet(p.kolom, p.baris, p.pxCabX, p.pxCabY);
  c.fillStyle = '#e2e8f0';
  for (const x of g.x) c.fillRect(Math.min(x, W - 1), 0, 1, H);
  for (const y of g.y) c.fillRect(0, Math.min(y, H - 1), W, 1);
  //  Diagonal + lingkaran: harus lurus & bulat sempurna bila skala/rasio benar.
  const tebal = Math.max(1, Math.round(Math.min(W, H) / 400));
  c.lineWidth = tebal;
  c.strokeStyle = '#ef4444';
  c.beginPath(); c.moveTo(0, 0); c.lineTo(W, H); c.moveTo(W, 0); c.lineTo(0, H); c.stroke();
  c.strokeStyle = '#22c55e';
  c.beginPath(); c.arc(W / 2, H / 2, Math.min(W, H) * 0.45, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#facc15';
  const s = Math.min(W, H) * 0.06;
  c.beginPath(); c.moveTo(W / 2 - s, H / 2); c.lineTo(W / 2 + s, H / 2); c.moveTo(W / 2, H / 2 - s); c.lineTo(W / 2, H / 2 + s); c.stroke();
  //  Tepi 1 px warna mencolok di keempat sisi.
  c.fillStyle = '#f0f';
  c.fillRect(0, 0, W, 1); c.fillRect(0, H - 1, W, 1); c.fillRect(0, 0, 1, H); c.fillRect(W - 1, 0, 1, H);
  //  Label tiap cabinet (dilewati bila terlalu kecil untuk terbaca).
  const fs = Math.floor(Math.min(p.pxCabX, p.pxCabY) * 0.22);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (fs >= 7) {
    c.font = `bold ${fs}px Arial, sans-serif`;
    c.fillStyle = '#93c5fd';
    for (let r = 0; r < p.baris; r++) for (let k = 0; k < p.kolom; k++) c.fillText(labelCabinet(k, r), k * p.pxCabX + p.pxCabX / 2, r * p.pxCabY + p.pxCabY / 2);
  }
  const fj = Math.max(10, Math.floor(Math.min(W, H) / 22));
  c.font = `bold ${fj}px Arial, sans-serif`;
  const teks = `${p.judul} · ${W} × ${H} px · ${p.kolom} × ${p.baris}`;
  const lebar = c.measureText(teks).width + fj;
  c.fillStyle = 'rgba(0,0,0,.75)';
  c.fillRect(W / 2 - lebar / 2, H / 2 + s + fj * 0.3, lebar, fj * 1.5);
  c.fillStyle = '#fff';
  c.fillText(teks, W / 2, H / 2 + s + fj * 1.05);
}

function gambarWarna(c: CanvasRenderingContext2D, p: PolaUji) {
  const { resX: W, resY: H } = p;
  const bar = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff', '#000000'];
  const tBar = Math.round(H * 0.6);
  bar.forEach((w, i) => { c.fillStyle = w; c.fillRect(Math.round((i * W) / bar.length), 0, Math.ceil(W / bar.length), tBar); });
  //  4 gradasi: abu, merah, hijau, biru - banding/garis bertangga = kedalaman bit / kalibrasi kurang.
  const ramp = ['255,255,255', '255,0,0', '0,255,0', '0,0,255'];
  const tR = (H - tBar) / ramp.length;
  ramp.forEach((rgb, i) => {
    const gr = c.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, 'rgb(0,0,0)'); gr.addColorStop(1, `rgb(${rgb})`);
    c.fillStyle = gr; c.fillRect(0, Math.round(tBar + i * tR), W, Math.ceil(tR));
  });
}

export function gambarPola(c: CanvasRenderingContext2D, p: PolaUji) {
  c.imageSmoothingEnabled = false;
  if (p.jenis === 'grid') gambarGrid(c, p);
  else if (p.jenis === 'warna') gambarWarna(c, p);
  else { c.fillStyle = p.warna; c.fillRect(0, 0, p.resX, p.resY); }
}

/** Kanvas pola uji; skala < 1 untuk pratinjau (koordinat gambar tetap piksel asli). */
export function kanvasPola(p: PolaUji, skala = 1, kanvas?: HTMLCanvasElement): HTMLCanvasElement {
  const k = kanvas ?? document.createElement('canvas');
  k.width = Math.max(1, Math.round(p.resX * skala));
  k.height = Math.max(1, Math.round(p.resY * skala));
  const c = k.getContext('2d');
  if (!c) throw new Error('Kanvas tidak tersedia');
  c.setTransform(skala, 0, 0, skala, 0, 0);
  gambarPola(c, p);
  return k;
}
