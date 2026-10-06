'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Image as IkonGambar, Plus, Trash2, Wand2, Cable, SquareDashed, Eraser } from 'lucide-react';
import { hitungKoneksi, type SudutMulai, type SelRC, type HasilKoneksi } from '@/lib/av-hitung';
import { Angka, Segmen, Nilai, Catatan, f } from './ui';
import { esc, namaBerkas, unduhSvgPNG, unduhUrl, type Seksi } from './cetak';

/**
 * Screen Connection ala NovaLCT: grid receiving card, urutan kabel data per port LAN.
 * Dua cara: template cepat (pojok mulai, arah, pola S/Z, pembagian port) atau manual
 * (klik / seret receiving card berurutan per port). Ukuran receiving card bisa mengikuti
 * Kalkulator LED atau diisi bebas per kolom/baris (px); sel bisa dikosongkan untuk layar
 * yang tidak persegi.
 */

/** Pengaturan screen connection (disimpan bersama hitungan LED, ikut undo/redo). */
export interface PengaturanKoneksi {
  mode: 'template' | 'manual';
  mulai: SudutMulai; arah: 'horizontal' | 'vertikal'; pola: 'S' | 'Z'; bagi: 'baris' | 'penuh';
  /** Batas beban port (%). */ beban: number;
  /** Jumlah modul/cabinet per receiving card (mendatar × tegak); null = otomatis. */ rcKol: number | null; rcBaris: number | null;
  /** Port LAN per controller; null = ikut hardware terpilih. */ ppk: number | null;
  /** Ukuran receiving card bebas: lebar tiap kolom & tinggi tiap baris (px). null = ikut kalkulator. */
  lebarKol: number[] | null; tinggiBaris: number[] | null;
  /** Sel tanpa receiving card. */ kosong: SelRC[];
  /** Kabel manual per port. */ manual: SelRC[][] | null;
  /** Kapasitas port (px); null = dari refresh & bit kalkulator. */ pxPort: number | null;
}
export const KONEKSI_AWAL: PengaturanKoneksi = {
  mode: 'template', mulai: 'kiri-atas', arah: 'horizontal', pola: 'S', bagi: 'baris', beban: 100, rcKol: null, rcBaris: null, ppk: null,
  lebarKol: null, tinggiBaris: null, kosong: [], manual: null, pxPort: null,
};

/** Pengaturan dari hitungan tersimpan: nilai asing / tidak sah diganti bawaan. */
export function bersihkanKoneksi(x: unknown): PengaturanKoneksi {
  const o = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const pilih = <T extends string>(v: unknown, sah: readonly T[], awal: T): T => (sah.includes(v as T) ? (v as T) : awal);
  const bulat = (v: unknown, min: number, maks: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(maks, Math.max(min, Math.round(v))) : null);
  const sel = (v: unknown): SelRC | null => (Array.isArray(v) && v.length === 2 && bulat(v[0], 0, 999) !== null && bulat(v[1], 0, 999) !== null
    ? [bulat(v[0], 0, 999)!, bulat(v[1], 0, 999)!] : null);
  const daftarSel = (v: unknown, maks: number) => (Array.isArray(v) ? v.slice(0, maks).map(sel).filter((s): s is SelRC => !!s) : []);
  const ukuran = (v: unknown) => (Array.isArray(v) && v.length >= 1 && v.length <= 256 && v.every(n => bulat(n, 1, 8192) !== null) ? v.map(n => bulat(n, 1, 8192)!) : null);
  const A = KONEKSI_AWAL;
  const lebarKol = ukuran(o.lebarKol), tinggiBaris = ukuran(o.tinggiBaris);
  return {
    mode: pilih(o.mode, ['template', 'manual'] as const, A.mode),
    mulai: pilih(o.mulai, ['kiri-atas', 'kanan-atas', 'kiri-bawah', 'kanan-bawah'] as const, A.mulai),
    arah: pilih(o.arah, ['horizontal', 'vertikal'] as const, A.arah),
    pola: pilih(o.pola, ['S', 'Z'] as const, A.pola),
    bagi: pilih(o.bagi, ['baris', 'penuh'] as const, A.bagi),
    beban: bulat(o.beban, 10, 100) ?? A.beban,
    rcKol: bulat(o.rcKol, 1, 1000), rcBaris: bulat(o.rcBaris, 1, 1000), ppk: bulat(o.ppk, 0, 256),
    lebarKol: lebarKol && tinggiBaris ? lebarKol : null, tinggiBaris: lebarKol && tinggiBaris ? tinggiBaris : null,
    kosong: daftarSel(o.kosong, 4096),
    manual: Array.isArray(o.manual) ? o.manual.slice(0, 256).map(r => daftarSel(r, 4096)) : null,
    pxPort: bulat(o.pxPort, 1000, 20_000_000),
  };
}

/** Data layar dari kalkulator. */
export interface DataKoneksi {
  /** Susunan unit (modul / cabinet). */ kolom: number; baris: number;
  /** Ukuran unit (mm) & pixel per unit. */ wUnit: number; hUnit: number; pxX: number; pxY: number;
  satuan: 'modul' | 'cabinet';
  pxPerPort: number; /** Perkiraan port dari total pixel. */ portIdeal: number;
  /** Port per unit hardware & namanya (0 / null = belum ada). */ ppkHw: number; namaHw: string | null;
  refresh: number; bit: number;
}

const WARNA_PORT = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#059669', '#b91c1c', '#7c3aed'];
export const warnaPort = (p: number) => WARNA_PORT[(p - 1) % WARNA_PORT.length];
const SUDUT: { v: SudutMulai; l: string }[] = [
  { v: 'kiri-atas', l: 'Kiri atas' }, { v: 'kanan-atas', l: 'Kanan atas' }, { v: 'kiri-bawah', l: 'Kiri bawah' }, { v: 'kanan-bawah', l: 'Kanan bawah' },
];
/** Batas umum area satu receiving card (512 × 512 px). */
const PX_RC_UMUM = 512 * 512;
const kunci = (c: number, r: number) => `${c},${r}`;

/** Grid receiving card (ukuran tiap kolom/baris) & urutan kabelnya. */
export function susunKoneksi(d: DataKoneksi, s: PengaturanKoneksi) {
  const otoKol = d.satuan === 'cabinet' ? 1 : Math.max(1, Math.round(500 / Math.max(1, d.wUnit)));
  const otoBaris = d.satuan === 'cabinet' ? 1 : Math.max(1, Math.round(500 / Math.max(1, d.hUnit)));
  const rcKol = Math.min(d.kolom, Math.max(1, Math.round(s.rcKol ?? otoKol)));
  const rcBaris = Math.min(d.baris, Math.max(1, Math.round(s.rcBaris ?? otoBaris)));
  const custom = !!(s.lebarKol?.length && s.tinggiBaris?.length);
  //  Ikut kalkulator: receiving card di tepi kanan/bawah memuat sisa modul (ukurannya tepat, bukan dibulatkan).
  const lebar = custom ? s.lebarKol! : Array.from({ length: Math.ceil(d.kolom / rcKol) }, (_, c) => Math.min(rcKol, d.kolom - c * rcKol) * d.pxX);
  const tinggi = custom ? s.tinggiBaris! : Array.from({ length: Math.ceil(d.baris / rcBaris) }, (_, r) => Math.min(rcBaris, d.baris - r * rcBaris) * d.pxY);
  const K = lebar.length, B = tinggi.length;
  const ppk = Math.max(0, Math.round(s.ppk ?? d.ppkHw));
  const pxPort = s.pxPort ?? d.pxPerPort;
  const kosong = new Set(s.kosong.filter(([c, r]) => c < K && r < B).map(([c, r]) => kunci(c, r)));
  const hasil = hitungKoneksi({
    kolom: K, baris: B, lebarPx: lebar, tinggiPx: tinggi, kosong: s.kosong, manual: s.mode === 'manual' ? (s.manual ?? []) : null,
    pxPerPort: pxPort, mulai: s.mulai, arah: s.arah, pola: s.pola, bagi: s.bagi, bebanMaks: s.beban, portPerKartu: ppk,
  });
  //  Port kosong (mode manual) tidak dihitung; controller = sampai port terakhir yang terisi.
  const terisi = hasil.port.filter(p => p.jumlah);
  const portTerpakai = terisi.length;
  const controller = !terisi.length ? 0 : ppk > 0 ? Math.ceil(terisi[terisi.length - 1].port / ppk) : 1;
  return {
    K, B, lebar, tinggi, custom, rcKol, rcBaris, otoKol, otoBaris, ppk, pxPort, kosong, hasil, arah: s.arah, portTerpakai, controller,
    resX: lebar.reduce((a, b) => a + b, 0), resY: tinggi.reduce((a, b) => a + b, 0),
  };
}
type Susunan = ReturnType<typeof susunKoneksi>;

/** Rantai kabel per port dari hasil (untuk menyalin template ke manual). */
const rantaiDari = (h: HasilKoneksi): SelRC[][] => h.port.map(p => h.sel.filter(x => x.port === p.port).map(x => [x.c, x.r] as SelRC));

const namaPort = (t: Susunan, port: number) =>
  t.ppk > 0 && t.controller > 1 ? `Controller ${Math.ceil(port / t.ppk)} · port ${((port - 1) % t.ppk) + 1}` : `Port ${port}`;

/** Diagram koneksi (SVG mandiri) - dipakai di layar (interaktif), cetak, dan unduhan. */
export function svgKoneksi(d: DataKoneksi, t: Susunan, o: { judul?: string; interaktif?: boolean; portAktif?: number } = {}): string {
  const skala = Math.min(860 / Math.max(1, t.resX), 430 / Math.max(1, t.resY));
  const W = t.resX * skala, H = t.resY * skala;
  const ox = 52, oy = o.judul ? 52 : 30;
  const xs = [ox], ys = [oy];
  t.lebar.forEach(w => xs.push(xs[xs.length - 1] + w * skala));
  t.tinggi.forEach(h => ys.push(ys[ys.length - 1] + h * skala));
  const pusat = (c: number, r: number) => [(xs[c] + xs[c + 1]) / 2, (ys[r] + ys[r + 1]) / 2];
  let selMin = Infinity;
  for (let i = 0; i < t.K; i++) selMin = Math.min(selMin, xs[i + 1] - xs[i]);
  for (let i = 0; i < t.B; i++) selMin = Math.min(selMin, ys[i + 1] - ys[i]);
  const banyak = t.K * t.B > 2500;
  const fs = Math.min(12, selMin * 0.24);
  const n = (v: number) => Math.round(v * 10) / 10;
  const peta = new Map(t.hasil.sel.map(s => [kunci(s.c, s.r), s]));
  const out: string[] = [];
  out.push('<defs><pattern id="arsir-koneksi" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#e2e8f0"/><line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" stroke-width="1.6"/></pattern></defs>');
  if (o.interaktif) out.push('<style>.sel{cursor:pointer}.sel:hover{stroke:#1d4ed8;stroke-width:2.5}</style>');
  //  Sel receiving card: warna port, putih = belum tersambung, arsir = kosong (tidak ada receiving card).
  for (let r = 0; r < t.B; r++) for (let c = 0; c < t.K; c++) {
    const k = kunci(c, r), s = peta.get(k);
    const isi = t.kosong.has(k) ? 'fill="url(#arsir-koneksi)"'
      : s ? `fill="${warnaPort(s.port)}" fill-opacity="${o.portAktif === s.port ? 0.32 : 0.17}"` : 'fill="#ffffff"';
    out.push(`<rect x="${n(xs[c])}" y="${n(ys[r])}" width="${n(xs[c + 1] - xs[c])}" height="${n(ys[r + 1] - ys[r])}" ${isi}${o.interaktif ? ` class="sel" data-sel="${k}"` : ''}/>`);
  }
  //  Semua hiasan di atas sel tidak menangkap klik.
  const atas: string[] = [];
  if (!t.custom && (t.rcKol > 1 || t.rcBaris > 1) && d.kolom <= 160 && d.baris <= 160) {
    const tipis: string[] = [];
    for (let i = 1; i < d.kolom; i++) if (i % t.rcKol) { const x = n(ox + i * d.pxX * skala); tipis.push(`<line x1="${x}" y1="${oy}" x2="${x}" y2="${n(oy + H)}"/>`); }
    for (let i = 1; i < d.baris; i++) if (i % t.rcBaris) { const y = n(oy + i * d.pxY * skala); tipis.push(`<line x1="${ox}" y1="${y}" x2="${n(ox + W)}" y2="${y}"/>`); }
    if (tipis.length) atas.push(`<g stroke="#94a3b8" stroke-width="0.6" stroke-dasharray="3 2">${tipis.join('')}</g>`);
  }
  const batas: string[] = [];
  for (let i = 1; i < t.K; i++) batas.push(`<line x1="${n(xs[i])}" y1="${oy}" x2="${n(xs[i])}" y2="${n(oy + H)}"/>`);
  for (let i = 1; i < t.B; i++) batas.push(`<line x1="${ox}" y1="${n(ys[i])}" x2="${n(ox + W)}" y2="${n(ys[i])}"/>`);
  atas.push(`<g stroke="#64748b" stroke-width="${banyak ? 0.3 : 0.8}">${batas.join('')}</g>`);
  atas.push(`<rect x="${ox}" y="${oy}" width="${n(W)}" height="${n(H)}" fill="none" stroke="#0f172a" stroke-width="1.5"/>`);
  //  Belum tersambung (manual): bingkai putus-putus jingga.
  for (const { c, r } of t.hasil.tanpaPort) {
    atas.push(`<rect x="${n(xs[c] + 2)}" y="${n(ys[r] + 2)}" width="${n(xs[c + 1] - xs[c] - 4)}" height="${n(ys[r + 1] - ys[r] - 4)}" fill="none" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="4 3"/>`);
  }
  //  Port aktif (mode manual) dipertegas.
  if (o.portAktif) for (const s of t.hasil.sel) if (s.port === o.portAktif) {
    atas.push(`<rect x="${n(xs[s.c] + 1)}" y="${n(ys[s.r] + 1)}" width="${n(xs[s.c + 1] - xs[s.c] - 2)}" height="${n(ys[s.r + 1] - ys[s.r] - 2)}" fill="none" stroke="${warnaPort(s.port)}" stroke-width="2"/>`);
  }
  //  Rantai kabel per port + panah arah.
  const tebal = Math.max(1, Math.min(2.5, selMin * 0.06));
  const panah = Math.max(2.5, Math.min(6, selMin * 0.13));
  const perPort = new Map<number, number[][]>();
  for (const s of t.hasil.sel) { const a = perPort.get(s.port) ?? []; a.push(pusat(s.c, s.r)); perPort.set(s.port, a); }
  if (!banyak) {
    perPort.forEach((titik, port) => {
      const warna = warnaPort(port);
      if (titik.length > 1) atas.push(`<polyline points="${titik.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${warna}" stroke-width="${n(tebal)}" stroke-linejoin="round" stroke-opacity="0.85"/>`);
      if (selMin >= 12) {
        const seg: string[] = [];
        for (let i = 1; i < titik.length; i++) {
          const [x0, y0] = titik[i - 1], [x1, y1] = titik[i];
          const pj = Math.hypot(x1 - x0, y1 - y0); if (pj < 1) continue;
          const ux = (x1 - x0) / pj, uy = (y1 - y0) / pj, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
          const bx = mx - panah * ux, by = my - panah * uy;
          seg.push(`${n(mx + panah * ux)},${n(my + panah * uy)} ${n(bx - 0.8 * panah * uy)},${n(by + 0.8 * panah * ux)} ${n(bx + 0.8 * panah * uy)},${n(by - 0.8 * panah * ux)}`);
        }
        if (seg.length) atas.push(`<g fill="${warna}">${seg.map(p => `<polygon points="${p}"/>`).join('')}</g>`);
      }
    });
  }
  //  Titik masuk tiap port. Di tepi layar: label di luar tepi terdekat (seri: sisi searah kabel didahulukan).
  //  Di tengah layar (zona / isi penuh / manual): label langsung di sel pertama.
  const utama = (sisi: string) => ((sisi === 'kiri' || sisi === 'kanan') === (t.arah === 'horizontal') ? 1 : 0);
  const masuk = t.hasil.port.filter(p => p.mulai).map(p => {
    const m = p.mulai!;
    const jarak = [
      { sisi: 'kiri', v: m.c }, { sisi: 'kanan', v: t.K - 1 - m.c }, { sisi: 'atas', v: m.r }, { sisi: 'bawah', v: t.B - 1 - m.r },
    ].sort((a, b) => a.v - b.v || utama(b.sisi) - utama(a.sisi));
    return { p, m, sisi: jarak[0].v === 0 ? jarak[0].sisi : null };
  });
  const diSel = new Set(masuk.filter(x => !x.sisi).map(x => x.p.port));
  const adaLabel = !banyak && fs >= 5.5;
  if (adaLabel) {
    const lbl: string[] = [];
    for (const s of t.hasil.sel) {
      const [x, y] = pusat(s.c, s.r);
      if (!(s.urut === 1 && diSel.has(s.port))) lbl.push(`<text x="${n(x)}" y="${n(y - fs * 0.55)}">${s.port}-${s.urut}</text>`);
    }
    atas.push(`<g font-size="${n(fs)}" font-weight="700" text-anchor="middle" fill="#0f172a" font-family="Segoe UI,Arial" paint-order="stroke" stroke="#ffffff" stroke-width="2.4">${lbl.join('')}</g>`);
    //  Ukuran receiving card (px) bila sel cukup besar - seperti tampilan NovaLCT.
    const kecil = Math.max(6, fs * 0.78), ukur: string[] = [];
    for (let r = 0; r < t.B; r++) for (let c = 0; c < t.K; c++) {
      const w = xs[c + 1] - xs[c], h = ys[r + 1] - ys[r];
      if (t.kosong.has(kunci(c, r)) || w < kecil * 5.2 || h < fs * 3.4) continue;
      const [x, y] = pusat(c, r);
      ukur.push(`<text x="${n(x)}" y="${n(y + h * 0.36)}">${t.lebar[c]}×${t.tinggi[r]}</text>`);
    }
    if (ukur.length) atas.push(`<g font-size="${n(kecil)}" text-anchor="middle" fill="#475569" font-family="Segoe UI,Arial">${ukur.join('')}</g>`);
  }
  for (const { p, m, sisi } of masuk) {
    const warna = warnaPort(p.port);
    const [cx, cy] = pusat(m.c, m.r);
    const r = Math.max(3, Math.min(7, selMin * 0.16));
    atas.push(`<circle cx="${n(cx)}" cy="${n(cy + (adaLabel ? r * 0.9 : 0))}" r="${n(r)}" fill="${warna}" stroke="#fff" stroke-width="1.2"/>`);
    const teks = `P${p.port}`;
    if (!sisi) {
      const fb = Math.max(6, Math.min(10, fs + 1)), bw = 5 + teks.length * fb * 0.62, bh = fb + 4;
      const by = adaLabel ? cy - fs * 0.55 - fb * 0.85 : cy - bh / 2;
      atas.push(`<rect x="${n(cx - bw / 2)}" y="${n(by)}" width="${n(bw)}" height="${n(bh)}" rx="3" fill="${warna}" stroke="#fff" stroke-width="1"/>`);
      atas.push(`<text x="${n(cx)}" y="${n(by + bh - 3)}" font-size="${n(fb)}" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial">${teks}</text>`);
      continue;
    }
    const lw = 8 + teks.length * 6.4, lh = 15;
    const [lx, ly] = sisi === 'kiri' ? [ox - lw - 6, cy - lh / 2] : sisi === 'kanan' ? [ox + W + 6, cy - lh / 2]
      : sisi === 'atas' ? [cx - lw / 2, oy - lh - 5] : [cx - lw / 2, oy + H + 5];
    const [ex, ey] = sisi === 'kiri' ? [ox, cy] : sisi === 'kanan' ? [ox + W, cy] : sisi === 'atas' ? [cx, oy] : [cx, oy + H];
    const [tx, ty] = sisi === 'kiri' ? [lx + lw, cy] : sisi === 'kanan' ? [lx, cy] : sisi === 'atas' ? [cx, ly + lh] : [cx, ly];
    atas.push(`<line x1="${n(tx)}" y1="${n(ty)}" x2="${n(ex)}" y2="${n(ey)}" stroke="${warna}" stroke-width="1.6"/>`);
    atas.push(`<rect x="${n(lx)}" y="${n(ly)}" width="${n(lw)}" height="${lh}" rx="4" fill="${warna}"/>`);
    atas.push(`<text x="${n(lx + lw / 2)}" y="${n(ly + 11)}" font-size="10" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial">${teks}</text>`);
  }
  const fm = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  const mmPerPx = d.wUnit / Math.max(1, d.pxX);
  atas.push(`<text x="${n(ox + W / 2)}" y="${n(oy + H + 36)}" font-size="11" text-anchor="middle" fill="#334155" font-family="Segoe UI,Arial">${t.resX} px · ±${fm((t.resX * mmPerPx) / 1000)} m · ${t.K} kolom receiving card</text>`);
  atas.push(`<text x="${n(ox - 34)}" y="${n(oy + H / 2)}" font-size="11" text-anchor="middle" fill="#334155" font-family="Segoe UI,Arial" transform="rotate(-90 ${n(ox - 34)} ${n(oy + H / 2)})">${t.resY} px · ±${fm((t.resY * mmPerPx) / 1000)} m · ${t.B} baris</text>`);
  if (o.judul) atas.push(`<text x="${ox}" y="20" font-size="13" font-weight="700" fill="#0f172a" font-family="Segoe UI,Arial">${esc(o.judul)}</text>`);
  out.push(`<g pointer-events="none">${atas.join('')}</g>`);
  const lebar = n(W + ox + 52), tinggi = n(H + oy + 48);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lebar}" height="${tinggi}" viewBox="0 0 ${lebar} ${tinggi}" style="max-width:100%;height:auto;touch-action:${o.interaktif ? 'none' : 'auto'}">${out.join('')}</svg>`;
}

/**
 * Gambar siap kirim (PNG/SVG): judul, ringkasan, diagram lengkap, dan legenda port - satu berkas
 * yang bisa langsung ditempel ke penawaran / dikirim ke installer.
 */
export function svgPosterKoneksi(d: DataKoneksi, s: PengaturanKoneksi, judul: string, sub: string): string {
  const t = susunKoneksi(d, s), k = t.hasil;
  const diagram = svgKoneksi(d, t);
  const dw = Number(/\swidth="([\d.]+)"/.exec(diagram)?.[1] ?? 800), dh = Number(/\sheight="([\d.]+)"/.exec(diagram)?.[1] ?? 400);
  const W = Math.max(dw, 820) + 40;
  const port = k.port;
  const kolomLegenda = port.length > 24 ? 3 : port.length > 8 ? 2 : 1;
  const barisLegenda = Math.ceil(port.length / kolomLegenda);
  const yDiagram = 92, yLegenda = yDiagram + dh + 16, tinggiBaris = 19;
  const H = yLegenda + 30 + barisLegenda * tinggiBaris + 46;
  const lebarKolom = (W - 40) / kolomLegenda;
  const huruf = 'font-family="Segoe UI,Arial"';
  const legenda = port.map((p, i) => {
    const x = 20 + Math.floor(i / barisLegenda) * lebarKolom, y = yLegenda + 30 + (i % barisLegenda) * tinggiBaris;
    const teks = `${namaPort(t, p.port)} · ${p.jumlah} RC · ${p.px.toLocaleString('id-ID')} px · ${f(p.beban, 0)}%${p.mulai ? ` · masuk kolom ${p.mulai.c + 1}, baris ${p.mulai.r + 1}` : ''}`;
    return `<rect x="${x}" y="${y - 10}" width="11" height="11" rx="2" fill="${warnaPort(p.port)}"/><text x="${x + 17}" y="${y}" font-size="11.5" fill="${p.beban > s.beban ? '#b91c1c' : '#1e293b'}" ${huruf}>${esc(teks)}</text>`;
  }).join('');
  const ringkas = `${k.sel.length} receiving card (${t.K} × ${t.B}) · ${t.resX} × ${t.resY} px · ${t.portTerpakai} port LAN${t.ppk > 0 ? ` · ${t.controller} controller × ${t.ppk} port` : ''} · ${teksCara(s)}`;
  const peringatan = [k.galat, k.tanpaPort.length ? `${k.tanpaPort.length} receiving card belum tersambung` : '', k.lewat.length ? `Port ${k.lewat.join(', ')} melebihi batas beban ${s.beban}%` : '']
    .filter(Boolean).join(' · ');
  const tanggal = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<rect x="0" y="0" width="${W}" height="62" fill="#1d4ed8"/>
<text x="20" y="28" font-size="18" font-weight="800" fill="#ffffff" ${huruf}>${esc(judul)}</text>
<text x="20" y="48" font-size="12" fill="#dbeafe" ${huruf}>${esc(sub)}</text>
<text x="${W - 20}" y="28" font-size="11" text-anchor="end" fill="#dbeafe" ${huruf}>${esc(tanggal)}</text>
<text x="20" y="80" font-size="12" font-weight="600" fill="#334155" ${huruf}>${esc(ringkas)}</text>
${diagram.replace(/ style="[^"]*"/, '').replace('<svg ', `<svg x="${Math.round((W - dw) / 2)}" y="${yDiagram}" `)}
<text x="20" y="${yLegenda + 12}" font-size="11" font-weight="800" fill="#1e3a8a" letter-spacing="0.6" ${huruf}>PEMBAGIAN PORT LAN</text>
${legenda}
${peringatan ? `<text x="20" y="${H - 30}" font-size="11" fill="#b91c1c" ${huruf}>${esc(peringatan)}</text>` : ''}
<text x="20" y="${H - 12}" font-size="10" fill="#94a3b8" ${huruf}>IndoVisual Professional Tools — Tools Team · label sel = port-urutan, angka kecil = ukuran receiving card (px)</text>
</svg>`;
}

const teksSudut = (s: SudutMulai) => SUDUT.find(x => x.v === s)!.l.toLowerCase();
const teksCara = (s: PengaturanKoneksi) => (s.mode === 'manual' ? 'kabel manual'
  : `mulai ${teksSudut(s.mulai)}, ${s.arah === 'horizontal' ? 'mendatar' : 'tegak'} pola ${s.pola}, ${s.bagi === 'baris' ? 'baris utuh' : 'isi penuh'}`);

/** Ringkasan untuk Salin/WA. */
export function ringkasanKoneksi(d: DataKoneksi, s: PengaturanKoneksi): string {
  const t = susunKoneksi(d, s), k = t.hasil;
  return [
    `Screen connection: ${k.sel.length} receiving card (${t.K}×${t.B}${t.kosong.size ? `, ${t.kosong.size} sel kosong` : ''}), resolusi ${t.resX}×${t.resY} px`,
    `${t.portTerpakai} port LAN${t.ppk > 0 ? ` · ${t.controller} controller × ${t.ppk} port` : ''} · kapasitas ${f(t.pxPort / 1000, 0)} rb px/port, batas ${s.beban}%`,
    `Kabel: ${teksCara(s)}`,
    ...k.port.map(p => `- ${namaPort(t, p.port)}: ${p.jumlah} RC, ${p.px.toLocaleString('id-ID')} px (${f(p.beban, 0)}%)${p.mulai ? `, masuk kolom ${p.mulai.c + 1} baris ${p.mulai.r + 1}` : ''}`),
    k.tanpaPort.length ? `Belum tersambung: ${k.tanpaPort.length} receiving card` : '',
  ].filter(Boolean).join('\n');
}

/** Seksi lembar cetak: diagram + tabel port. */
export function seksiCetakKoneksi(d: DataKoneksi, s: PengaturanKoneksi): Seksi[] {
  const t = susunKoneksi(d, s), k = t.hasil;
  const ket = `${t.K} × ${t.B} receiving card · ${t.resX} × ${t.resY} px · ${teksCara(s)} · label sel = port-urutan, angka kecil = ukuran receiving card (px)`;
  const peringatan = [k.galat, k.tanpaPort.length ? `${k.tanpaPort.length} receiving card belum tersambung.` : '', k.lewat.length ? `Port melebihi batas beban: ${k.lewat.join(', ')}.` : '']
    .filter(Boolean).map(x => `<p style="margin:4px 0 0;font-size:11px;color:#b91c1c">${esc(x)}</p>`).join('');
  return [
    { judul: 'Screen connection (urutan kabel data)', jenis: 'html',
      html: `<div class="diagram">${svgKoneksi(d, t)}<p style="margin:6px 0 0;font-size:11px;color:#475569">${esc(ket)}</p>${peringatan}</div>` },
    { judul: 'Pembagian port LAN', jenis: 'tabel', kepala: ['Port', 'Receiving card', 'Pixel', 'Beban', 'Masuk di'], rataKanan: [1, 2, 3],
      isi: k.port.map(p => [namaPort(t, p.port), String(p.jumlah), p.px.toLocaleString('id-ID'), `${f(p.beban, 0)}%`, p.mulai ? `kolom ${p.mulai.c + 1}, baris ${p.mulai.r + 1}` : '—']) },
  ];
}

/** Ikon pola kabel 3×3 (S/Z) dari pojok & arah - seperti tombol koneksi cepat NovaLCT. */
function IkonPola({ mulai, arah, pola }: { mulai: SudutMulai; arah: 'horizontal' | 'vertikal'; pola: 'S' | 'Z' }) {
  const h = hitungKoneksi({ kolom: 3, baris: 3, pxPerRC: 1, pxPerPort: 100, mulai, arah, pola, bagi: 'penuh' });
  const titik = h.sel.map(s => `${6 + s.c * 10},${6 + s.r * 10}`).join(' ');
  const a = h.sel[0];
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="3" fill="#f8fafc" stroke="#cbd5e1" />
      <polyline points={titik} fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={6 + a.c * 10} cy={6 + a.r * 10} r="2.6" fill="#16a34a" />
    </svg>
  );
}

/** Isian angka kecil (untuk deret lebar kolom / tinggi baris). */
function AngkaKecil({ nilai, onUbah, label }: { nilai: number; onUbah: (v: number) => void; label: string }) {
  const [teks, setTeks] = useState<string | null>(null);
  return (
    <input type="number" inputMode="numeric" min={1} step={1} aria-label={label} title={label}
      value={teks ?? String(nilai)}
      onChange={e => { setTeks(e.target.value); const v = Math.round(Number(e.target.value)); if (v >= 1 && v <= 8192) onUbah(v); }}
      onBlur={() => setTeks(null)}
      className="w-[64px] shrink-0 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[12px] tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
  );
}

const kelasTombol = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent';
const kelasJudul = 'text-[11px] font-bold uppercase tracking-wider text-slate-600';

/** Ruang kerja Screen Connection (menu tersendiri di Tools Team). */
export function RuangKoneksi({ d, s, onUbah, namaFile }: {
  d: DataKoneksi; s: PengaturanKoneksi; onUbah: (s: PengaturanKoneksi) => void; namaFile: string;
}) {
  const t = useMemo(() => susunKoneksi(d, s), [d, s]);
  const k = t.hasil;
  const [portAktif, setPortAktif] = useState(1);
  const [alat, setAlat] = useState<'kabel' | 'kosong' | null>(null);
  const alatEf = s.mode === 'manual' ? (alat ?? 'kabel') : alat;
  const svg = useMemo(() => svgKoneksi(d, t, { interaktif: true, portAktif: s.mode === 'manual' ? portAktif : undefined }), [d, t, s.mode, portAktif]);
  const ubah = (p: Partial<PengaturanKoneksi>) => onUbah({ ...s, ...p });
  const nUnit = d.satuan === 'modul' ? 'modul' : 'cabinet';
  const nPortManual = (s.manual ?? []).length;
  useEffect(() => { if (s.mode === 'manual' && portAktif > Math.max(1, nPortManual)) setPortAktif(Math.max(1, nPortManual)); }, [s.mode, nPortManual, portAktif]);

  //  Pengaturan terbaru untuk klik/seret beruntun (sebelum React sempat render ulang).
  const sRef = useRef(s); sRef.current = s;
  const seret = useRef(false);
  const terapkan = (baru: PengaturanKoneksi) => { sRef.current = baru; onUbah(baru); };
  const rantaiSalin = () => (sRef.current.manual ?? []).map(r => [...r] as SelRC[]);
  const sama = (a: SelRC, c: number, r: number) => a[0] === c && a[1] === r;

  const klikSel = (c: number, r: number) => {
    const sk = sRef.current;
    const kosongIni = sk.kosong.some(x => sama(x, c, r));
    if (alatEf === 'kosong') {
      const kosong = kosongIni ? sk.kosong.filter(x => !sama(x, c, r)) : [...sk.kosong, [c, r] as SelRC];
      terapkan({ ...sk, kosong, manual: sk.manual?.map(rt => rt.filter(x => !sama(x, c, r))) ?? null });
      return;
    }
    if (alatEf !== 'kabel' || kosongIni) return;
    const m = rantaiSalin(), ai = portAktif - 1;
    while (m.length <= ai) m.push([]);
    const pos = m[ai].findIndex(x => sama(x, c, r));
    if (pos >= 0) { m[ai] = m[ai].slice(0, pos); seret.current = false; }   // putus dari kartu ini ke belakang
    else {
      for (let i = 0; i < m.length; i++) if (i !== ai) m[i] = m[i].filter(x => !sama(x, c, r));
      m[ai].push([c, r]); seret.current = true;
    }
    terapkan({ ...sk, manual: m });
  };
  const seretKe = (c: number, r: number) => {
    if (!seret.current || alatEf !== 'kabel') return;
    const sk = sRef.current;
    if (sk.kosong.some(x => sama(x, c, r)) || (sk.manual ?? []).some(rt => rt.some(x => sama(x, c, r)))) return;
    const m = rantaiSalin(), ai = portAktif - 1;
    while (m.length <= ai) m.push([]);
    m[ai].push([c, r]);
    terapkan({ ...sk, manual: m });
  };
  const selDari = (el: Element | null): [number, number] | null => {
    const v = el?.closest('[data-sel]')?.getAttribute('data-sel');
    if (!v) return null;
    const [c, r] = v.split(',').map(Number);
    return Number.isInteger(c) && Number.isInteger(r) ? [c, r] : null;
  };

  const keManual = (dariTemplate: boolean) => {
    const rantai = dariTemplate || !s.manual ? rantaiDari(susunKoneksi(d, { ...s, mode: 'template' }).hasil) : s.manual;
    onUbah({ ...s, mode: 'manual', manual: rantai });
    setPortAktif(1); setAlat('kabel');
  };
  const gantiManual = (fn: (m: SelRC[][]) => SelRC[][]) => onUbah({ ...s, manual: fn((s.manual ?? []).map(r => [...r])) });

  //  Ukuran receiving card bebas: mulai dari grid yang sedang tampil.
  const keCustom = () => onUbah({ ...s, lebarKol: [...t.lebar], tinggiBaris: [...t.tinggi] });
  const ubahJumlah = (sumbu: 'lebarKol' | 'tinggiBaris', jumlah: number) => {
    const lama = (s[sumbu] ?? (sumbu === 'lebarKol' ? t.lebar : t.tinggi));
    const baru = Array.from({ length: jumlah }, (_, i) => lama[i] ?? lama[lama.length - 1] ?? 256);
    onUbah({ ...s, lebarKol: sumbu === 'lebarKol' ? baru : s.lebarKol ?? [...t.lebar], tinggiBaris: sumbu === 'tinggiBaris' ? baru : s.tinggiBaris ?? [...t.tinggi] });
  };
  const [samaW, setSamaW] = useState(256), [samaH, setSamaH] = useState(256);

  const poster = () => svgPosterKoneksi(d, s, 'Screen Connection LED', namaFile);
  const [pngStatus, setPngStatus] = useState<'siap' | 'proses' | 'gagal'>('siap');
  const unduhPNG = async () => {
    setPngStatus('proses');
    try { await unduhSvgPNG(poster(), namaBerkas('Screen Connection', namaFile), 2); setPngStatus('siap'); }
    catch { setPngStatus('gagal'); setTimeout(() => setPngStatus('siap'), 2500); }
  };
  const unduhSVG = () => {
    const url = URL.createObjectURL(new Blob([poster()], { type: 'image/svg+xml' }));
    unduhUrl(url, `${namaBerkas('Screen Connection', namaFile)}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const rataBeban = k.port.length ? k.port.reduce((a, p) => a + p.beban, 0) / k.port.length : 0;
  const zona = s.mode === 'template' && s.bagi === 'baris'
    ? new Set(k.port.filter(p => p.mulai).map(p => (s.arah === 'horizontal' ? p.mulai!.c : p.mulai!.r))).size : 1;
  const pAktif = k.port.find(p => p.port === portAktif);
  const resKalk = { x: d.kolom * d.pxX, y: d.baris * d.pxY };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] items-start">
      {/* ── Panel pengaturan ── */}
      <div className="space-y-3 min-w-0">
        <section className="rounded-2xl bg-white border border-slate-200 p-3 space-y-3">
          <Segmen label="Cara menyambung" nilai={s.mode} onUbah={v => (v === 'manual' ? keManual(false) : (ubah({ mode: 'template' }), setAlat(null)))}
            opsi={[{ v: 'template', l: 'Template cepat' }, { v: 'manual', l: 'Manual (klik / seret)' }]} />
          {s.mode === 'template' ? (
            <>
              <div>
                <span className={kelasJudul}>Pola koneksi cepat</span>
                <div className="grid grid-cols-4 gap-1.5 mt-1" role="radiogroup" aria-label="Pola koneksi cepat">
                  {(['horizontal', 'vertikal'] as const).flatMap(arah => SUDUT.map(sd => {
                    const on = s.mulai === sd.v && s.arah === arah;
                    return (
                      <button key={`${arah}-${sd.v}`} type="button" role="radio" aria-checked={on} onClick={() => ubah({ mulai: sd.v, arah })}
                        title={`Mulai ${sd.l.toLowerCase()}, kabel ${arah === 'horizontal' ? 'mendatar' : 'tegak'}`}
                        className={`grid place-items-center rounded-xl border p-1 ${on ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-300' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                        <IkonPola mulai={sd.v} arah={arah} pola={s.pola} />
                      </button>
                    );
                  }))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Titik hijau = receiving card pertama. Baris atas: kabel mendatar, baris bawah: kabel tegak.</p>
              </div>
              <Segmen label="Pola" nilai={s.pola} onUbah={v => ubah({ pola: v })} opsi={[{ v: 'S', l: 'S · bolak-balik' }, { v: 'Z', l: 'Z · balik ke awal' }]} />
              <Segmen label="Pembagian port" nilai={s.bagi} onUbah={v => ubah({ bagi: v })}
                opsi={[{ v: 'baris', l: s.arah === 'horizontal' ? 'Baris utuh' : 'Kolom utuh' }, { v: 'penuh', l: 'Isi penuh' }]} />
              <button type="button" onClick={() => keManual(true)} className={`${kelasTombol} w-full justify-center`}>
                <Wand2 size={14} /> Edit manual dari pola ini
              </button>
            </>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <span className={kelasJudul}>Port aktif</span>
                  <button type="button" className={kelasTombol} onClick={() => { gantiManual(m => [...m, []]); setPortAktif(nPortManual + 1); }}><Plus size={13} /> Port</button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {(s.manual ?? []).map((rt, i) => {
                    const on = portAktif === i + 1;
                    return (
                      <button key={i} type="button" onClick={() => setPortAktif(i + 1)} aria-pressed={on}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold border ${on ? 'text-white border-transparent' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                        style={on ? { background: warnaPort(i + 1) } : undefined}>
                        {!on && <span className="w-2 h-2 rounded-sm" style={{ background: warnaPort(i + 1) }} />}P{i + 1}<span className={`font-semibold ${on ? 'text-white/85' : 'text-slate-500'}`}>{rt.length}</span>
                      </button>
                    );
                  })}
                  {!nPortManual && <span className="text-[12px] text-slate-500">Belum ada port - tambah port dulu.</span>}
                </div>
                {pAktif && (
                  <p className="text-[11.5px] text-slate-600 mt-1.5">
                    P{portAktif}: {pAktif.jumlah} RC · {pAktif.px.toLocaleString('id-ID')} px · <b className={pAktif.beban > s.beban ? 'text-rose-700' : 'text-slate-800'}>{f(pAktif.beban, 0)}%</b>
                  </p>
                )}
              </div>
              <Segmen label="Klik sel untuk" nilai={alatEf ?? 'kabel'} onUbah={v => setAlat(v)}
                opsi={[{ v: 'kabel', l: 'Sambung kabel' }, { v: 'kosong', l: 'Kosong / isi' }]} />
              <p className="text-[11.5px] text-slate-600 leading-relaxed">
                {alatEf === 'kabel'
                  ? 'Klik receiving card berurutan (atau tekan lalu seret) untuk menyambung ke port aktif. Klik kartu yang sudah tersambung di port ini untuk memutus dari kartu itu ke belakang.'
                  : 'Klik sel untuk menandai tidak ada receiving card (layar tidak persegi), klik lagi untuk mengisi.'}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" className={kelasTombol} disabled={!pAktif?.jumlah} onClick={() => gantiManual(m => m.map((rt, i) => (i === portAktif - 1 ? [] : rt)))}><Eraser size={13} /> Putus port ini</button>
                <button type="button" className={kelasTombol} disabled={!nPortManual} onClick={() => { gantiManual(m => m.filter((_, i) => i !== portAktif - 1)); setPortAktif(p => Math.max(1, p - 1)); }}><Trash2 size={13} /> Hapus port</button>
                <button type="button" className={kelasTombol} onClick={() => gantiManual(m => m.map(() => []))}><Cable size={13} /> Putus semua</button>
                <button type="button" className={kelasTombol} onClick={() => keManual(true)}><Wand2 size={13} /> Dari template</button>
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-3 space-y-3">
          <Segmen label="Ukuran receiving card" nilai={t.custom ? 'custom' : 'ikut'} onUbah={v => (v === 'custom' ? keCustom() : ubah({ lebarKol: null, tinggiBaris: null }))}
            opsi={[{ v: 'ikut', l: 'Ikut kalkulator' }, { v: 'custom', l: 'Custom (px)' }]} />
          {!t.custom ? (
            <div>
              <div className="grid grid-cols-2 gap-3">
                <Angka label={`${nUnit} mendatar`} nilai={t.rcKol} step={1} onUbah={v => v >= 1 && ubah({ rcKol: Math.round(v) })} />
                <Angka label={`${nUnit} tegak`} nilai={t.rcBaris} step={1} onUbah={v => v >= 1 && ubah({ rcBaris: Math.round(v) })} />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Per receiving card: {t.rcKol}×{t.rcBaris} {nUnit} = {t.rcKol * d.pxX}×{t.rcBaris * d.pxY} px{s.rcKol === null && s.rcBaris === null && ' (otomatis)'}
                {(s.rcKol !== null || s.rcBaris !== null) && <button type="button" onClick={() => ubah({ rcKol: null, rcBaris: null })} className="ml-1.5 font-semibold text-blue-700 hover:underline">Otomatis</button>}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <Angka label="Kolom RC" nilai={t.K} step={1} onUbah={v => v >= 1 && v <= 256 && ubahJumlah('lebarKol', Math.round(v))} />
                <Angka label="Baris RC" nilai={t.B} step={1} onUbah={v => v >= 1 && v <= 256 && ubahJumlah('tinggiBaris', Math.round(v))} />
              </div>
              <div>
                <span className={kelasJudul}>Lebar tiap kolom (px)</span>
                <div className="flex gap-1 overflow-x-auto pb-1 mt-1">
                  {t.lebar.map((w, i) => <AngkaKecil key={i} nilai={w} label={`Lebar kolom ${i + 1}`} onUbah={v => ubah({ lebarKol: t.lebar.map((x, j) => (j === i ? v : x)), tinggiBaris: [...t.tinggi] })} />)}
                </div>
              </div>
              <div>
                <span className={kelasJudul}>Tinggi tiap baris (px)</span>
                <div className="flex gap-1 overflow-x-auto pb-1 mt-1">
                  {t.tinggi.map((h, i) => <AngkaKecil key={i} nilai={h} label={`Tinggi baris ${i + 1}`} onUbah={v => ubah({ tinggiBaris: t.tinggi.map((x, j) => (j === i ? v : x)), lebarKol: [...t.lebar] })} />)}
                </div>
              </div>
              <div className="flex items-end gap-1.5 flex-wrap">
                <span className="text-[11.5px] text-slate-600 w-full">Samakan semua receiving card:</span>
                <AngkaKecil nilai={samaW} label="Lebar semua (px)" onUbah={setSamaW} /><span className="text-slate-500 text-sm pb-1">×</span>
                <AngkaKecil nilai={samaH} label="Tinggi semua (px)" onUbah={setSamaH} />
                <button type="button" className={kelasTombol} onClick={() => ubah({ lebarKol: t.lebar.map(() => samaW), tinggiBaris: t.tinggi.map(() => samaH) })}>Terapkan</button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11.5px] text-slate-600">Sel kosong: <b className="text-slate-800">{t.kosong.size}</b></span>
            <div className="flex gap-1.5">
              <button type="button" className={`${kelasTombol} ${alatEf === 'kosong' ? 'ring-2 ring-blue-300 border-blue-400 text-blue-800 bg-blue-50' : ''}`}
                onClick={() => setAlat(alatEf === 'kosong' ? (s.mode === 'manual' ? 'kabel' : null) : 'kosong')} aria-pressed={alatEf === 'kosong'}>
                <SquareDashed size={13} /> {alatEf === 'kosong' ? 'Selesai' : 'Kosongkan sel'}
              </button>
              {t.kosong.size > 0 && <button type="button" className={kelasTombol} onClick={() => ubah({ kosong: [] })}>Isi semua</button>}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-3 space-y-3">
          <Angka label="Kapasitas per port" nilai={t.pxPort} satuan="px" step={1000} onUbah={v => v >= 1000 && ubah({ pxPort: Math.round(v) })}
            bantuan={s.pxPort === null ? `Dari kalkulator: ${d.refresh} Hz, ${d.bit}-bit` : 'Diisi manual'} />
          {s.pxPort !== null && <button type="button" onClick={() => ubah({ pxPort: null })} className="-mt-2 text-[12px] font-semibold text-blue-700 hover:underline">Ikut kalkulator ({d.pxPerPort.toLocaleString('id-ID')} px)</button>}
          <Angka label="Batas beban port" nilai={s.beban} satuan="%" step={1} onUbah={v => v >= 10 && v <= 100 && ubah({ beban: Math.round(v) })}
            bantuan={`Maks ${Math.floor((t.pxPort * s.beban) / 100).toLocaleString('id-ID')} px per port`} />
          <Angka label="Port per controller" nilai={t.ppk} step={1} satuan="port" onUbah={v => v >= 0 && ubah({ ppk: Math.round(v) })}
            bantuan={s.ppk === null ? (d.namaHw ? `Dari ${d.namaHw}` : 'Belum ada hardware: isi manual') : 'Diisi manual'} />
          {s.ppk !== null && d.ppkHw > 0 && <button type="button" onClick={() => ubah({ ppk: null })} className="-mt-2 text-[12px] font-semibold text-blue-700 hover:underline">Ikut hardware ({d.ppkHw} port)</button>}
        </section>
      </div>

      {/* ── Kanvas & tabel ── */}
      <div className="space-y-3 min-w-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Nilai label="Receiving card" nilai={k.sel.length + k.tanpaPort.length} ket={`${t.K} × ${t.B}${t.kosong.size ? ` · ${t.kosong.size} kosong` : ''}`} />
          <Nilai label="Port LAN dipakai" nilai={t.portTerpakai} ket={`perkiraan pixel: ${d.portIdeal}`} nada={t.portTerpakai > d.portIdeal ? 'awas' : undefined} />
          <Nilai label="Controller" nilai={t.ppk > 0 ? t.controller : '-'} ket={t.ppk > 0 ? `${t.ppk} port/unit${d.namaHw && s.ppk === null ? ` · ${d.namaHw}` : ''}` : 'isi port per controller'} />
          <Nilai label="Beban rata-rata" nilai={f(rataBeban, 0)} satuan="%" ket={`resolusi ${t.resX}×${t.resY}`} />
        </div>
        {k.galat && <p className="text-[12.5px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{k.galat}</p>}
        {s.mode === 'manual' && k.tanpaPort.length > 0 && (
          <p className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{k.tanpaPort.length} receiving card belum tersambung (bingkai jingga putus-putus).</p>
        )}
        {k.lewat.length > 0 && (
          <p className="text-[12.5px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">Port {k.lewat.join(', ')} melebihi batas beban {s.beban}% - pindahkan sebagian receiving card ke port lain.</p>
        )}
        {Math.max(...t.lebar) * Math.max(...t.tinggi) > PX_RC_UMUM && !k.galat && (
          <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Ada receiving card lebih dari ±512×512 px (kapasitas receiving card umum). Kecilkan area per receiving card atau cek tipe receiving card.
          </p>
        )}
        {t.custom && (t.resX !== resKalk.x || t.resY !== resKalk.y) && (
          <p className="text-[12.5px] text-amber-800">Resolusi receiving card ({t.resX}×{t.resY}) berbeda dari layar di kalkulator ({resKalk.x}×{resKalk.y}).</p>
        )}
        {s.mode === 'template' && s.bagi === 'baris' && zona > 1 && (
          <p className="text-[12.5px] text-slate-700">Satu {s.arah === 'horizontal' ? 'baris' : 'kolom'} melebihi kapasitas port, jadi layar dibagi <b>{zona} zona</b> yang dikabel terpisah. Pilih &quot;Isi penuh&quot; untuk menghemat port.</p>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 flex-wrap">
            <span className="text-[12px] text-slate-600">
              {alatEf === 'kabel' ? <>Mode kabel · port aktif <b style={{ color: warnaPort(portAktif) }}>P{portAktif}</b></>
                : alatEf === 'kosong' ? 'Mode kosongkan sel - klik sel untuk mengosongkan / mengisi'
                  : 'Template cepat - pilih "Manual" untuk menyambung sendiri'}
            </span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => void unduhPNG()} disabled={pngStatus === 'proses'} title="Unduh diagram + legenda port sebagai gambar PNG (resolusi 2x)" className={kelasTombol}>
                <IkonGambar size={14} /> {pngStatus === 'proses' ? 'Membuat...' : pngStatus === 'gagal' ? 'PNG gagal' : 'PNG'}
              </button>
              <button type="button" onClick={unduhSVG} title="Unduh diagram sebagai SVG (vektor, bisa diedit di Illustrator / Inkscape)" className={kelasTombol}><Download size={14} /> SVG</button>
            </div>
          </div>
          <div className="p-2 overflow-x-auto [&>svg]:mx-auto [&>svg]:block select-none" role="img"
            aria-label={`Diagram koneksi ${t.portTerpakai} port untuk ${k.sel.length} receiving card`}
            onPointerDown={e => {
              if (!alatEf) return;
              const sel = selDari(e.target as Element); if (!sel) return;
              e.preventDefault();
              try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* abaikan */ }
              klikSel(sel[0], sel[1]);
            }}
            onPointerMove={e => {
              if (!seret.current) return;
              const sel = selDari(document.elementFromPoint(e.clientX, e.clientY));
              if (sel) seretKe(sel[0], sel[1]);
            }}
            onPointerUp={() => { seret.current = false; }} onPointerCancel={() => { seret.current = false; }}
            dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-50 text-slate-600 sticky top-0">
              <tr>
                <th className="text-left font-bold px-3 py-2">Port</th>
                <th className="text-right font-bold px-3 py-2">RC</th>
                <th className="text-right font-bold px-3 py-2">Pixel</th>
                <th className="text-left font-bold px-3 py-2 w-40">Beban</th>
                <th className="text-left font-bold px-3 py-2">Masuk di</th>
              </tr>
            </thead>
            <tbody>
              {k.port.map(p => (
                <tr key={p.port} className={`border-t border-slate-100 ${s.mode === 'manual' ? 'cursor-pointer hover:bg-slate-50' : ''} ${s.mode === 'manual' && p.port === portAktif ? 'bg-blue-50/60' : ''}`}
                  onClick={() => s.mode === 'manual' && setPortAktif(p.port)}>
                  <td className="px-3 py-1.5 font-semibold text-slate-800 whitespace-nowrap">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style={{ background: warnaPort(p.port) }} />{namaPort(t, p.port)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{p.jumlah}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{p.px.toLocaleString('id-ID')}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full ${p.beban > 100 ? 'bg-rose-600' : p.beban > s.beban ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, p.beban)}%` }} />
                      </div>
                      <span className="tabular-nums w-9 text-right">{f(p.beban, 0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{p.mulai ? `kolom ${p.mulai.c + 1}, baris ${p.mulai.r + 1}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Catatan>Label sel = port-urutan receiving card, angka kecil = ukuran receiving card (px); P1, P2, … = titik masuk kabel LAN. Samakan dengan NovaLCT (Screen Configuration → Screen Connection) saat instalasi.</Catatan>
      </div>
    </div>
  );
}
