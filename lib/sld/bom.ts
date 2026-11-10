import { bacaZip } from './zip';

export interface Potong { l: number; t: number; r: number; b: number }
export interface FotoBom { mime: string; isi: Uint8Array; potong?: Potong }
export interface BarisBom {
  baris: number; no: string; kategori: string; merek: string; model: string; spek: string; fungsi: string; qty: number; satuan: string;
  foto?: FotoBom;
}

const td = new TextDecoder();
const xml = (m: Map<string, Uint8Array>, p: string) => { const b = m.get(p); return b ? td.decode(b) : ''; };
const ent = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&');
const teksRun = (s: string) => ent([...s.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(x => x[1]).join(''));

function gabungJalur(dasar: string, rel: string): string {
  if (rel.startsWith('/')) return rel.slice(1);
  const bagian = dasar.split('/').slice(0, -1);
  for (const p of rel.split('/')) { if (p === '..') bagian.pop(); else if (p !== '.') bagian.push(p); }
  return bagian.join('/');
}
const jalurRels = (p: string) => { const i = p.lastIndexOf('/'); return `${p.slice(0, i)}/_rels/${p.slice(i + 1)}.rels`; };

function bacaRels(m: Map<string, Uint8Array>, pemilik: string): Map<string, string> {
  const r = new Map<string, string>();
  for (const x of xml(m, jalurRels(pemilik)).matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /\bId="([^"]+)"/.exec(x[1])?.[1], target = /\bTarget="([^"]+)"/.exec(x[1])?.[1];
    if (id && target) r.set(id, gabungJalur(pemilik, ent(target)));
  }
  return r;
}

const kolomKe = (huruf: string) => [...huruf].reduce((s, c) => s * 26 + c.charCodeAt(0) - 64, 0) - 1;

function bacaSel(isi: string, bersama: string[]): Map<number, string[]> {
  const baris = new Map<number, string[]>();
  for (const c of isi.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = /\br="([A-Z]+)(\d+)"/.exec(c[1]);
    if (!ref || !c[2]) continue;
    const t = /\bt="(\w+)"/.exec(c[1])?.[1];
    const v = /<v>([\s\S]*?)<\/v>/.exec(c[2])?.[1];
    const nilai = t === 's' ? (bersama[Number(v)] ?? '') : t === 'inlineStr' ? teksRun(c[2]) : ent(v ?? '');
    const r = Number(ref[2]), k = kolomKe(ref[1]);
    const isiBaris = baris.get(r) ?? [];
    isiBaris[k] = nilai.trim();
    baris.set(r, isiBaris);
  }
  return baris;
}

const KEPALA: Record<keyof Omit<BarisBom, 'baris' | 'foto'>, RegExp> = {
  no: /^no\.?$/i, kategori: /^kategori/i, merek: /^merek|^brand/i, model: /^model|part no|^tipe|^type/i, spek: /^spesifikasi|^spek/i,
  fungsi: /^fungsi|^keterangan/i, qty: /^qty|^jumlah/i, satuan: /^satuan|^unit$/i,
};

function bacaFoto(m: Map<string, Uint8Array>, lembar: string): Map<number, FotoBom> {
  const hasil = new Map<number, FotoBom>();
  for (const gambar of bacaRels(m, lembar).values()) {
    if (!/drawings\/drawing\d*\.xml$/.test(gambar)) continue;
    const rels = bacaRels(m, gambar);
    for (const a of xml(m, gambar).matchAll(/<xdr:(oneCellAnchor|twoCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g)) {
      const baris = /<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/.exec(a[0])?.[1];
      const rid = /<a:blip\b[^>]*r:embed="([^"]+)"/.exec(a[0])?.[1];
      const jalur = rid ? rels.get(rid) : undefined;
      const isi = jalur ? m.get(jalur) : undefined;
      if (baris === undefined || !jalur || !isi) continue;
      const mime = /\.png$/i.test(jalur) ? 'image/png' : /\.jpe?g$/i.test(jalur) ? 'image/jpeg' : /\.gif$/i.test(jalur) ? 'image/gif' : '';
      if (!mime) continue;
      const sr = /<a:srcRect\b([^>]*)\/>/.exec(a[0])?.[1] ?? '';
      const ambil = (k: string) => Number(new RegExp(`\\b${k}="(-?\\d+)"`).exec(sr)?.[1] ?? 0) / 100_000;
      const potong = { l: ambil('l'), t: ambil('t'), r: ambil('r'), b: ambil('b') };
      hasil.set(Number(baris) + 1, { mime, isi, potong: potong.l || potong.t || potong.r || potong.b ? potong : undefined });
    }
  }
  return hasil;
}

export async function bacaBom(berkas: Uint8Array): Promise<BarisBom[]> {
  const m = await bacaZip(berkas, n => /^xl\/(workbook\.xml|_rels\/|sharedStrings\.xml|worksheets\/|drawings\/|media\/)/.test(n));
  const bersama = [...xml(m, 'xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(x => teksRun(x[1]));
  const relsBuku = bacaRels(m, 'xl/workbook.xml');
  let terbaik: BarisBom[] = [];
  for (const s of xml(m, 'xl/workbook.xml').matchAll(/<sheet\b[^>]*r:id="([^"]+)"/g)) {
    const lembar = relsBuku.get(s[1]);
    if (!lembar) continue;
    const sel = bacaSel(xml(m, lembar), bersama);
    const urut = [...sel.keys()].sort((a, b) => a - b);
    const kepala = urut.find(r => (sel.get(r) ?? []).some(v => KEPALA.no.test(v ?? '')) && (sel.get(r) ?? []).some(v => KEPALA.model.test(v ?? '') || KEPALA.qty.test(v ?? '')));
    if (kepala === undefined) continue;
    const kol = Object.fromEntries(Object.entries(KEPALA).map(([k, re]) => [k, (sel.get(kepala) ?? []).findIndex(v => re.test(v ?? ''))])) as Record<keyof typeof KEPALA, number>;
    const foto = bacaFoto(m, lembar);
    const ambil = (r: string[], k: keyof typeof KEPALA) => (kol[k] >= 0 ? r[kol[k]] ?? '' : '');
    const hasil: BarisBom[] = [];
    for (const r of urut.filter(x => x > kepala)) {
      const isi = sel.get(r) ?? [];
      const no = ambil(isi, 'no');
      if (!/^\d+(\.\d+)?$/.test(no)) continue;
      hasil.push({
        baris: r, no, kategori: ambil(isi, 'kategori'), merek: ambil(isi, 'merek'), model: ambil(isi, 'model'), spek: ambil(isi, 'spek'),
        fungsi: ambil(isi, 'fungsi'), qty: Number(ambil(isi, 'qty').replace(',', '.')) || 1, satuan: ambil(isi, 'satuan') || 'unit', foto: foto.get(r),
      });
    }
    if (hasil.length > terbaik.length) terbaik = hasil;
  }
  return terbaik;
}

export function modelBom(r: Pick<BarisBom, 'merek' | 'model'>): string {
  const merek = r.merek.trim(), model = r.model.trim();
  if (!merek) return model;
  if (/^sesuai pengadaan$/i.test(merek)) return model ? `${model} (sesuai pengadaan)` : merek;
  return model.toLowerCase().startsWith(merek.toLowerCase()) ? model : `${merek} ${model}`.trim();
}

export function isiDariBom(r: BarisBom): { no: string; nama: string; kategori: string; model: string; qty: number; satuan: string; subGambar: string; ket: string } {
  const sesuai = /^sesuai pengadaan$/i.test(r.merek.trim());
  const ringkas = r.spek.split(/[.;\n]/)[0].trim().slice(0, 70);
  return {
    no: r.no, nama: r.model || r.merek, kategori: r.kategori, model: modelBom(r), qty: r.qty, satuan: r.satuan,
    subGambar: sesuai ? 'sesuai pengadaan' : [r.merek, r.model].filter(Boolean).join(' '), ket: ringkas,
  };
}
