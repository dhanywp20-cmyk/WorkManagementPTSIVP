import { HURUF } from './gaya';

export const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const n = (v: number) => String(Math.round(v * 100) / 100);

const SEMPIT = new Set([...'il.,:;|!\'`']);
const AGAK = new Set([...'fjtrI()[]-/"*']);
const LEBAR = new Set([...'mwMW@%']);

function lebarHuruf(c: string): number {
  if (c === ' ') return 0.278;
  if (SEMPIT.has(c)) return 0.25;
  if (AGAK.has(c)) return 0.33;
  if (LEBAR.has(c)) return 0.86;
  if (/[0-9]/.test(c)) return 0.556;
  if (/[A-Z]/.test(c)) return 0.68;
  if (/[a-z]/.test(c)) return 0.52;
  return 0.6;
}

export function lebarTeks(s: string, ukuran: number, tebal = false): number {
  let w = 0;
  for (const c of s) w += lebarHuruf(c);
  return w * ukuran * (tebal ? 1.07 : 1);
}

export function bungkus(s: string, maks: number, ukuran: number, tebal = false): string[] {
  const hasil: string[] = [];
  for (const paragraf of String(s ?? '').split('\n')) {
    const kata = paragraf.split(/ +/).filter(Boolean);
    if (!kata.length) { hasil.push(''); continue; }
    let baris = '';
    for (const k of kata) {
      const coba = baris ? `${baris} ${k}` : k;
      if (!baris || lebarTeks(coba, ukuran, tebal) <= maks) { baris = coba; continue; }
      hasil.push(baris);
      baris = k;
    }
    hasil.push(baris);
  }
  return hasil;
}

export function potong(s: string, maks: number, ukuran: number, tebal = false): string {
  if (lebarTeks(s, ukuran, tebal) <= maks) return s;
  let t = s;
  while (t.length > 1 && lebarTeks(`${t}…`, ukuran, tebal) > maks) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export interface OpsiTeks { ukuran: number; warna: string; tebal?: boolean; tengah?: boolean; kanan?: boolean; putar?: number; pusatV?: boolean }

export function teks(x: number, y: number, isi: string, o: OpsiTeks): string {
  const anchor = o.tengah ? 'middle' : o.kanan ? 'end' : 'start';
  const putar = o.putar ? ` transform="rotate(${o.putar} ${n(x)} ${n(y)})"` : '';
  const dy = o.pusatV ? ` dy="${n(o.ukuran * 0.35)}"` : '';
  return `<text x="${n(x)}" y="${n(y)}"${dy} font-family="${HURUF}" font-size="${n(o.ukuran)}" fill="${o.warna}"${o.tebal ? ' font-weight="700"' : ''}`
    + ` text-anchor="${anchor}"${putar}>${esc(isi)}</text>`;
}

export const garis = (x1: number, y1: number, x2: number, y2: number, warna: string, tebal: number) =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${warna}" stroke-width="${n(tebal)}"/>`;

export const kotak = (x: number, y: number, w: number, h: number, o: { isi?: string; garis?: string; tebal?: number; r?: number }) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${o.r ? ` rx="${n(o.r)}"` : ''} fill="${o.isi ?? 'none'}"`
  + `${o.garis ? ` stroke="${o.garis}" stroke-width="${n(o.tebal ?? 0.2)}"` : ''}/>`;
