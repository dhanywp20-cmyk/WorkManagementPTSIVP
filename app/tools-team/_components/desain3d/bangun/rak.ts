/** Tekstur isi rack: gambar muka perangkat per U (switch, amplifier, matrix, server ...). */
import { type Benda, susunRak } from '../inti/index';
import { acak, kanvas } from './tekstur';
import type * as T from 'three';

/**
 * Isi rack tampak depan (1 U = 48 px): patch panel, switch, server, NAS, amplifier, DSP,
 * matrix, cable manager, blank panel, dan UPS di bawah - lengkap dengan port & LED.
 */
/** Tekstur isi rack dari rack elevation (perangkat per U dari atas; sisa U = blank panel). */
export function teksturIsiRak(THREE: typeof T, b: Benda): T.Texture {
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
