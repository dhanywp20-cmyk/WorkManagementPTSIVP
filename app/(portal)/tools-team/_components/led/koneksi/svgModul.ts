import { type DataKoneksi, kunci, type Susunan } from './data';

const n = (v: number) => Math.round(v * 10) / 10;
const HURUF = 'font-family="Segoe UI,Arial"';
const MAKS_UBIN = 9000;

export const KET_LABEL_SEL = 'label sel = port-urutan, START = RC pertama, END (kotak) = RC terakhir tiap port, angka kecil = ukuran receiving card (px)';

export const namaUnitKoneksi = (d: DataKoneksi) => (d.satuan === 'cabinet' ? 'cabinet' : 'modul');

export function modulPerSel(d: DataKoneksi, t: Susunan, c: number, r: number) {
  return { k: Math.max(1, Math.round(t.lebar[c] / Math.max(1, d.pxX))), b: Math.max(1, Math.round(t.tinggi[r] / Math.max(1, d.pxY))) };
}

export function bisaUbin(d: DataKoneksi, t: Susunan, xs: number[], ys: number[]) {
  let total = 0, terkecil = Infinity;
  for (let r = 0; r < t.B; r++) for (let c = 0; c < t.K; c++) {
    const m = modulPerSel(d, t, c, r);
    total += m.k * m.b;
    terkecil = Math.min(terkecil, (xs[c + 1] - xs[c]) / m.k, (ys[r + 1] - ys[r]) / m.b);
  }
  return total <= MAKS_UBIN && terkecil >= 5;
}

export function ubinModul(d: DataKoneksi, t: Susunan, xs: number[], ys: number[]) {
  const per: string[] = [];
  for (let r = 0; r < t.B; r++) for (let c = 0; c < t.K; c++) {
    if (t.kosong.has(kunci(c, r))) continue;
    const m = modulPerSel(d, t, c, r);
    const w = (xs[c + 1] - xs[c]) / m.k, h = (ys[r + 1] - ys[r]) / m.b;
    const g = Math.max(0.8, Math.min(3, Math.min(w, h) * 0.06));
    const ubin: string[] = [];
    for (let j = 0; j < m.b; j++) for (let i = 0; i < m.k; i++) {
      ubin.push(`<rect x="${n(xs[c] + i * w + g)}" y="${n(ys[r] + j * h + g)}" width="${n(w - 2 * g)}" height="${n(h - 2 * g)}" rx="${n(Math.min(2, g))}"/>`);
    }
    per.push(ubin.join(''));
  }
  return `<g fill="#ffffff" fill-opacity="0.55" stroke="#94a3b8" stroke-opacity="0.55" stroke-width="0.7">${per.join('')}</g>`;
}

export function teksSpekRC(d: DataKoneksi, t: Susunan) {
  const u = namaUnitKoneksi(d);
  if (t.custom) return `${u} ${d.wUnit}×${d.hUnit} mm · ${d.pxX}×${d.pxY} px · ukuran receiving card custom`;
  const isi = t.rcKol * t.rcBaris > 1 ? `${t.rcKol}×${t.rcBaris} ${u} (${t.rcKol * t.rcBaris} ${u})` : `1 ${u}`;
  return `1 RC = ${isi} · ${t.rcKol * d.wUnit}×${t.rcBaris * d.hUnit} mm · `
    + `${t.rcKol * d.pxX}×${t.rcBaris * d.pxY} px · 1 ${u} ${d.wUnit}×${d.hUnit} mm, ${d.pxX}×${d.pxY} px`;
}

function garisUkur(x1: number, y1: number, x2: number, y2: number, teks: string, putar: boolean) {
  const t = 4, tegak = x1 === x2;
  const ujung = tegak
    ? `<line x1="${n(x1 - t)}" x2="${n(x1 + t)}" y1="${n(y1)}" y2="${n(y1)}"/><line x1="${n(x2 - t)}" x2="${n(x2 + t)}" y1="${n(y2)}" y2="${n(y2)}"/>`
    : `<line x1="${n(x1)}" x2="${n(x1)}" y1="${n(y1 - t)}" y2="${n(y1 + t)}"/><line x1="${n(x2)}" x2="${n(x2)}" y1="${n(y2 - t)}" y2="${n(y2 + t)}"/>`;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const tx = tegak ? mx - 8 : mx, ty = tegak ? my : my + 15;
  return `<g stroke="#64748b" stroke-width="1"><line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"/>${ujung}</g>`
    + `<text x="${n(tx)}" y="${n(ty)}" font-size="10.5" fill="#334155" text-anchor="middle" ${HURUF}${putar ? ` transform="rotate(-90 ${n(tx)} ${n(ty)})"` : ''}>${teks}</text>`;
}

export function detailRC(d: DataKoneksi, t: Susunan, x: number, y: number, warna = '#1d4ed8') {
  if (t.custom) return null;
  const u = namaUnitKoneksi(d);
  const mmW = t.rcKol * d.wUnit, mmH = t.rcBaris * d.hUnit;
  const s = Math.min(240 / mmW, 170 / mmH);
  const w = mmW * s, h = mmH * s, mw = d.wUnit * s, mh = d.hUnit * s;
  const rx = x + 34, ry = y + 34;
  const ubin: string[] = [], lbl: string[] = [];
  const muat = mw >= 46 && mh >= 22;
  for (let j = 0; j < t.rcBaris; j++) for (let i = 0; i < t.rcKol; i++) {
    const g = Math.max(1, Math.min(3, Math.min(mw, mh) * 0.05));
    ubin.push(`<rect x="${n(rx + i * mw + g)}" y="${n(ry + j * mh + g)}" width="${n(mw - 2 * g)}" height="${n(mh - 2 * g)}" rx="2"/>`);
    if (muat) {
      const cx = rx + (i + 0.5) * mw, cy = ry + (j + 0.5) * mh;
      lbl.push(`<text x="${n(cx)}" y="${n(cy - 1)}" font-weight="700">M${j * t.rcKol + i + 1}</text><text x="${n(cx)}" y="${n(cy + 10)}" fill="#475569">${d.wUnit}×${d.hUnit}</text>`);
    }
  }
  const info = [
    `${t.rcKol * t.rcBaris} ${u} per receiving card (${t.rcKol} kolom × ${t.rcBaris} baris)`,
    `1 ${u}: ${d.wUnit} × ${d.hUnit} mm · ${d.pxX} × ${d.pxY} px`,
    `1 receiving card: ${mmW} × ${mmH} mm · ${t.rcKol * d.pxX} × ${t.rcBaris * d.pxY} px`,
    `Total: ${t.K * t.B} RC · ${d.kolom * d.baris} ${u} (${d.kolom} × ${d.baris})`,
  ];
  const ix = rx + w + 30;
  const svg = `<g>
<text x="${n(x)}" y="${n(y + 12)}" font-size="11" font-weight="800" fill="#1e3a8a" letter-spacing="0.6" ${HURUF}>DETAIL 1 RECEIVING CARD</text>
<rect x="${n(rx)}" y="${n(ry)}" width="${n(w)}" height="${n(h)}" fill="${warna}" fill-opacity="0.28" stroke="#0f172a" stroke-width="2"/>
<g fill="#ffffff" fill-opacity="0.75" stroke="${warna}" stroke-opacity="0.6" stroke-width="0.8">${ubin.join('')}</g>
${muat ? `<g font-size="9.5" text-anchor="middle" fill="#0f172a" ${HURUF}>${lbl.join('')}</g>` : ''}
${garisUkur(rx, ry + h + 12, rx + w, ry + h + 12, `${mmW} mm · ${t.rcKol * d.pxX} px`, false)}
${garisUkur(rx - 14, ry, rx - 14, ry + h, `${mmH} mm · ${t.rcBaris * d.pxY} px`, true)}
<g font-size="11.5" fill="#1e293b" ${HURUF}>${info.map((l, i) => `<text x="${n(ix)}" y="${n(ry + 12 + i * 19)}"${i === 0 ? ' font-weight="700"' : ''}>${l}</text>`).join('')}</g>
</g>`;
  return { svg, w: ix - x + 330, h: Math.max(h, info.length * 19) + 34 + 40 };
}

export function ujungPort(t: Susunan) {
  const ujung = new Map<number, { awal: { c: number; r: number; urut: number }; akhir: { c: number; r: number; urut: number } }>();
  for (const s of t.hasil.sel) {
    const u = ujung.get(s.port);
    if (!u) { ujung.set(s.port, { awal: s, akhir: s }); continue; }
    if (s.urut < u.awal.urut) u.awal = s;
    if (s.urut > u.akhir.urut) u.akhir = s;
  }
  return ujung;
}

export const ukuranPil = (selMin: number) => Math.max(6, Math.min(9, selMin * 0.11));

export function selBerPil(t: Susunan, selMin: number) {
  const sel = new Set<string>();
  if (selMin < 30) return sel;
  ujungPort(t).forEach(({ awal, akhir }) => { sel.add(kunci(awal.c, awal.r)); sel.add(kunci(akhir.c, akhir.r)); });
  return sel;
}

function pil(x: number, y: number, teks: string, warna: string, isi: boolean, fb: number) {
  const w = 8 + teks.length * fb * 0.62, h = fb + 5;
  return `<rect x="${n(x - w / 2)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(h / 2)}" fill="${isi ? warna : '#ffffff'}" stroke="${isi ? '#ffffff' : warna}" stroke-width="1.2"/>`
    + `<text x="${n(x)}" y="${n(y + h - 3.6)}" font-size="${n(fb)}" font-weight="800" letter-spacing="0.4" text-anchor="middle" fill="${isi ? '#ffffff' : warna}" ${HURUF}>${teks}</text>`;
}

export function penandaStartEnd(t: Susunan, pusat: (c: number, r: number) => number[], o: {
  selMin: number; geser: number; r: number; warna: (port: number) => string; kode: (port: number) => string;
}) {
  const out: string[] = [];
  const fb = ukuranPil(o.selMin);
  const teks = o.selMin >= 30;
  ujungPort(t).forEach(({ awal, akhir }, port) => {
    const warna = o.warna(port), kode = o.kode(port);
    const [ax, ay] = pusat(akhir.c, akhir.r);
    const sama = awal.c === akhir.c && awal.r === akhir.r;
    const yA = ay + o.geser;
    if (!sama) {
      const s = o.r * 1.7;
      out.push(`<rect x="${n(ax - s / 2)}" y="${n(yA - s / 2)}" width="${n(s)}" height="${n(s)}" rx="1.5" fill="#ffffff" stroke="${warna}" stroke-width="2.2"/>`);
      out.push(`<rect x="${n(ax - s / 4)}" y="${n(yA - s / 4)}" width="${n(s / 2)}" height="${n(s / 2)}" fill="${warna}"/>`);
    }
    if (!teks) return;
    const [sx, sy] = pusat(awal.c, awal.r);
    if (sama) { out.push(pil(sx, sy + o.geser + o.r + 3, `START · END ${kode}`, warna, true, fb)); return; }
    out.push(pil(sx, sy + o.geser + o.r + 3, `START ${kode}`, warna, true, fb));
    out.push(pil(ax, yA + o.r + 3, `END ${kode}`, warna, false, fb));
  });
  return out.join('');
}
