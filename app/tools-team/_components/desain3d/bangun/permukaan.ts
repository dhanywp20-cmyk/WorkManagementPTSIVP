/**
 * desain3d/bangun/permukaan.ts - Tekstur bahan permukaan: kayu, kain, gril speaker, logam berlubang, dinding aksen, mic boundary, lift.
 * Model dibangun dengan alas di y = 0; ketinggian (elev) diterapkan lewat posisi grup.
 */
import type * as T from 'three';
import { type Finish } from '../inti';
import { acak, kanvas } from './tekstur';

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
export function teksturKayu(THREE: typeof T, fin: Finish, sepanjangZ: boolean): T.Texture {
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

/**
 * Tekstur feature wall: marmer putih berurat abu (slab 1,2 × 2,4 m dengan nat tipis) atau panel
 * kayu walnut. Satu ubin tekstur = satu slab; UV bidang dinding dihitung dalam meter (repeat).
 */
export function teksturDindingAksen(THREE: typeof T, jenis: 'marmer' | 'kayu'): { tex: T.Texture; ubinW: number; ubinH: number } {
  if (jenis === 'kayu') {
    const tex = teksturKayu(THREE, 'walnut', true);
    tex.repeat.set(1, 1);
    return { tex, ubinW: 0.4, ubinH: 1.6 };
  }
  const W = 512, H = 1024;
  const c = kanvas(W, H, g => {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#f4f2ee'); gr.addColorStop(0.5, '#ebe8e2'); gr.addColorStop(1, '#f6f4f0');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const r = acak(77);
    for (let i = 0; i < 14; i++) {
      let x = r() * W, y = 0;
      g.strokeStyle = r() > 0.6 ? 'rgba(120,120,125,0.55)' : 'rgba(160,158,155,0.4)';
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath(); g.moveTo(x, y);
      while (y < H) { x += (r() - 0.5) * 60; y += 20 + r() * 50; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(90,90,90,0.35)'; g.fillRect(0, 0, W, 2); g.fillRect(0, 0, 2, H);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, ubinW: 1.2, ubinH: 2.4 };
}

/** Anyaman kain (jok kursi, soundbar). `ubin` = ukuran satu ubin dalam meter. */
export function teksturKain(THREE: typeof T, dasar: string, ubin: number): T.Texture {
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
export function teksturGril(THREE: typeof T, dasar: string, lubang: string, ulang: number): T.Texture {
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

/**
 * Mic boundary cakram bundar (kain abu-abu berpola konsentris + cincin LED hijau + ikon mic).
 * 'kain' = tutup atas yang berkain; 'ikon' = lapisan transparan cincin & ikon yang menyala.
 * Keduanya dipetakan ke lingkaran: pusat tekstur = pusat cakram, sisi kanvas = tepi cakram.
 */
export function teksturMicBoundary(THREE: typeof T, bagian: 'kain' | 'ikon', dasar = '#6d6e72'): T.Texture {
  const U = 512, C = U / 2;
  const c = kanvas(U, U, g => {
    if (bagian === 'kain') {
      g.fillStyle = dasar; g.fillRect(0, 0, U, U);   // gelap sedikit: pencahayaan adegan menerangkan ~1,4x
      //  Anyaman melingkar: ratusan lingkaran tipis berselang-seling terang/gelap -> pola moire seperti kain asli.
      for (let r = 3; r < C * 1.45; r += 2.1) {
        g.strokeStyle = Math.round(r / 2.1) % 2 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)';
        g.lineWidth = 1; g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke();
      }
      for (let i = 0; i < 1800; i++) { g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'; g.fillRect(Math.random() * U, Math.random() * U, 1.4, 1.4); }
      return;
    }
    const hijau = '#6bf2b0';
    g.shadowColor = '#2dff9a'; g.shadowBlur = 16; g.strokeStyle = hijau; g.fillStyle = hijau;
    g.lineWidth = 13; g.beginPath(); g.arc(C, C, 88, 0, Math.PI * 2); g.stroke();   // cincin LED
    g.shadowBlur = 8; g.lineWidth = 7; g.lineCap = 'round';
    const w = 17;                                                       // ikon mic: kapsul + busur + tiang + dasar
    g.beginPath(); g.moveTo(C - w, C - 22); g.arc(C, C - 22, w, Math.PI, 0); g.lineTo(C + w, C + 4); g.arc(C, C + 4, w, 0, Math.PI); g.closePath(); g.fill();
    g.beginPath(); g.arc(C, C + 4, w + 13, 0.12 * Math.PI, 0.88 * Math.PI); g.stroke();
    g.beginPath(); g.moveTo(C, C + 4 + w + 13); g.lineTo(C, C + 52); g.moveTo(C - 17, C + 52); g.lineTo(C + 17, C + 52); g.stroke();
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/** Layar paperless display lift: halaman masuk sistem rapat. */
export function teksturLift(THREE: typeof T): T.Texture {
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

/** Tekstur pelat besi hitam berlubang oval (bracket videowall), satu ubin = 16 cm, 4 lubang. */
let lubangCache: { h: T.Texture; v: T.Texture } | null = null;

export function teksturBerlubang(THREE: typeof T, tegak: boolean, panjang: number): T.Texture {
  if (!lubangCache) {
    const buat = (v: boolean) => {
      const W = v ? 32 : 128, H = v ? 128 : 32;
      const c = kanvas(W, H, g => {
        g.fillStyle = '#1d2025'; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(255,255,255,0.06)'; if (v) g.fillRect(0, 0, 3, H); else g.fillRect(0, 0, W, 3);
        g.fillStyle = '#040506';
        for (let k = 0; k < 4; k++) {
          const t = k * 32 + 16;
          g.beginPath();
          const [rx, ry, rw, rh] = v ? [11, t - 8, 10, 16] : [t - 8, 11, 16, 10];
          if (typeof g.roundRect === 'function') g.roundRect(rx, ry, rw, rh, 5); else g.rect(rx, ry, rw, rh);
          g.fill();
        }
      });
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return t;
    };
    lubangCache = { h: buat(false), v: buat(true) };
  }
  const t = (tegak ? lubangCache.v : lubangCache.h).clone();
  const n = Math.max(1, panjang / 0.16);
  t.repeat.set(tegak ? 1 : n, tegak ? n : 1);
  return t;
}
