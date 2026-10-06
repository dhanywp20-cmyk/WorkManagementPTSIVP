'use client';
import { LEGENDA_KABEL, type GolonganKabel } from '../inti';
import { esc } from '../../cetak';

/**
 * Legend warna kabel. Aturannya satu: tampil HANYA saat "Jalur kabel" dicentang - di sisi kanvas,
 * di PNG (panel samping / baris bawah, tidak menutupi gambar ruangan), dan di lembar cetak.
 * Ketujuh warna standar selalu tercantum; yang tidak dipakai di desain ini dipudarkan.
 */

const hex = (w: number) => `#${w.toString(16).padStart(6, '0')}`;
const teks = (l: (typeof LEGENDA_KABEL)[number]) => `${l.nama} - ${l.label}`;
const HURUF = 'Segoe UI, Arial, sans-serif';

/** Overlay di sisi kanan bawah kanvas 3D. */
export function LegendaKabel({ dipakai }: { dipakai: Set<GolonganKabel> }) {
  return (
    <div className="absolute right-2 bottom-2 z-10 rounded-xl bg-white/95 backdrop-blur border border-slate-200 shadow-md px-2.5 py-2 max-w-[calc(100%-120px)]"
      role="note" aria-label="Legend warna kabel">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600 mb-1">Legend kabel</p>
      <ul className="space-y-0.5">
        {LEGENDA_KABEL.map(l => (
          <li key={l.golongan} className={`flex items-center gap-1.5 text-[11px] leading-tight ${dipakai.has(l.golongan) ? 'text-slate-800 font-semibold' : 'text-slate-400'}`}>
            <span className="inline-block w-5 h-[3px] rounded-full flex-shrink-0" style={{ background: hex(l.warna), opacity: dipakai.has(l.golongan) ? 1 : 0.45 }} />
            <span className="truncate">{teks(l)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Satu butir legend (garis warna + teks) di kanvas; mengembalikan lebar yang dipakai. */
function butir(g: CanvasRenderingContext2D, x: number, cy: number, l: (typeof LEGENDA_KABEL)[number], ada: boolean, k: number): number {
  const garis = 22 * k;
  g.globalAlpha = ada ? 1 : 0.45;
  g.strokeStyle = hex(l.warna); g.lineWidth = 3.5 * k; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, cy); g.lineTo(x + garis, cy); g.stroke();
  g.fillStyle = ada ? '#1e293b' : '#94a3b8'; g.font = `${ada ? 600 : 400} ${Math.round(12 * k)}px ${HURUF}`; g.textBaseline = 'middle';
  g.fillText(teks(l), x + garis + 7 * k, cy);
  g.globalAlpha = 1;
  return garis + 7 * k + g.measureText(teks(l)).width;
}

/**
 * Foto + panel legend di SAMPING kanan (kanvas baru, lebih lebar) - legend tidak menutupi ruangan.
 * `k` = skala huruf (piksel foto per piksel layar).
 */
export function denganLegendaSamping(foto: HTMLCanvasElement, dipakai: Set<GolonganKabel>, k: number): HTMLCanvasElement {
  const ukur = document.createElement('canvas').getContext('2d')!;
  ukur.font = `600 ${Math.round(12 * k)}px ${HURUF}`;
  const pad = 18 * k, baris = 22 * k;
  const lebarPanel = Math.ceil(Math.max(...LEGENDA_KABEL.map(l => ukur.measureText(teks(l)).width)) + 22 * k + 7 * k + pad * 2);
  const c = document.createElement('canvas'); c.width = foto.width + lebarPanel; c.height = foto.height;
  const g = c.getContext('2d'); if (!g) return foto;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(foto, 0, 0);
  g.fillStyle = '#e2e8f0'; g.fillRect(foto.width, 0, Math.max(1, k), c.height);
  const x = foto.width + pad, y0 = pad;
  g.fillStyle = '#475569'; g.font = `700 ${Math.round(12 * k)}px ${HURUF}`; g.textBaseline = 'middle';
  g.fillText('LEGEND KABEL', x, y0 + baris / 2);
  LEGENDA_KABEL.forEach((l, i) => butir(g, x, y0 + baris * (i + 1.6), l, dipakai.has(l.golongan), k));
  return c;
}

/** Legend mendatar (dibungkus ke baris berikutnya bila tidak muat). Mengembalikan tinggi yang dipakai. */
export function gambarLegendaBaris(g: CanvasRenderingContext2D | null, x: number, y: number, lebar: number, dipakai: Set<GolonganKabel>, k: number): number {
  const ukur = g ?? document.createElement('canvas').getContext('2d')!;
  ukur.font = `700 ${Math.round(12 * k)}px ${HURUF}`;
  const judul = 'LEGEND KABEL', jarak = 22 * k, baris = 24 * k;
  let cx = x + ukur.measureText(judul).width + jarak, cy = y + baris / 2;
  if (g) { g.fillStyle = '#475569'; g.textBaseline = 'middle'; g.fillText(judul, x, cy); }
  for (const l of LEGENDA_KABEL) {
    ukur.font = `600 ${Math.round(12 * k)}px ${HURUF}`;
    const w = 29 * k + ukur.measureText(teks(l)).width;
    if (cx + w > x + lebar) { cx = x; cy += baris; }
    if (g) butir(g, cx, cy, l, dipakai.has(l.golongan), k);
    cx += w + jarak;
  }
  return cy - y + baris / 2;
}

/** Bagian legend untuk lembar cetak A4 (HTML; teks di-escape). */
export function htmlLegendaKabel(dipakai: Set<GolonganKabel>): string {
  const isi = LEGENDA_KABEL.map(l => {
    const ada = dipakai.has(l.golongan);
    return `<span style="display:inline-flex;align-items:center;gap:6px;margin:3px 16px 3px 0;${ada ? 'font-weight:600' : 'color:#94a3b8'}">`
      + `<span style="display:inline-block;width:24px;height:4px;border-radius:2px;background:${hex(l.warna)};${ada ? '' : 'opacity:.45'}"></span>${esc(teks(l))}</span>`;
  }).join('');
  return `<div style="display:flex;flex-wrap:wrap">${isi}</div>`;
}
