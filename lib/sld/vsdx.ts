import { GAYA_KABEL, LABEL_GARIS, LABEL_PERANGKAT, SUDUT_GARIS, WATERMARK } from './gaya';
import { geometri, kotakTampak, teksLabel } from './geometri';
import { barisLabel, primRangka1 } from './lembar1';
import { primLembar2 } from './lembar2';
import type { Prim } from './primitif';
import { lebarTeks } from './teks';
import type { DokSLD, Titik } from './tipe';
import { bentukPrim, f, geomKotak, INCI, pisahTeks, sel, teksRun, vy, xe } from './vsdx-bentuk';
import { STYLE_DASAR } from './vsdx-gaya';
import { tulisZip } from './zip';

export interface GambarVsdx { isi: Uint8Array; jpeg: boolean }
export interface MasukanVsdx { dok: DokSLD; gambar: Map<string, GambarVsdx>; watermark?: GambarVsdx; judul?: string }

const NS = "xmlns='http://schemas.microsoft.com/office/visio/2012/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships' xml:space='preserve'";
const KEPALA = "<?xml version='1.0' encoding='utf-8' ?>\n";
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const te = new TextEncoder();
const kutipGanda = (x: string) => x.replace("<?xml version='1.0' encoding='utf-8' ?>", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>').replace(/='([^']*)'/g, '="$1"');

class Halaman {
  bentuk: string[] = [];
  sambung: string[] = [];
  rels = new Map<string, string>();
  id = 0;
  baru() { return ++this.id; }
  rid(media: string) {
    if (!this.rels.has(media)) this.rels.set(media, `rId${this.rels.size + 1}`);
    return this.rels.get(media)!;
  }
}

class Media {
  daftar: { nama: string; isi: Uint8Array }[] = [];
  peta = new Map<string, string>();
  tambah(kunci: string, g: GambarVsdx) {
    if (!this.peta.has(kunci)) {
      const nama = `image${this.daftar.length + 1}.${g.jpeg ? 'jpeg' : 'png'}`;
      this.daftar.push({ nama, isi: g.isi });
      this.peta.set(kunci, nama);
    }
    return this.peta.get(kunci)!;
  }
}

function watermark(h: Halaman, media: Media, g?: GambarVsdx) {
  if (!g) return;
  const rid = h.rid(media.tambah('__watermark', g));
  WATERMARK.baris.forEach((cy, i) => {
    for (const cx of i % 2 ? WATERMARK.kolomGanjil : WATERMARK.kolomGenap) {
      const w = WATERMARK.w, hh = WATERMARK.h;
      h.bentuk.push(`<Shape ID='${h.baru()}' NameU='Watermark' Type='Foreign' LineStyle='2' FillStyle='2' TextStyle='2'>`
        + `${sel('PinX', INCI(cx))}${sel('PinY', vy(cy))}${sel('Width', INCI(w))}${sel('Height', INCI(hh))}${sel('LocPinX', INCI(w / 2), " F='Width*0.5'")}`
        + `${sel('LocPinY', INCI(hh / 2), " F='Height*0.5'")}${sel('Angle', (-WATERMARK.sudut * Math.PI) / 180)}${sel('ImgWidth', INCI(w), " F='Width*1'")}`
        + `${sel('ImgHeight', INCI(hh), " F='Height*1'")}${sel('Transparency', 1 - WATERMARK.tembus)}${sel('LayerMember', '0')}${geomKotak(false, false)}`
        + `<ForeignData ForeignType='Bitmap' CompressionType='${g.jpeg ? 'JPEG' : 'PNG'}'><Rel r:id='${rid}'/></ForeignData></Shape>`);
    }
  });
}

const kunciTitik = (t: Titik) => `${Math.round(t.x * 100)},${Math.round(t.y * 100)}`;

function lembar1(m: MasukanVsdx, media: Media): Halaman {
  const h = new Halaman();
  const d = m.dok;
  for (const p of primRangka1(d)) { const id = h.baru(); h.bentuk.push(bentukPrim(p, id, () => null)); }
  const geo = geometri(d);
  const titikPerangkat = new Map<string, Titik[]>();
  const peta = new Map(d.kabel.map(c => [c.id, c]));
  for (const g of geo) {
    const c = peta.get(g.id)!;
    const tujuan = [c.ke, ...c.cabang].filter(u => d.perangkat.some(p => p.id === u.p));
    g.garis.forEach((gr, i) => {
      for (const [pid, t] of [[c.dari.p, gr.titik[0]], [tujuan[i].p, gr.titik[gr.titik.length - 1]]] as const) {
        const ada = titikPerangkat.get(pid) ?? [];
        if (!ada.some(x => kunciTitik(x) === kunciTitik(t))) ada.push(t);
        titikPerangkat.set(pid, ada);
      }
    });
  }
  const idPerangkat = new Map<string, { id: number; titik: Titik[] }>();
  for (const p of d.perangkat) {
    const k = kotakTampak(p), id = h.baru();
    const titik = titikPerangkat.get(p.id) ?? [];
    const sisi = [{ x: k.x, y: k.y + k.h / 2 }, { x: k.x + k.w, y: k.y + k.h / 2 }, { x: k.x + k.w / 2, y: k.y }, { x: k.x + k.w / 2, y: k.y + k.h }];
    const semua = [...titik, ...sisi.filter(s => !titik.some(t => kunciTitik(t) === kunciTitik(s)))];
    idPerangkat.set(p.id, { id, titik: semua });
    const koneksi = semua.map((t, i) => {
      const fx = (t.x - k.x) / k.w, fy = 1 - (t.y - k.y) / k.h;
      return `<Row T='Connection' IX='${i}'>${sel('X', INCI(k.w) * fx, ` F='Width*${f(fx)}'`)}${sel('Y', INCI(k.h) * fy, ` F='Height*${f(fy)}'`)}`
        + `${sel('DirX', 0)}${sel('DirY', 0)}${sel('Type', 0)}${sel('AutoGen', 0)}</Row>`;
    }).join('');
    const baris = barisLabel(p);
    const lebarLabel = Math.max(k.w, ...baris.map(b => lebarTeks(b.isi, b.ukuran, b.tebal) * 1.15 + 2));
    const tinggiLabel = baris.reduce((s, b) => s + b.ukuran * LABEL_PERANGKAT.spasi, 0) + 1;
    const kiri = p.x + LABEL_PERANGKAT.geserKiri - k.x, atas = p.y + p.h + LABEL_PERANGKAT.jarakAtas - (k.y + k.h);
    const teks = baris.length ? pisahTeks(teksRun(baris.map((b, i) => ({ ...b, isi: i < baris.length - 1 ? `${b.isi}\n` : b.isi })), 0, -1.1)) : ['', ''];
    const g = m.gambar.get(p.id);
    const rid = g ? h.rid(media.tambah(p.id, g)) : '';
    h.bentuk.push(`<Shape ID='${id}' NameU='${xe(p.nama || 'Perangkat')}' Type='${g ? 'Foreign' : 'Shape'}' LineStyle='2' FillStyle='2' TextStyle='3'>`
      + `${sel('PinX', INCI(k.x + k.w / 2))}${sel('PinY', vy(k.y + k.h / 2))}${sel('Width', INCI(k.w))}${sel('Height', INCI(k.h))}`
      + `${sel('LocPinX', INCI(k.w / 2), " F='Width*0.5'")}${sel('LocPinY', INCI(k.h / 2), " F='Height*0.5'")}${sel('Angle', 0)}`
      + (g ? `${sel('ImgWidth', INCI(k.w), " F='Width*1'")}${sel('ImgHeight', INCI(k.h), " F='Height*1'")}` : '')
      + `${sel('TxtPinX', INCI(kiri + lebarLabel / 2))}${sel('TxtPinY', INCI(-atas - tinggiLabel / 2))}${sel('TxtWidth', INCI(lebarLabel))}`
      + `${sel('TxtHeight', INCI(tinggiLabel))}${sel('TxtLocPinX', INCI(lebarLabel / 2), " F='TxtWidth*0.5'")}${sel('TxtLocPinY', INCI(tinggiLabel / 2), " F='TxtHeight*0.5'")}`
      + `${sel('VerticalAlign', 0)}${sel('LeftMargin', 0)}${sel('RightMargin', 0)}${sel('TopMargin', 0)}${sel('BottomMargin', 0)}${sel('ObjType', 1)}`
      + `<Section N='Connection'>${koneksi}</Section>${teks[0]}${geomKotak(false, !g)}${teks[1]}`
      + (g ? `<ForeignData ForeignType='Bitmap' CompressionType='${g.jpeg ? 'JPEG' : 'PNG'}'><Rel r:id='${rid}'/></ForeignData>` : '')
      + '</Shape>');
  }
  for (const g of geo) {
    const c = peta.get(g.id)!;
    const s = GAYA_KABEL[c.jenis];
    const tujuan = [c.ke, ...c.cabang].filter(u => idPerangkat.has(u.p));
    g.garis.forEach((gr, i) => {
      const a = idPerangkat.get(c.dari.p)!, b = idPerangkat.get(tujuan[i].p)!;
      const awal = gr.titik[0], akhir = gr.titik[gr.titik.length - 1];
      const ia = a.titik.findIndex(t => kunciTitik(t) === kunciTitik(awal)), ib = b.titik.findIndex(t => kunciTitik(t) === kunciTitik(akhir));
      const id = h.baru();
      const lokal = (t: Titik) => ({ x: INCI(t.x - awal.x), y: INCI(awal.y - t.y) });
      const ujung = lokal(akhir);
      const baris = gr.titik.slice(1).map((t, j) => {
        const l = lokal(t);
        return `<Row T='LineTo' IX='${j + 2}'><Cell N='X' V='${f(l.x)}'/><Cell N='Y' V='${f(l.y)}'/></Row>`;
      }).join('');
      const label = i === 0 ? teksLabel(c, g.kode) : '';
      const lp = lokal(g.label);
      const lw = INCI(g.lebarLabel), lh = INCI(LABEL_GARIS.tinggi);
      const glue = (n: number, k: number) => `PAR(PNT(Sheet.${n}!Connections.X${k + 1},Sheet.${n}!Connections.Y${k + 1}))`;
      h.bentuk.push(`<Shape ID='${id}' NameU='Kabel ${xe(g.kode)}' Type='Shape' LineStyle='3' FillStyle='3' TextStyle='3'>`
        + `${sel('PinX', INCI((awal.x + akhir.x) / 2), " F='GUARD((BeginX+EndX)/2)'")}${sel('PinY', vy((awal.y + akhir.y) / 2), " F='GUARD((BeginY+EndY)/2)'")}`
        + `${sel('Width', ujung.x, " F='GUARD(EndX-BeginX)'")}${sel('Height', ujung.y, " F='GUARD(EndY-BeginY)'")}`
        + `${sel('LocPinX', ujung.x / 2, " F='GUARD(Width*0.5)'")}${sel('LocPinY', ujung.y / 2, " F='GUARD(Height*0.5)'")}${sel('Angle', 0, " F='GUARD(0DA)'")}`
        + `${sel('BeginX', INCI(awal.x), ` F='${glue(a.id, ia)}'`)}${sel('BeginY', vy(awal.y), ` F='${glue(a.id, ia)}'`)}`
        + `${sel('EndX', INCI(akhir.x), ` F='${glue(b.id, ib)}'`)}${sel('EndY', vy(akhir.y), ` F='${glue(b.id, ib)}'`)}`
        + `${sel('BegTrigger', 2, ` F='_XFTRIGGER(Sheet.${a.id}!EventXFMod)'`)}${sel('EndTrigger', 2, ` F='_XFTRIGGER(Sheet.${b.id}!EventXFMod)'`)}`
        + `${sel('ObjType', 2)}${sel('GlueType', 2)}${sel('DynFeedback', 2)}${sel('NoAlignBox', 1)}${sel('LockHeight', 1)}${sel('LockCalcWH', 1)}${sel('ShapeSplittable', 1)}`
        + `${sel('ShapeRouteStyle', 1)}${sel('ConFixedCode', 0)}${sel('Rounding', INCI(SUDUT_GARIS), " U='MM'")}`
        + `${sel('LineWeight', INCI(s.tebal), " U='MM'")}${sel('LineColor', s.warna)}${sel('LinePattern', !s.putus ? 1 : /^0\./.test(s.putus) ? 3 : 2)}`
        + `${sel('BeginArrow', gr.awal ? 10 : 0)}${sel('BeginArrowSize', 1)}${sel('EndArrow', c.duaArah ? 10 : 13)}${sel('EndArrowSize', 1)}`
        + (label ? `${sel('TxtPinX', lp.x, " F='SETATREF(Controls.TextPosition)'")}${sel('TxtPinY', lp.y, " F='SETATREF(Controls.TextPosition.Y)'")}`
          + `${sel('TxtWidth', lw)}${sel('TxtHeight', lh)}${sel('TxtLocPinX', lw / 2, " F='TxtWidth*0.5'")}${sel('TxtLocPinY', lh / 2, " F='TxtHeight*0.5'")}`
          + `${sel('TextBkgnd', '#ffffff')}${sel('LeftMargin', 0)}${sel('RightMargin', 0)}${sel('TopMargin', 0)}${sel('BottomMargin', 0)}`
          + `<Section N='Control'><Row N='TextPosition'>${sel('X', lp.x)}${sel('Y', lp.y)}${sel('XDyn', lp.x, " F='Controls.TextPosition'")}`
          + `${sel('YDyn', lp.y, " F='Controls.TextPosition.Y'")}${sel('XCon', 0)}${sel('YCon', 0)}${sel('CanGlue', 0)}</Row></Section>` : '')
        + (label ? pisahTeks(teksRun([{ isi: label, ukuran: LABEL_GARIS.ukuran, warna: s.warna, tebal: true }], 1))[0] : '')
        + `<Section N='Geometry' IX='0'>${sel('NoFill', 1)}${sel('NoLine', 0)}${sel('NoShow', 0)}<Row T='MoveTo' IX='1'><Cell N='X' V='0'/><Cell N='Y' V='0'/></Row>${baris}</Section>`
        + (label ? pisahTeks(teksRun([{ isi: label, ukuran: LABEL_GARIS.ukuran, warna: s.warna, tebal: true }], 1))[1] : '')
        + '</Shape>');
      h.sambung.push(`<Connect FromSheet='${id}' FromCell='BeginX' FromPart='9' ToSheet='${a.id}' ToCell='Connections.X${ia + 1}' ToPart='${100 + ia}'/>`);
      h.sambung.push(`<Connect FromSheet='${id}' FromCell='EndX' FromPart='12' ToSheet='${b.id}' ToCell='Connections.X${ib + 1}' ToPart='${100 + ib}'/>`);
    });
  }
  if (d.watermark !== false) watermark(h, media, m.watermark);
  return h;
}

function lembar2(m: MasukanVsdx, media: Media): Halaman {
  const h = new Halaman();
  const prim: Prim[] = primLembar2(m.dok).prim;
  for (const p of prim) {
    const id = h.baru();
    h.bentuk.push(bentukPrim(p, id, pid => {
      const g = m.gambar.get(pid);
      return g ? { rid: h.rid(media.tambah(pid, g)), jpeg: g.jpeg } : null;
    }));
  }
  if (m.dok.watermark !== false) watermark(h, media, m.watermark);
  return h;
}

const isiHalaman = (h: Halaman) => `${KEPALA}<PageContents ${NS}><Shapes>${h.bentuk.filter(Boolean).join('')}</Shapes>`
  + `${h.sambung.length ? `<Connects>${h.sambung.join('')}</Connects>` : ''}</PageContents>`;

const relsHalaman = (h: Halaman) => `${KEPALA}<Relationships xmlns='${REL}'>`
  + [...h.rels].map(([nama, id]) => `<Relationship Id='${id}' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/image' Target='../media/${nama}'/>`).join('')
  + '</Relationships>';

function lembarHalaman(id: number, nama: string, rid: string): string {
  return `<Page ID='${id}' NameU='${xe(nama)}' IsCustomNameU='1' Name='${xe(nama)}' IsCustomName='1' ViewScale='-1'><PageSheet LineStyle='0' FillStyle='0' TextStyle='0'>`
    + `${sel('PageWidth', INCI(420), " U='MM'")}${sel('PageHeight', INCI(297), " U='MM'")}${sel('PageScale', INCI(1), " U='MM'")}${sel('DrawingScale', INCI(1), " U='MM'")}`
    + `${sel('DrawingSizeType', 0)}${sel('DrawingScaleType', 0)}${sel('PrintPageOrientation', 2)}${sel('PaperKind', 8)}${sel('RouteStyle', 1)}`
    + `<Section N='Layer'><Row IX='0'>${sel('Name', 'Watermark')}${sel('Visible', 1)}${sel('Print', 1)}${sel('Active', 0)}${sel('Lock', 1)}${sel('Snap', 0)}`
    + `${sel('Glue', 0)}${sel('NameUniv', 'Watermark')}</Row></Section></PageSheet><Rel r:id='${rid}'/></Page>`;
}

function dokumen(): string {
  const anak = (id: number, nama: string, tambahan = '') => `<StyleSheet ID='${id}' NameU='${nama}' IsCustomNameU='1' Name='${nama}' IsCustomName='1'`
    + ` LineStyle='0' FillStyle='0' TextStyle='0'>${tambahan}</StyleSheet>`;
  return `${KEPALA}<VisioDocument ${NS}><DocumentSettings TopPage='0' DefaultTextStyle='3' DefaultLineStyle='3' DefaultFillStyle='3' DefaultGuideStyle='3'>`
    + '<GlueSettings>9</GlueSettings><SnapSettings>65847</SnapSettings><SnapExtensions>34</SnapExtensions><DynamicGridEnabled>1</DynamicGridEnabled></DocumentSettings>'
    + "<Colors/><FaceNames><FaceName NameU='Arial' UnicodeRanges='-536858881 -1073711013 9 0' CharSets='1073742335 -65536' Panose='2 11 6 4 2 2 2 2 2 4' Flags='325'/></FaceNames>"
    + `<StyleSheets><StyleSheet ID='0' NameU='No Style' IsCustomNameU='1' Name='No Style' IsCustomName='1'>${STYLE_DASAR.replace(/"/g, "'")}</StyleSheet>`
    + `${anak(1, 'Text Only')}${anak(2, 'None', `${sel('LinePattern', 0)}${sel('FillPattern', 0)}`)}${anak(3, 'Normal')}</StyleSheets>`
    + "<DocumentSheet NameU='TheDoc' IsCustomNameU='1' Name='TheDoc' IsCustomName='1' LineStyle='0' FillStyle='0' TextStyle='0'/></VisioDocument>";
}

export function buatVsdx(m: MasukanVsdx): Uint8Array {
  const media = new Media();
  const h1 = lembar1(m, media), h2 = lembar2(m, media);
  const judul = xe(m.judul ?? 'Single Line Diagram');
  const tipeGambar = "<Default Extension='png' ContentType='image/png'/><Default Extension='jpeg' ContentType='image/jpeg'/>";
  const berkas = [
    { nama: '[Content_Types].xml', isi: `${KEPALA}<Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'>${tipeGambar}`
      + "<Default Extension='rels' ContentType='application/vnd.openxmlformats-package.relationships+xml'/><Default Extension='xml' ContentType='application/xml'/>"
      + "<Override PartName='/visio/document.xml' ContentType='application/vnd.ms-visio.drawing.main+xml'/>"
      + "<Override PartName='/visio/pages/pages.xml' ContentType='application/vnd.ms-visio.pages+xml'/>"
      + "<Override PartName='/visio/pages/page1.xml' ContentType='application/vnd.ms-visio.page+xml'/>"
      + "<Override PartName='/visio/pages/page2.xml' ContentType='application/vnd.ms-visio.page+xml'/>"
      + "<Override PartName='/visio/windows.xml' ContentType='application/vnd.ms-visio.windows+xml'/>"
      + "<Override PartName='/docProps/core.xml' ContentType='application/vnd.openxmlformats-package.core-properties+xml'/></Types>" },
    { nama: '_rels/.rels', isi: `${KEPALA}<Relationships xmlns='${REL}'><Relationship Id='rId1' Type='http://schemas.microsoft.com/visio/2010/relationships/document' Target='visio/document.xml'/>`
      + "<Relationship Id='rId2' Type='http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties' Target='docProps/core.xml'/></Relationships>" },
    { nama: 'docProps/core.xml', isi: `${KEPALA}<cp:coreProperties xmlns:cp='http://schemas.openxmlformats.org/package/2006/metadata/core-properties'`
      + ` xmlns:dc='http://purl.org/dc/elements/1.1/'><dc:title>${judul}</dc:title><dc:creator>AV Solution Tools</dc:creator></cp:coreProperties>` },
    { nama: 'visio/document.xml', isi: dokumen() },
    { nama: 'visio/_rels/document.xml.rels', isi: `${KEPALA}<Relationships xmlns='${REL}'>`
      + "<Relationship Id='rId1' Type='http://schemas.microsoft.com/visio/2010/relationships/pages' Target='pages/pages.xml'/>"
      + "<Relationship Id='rId2' Type='http://schemas.microsoft.com/visio/2010/relationships/windows' Target='windows.xml'/></Relationships>" },
    { nama: 'visio/windows.xml', isi: `${KEPALA}<Windows ClientWidth='1600' ClientHeight='900' ${NS}><Window ID='0' WindowType='Drawing' WindowState='1073741824'`
      + " ContainerType='Page' Page='0' ViewScale='-1'><ShowRulers>1</ShowRulers><ShowGrid>0</ShowGrid><ShowPageBreaks>0</ShowPageBreaks><ShowGuides>1</ShowGuides>"
      + '<ShowConnectionPoints>1</ShowConnectionPoints><GlueSettings>9</GlueSettings><SnapSettings>65847</SnapSettings></Window></Windows>' },
    { nama: 'visio/pages/pages.xml', isi: `${KEPALA}<Pages ${NS}>${lembarHalaman(0, 'Sheet 1 - Diagram', 'rId1')}${lembarHalaman(1, 'Sheet 2 - Koneksi & catatan', 'rId2')}</Pages>` },
    { nama: 'visio/pages/_rels/pages.xml.rels', isi: `${KEPALA}<Relationships xmlns='${REL}'>`
      + "<Relationship Id='rId1' Type='http://schemas.microsoft.com/visio/2010/relationships/page' Target='page1.xml'/>"
      + "<Relationship Id='rId2' Type='http://schemas.microsoft.com/visio/2010/relationships/page' Target='page2.xml'/></Relationships>" },
    { nama: 'visio/pages/page1.xml', isi: isiHalaman(h1) },
    { nama: 'visio/pages/page2.xml', isi: isiHalaman(h2) },
    { nama: 'visio/pages/_rels/page1.xml.rels', isi: relsHalaman(h1) },
    { nama: 'visio/pages/_rels/page2.xml.rels', isi: relsHalaman(h2) },
  ].map(b => ({ nama: b.nama, isi: te.encode(/\.rels$|Content_Types|core\.xml$/.test(b.nama) ? kutipGanda(b.isi) : b.isi) }));
  return tulisZip([...berkas, ...media.daftar.map(x => ({ nama: `visio/media/${x.nama}`, isi: x.isi }))]);
}
