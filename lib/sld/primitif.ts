import { HURUF } from './gaya';
import { esc, n } from './teks';

export type Rata = 'kiri' | 'tengah' | 'kanan';

export type Prim =
  | { t: 'kotak'; x: number; y: number; w: number; h: number; isi?: string; garis?: string; tebal?: number; r?: number }
  | { t: 'garis'; x1: number; y1: number; x2: number; y2: number; warna: string; tebal: number; putus?: string }
  | { t: 'lingkaran'; cx: number; cy: number; r: number; isi: string; garis?: string; tebal?: number }
  | { t: 'teks'; x: number; y: number; isi: string; ukuran: number; warna: string; tebal?: boolean; rata?: Rata; putar?: number; pusatV?: boolean }
  | { t: 'runs'; x: number; y: number; ukuran: number; warna: string; runs: { isi: string; tebal: boolean }[] }
  | { t: 'sel'; x: number; y: number; w: number; h: number; isi: string; garis: string; tebal: number; baris: string[]; ukuran: number; warna: string; huruf: boolean; jarak: number }
  | { t: 'gambar'; x: number; y: number; w: number; h: number; perangkat: string };

export function svgTeks(p: Extract<Prim, { t: 'teks' }>): string {
  const anchor = p.rata === 'tengah' ? 'middle' : p.rata === 'kanan' ? 'end' : 'start';
  const putar = p.putar ? ` transform="rotate(${p.putar} ${n(p.x)} ${n(p.y)})"` : '';
  const dy = p.pusatV ? ` dy="${n(p.ukuran * 0.35)}"` : '';
  return `<text x="${n(p.x)}" y="${n(p.y)}"${dy} font-family="${HURUF}" font-size="${n(p.ukuran)}" fill="${p.warna}"${p.tebal ? ' font-weight="700"' : ''}`
    + ` text-anchor="${anchor}"${putar}>${esc(p.isi)}</text>`;
}

const svgKotak = (x: number, y: number, w: number, h: number, isi = 'none', garis?: string, tebal = 0.2, r?: number) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r ? ` rx="${n(r)}"` : ''} fill="${isi}"${garis ? ` stroke="${garis}" stroke-width="${n(tebal)}"` : ''}/>`;

export function svgPrimitif(daftar: Prim[], gambar: (id: string, x: number, y: number, w: number, h: number) => string): string {
  return daftar.map(p => {
    switch (p.t) {
      case 'kotak': return svgKotak(p.x, p.y, p.w, p.h, p.isi, p.garis, p.tebal, p.r);
      case 'garis': return `<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}" stroke="${p.warna}" stroke-width="${n(p.tebal)}"${p.putus ? ` stroke-dasharray="${p.putus}"` : ''}/>`;
      case 'lingkaran': return `<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" fill="${p.isi}"${p.garis ? ` stroke="${p.garis}" stroke-width="${n(p.tebal ?? 0.25)}"` : ''}/>`;
      case 'teks': return svgTeks(p);
      case 'runs': return `<text x="${n(p.x)}" y="${n(p.y)}" font-family="${HURUF}" font-size="${n(p.ukuran)}" fill="${p.warna}">`
        + `${p.runs.map(r => (r.tebal ? `<tspan font-weight="700">${esc(r.isi)}</tspan>` : esc(r.isi))).join('')}</text>`;
      case 'sel': return svgKotak(p.x, p.y, p.w, p.h, p.isi, p.garis, p.tebal)
        + p.baris.map((s, i) => svgTeks({ t: 'teks', x: p.x + 1, y: p.y + 0.9 + p.ukuran * 0.92 + i * p.jarak, isi: s, ukuran: p.ukuran, warna: p.warna, tebal: p.huruf })).join('');
      case 'gambar': return gambar(p.perangkat, p.x, p.y, p.w, p.h);
    }
  }).join('');
}
