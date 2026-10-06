/** Tekstur kanvas procedural (lantai, layar, rack, lampu) (dipisah dari model.ts). */
import type * as T from 'three';
import { warnaSah, type Benda, type Ruang } from '../inti';
import { susunRak } from '../inti';


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
const kotakBulat = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath();
  if (typeof g.roundRect === 'function') g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
};

/** Satu kamera CCTV: jalan dari sudut tinggi dengan marka & kendaraan, label kamera, REC, cap waktu. */
function gambarCCTV(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, no: number) {
  const r = acak(no * 977 + 13);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = ['#6f7a5f', '#7a7c70', '#66705c', '#7f8173'][no % 4]; g.fillRect(x, y, w, h);
  for (let i = 0; i < 22; i++) {
    g.fillStyle = `rgba(${(35 + r() * 40) | 0},${(70 + r() * 50) | 0},${(35 + r() * 30) | 0},0.6)`;
    g.beginPath(); g.ellipse(x + r() * w, y + r() * h * 0.55, w * (0.03 + r() * 0.06), h * (0.03 + r() * 0.05), 0, 0, Math.PI * 2); g.fill();
  }
  //  Jalan: trapesium perspektif menuju titik hilang.
  const hx = x + w * (0.3 + r() * 0.4), hy = y + h * (0.04 + r() * 0.16), la = w * (0.07 + r() * 0.08);
  const kiri = x - w * (0.05 + r() * 0.2), kanan = x + w * (1.05 + r() * 0.2), bawah = y + h;
  const titik = (f: number, t: number) => [(hx - la + f * 2 * la) * (1 - t) + (kiri + f * (kanan - kiri)) * t, hy * (1 - t) + bawah * t];
  g.fillStyle = '#585c63';
  g.beginPath(); g.moveTo(kiri, bawah); g.lineTo(hx - la, hy); g.lineTo(hx + la, hy); g.lineTo(kanan, bawah); g.closePath(); g.fill();
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.07})`; g.fillRect(x + r() * w, hy + r() * (bawah - hy), 2, 2); }
  g.strokeStyle = 'rgba(235,235,235,0.85)'; g.lineWidth = Math.max(1, w * 0.006);
  for (const f of [0.04, 0.25, 0.5, 0.75, 0.96]) {
    g.setLineDash(f === 0.04 || f === 0.96 ? [] : [w * 0.035, w * 0.03]);
    const [x0, y0] = titik(f, 0.02), [x1, y1] = titik(f, 1);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  g.setLineDash([]);
  //  Kendaraan: makin dekat makin besar.
  const warna = ['#f8fafc', '#cbd5e1', '#111827', '#b91c1c', '#1d4ed8', '#6b7280', '#e5e7eb', '#334155'];
  const mobil = 5 + Math.floor(r() * 7);
  for (let i = 0; i < mobil; i++) {
    const f = [0.125, 0.375, 0.625, 0.875][Math.floor(r() * 4)], t = 0.12 + r() * 0.85;
    const [px, py] = titik(f, t);
    const lw = w * (0.012 + 0.07 * t), lh = lw * (1.4 + r() * 0.5);
    const motor = r() < 0.25;
    g.fillStyle = 'rgba(0,0,0,0.25)'; kotakBulat(g, px - lw / 2 + lw * 0.08, py - lh / 2 + lh * 0.08, motor ? lw * 0.35 : lw, lh, lw * 0.2); g.fill();
    g.fillStyle = warna[Math.floor(r() * warna.length)];
    kotakBulat(g, px - lw / 2, py - lh / 2, motor ? lw * 0.35 : lw, lh, lw * 0.2); g.fill();
    if (!motor) { g.fillStyle = 'rgba(15,23,42,0.75)'; g.fillRect(px - lw * 0.38, py - lh * 0.25, lw * 0.76, lh * 0.2); }
  }
  //  Nuansa kamera: sedikit pudar + vignet.
  g.fillStyle = 'rgba(30,41,59,0.10)'; g.fillRect(x, y, w, h);
  const vg = g.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = vg; g.fillRect(x, y, w, h);
  const f = Math.max(8, h * 0.075);
  g.font = `600 ${f}px sans-serif`; g.textBaseline = 'top';
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x + f * 0.4, y + f * 0.4, g.measureText(`CAM ${String(no + 1).padStart(2, '0')}`).width + f * 0.6, f * 1.3);
  g.fillStyle = '#ffffff'; g.fillText(`CAM ${String(no + 1).padStart(2, '0')}`, x + f * 0.7, y + f * 0.55);
  g.fillStyle = '#ef4444'; g.beginPath(); g.arc(x + w - f * 2.6, y + f * 1.05, f * 0.32, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.fillText('REC', x + w - f * 2.1, y + f * 0.55);
  g.font = `${f * 0.85}px monospace`; g.textBaseline = 'bottom'; g.textAlign = 'right';
  g.fillText(`2026-10-06 10:${String(10 + (no * 7) % 49).padStart(2, '0')}:${String((no * 13) % 60).padStart(2, '0')}`, x + w - f * 0.5, y + h - f * 0.4);
  g.textAlign = 'left';
  g.restore();
  g.strokeStyle = '#0b0f14'; g.lineWidth = Math.max(1, w * 0.006); g.strokeRect(x, y, w, h);
}

/** Satu kartu grafik dashboard (donut, batang bertumpuk, batang mendatar, area, angka). */
function gambarWidget(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, jenis: number, r: () => number, gelap: boolean) {
  const kartu = gelap ? '#111827' : '#ffffff', garis = gelap ? '#1f2937' : '#e2e8f0', teks = gelap ? '#e5e7eb' : '#334155';
  const biru = ['#2563eb', '#0ea5e9', '#22c55e', '#f59e0b', '#a855f7', '#ef4444'];
  g.fillStyle = kartu; g.fillRect(x, y, w, h); g.strokeStyle = garis; g.lineWidth = Math.max(1, w * 0.004); g.strokeRect(x, y, w, h);
  const f = Math.max(7, Math.min(w, h) * 0.07);
  g.fillStyle = teks; g.font = `600 ${f}px sans-serif`; g.textBaseline = 'top';
  g.fillText(['Status perangkat', 'Kejadian per jam', 'Lalu lintas per ruas', 'Tren harian', 'Ringkasan', 'Kapasitas'][jenis % 6], x + f * 0.6, y + f * 0.5);
  const ix = x + f * 0.8, iy = y + f * 2.2, iw = w - f * 1.6, ih = h - f * 3;
  switch (jenis % 6) {
    case 0: {
      const cx = ix + iw * 0.35, cy = iy + ih / 2, rr = Math.min(iw * 0.3, ih * 0.45);
      let a0 = -Math.PI / 2;
      [0.45, 0.25, 0.18, 0.12].forEach((v, i) => {
        g.strokeStyle = biru[i]; g.lineWidth = rr * 0.35; g.beginPath(); g.arc(cx, cy, rr * 0.8, a0, a0 + v * Math.PI * 2); g.stroke(); a0 += v * Math.PI * 2;
      });
      g.fillStyle = teks; g.font = `700 ${rr * 0.45}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(20 + Math.floor(r() * 70)), cx, cy); g.textAlign = 'left';
      for (let i = 0; i < 4; i++) { g.fillStyle = biru[i]; g.fillRect(ix + iw * 0.72, iy + ih * (0.2 + i * 0.18), f * 0.8, f * 0.8); g.fillStyle = teks; g.font = `${f * 0.8}px sans-serif`; g.textBaseline = 'top'; g.fillText(['Aktif', 'Siaga', 'Rawat', 'Mati'][i], ix + iw * 0.72 + f, iy + ih * (0.2 + i * 0.18)); }
      break;
    }
    case 1: {
      const n = 6, bw = iw / (n * 1.6);
      for (let i = 0; i < n; i++) {
        let yy = iy + ih;
        for (let k = 0; k < 4; k++) { const hh = ih * (0.05 + r() * 0.2); g.fillStyle = biru[k]; g.fillRect(ix + i * bw * 1.6 + bw * 0.3, yy - hh, bw, hh); yy -= hh; }
      }
      break;
    }
    case 2: {
      const n = 8;
      for (let i = 0; i < n; i++) { const v = (1 - i / n) * (0.55 + r() * 0.45); g.fillStyle = gelap ? '#38bdf8' : '#2563eb'; g.fillRect(ix + iw * 0.25, iy + i * (ih / n) + ih / n * 0.2, iw * 0.72 * v, ih / n * 0.6); g.fillStyle = teks; g.font = `${f * 0.7}px sans-serif`; g.textBaseline = 'middle'; g.fillText(`Ruas ${i + 1}`, ix, iy + i * (ih / n) + ih / n * 0.5); }
      break;
    }
    case 3: {
      const n = 14, titik: [number, number][] = [];
      for (let i = 0; i < n; i++) titik.push([ix + (iw * i) / (n - 1), iy + ih * (0.85 - (i === 9 ? 0.75 : 0.15 + r() * 0.35))]);
      g.fillStyle = gelap ? 'rgba(56,189,248,0.25)' : 'rgba(37,99,235,0.15)';
      g.beginPath(); g.moveTo(ix, iy + ih); titik.forEach(([a, b]) => g.lineTo(a, b)); g.lineTo(ix + iw, iy + ih); g.closePath(); g.fill();
      g.strokeStyle = gelap ? '#38bdf8' : '#2563eb'; g.lineWidth = Math.max(1, f * 0.18); g.beginPath(); titik.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.stroke();
      break;
    }
    case 4: {
      const warna = ['#22c55e', '#facc15', '#38bdf8', '#22c55e'];
      for (let i = 0; i < 4; i++) {
        const kx = ix + (i % 2) * iw / 2, ky = iy + Math.floor(i / 2) * ih / 2;
        g.fillStyle = warna[i]; g.fillRect(kx + 2, ky + 2, iw / 2 - 4, ih / 2 - 4);
        g.fillStyle = '#0f172a'; g.font = `700 ${Math.min(iw, ih) * 0.14}px sans-serif`; g.textBaseline = 'middle';
        g.fillText(`${60 + Math.floor(r() * 40)}%`, kx + iw * 0.06, ky + ih / 4);
      }
      break;
    }
    default: {
      for (let i = 0; i < 5; i++) {
        const v = 0.3 + r() * 0.65;
        g.fillStyle = gelap ? '#1f2937' : '#e2e8f0'; g.fillRect(ix, iy + i * ih / 5 + ih / 20, iw, ih / 10);
        g.fillStyle = v > 0.85 ? '#ef4444' : v > 0.7 ? '#f59e0b' : '#22c55e'; g.fillRect(ix, iy + i * ih / 5 + ih / 20, iw * v, ih / 10);
      }
    }
  }
}

/** Dashboard lengkap: kepala, 3 x 2 grafik, deret indikator. */
function gambarDashboard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, benih: number, gelap = false) {
  const r = acak(benih);
  g.fillStyle = gelap ? '#0b1220' : '#eef2f7'; g.fillRect(x, y, w, h);
  const kh = h * 0.07;
  g.fillStyle = gelap ? '#111827' : '#ffffff'; g.fillRect(x, y, w, kh);
  g.fillStyle = '#dc2626'; g.fillRect(x + kh * 0.3, y + kh * 0.2, kh * 0.6, kh * 0.6);
  g.fillStyle = gelap ? '#e5e7eb' : '#1e293b'; g.font = `700 ${kh * 0.45}px sans-serif`; g.textBaseline = 'middle';
  g.fillText('Command Center · Dashboard', x + kh * 1.2, y + kh / 2);
  const pad = Math.max(2, w * 0.008), top = y + kh + pad, tinggiGrafik = (h - kh - pad * 4) * 0.82;
  const cw = (w - pad * 4) / 3, ch = (tinggiGrafik - pad) / 2;
  for (let i = 0; i < 6; i++) gambarWidget(g, x + pad + (i % 3) * (cw + pad), top + Math.floor(i / 3) * (ch + pad), cw, ch, i, r, gelap);
  const by = top + tinggiGrafik + pad, bh = y + h - by - pad, n = 6, bw = (w - pad * (n + 1)) / n;
  const warna = ['#86efac', '#fde68a', '#93c5fd', '#86efac', '#bae6fd', '#86efac'];
  for (let i = 0; i < n; i++) {
    g.fillStyle = warna[i]; g.fillRect(x + pad + i * (bw + pad), by, bw, bh);
    g.fillStyle = '#0f172a'; g.font = `700 ${Math.min(bh * 0.45, bw * 0.22)}px sans-serif`; g.textBaseline = 'middle';
    g.fillText(`${60 + Math.floor(r() * 40)}%`, x + pad + i * (bw + pad) + bw * 0.08, by + bh / 2);
  }
}

/** Home screen interactive display (jam, ikon aplikasi, dok). */
function gambarDesktop(g: CanvasRenderingContext2D, W: number, H: number) {
  const gr = g.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, '#0b1d3a'); gr.addColorStop(0.55, '#1e3a8a'); gr.addColorStop(1, '#0f172a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(W * (0.4 + i * 0.1), 0); g.lineTo(W * (0.55 + i * 0.1), 0); g.lineTo(W * (0.25 + i * 0.1), H); g.lineTo(W * (0.1 + i * 0.1), H); g.closePath(); g.fill(); }
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `300 ${H * 0.16}px sans-serif`; g.fillText('10:55', W * 0.58, H * 0.22);
  g.font = `${H * 0.035}px sans-serif`; g.fillText('Selasa, 6 Oktober 2026', W * 0.58, H * 0.33);
  const ikon = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];
  const nama = ['Whiteboard', 'Meeting', 'Browser', 'Files', 'Screen Share', 'Kamera', 'Galeri', 'Catatan', 'Setting', 'Apps'];
  const s = H * 0.1;
  ikon.forEach((c, i) => {
    const cx = W * 0.58 + (i % 5 - 2) * s * 1.9, cy = H * 0.5 + Math.floor(i / 5) * s * 1.7;
    g.fillStyle = c; kotakBulat(g, cx - s / 2, cy - s / 2, s, s, s * 0.22); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = `${s * 0.2}px sans-serif`; g.fillText(nama[i], cx, cy + s * 0.75);
  });
  g.fillStyle = 'rgba(255,255,255,0.12)'; kotakBulat(g, W * 0.03, H * 0.08, W * 0.2, H * 0.84, H * 0.02); g.fill();
  g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = `${H * 0.03}px sans-serif`;
  ['Rapat 09:00', 'Review desain', 'Presentasi', 'Video call'].forEach((t, i) => g.fillText(t, W * 0.05, H * (0.16 + i * 0.08)));
  g.fillStyle = 'rgba(255,255,255,0.15)'; kotakBulat(g, W * 0.32, H * 0.88, W * 0.52, H * 0.07, H * 0.035); g.fill();
}

/**
 * Konten layar contoh: CCTV (grid kamera), dashboard grafik, campuran (grafik + CCTV, ala
 * command center) atau home screen. Videowall: grid kamera mengikuti panel (2 x 2 per panel).
 */
export function teksturKonten(THREE: typeof T, b: Benda): T.Texture {
  const konten = b.konten ?? 'pola';
  const rasio = b.w / Math.max(0.01, b.h);
  if (konten !== 'cctv' && konten !== 'dashboard' && konten !== 'campuran' && konten !== 'desktop') return teksturPolaUji(THREE, b.nama, rasio);
  let W = 2048, H = Math.round(W / Math.max(0.3, rasio));
  if (H > 2048) { H = 2048; W = Math.round(H * rasio); }
  H = Math.max(256, H);
  const benih = [...b.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const c = kanvas(W, H, g => {
    const gridCCTV = (x: number, y: number, w: number, h: number, kol: number, bar: number, mulai: number) => {
      for (let j = 0; j < bar; j++) for (let i = 0; i < kol; i++) gambarCCTV(g, x + (i * w) / kol, y + (j * h) / bar, w / kol, h / bar, mulai + j * kol + i);
    };
    const vw = b.jenis === 'videowall' ? { kol: Math.max(1, b.kol ?? 2), bar: Math.max(1, b.bar ?? 2) } : null;
    if (konten === 'cctv') {
      const k = vw && vw.kol * vw.bar <= 6 ? 2 : 1;
      const kol = vw ? vw.kol * k : Math.max(2, Math.round(Math.sqrt(9 * rasio)));
      const bar = vw ? vw.bar * k : Math.max(1, Math.round((kol / rasio) * (16 / 9) * 0.5625 * 1.0));
      gridCCTV(0, 0, W, H, kol, bar, 0);
    } else if (konten === 'dashboard') {
      gambarDashboard(g, 0, 0, W, H, benih);
    } else if (konten === 'campuran') {
      //  Kiri: dashboard; kanan: 3 x 3 kamera di atas, peta & daftar kejadian di bawah.
      const bagi = vw && vw.kol >= 2 ? Math.round(vw.kol / 2) / vw.kol : 0.5;
      gambarDashboard(g, 0, 0, W * bagi, H, benih);
      const xk = W * bagi, wk = W - xk, hk = H * 0.74;
      gridCCTV(xk, 0, wk, hk, 3, 3, 0);
      g.fillStyle = '#0b1220'; g.fillRect(xk, hk, wk / 2, H - hk);
      const r = acak(benih + 7);
      for (let i = 0; i < 40; i++) { g.fillStyle = ['#22d3ee', '#f472b6', '#a3e635', '#fbbf24'][i % 4]; g.beginPath(); g.arc(xk + r() * wk / 2, hk + r() * (H - hk), Math.max(2, H * 0.006), 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#f8fafc'; g.fillRect(xk + wk / 2, hk, wk / 2, H - hk);
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#e2e8f0' : '#dbeafe'; g.fillRect(xk + wk / 2 + wk * 0.02, hk + (H - hk) * (0.08 + i * 0.15), wk * 0.46, (H - hk) * 0.1); }
    } else {
      gambarDesktop(g, W, H);
    }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Layar monitor meja operator: dashboard gelap atau 2 x 2 kamera. */
export function teksturMonitor(THREE: typeof T, cctv: boolean, benih: number): T.Texture {
  const c = kanvas(640, 360, g => {
    if (cctv) for (let i = 0; i < 4; i++) gambarCCTV(g, (i % 2) * 320, Math.floor(i / 2) * 180, 320, 180, benih + i);
    else gambarDashboard(g, 0, 0, 640, 360, benih, true);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

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
