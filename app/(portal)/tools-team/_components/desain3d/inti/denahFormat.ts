/**
 * Denah 2D (inti/denah.ts) ke SVG berskala (lembar cetak A4: lebar dalam mm = skala sebenarnya) dan ke DXF
 * R12 (satuan mm, lapis terpisah) untuk dibuka di AutoCAD / software CAD lain. Murni (uji/desain3d-denah.ts).
 */
import type { Denah, LapisDenah, P2, TulisanDenah } from './denah';

/** Skala gambar kerja yang umum (1 : N). */
export const SKALA_DENAH = [20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000];

/** Skala terbesar yang membuat denah muat di area cetak (mm). */
export function skalaDenah(d: Denah, maksLebarMm = 165, maksTinggiMm = 220): number {
  const w = (d.batas.x1 - d.batas.x0) * 1000, h = (d.batas.z1 - d.batas.z0) * 1000;
  return SKALA_DENAH.find(n => w / n <= maksLebarMm && h / n <= maksTinggiMm) ?? SKALA_DENAH[SKALA_DENAH.length - 1];
}

const WARNA: Record<LapisDenah, string> = { DINDING: '#0f172a', BUKAAN: '#0369a1', BENDA: '#334155', PLAFON: '#7c3aed', TEKS: '#0f172a', UKURAN: '#dc2626' };
const TEBAL: Record<LapisDenah, number> = { DINDING: 0.035, BUKAAN: 0.012, BENDA: 0.012, PLAFON: 0.01, TEKS: 0, UKURAN: 0.008 };
/** Tinggi tulisan di kertas (mm) - teks diperbesar sesuai skala supaya tetap terbaca saat dicetak. */
const KERTAS_MM: Record<LapisDenah, number> = { DINDING: 2, BUKAAN: 2, BENDA: 2, PLAFON: 1.8, TEKS: 2, UKURAN: 2.3 };
/** Tinggi (m di ruangan) & titik tulisan setelah digeser menjauhi garis ukur. */
export function tataTulisan(t: TulisanDenah, skala: number): { h: number; p: P2 } {
  const h = Math.max(t.tinggi, (KERTAS_MM[t.lapis] * skala) / 1000);
  return { h, p: t.geser ? [t.p[0] + t.geser[0] * h * 0.75, t.p[1] + t.geser[1] * h * 0.75] : t.p };
}
const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n4 = (v: number) => Math.round(v * 10000) / 10000;

/** SVG denah dalam meter (viewBox), lebar & tinggi dalam mm sesuai skala 1 : N, plus bar skala 1 m. */
export function svgDenah(d: Denah, skala = skalaDenah(d)): string {
  const { x0, z0, x1, z1 } = d.batas;
  const bawah = 0.45, w = x1 - x0, h = z1 - z0 + bawah;
  const titik = (p: P2) => `${n4(p[0])},${n4(p[1])}`;
  const isi: string[] = [];
  for (const l of d.garis) {
    isi.push(`<line x1="${n4(l.a[0])}" y1="${n4(l.a[1])}" x2="${n4(l.b[0])}" y2="${n4(l.b[1])}" stroke="${WARNA[l.lapis]}" stroke-width="${TEBAL[l.lapis]}"${l.putus ? ' stroke-dasharray="0.08 0.05"' : ''}/>`);
  }
  for (const b of d.busur) {
    const rad = (a: number) => (a * Math.PI) / 180;
    const a: P2 = [b.c[0] + b.r * Math.cos(rad(b.a0)), b.c[1] + b.r * Math.sin(rad(b.a0))];
    const e: P2 = [b.c[0] + b.r * Math.cos(rad(b.a1)), b.c[1] + b.r * Math.sin(rad(b.a1))];
    const besar = ((((b.a1 - b.a0) % 360) + 360) % 360) > 180 ? 1 : 0;
    isi.push(`<path d="M${titik(a)} A${n4(b.r)},${n4(b.r)} 0 ${besar} 1 ${titik(e)}" fill="none" stroke="${WARNA[b.lapis]}" stroke-width="${TEBAL[b.lapis]}" stroke-dasharray="0.04 0.03"/>`);
  }
  for (const t of d.tulisan) {
    const { h: tinggi, p } = tataTulisan(t, skala);
    const putar = t.sudut ? ` transform="rotate(${t.sudut} ${titik(p)})"` : '';
    isi.push(`<text x="${n4(p[0])}" y="${n4(p[1])}" font-size="${n4(tinggi)}" text-anchor="middle" dominant-baseline="middle" fill="${WARNA[t.lapis]}" font-family="Segoe UI,Arial,sans-serif"${t.lapis === 'UKURAN' ? ' font-weight="700"' : ''}${putar}>${escXml(t.teks)}</text>`);
  }
  //  Bar skala 1 m (hitam-putih per 0,5 m) & keterangan skala di bawah denah.
  const yb = z1 + 0.15;
  isi.push(`<rect x="${n4(x0 + 0.1)}" y="${n4(yb)}" width="0.5" height="0.06" fill="#0f172a"/><rect x="${n4(x0 + 0.6)}" y="${n4(yb)}" width="0.5" height="0.06" fill="#fff" stroke="#0f172a" stroke-width="0.008"/>`);
  isi.push(`<text x="${n4(x0 + 1.2)}" y="${n4(yb + 0.05)}" font-size="${n4((2 * skala) / 1000)}" fill="#0f172a" font-family="Segoe UI,Arial,sans-serif">1 m · Skala 1:${skala} (A4) · ukuran dalam mm</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n4((w * 1000) / skala)}mm" height="${n4((h * 1000) / skala)}mm" viewBox="${n4(x0)} ${n4(z0)} ${n4(w)} ${n4(h)}" style="max-width:100%;height:auto;background:#fff">${isi.join('')}</svg>`;
}

const WARNA_DXF: Record<LapisDenah, number> = { DINDING: 7, BUKAAN: 5, BENDA: 8, PLAFON: 6, TEKS: 7, UKURAN: 1 };

/** Teks DXF R12: karakter non-ASCII sebagai \U+XXXX (dibaca AutoCAD), tanpa baris baru. */
const teksDxf = (s: string) => Array.from(s.replace(/[\r\n]+/g, ' ')).map(c => (c.charCodeAt(0) > 126 ? `\\U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}` : c)).join('');

/** DXF R12 ASCII, satuan mm; sumbu Y dibalik (depan ruangan di atas, seperti di kertas). */
export function dxfDenah(d: Denah, skala = skalaDenah(d)): string {
  const o: (string | number)[] = [];
  const kode = (...pasang: (string | number)[]) => o.push(...pasang);
  const X = (v: number) => Math.round(v * 10000) / 10, Y = (v: number) => -Math.round(v * 10000) / 10;
  const lapis = Object.keys(WARNA_DXF) as LapisDenah[];
  kode(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC');
  kode(0, 'SECTION', 2, 'TABLES');
  kode(0, 'TABLE', 2, 'LTYPE', 70, 2,
    0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, 0,
    0, 'LTYPE', 2, 'DASHED', 70, 0, 3, '__ __ __', 72, 65, 73, 2, 40, 120, 49, 80, 49, -40, 0, 'ENDTAB');
  kode(0, 'TABLE', 2, 'LAYER', 70, lapis.length);
  for (const l of lapis) kode(0, 'LAYER', 2, l, 70, 0, 62, WARNA_DXF[l], 6, l === 'PLAFON' ? 'DASHED' : 'CONTINUOUS');
  kode(0, 'ENDTAB', 0, 'ENDSEC');
  kode(0, 'SECTION', 2, 'ENTITIES');
  for (const l of d.garis) kode(0, 'LINE', 8, l.lapis, ...(l.putus ? [6, 'DASHED'] : []), 10, X(l.a[0]), 20, Y(l.a[1]), 30, 0, 11, X(l.b[0]), 21, Y(l.b[1]), 31, 0);
  //  Sumbu Y dibalik: sudut ikut berbalik tanda, jadi awal / akhir busur bertukar.
  for (const b of d.busur) kode(0, 'ARC', 8, b.lapis, 10, X(b.c[0]), 20, Y(b.c[1]), 30, 0, 40, X(b.r), 50, n4(-b.a1), 51, n4(-b.a0));
  for (const t of d.tulisan) {
    const { h, p } = tataTulisan(t, skala);
    kode(0, 'TEXT', 8, t.lapis, 10, X(p[0]), 20, Y(p[1]), 30, 0, 40, X(h), 1, teksDxf(t.teks), 50, n4(-(t.sudut ?? 0)), 72, 1, 73, 2, 11, X(p[0]), 21, Y(p[1]), 31, 0);
  }
  kode(0, 'ENDSEC', 0, 'EOF');
  const baris: string[] = [];
  for (let i = 0; i < o.length; i += 2) baris.push(String(o[i]).padStart(3, ' '), String(o[i + 1]));
  return baris.join('\r\n') + '\r\n';
}
