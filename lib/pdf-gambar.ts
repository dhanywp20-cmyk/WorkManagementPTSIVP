interface GambarPdf { width: number; height: number }
interface DokGambar {
  addPage(o: object): DokGambar;
  openImage(src: ArrayBuffer): GambarPdf;
  image(src: GambarPdf, x: number, y: number, o: object): DokGambar;
  on(e: string, f: (x?: Uint8Array) => void): void;
  end(): void;
}
export type KelasPdfGambar = new (o: object) => DokGambar;

let muat: Promise<KelasPdfGambar> | null = null;
function kelasPdf() {
  muat ??= import('pdfkit/js/pdfkit.standalone.js').then(m => ((m as { default?: unknown }).default ?? m) as KelasPdfGambar);
  muat.catch(() => { muat = null; });
  return muat;
}

export const SISI_HALAMAN = 1190.55;

const keArrayBuffer = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

function gabung(potong: Uint8Array[]): Uint8Array {
  const hasil = new Uint8Array(potong.reduce((a, p) => a + p.length, 0));
  let i = 0;
  for (const p of potong) { hasil.set(p, i); i += p.length; }
  return hasil;
}

export async function pdfDariGambar(gambar: Uint8Array[], judul: string, Kelas?: KelasPdfGambar): Promise<Uint8Array> {
  const Pdf = Kelas ?? await kelasPdf();
  const doc = new Pdf({ autoFirstPage: false, margin: 0, info: { Title: judul, Creator: 'Work Management PTS' } });
  const potong: Uint8Array[] = [];
  const selesai = new Promise<Uint8Array>((ok, gagal) => {
    doc.on('data', c => { if (c) potong.push(new Uint8Array(c)); });
    doc.on('end', () => ok(gabung(potong)));
    doc.on('error', () => gagal(new Error('PDF gagal dibuat.')));
  });
  for (const g of gambar) {
    const img = doc.openImage(keArrayBuffer(g));
    const s = SISI_HALAMAN / Math.max(img.width, img.height);
    const w = img.width * s, h = img.height * s;
    doc.addPage({ size: [w, h], margin: 0 });
    doc.image(img, 0, 0, { width: w, height: h });
  }
  doc.end();
  return selesai;
}

export function ukuranSvgPiksel(svg: string) {
  const kepala = /<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  const vb = /viewBox="[\d.\-]+[\s,]+[\d.\-]+[\s,]+([\d.]+)[\s,]+([\d.]+)"/.exec(kepala);
  const w = Number(/\swidth="([\d.]+)/.exec(kepala)?.[1]) || Number(vb?.[1]) || 1000;
  const h = Number(/\sheight="([\d.]+)/.exec(kepala)?.[1]) || Number(vb?.[2]) || 700;
  return { w, h };
}

export async function pngDariSvgPiksel(svg: string, sisi = 3000): Promise<Uint8Array> {
  const u = ukuranSvgPiksel(svg);
  const s = sisi / Math.max(u.w, u.h);
  const lebar = Math.round(u.w * s), tinggi = Math.round(u.h * s);
  const sumber = svg.replace(/<svg\b[^>]*>/, k => k.replace(/\swidth="[^"]*"/, ` width="${lebar}"`).replace(/\sheight="[^"]*"/, ` height="${tinggi}"`));
  const img = await new Promise<HTMLImageElement>((ok, gagal) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => gagal(new Error('Gambar gagal dimuat.'));
    i.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sumber)}`;
  });
  const c = document.createElement('canvas');
  c.width = lebar; c.height = tinggi;
  const g = c.getContext('2d');
  if (!g) throw new Error('Kanvas tidak tersedia.');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, lebar, tinggi);
  g.drawImage(img, 0, 0, lebar, tinggi);
  const blob = await new Promise<Blob>((ok, gagal) => c.toBlob(b => (b ? ok(b) : gagal(new Error('PNG gagal dibuat.'))), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

export const pdfDariSvg = async (svg: string, judul: string) => pdfDariGambar([await pngDariSvgPiksel(svg)], judul);
