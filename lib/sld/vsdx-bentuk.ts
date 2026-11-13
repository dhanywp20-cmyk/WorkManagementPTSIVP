import { HURUF } from './gaya';
import type { Prim } from './primitif';
import { barisTeks, kotakTeks, WARNA_TEKS } from './teks-bebas';
import { lebarTeks } from './teks';
import type { TeksBebas, ZonaSLD } from './tipe';
import { GAYA_ZONA, hurufZona, labelZona, tebalZona, WARNA_ZONA } from './zona';

export const INCI = (mm: number) => mm / 25.4;
export const f = (v: number) => (Math.abs(v) < 1e-9 ? '0' : String(Math.round(v * 1e9) / 1e9));
export const xe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
export const sel = (n: string, v: string | number, tambahan = '') => `<Cell N='${n}' V='${typeof v === 'number' ? f(v) : xe(v)}'${tambahan}/>`;

let tinggiHalaman = 297;
export const aturTinggiHalaman = (h: number) => { tinggiHalaman = h; };
export const vy = (y: number) => INCI(tinggiHalaman - y);

export function pin(x: number, y: number, w: number, h: number, sudut = 0): string {
  return sel('PinX', INCI(x + w / 2)) + sel('PinY', vy(y + h / 2)) + sel('Width', INCI(w)) + sel('Height', INCI(h))
    + sel('LocPinX', INCI(w / 2), " F='Width*0.5'") + sel('LocPinY', INCI(h / 2), " F='Height*0.5'") + sel('Angle', sudut);
}

export const tanpaMargin = sel('LeftMargin', 0) + sel('RightMargin', 0) + sel('TopMargin', 0) + sel('BottomMargin', 0);

export function geomKotak(isi: boolean, garisAda: boolean): string {
  return `<Section N='Geometry' IX='0'>${sel('NoFill', isi ? 0 : 1)}${sel('NoLine', garisAda ? 0 : 1)}${sel('NoShow', 0)}`
    + "<Row T='RelMoveTo' IX='1'><Cell N='X' V='0'/><Cell N='Y' V='0'/></Row><Row T='RelLineTo' IX='2'><Cell N='X' V='1'/><Cell N='Y' V='0'/></Row>"
    + "<Row T='RelLineTo' IX='3'><Cell N='X' V='1'/><Cell N='Y' V='1'/></Row><Row T='RelLineTo' IX='4'><Cell N='X' V='0'/><Cell N='Y' V='1'/></Row>"
    + "<Row T='RelLineTo' IX='5'><Cell N='X' V='0'/><Cell N='Y' V='0'/></Row></Section>";
}

export interface Run { isi: string; ukuran: number; warna: string; tebal: boolean }

export function teksRun(runs: Run[], rata: 0 | 1 | 2, spasi = -1.1): string {
  const karakter = runs.map((r, i) => `<Row IX='${i}'>${sel('Font', HURUF.split(',')[0])}${sel('Color', r.warna)}${sel('Style', r.tebal ? 1 : 0)}`
    + `${sel('Size', INCI(r.ukuran), " U='PT'")}${sel('Case', 0)}${sel('Pos', 0)}${sel('FontScale', 1)}${sel('Letterspace', 0)}${sel('DblUnderline', 0)}`
    + `${sel('Overline', 0)}${sel('Strikethru', 0)}${sel('ColorTrans', 0)}${sel('LangID', 'en-US')}</Row>`).join('');
  const isi = runs.map((r, i) => `<cp IX='${i}'/>${xe(r.isi)}`).join('');
  return `<Section N='Character'>${karakter}</Section><Section N='Paragraph'><Row IX='0'>${sel('SpLine', spasi)}${sel('HorzAlign', rata)}</Row></Section>`
    + `|TEKS|<Text>${isi}</Text>`;
}

export const pisahTeks = (s: string): [string, string] => { const i = s.indexOf('|TEKS|'); return [s.slice(0, i), s.slice(i + 6)]; };

export function bentukTeksBebas(t: TeksBebas, id: number): string {
  const k = kotakTeks(t), w = k.w * 1.18 + 1.5;
  const [a, b] = pisahTeks(teksRun([{ isi: barisTeks(t).join('\n'), ukuran: t.ukuran, warna: WARNA_TEKS[t.warna], tebal: t.tebal }], 0, -1.25));
  return `<Shape ID='${id}' NameU='Teks' Type='Shape' LineStyle='3' FillStyle='3' TextStyle='3'>${pin(k.x + (k.w - w) / 2, k.y, w, k.h, (-(t.putar ?? 0) * Math.PI) / 180)}`
    + `${sel('LinePattern', 0)}${sel('FillPattern', 0)}${tanpaMargin}${sel('VerticalAlign', 0)}${a}${b}</Shape>`;
}

export function bentukZona(z: ZonaSLD, baru: () => number): string[] {
  const c = WARNA_ZONA[z.warna] ?? WARNA_ZONA.abu, l = labelZona(z);
  const kotak = `<Shape ID='${baru()}' NameU='Area' Type='Shape' LineStyle='3' FillStyle='3' TextStyle='3'>${pin(z.x, z.y, z.w, z.h)}`
    + `${sel('LineWeight', INCI(tebalZona(z)), " U='MM'")}${sel('LineColor', c)}${sel('LinePattern', 2)}${sel('FillPattern', 0)}`
    + `${sel('Rounding', INCI(GAYA_ZONA.sudut), " U='MM'")}${geomKotak(false, true)}</Shape>`;
  if (!l.w) return [kotak];
  const [a, b] = pisahTeks(teksRun([{ isi: z.label.trim(), ukuran: hurufZona(z), warna: c, tebal: true }], 1));
  return [kotak, `<Shape ID='${baru()}' NameU='Label area' Type='Shape' LineStyle='3' FillStyle='3' TextStyle='3'>${pin(l.x, l.y, l.w * 1.12, l.h)}`
    + `${sel('LinePattern', 0)}${sel('FillForegnd', '#ffffff')}${sel('FillPattern', 1)}${tanpaMargin}${sel('VerticalAlign', 1)}${a}${geomKotak(true, false)}${b}</Shape>`];
}

const pola = (putus?: string) => (!putus ? 1 : /^0\.[0-9]+ /.test(putus) ? 3 : 2);

export function bentukPrim(p: Prim, id: number, gambar: (perangkat: string) => { rid: string; jpeg: boolean; rasio?: number } | null): string {
  const awal = (jenis = 'Shape') => `<Shape ID='${id}' Type='${jenis}' LineStyle='3' FillStyle='3' TextStyle='3'>`;
  switch (p.t) {
    case 'kotak': {
      const isi = !!p.isi && p.isi !== 'none';
      return `${awal()}${pin(p.x, p.y, p.w, p.h)}${sel('LineWeight', INCI(p.tebal ?? 0.2), " U='MM'")}${sel('LineColor', p.garis ?? '#000000')}`
        + `${sel('LinePattern', p.garis ? 1 : 0)}${isi ? sel('FillForegnd', p.isi!) + sel('FillPattern', 1) : sel('FillPattern', 0)}`
        + `${p.r ? sel('Rounding', INCI(p.r), " U='MM'") : ''}${geomKotak(isi, !!p.garis)}</Shape>`;
    }
    case 'garis':
      return `<Shape ID='${id}' Type='Shape' LineStyle='3' FillStyle='3' TextStyle='3'>${sel('BeginX', INCI(p.x1))}${sel('BeginY', vy(p.y1))}${sel('EndX', INCI(p.x2))}`
        + `${sel('EndY', vy(p.y2))}${sel('PinX', INCI((p.x1 + p.x2) / 2))}${sel('PinY', vy((p.y1 + p.y2) / 2))}`
        + `${sel('Width', INCI(Math.hypot(p.x2 - p.x1, p.y2 - p.y1)))}${sel('Height', 0)}${sel('Angle', Math.atan2(-(p.y2 - p.y1), p.x2 - p.x1))}`
        + `${sel('LocPinX', INCI(Math.hypot(p.x2 - p.x1, p.y2 - p.y1) / 2), " F='Width*0.5'")}${sel('LocPinY', 0)}`
        + `${sel('LineWeight', INCI(p.tebal), " U='MM'")}${sel('LineColor', p.warna)}${sel('LinePattern', pola(p.putus))}`
        + `<Section N='Geometry' IX='0'>${sel('NoFill', 1)}<Row T='MoveTo' IX='1'><Cell N='X' V='0'/><Cell N='Y' V='0'/></Row>`
        + `<Row T='LineTo' IX='2'><Cell N='X' V='${f(INCI(Math.hypot(p.x2 - p.x1, p.y2 - p.y1)))}' F='Width'/><Cell N='Y' V='0'/></Row></Section></Shape>`;
    case 'lingkaran':
      return `${awal()}${pin(p.cx - p.r, p.cy - p.r, p.r * 2, p.r * 2)}${sel('LineWeight', INCI(p.tebal ?? 0.25), " U='MM'")}${sel('LineColor', p.garis ?? p.isi)}`
        + `${sel('FillForegnd', p.isi)}${sel('FillPattern', 1)}<Section N='Geometry' IX='0'>${sel('NoFill', 0)}${sel('NoLine', p.garis ? 0 : 1)}`
        + `<Row T='Ellipse' IX='1'><Cell N='X' V='${f(INCI(p.r))}'/><Cell N='Y' V='${f(INCI(p.r))}'/><Cell N='A' V='${f(INCI(p.r * 2))}'/>`
        + `<Cell N='B' V='${f(INCI(p.r))}'/><Cell N='C' V='${f(INCI(p.r))}'/><Cell N='D' V='${f(INCI(p.r * 2))}'/></Row></Section></Shape>`;
    case 'teks': {
      const w = lebarTeks(p.isi, p.ukuran, p.tebal) * 1.18 + 1.5, h = p.ukuran * 1.45;
      const geser = p.rata === 'tengah' ? 0 : p.rata === 'kanan' ? -w / 2 : w / 2;
      const yPusat = p.pusatV ? p.y : p.y - p.ukuran * 0.35;
      const [cx, cy] = p.putar ? [p.x, yPusat + geser] : [p.x + geser, yPusat];
      const [a, b] = pisahTeks(teksRun([{ isi: p.isi, ukuran: p.ukuran, warna: p.warna, tebal: !!p.tebal }], p.rata === 'tengah' ? 1 : p.rata === 'kanan' ? 2 : 0));
      return `${awal()}${pin(cx - w / 2, cy - h / 2, w, h, p.putar ? -Math.PI / 2 : 0)}${sel('LinePattern', 0)}${sel('FillPattern', 0)}${tanpaMargin}`
        + `${sel('VerticalAlign', 1)}${a}${b}</Shape>`;
    }
    case 'runs': {
      const total = p.runs.reduce((s, r) => s + lebarTeks(r.isi, p.ukuran, r.tebal), 0) * 1.18 + 1.5, h = p.ukuran * 1.45;
      const [a, b] = pisahTeks(teksRun(p.runs.map(r => ({ ...r, ukuran: p.ukuran, warna: p.warna })), 0));
      return `${awal()}${pin(p.x, p.y - p.ukuran * 0.35 - h / 2, total, h)}${sel('LinePattern', 0)}${sel('FillPattern', 0)}${tanpaMargin}${sel('VerticalAlign', 1)}${a}${b}</Shape>`;
    }
    case 'sel': {
      const [a, b] = pisahTeks(teksRun([{ isi: p.baris.join('\n'), ukuran: p.ukuran, warna: p.warna, tebal: p.huruf }], 0, -(p.jarak / p.ukuran) / 1.2));
      return `${awal()}${pin(p.x, p.y, p.w, p.h)}${sel('LineWeight', INCI(p.tebal), " U='MM'")}${sel('LineColor', p.garis)}${sel('FillForegnd', p.isi)}${sel('FillPattern', 1)}`
        + `${sel('LeftMargin', INCI(1), " U='MM'")}${sel('RightMargin', INCI(0.5), " U='MM'")}${sel('TopMargin', INCI(0.6), " U='MM'")}${sel('BottomMargin', 0)}`
        + `${sel('VerticalAlign', 0)}${a}${geomKotak(true, true)}${b}</Shape>`;
    }
    case 'gambar': {
      const g = gambar(p.perangkat);
      if (!g) return '';
      const r = g.rasio ?? p.w / p.h;
      const w = p.w / p.h > r ? p.h * r : p.w, h = p.w / p.h > r ? p.h : p.w / r;
      const x = p.x + (p.w - w) / 2, y = p.y + (p.h - h) / 2;
      return `<Shape ID='${id}' Type='Foreign' LineStyle='2' FillStyle='2' TextStyle='2'>${pin(x, y, w, h)}${sel('ImgWidth', INCI(w), " F='Width*1'")}`
        + `${sel('ImgHeight', INCI(h), " F='Height*1'")}${geomKotak(false, false)}`
        + `<ForeignData ForeignType='Bitmap' CompressionType='${g.jpeg ? 'JPEG' : 'PNG'}'><Rel r:id='${g.rid}'/></ForeignData></Shape>`;
    }
  }
}
