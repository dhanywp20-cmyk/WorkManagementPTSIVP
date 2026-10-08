/** Tekstur konten layar: pola uji, CCTV, dashboard / widget, home screen, monitor operator. */
import type { Benda } from '../inti/index';
import { acak, kanvas, teksturPolaUji } from './tekstur';
import type * as T from 'three';

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
