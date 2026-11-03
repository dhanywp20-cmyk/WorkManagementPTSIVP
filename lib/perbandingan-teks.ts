export type Huruf = 'Sans' | 'SansBold' | 'SansItalic' | 'Centang';
export interface Potong { t: string; f: Huruf; c: string }
interface Kata { t: string; f: Huruf; c: string; w: number; spasi: boolean }
export interface BarisTeks { kata: Kata[]; w: number }

export interface DokPdf {
  font(n: string): DokPdf; fontSize(s: number): DokPdf; fillColor(c: string | object): DokPdf;
  widthOfString(s: string, o?: object): number;
  text(t: string, x: number, y: number, o?: object): DokPdf;
}

export function tataBaris(doc: DokPdf, potong: Potong[], lebar: number, uk: number, jarak = 0): BarisTeks[] {
  const kata: Kata[] = [];
  let sisaSpasi = false;
  for (const p of potong) {
    doc.font(p.f).fontSize(uk);
    for (const m of p.t.matchAll(/(\s*)(\S+)/g)) {
      kata.push({ t: m[2], f: p.f, c: p.c, w: doc.widthOfString(m[2], { characterSpacing: jarak }), spasi: m[1].length > 0 || sisaSpasi });
      sisaSpasi = false;
    }
    if (/\s$/.test(p.t)) sisaSpasi = true;
  }
  const spasiW = (f: Huruf) => { doc.font(f === 'Centang' ? 'Sans' : f).fontSize(uk); return doc.widthOfString(' ') + jarak; };
  const baris: BarisTeks[] = [];
  let kini: BarisTeks = { kata: [], w: 0 };
  for (const k of kata) {
    let sp = kini.kata.length && k.spasi ? spasiW(k.f) : 0;
    if (kini.kata.length && kini.w + sp + k.w > lebar) { baris.push(kini); kini = { kata: [], w: 0 }; sp = 0; }
    kini.kata.push({ ...k, spasi: sp > 0 });
    kini.w += sp + k.w;
  }
  if (kini.kata.length) baris.push(kini);
  return baris;
}

export function gambarBaris(doc: DokPdf, baris: BarisTeks[], x: number, y: number, uk: number, tinggi: number, opsi: { jarak?: number; tengah?: number } = {}) {
  baris.forEach((b, i) => {
    let cx = opsi.tengah !== undefined ? x + (opsi.tengah - b.w) / 2 : x;
    const cy = y + i * tinggi + (tinggi - uk * 1.15) / 2;
    for (const k of b.kata) {
      if (k.spasi) { doc.font(k.f === 'Centang' ? 'Sans' : k.f).fontSize(uk); cx += doc.widthOfString(' ') + (opsi.jarak ?? 0); }
      doc.font(k.f).fontSize(uk).fillColor(k.c).text(k.t, cx, cy, { lineBreak: false, characterSpacing: opsi.jarak ?? 0 });
      cx += k.w;
    }
  });
}

export function potongKaya(s: string, f: Huruf, c: string, fTebal: Huruf = 'SansBold', cTebal = c): Potong[] {
  return s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(p => (p.startsWith('**') && p.endsWith('**') ? { t: p.slice(2, -2), f: fTebal, c: cTebal } : { t: p, f, c }));
}
