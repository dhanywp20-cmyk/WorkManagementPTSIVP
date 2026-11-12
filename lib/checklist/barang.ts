
export type StatusCek = '' | 'ok' | 'tidak';

export interface ItemBarang {
  id: string;
  nama: string;
   spek: string;
  qty: string;
  satuan: string;
  ket: string;
  status: StatusCek;
   grup?: boolean;
}

export interface Penanda { label: string; nama: string;  ttd: string }

export interface DokChecklist {
  judul: string;
  nomor: string;
  project: string;
  lokasi: string;
   tanggal: string;
  catatan: string;
  items: ItemBarang[];
  penanda: Penanda[];
}

export const MAKS_ITEM = 2000;
export const MAKS_PENANDA = 4;
export const PENANDA_BAWAAN: Penanda[] = [
  { label: 'Diserahkan oleh', nama: '', ttd: '' },
  { label: 'Diperiksa oleh', nama: '', ttd: '' },
  { label: 'Diterima oleh', nama: '', ttd: '' },
];

let urut = 0;
export const idBaru = () => `b${Date.now().toString(36)}${(urut++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const itemBaru = (isi: Partial<ItemBarang> = {}): ItemBarang =>
  ({ id: idBaru(), nama: '', spek: '', qty: '', satuan: '', ket: '', status: '', ...isi });

export function dokBaru(tanggal: string): DokChecklist {
  return { judul: 'Checklist Barang', nomor: '', project: '', lokasi: '', tanggal, catatan: '', items: [], penanda: PENANDA_BAWAAN.map(p => ({ ...p })) };
}

export function bacaDraf(x: unknown): DokChecklist | null {
  const o = x as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || !Array.isArray(o.items) || !Array.isArray(o.penanda)) return null;
  const t = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
  const items = o.items.slice(0, MAKS_ITEM).flatMap((v): ItemBarang[] => {
    const i = v as Record<string, unknown> | null;
    if (!i || typeof i !== 'object' || typeof i.nama !== 'string') return [];
    const it = itemBaru({
      nama: t(i.nama, 500), spek: t(i.spek, 500), qty: t(i.qty, 40), satuan: t(i.satuan, 40), ket: t(i.ket, 500),
      status: i.status === 'ok' || i.status === 'tidak' ? i.status : '',
    });
    if (i.grup === true) it.grup = true;
    return [it];
  });
  const penanda = o.penanda.slice(0, MAKS_PENANDA).flatMap((v): Penanda[] => {
    const p = v as Record<string, unknown> | null;
    if (!p || typeof p !== 'object') return [];
    const ttd = typeof p.ttd === 'string' && p.ttd.length < 800_000 && /^data:image\/png;base64,/.test(p.ttd) ? p.ttd : '';
    return [{ label: t(p.label, 60), nama: t(p.nama, 80), ttd }];
  });
  return {
    judul: t(o.judul, 120), nomor: t(o.nomor, 60), project: t(o.project, 160), lokasi: t(o.lokasi, 160),
    tanggal: typeof o.tanggal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.tanggal) ? o.tanggal : '',
    catatan: t(o.catatan, 2000), items, penanda: penanda.length ? penanda : PENANDA_BAWAAN.map(p => ({ ...p })),
  };
}

export function ringkas(items: ItemBarang[]) {
  let total = 0, ok = 0, tidak = 0;
  for (const it of items) {
    if (it.grup) continue;
    total++;
    if (it.status === 'ok') ok++; else if (it.status === 'tidak') tidak++;
  }
  return { total, ok, tidak, belum: total - ok - tidak };
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export function tglIndo(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m && +m[2] >= 1 && +m[2] <= 12 ? `${+m[3]} ${BULAN[+m[2] - 1]} ${m[1]}` : s;
}

export function namaBerkasPdf(d: Pick<DokChecklist, 'judul' | 'project' | 'tanggal'>): string {
  const bersih = (s: string) => s.normalize('NFKD').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 50);
  const bagian = ['Checklist-Barang', bersih(d.project) || (d.judul === 'Checklist Barang' ? '' : bersih(d.judul)), d.tanggal].filter(Boolean);
  return `${bagian.join('-')}.pdf`;
}

type Peran = 'no' | 'nama' | 'spek' | 'qty' | 'satuan' | 'ket' | 'status';

const POLA_KEPALA: [Peran, RegExp][] = [
  ['no', /^(no|nomor|num|nr|#)\.?$/],
  ['qty', /^(qty|q'ty|jumlah|jml|kuantitas|quantity|vol|volume|banyak(nya)?)\b/],
  ['satuan', /^(satuan|sat|uom|unit|units)\.?$/],
  ['status', /^(status|cek|check|checklist|ok|hasil|kondisi|ada)\b/],
  ['ket', /^(ket|keterangan|catatan|remarks?|notes?)\.?$/],
  ['spek', /\b(merk|merek|brand|tipe|type|model|spesifikasi|spec|specification|kode|code|part ?(no|number)|p\/n|serial|s\/n|sn)\b/],
  ['nama', /(nama|barang|item|deskripsi|description|uraian|material|produk|product|perangkat|equipment|artikel|article|goods)/],
];

const normKepala = (s: string) => s.toLowerCase().replace(/[\s ]+/g, ' ').replace(/[:*]+$/, '').trim();

function peranKepala(s: string): Peran | null {
  const t = normKepala(s);
  if (!t || t.length > 40) return null;
  for (const [p, re] of POLA_KEPALA) if (re.test(t)) return p;
  return null;
}

function petakanKepala(baris: string[]): (Peran | null)[] | null {
  const peran: (Peran | null)[] = baris.map(peranKepala);
  const ada = new Set<Peran>();
  for (let i = 0; i < peran.length; i++) {
    const p = peran[i];
    if (!p) continue;
    if (ada.has(p) && !['spek', 'nama', 'ket'].includes(p)) peran[i] = null;
    ada.add(p);
  }
  return ada.has('nama') && ada.size >= 2 ? peran : null;
}

const MAKS_CARI_KEPALA = 25;

function cariKepala(baris: string[][]): { i: number; peran: (Peran | null)[] } | null {
  let hasil: { i: number; peran: (Peran | null)[]; skor: number } | null = null;
  for (let i = 0; i < Math.min(baris.length, MAKS_CARI_KEPALA); i++) {
    const peran = petakanKepala(baris[i]);
    if (!peran) continue;
    const skor = peran.filter(Boolean).length;
    if (!hasil || skor > hasil.skor) hasil = { i, peran, skor };
  }
  return hasil;
}

const ANGKA = /^\d+(?:[.,]\d+)?$/;
const SATUAN = 'pcs|pc|unit|units|set|sets|buah|bh|roll|rol|meter|mtr|m|ls|lot|box|pack|pak|lembar|lbr|ea|kg|btg|batang|pasang|psg|dus|titik|tt|paket|pkt';
const RE_SATUAN = new RegExp(`^(${SATUAN})\\.?$`, 'i');
const RE_QTY_SATUAN = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${SATUAN})?\\.?$`, 'i');

export function sel(v: unknown): string {
  if (v === null || v === undefined) return '';
  // eslint-disable-next-line no-control-regex
  return String(v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/[\s ]+/g, ' ').trim().slice(0, 500);
}

const RE_OK = /^(✓|✔|☑|v|ok|oke|ada|sesuai|baik|yes|ya|y|lengkap|good|done|selesai)$/i;
const RE_TIDAK = /^(✗|✘|×|☒|tidak( .*)?|tdk( .*)?|no|n|kurang|rusak|hilang|bad|ng|not ok)$/i;
const statusDari = (s: string): StatusCek => (RE_OK.test(s) ? 'ok' : RE_TIDAK.test(s) ? 'tidak' : '');

const RE_TOTAL = /^(sub ?total|total|grand ?total|jumlah)\b/i;
const RE_HALAMAN = /^(halaman|page|hal\.?)\s*\d+/i;

function tebakPeran(baris: string[][]): (Peran | null)[] {
  const lebar = Math.max(0, ...baris.map(r => r.length));
  const st = Array.from({ length: lebar }, (_, j) => {
    let isi = 0, angka = 0, huruf = 0, panjang = 0;
    for (const r of baris) {
      const v = r[j] ?? '';
      if (!v) continue;
      isi++;
      if (ANGKA.test(v)) angka++;
      if (/\p{L}/u.test(v)) { huruf++; panjang += v.length; }
    }
    return { isi, angka, huruf, rata: huruf ? panjang / huruf : 0 };
  });
  const peran: (Peran | null)[] = Array(lebar).fill(null);
  let nama = -1, terbaik = 0;
  st.forEach((s, j) => { const nilai = s.huruf * s.rata; if (nilai > terbaik) { terbaik = nilai; nama = j; } });
  if (nama < 0) return peran;
  peran[nama] = 'nama';
  const angkaan = (j: number) => st[j].isi > 0 && st[j].angka / st[j].isi >= 0.6;
  for (let j = 0; j < nama; j++) if (angkaan(j)) { peran[j] = 'no'; break; }
  for (let j = nama + 1; j < lebar; j++) {
    if (!angkaan(j)) continue;
    peran[j] = 'qty';
    const s = st[j + 1];
    if (s && s.huruf && s.rata <= 10) peran[j + 1] = 'satuan';
    break;
  }
  return peran;
}

const barisKepala = (r: string[]) => petakanKepala(r) !== null && r.filter(Boolean).every(v => peranKepala(v) !== null);

function dariKolom(baris: string[][], peran: (Peran | null)[]): ItemBarang[] {
  const ambil = (r: string[], p: Peran, gabung = ' · ') =>
    peran.map((x, j) => (x === p ? r[j] ?? '' : '')).filter(Boolean).join(gabung);
  const adaKolomQty = peran.includes('qty');
  const out: ItemBarang[] = [];
  for (const r of baris) {
    if (out.length >= MAKS_ITEM) break;
    if (!r.some(Boolean) || barisKepala(r)) continue;
    let nama = ambil(r, 'nama', ' - '), spek = ambil(r, 'spek');
    let qty = ambil(r, 'qty'), satuan = ambil(r, 'satuan');
    const no = ambil(r, 'no'), ket = ambil(r, 'ket'), status = ambil(r, 'status');
    if (!nama && spek) { nama = spek; spek = ''; }
    if (!nama || RE_TOTAL.test(nama) || RE_HALAMAN.test(nama)) continue;
    const qs = RE_QTY_SATUAN.exec(qty);
    if (qs && qs[2] && !satuan) { qty = qs[1]; satuan = qs[2]; }
    const grup = adaKolomQty && !qty && !/^\d+\.?$/.test(no) && !spek && !satuan && !ket && !status;
    out.push(itemBaru(grup ? { nama, grup: true } : { nama, spek, qty, satuan, ket, status: statusDari(status) }));
  }
  return out.filter((it, i) => !it.grup || (out[i + 1] && !out[i + 1].grup));
}

export function bacaTabel(baris: unknown[][]): ItemBarang[] {
  const bersih = baris.map(r => (Array.isArray(r) ? r.map(sel) : [])).filter(r => r.some(Boolean));
  const kepala = cariKepala(bersih);
  if (kepala) return dariKolom(bersih.slice(kepala.i + 1), kepala.peran);
  return dariKolom(bersih, tebakPeran(bersih));
}

export interface PotongPdf { str: string; x: number; y: number; w: number; h: number }
interface SelPdf { t: string; x0: number; x1: number }
interface BarisPdf { y: number; h: number; sel: SelPdf[] }

export function susunBarisPdf(halaman: PotongPdf[][]): BarisPdf[][] {
  return halaman.map(potong => {
    const p = potong.filter(x => x.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
    const baris: { y: number; h: number; isi: PotongPdf[] }[] = [];
    for (const x of p) {
      const b = baris[baris.length - 1];
      const tol = Math.max(2, Math.min(x.h, b?.h ?? x.h) * 0.45);
      if (b && Math.abs(b.y - x.y) <= tol) { b.isi.push(x); b.h = Math.max(b.h, x.h); } else baris.push({ y: x.y, h: x.h || 10, isi: [x] });
    }
    return baris.map(b => {
      const isi = b.isi.sort((a, c) => a.x - c.x);
      const daftar: SelPdf[] = [];
      for (const x of isi) {
        const s = daftar[daftar.length - 1];
        const jeda = Math.max(4, (x.h || b.h) * 0.75);
        if (s && x.x - s.x1 <= jeda) {
          s.t += (x.x - s.x1 > (x.h || b.h) * 0.12 && !s.t.endsWith(' ') && !x.str.startsWith(' ') ? ' ' : '') + x.str;
          s.x1 = Math.max(s.x1, x.x + x.w);
        } else daftar.push({ t: x.str, x0: x.x, x1: x.x + x.w });
      }
      return { y: b.y, h: b.h, sel: daftar.map(s => ({ ...s, t: sel(s.t) })).filter(s => s.t) };
    }).filter(b => b.sel.length);
  });
}

function tempatkan(b: BarisPdf, kolom: SelPdf[]): string[] {
  const out = kolom.map(() => '');
  const batas = kolom.map((k, i) => ({
    a: i === 0 ? -Infinity : (kolom[i - 1].x1 + k.x0) / 2,
    z: i === kolom.length - 1 ? Infinity : (k.x1 + kolom[i + 1].x0) / 2,
  }));
  for (const s of b.sel) {
    let j = 0, terbaik = -Infinity;
    batas.forEach((r, i) => {
      const tutup = Math.min(s.x1, r.z) - Math.max(s.x0, r.a);
      if (tutup > terbaik) { terbaik = tutup; j = i; }
    });
    out[j] = out[j] ? `${out[j]} ${s.t}` : s.t;
  }
  return out;
}

export function barisTeks(selBaris: string[]): ItemBarang | null {
  const s = selBaris.map(sel).filter(Boolean);
  if (!s.length) return null;
  if (s.length > 1 && /^\d{1,4}[.)]?$/.test(s[0])) s.shift();
  let qty = '', satuan = '';
  if (s.length > 1 && RE_SATUAN.test(s[s.length - 1]) && ANGKA.test(s[s.length - 2] ?? '')) {
    satuan = s.pop()!; qty = s.pop()!;
  } else if (s.length > 1) {
    const m = RE_QTY_SATUAN.exec(s[s.length - 1]);
    if (m) { s.pop(); qty = m[1]; satuan = m[2] ?? ''; }
  }
  let nama = s.join(' ').replace(/^(?:[-•*▪●◦–]|\[\s?[xX✓]?\s?\]|\d{1,4}[.)])\s*/, '').trim();
  if (!qty) {
    const m = new RegExp(`^(.*\\S)\\s+(?:x\\s*(\\d+)|(\\d+(?:[.,]\\d+)?)\\s*(${SATUAN})\\.?)$`, 'i').exec(nama);
    if (m) { nama = m[1]; qty = m[2] ?? m[3]; satuan = m[4] ?? ''; }
  }
  if (!nama || nama.length > 200 || RE_TOTAL.test(nama) || RE_HALAMAN.test(nama)) return null;
  return itemBaru({ nama, qty, satuan });
}

const SEMUA_HURUF_BESAR = (s: string) => /\p{Lu}/u.test(s) && s === s.toUpperCase();

export function bacaPdf(halaman: PotongPdf[][]): ItemBarang[] {
  const semua = susunBarisPdf(halaman);
  const datar = semua.flatMap((bs, hal) => bs.map(b => ({ ...b, hal })));
  const kepala = cariKepala(datar.map(b => b.sel.map(s => s.t)));
  if (!kepala) return datar.map(b => barisTeks(b.sel.map(s => s.t))).filter((x): x is ItemBarang => !!x).slice(0, MAKS_ITEM);

  const kolom = datar[kepala.i].sel;
  const peran = kepala.peran;
  const idx = (p: Peran) => peran.indexOf(p);
  const baris: string[][] = [];
  let lalu = null as { y: number; h: number; hal: number; item: boolean } | null;
  for (const b of datar.slice(kepala.i + 1)) {
    const r = tempatkan(b, kolom);
    const isiNo = idx('no') >= 0 && r[idx('no')];
    const isiQty = idx('qty') >= 0 && r[idx('qty')];
    const teksBaris = r.filter(Boolean).join(' ');
    const lanjutan: boolean = !!lalu?.item && lalu.hal === b.hal && !isiNo && !isiQty && !barisKepala(r)
      && lalu.y - b.y <= Math.max(lalu.h, b.h) * 1.6 && !SEMUA_HURUF_BESAR(teksBaris);
    if (lanjutan && baris.length) {
      const prev = baris[baris.length - 1];
      r.forEach((v, j) => { if (v) prev[j] = prev[j] ? `${prev[j]} ${v}` : v; });
    } else baris.push(r);
    lalu = { y: b.y, h: b.h, hal: b.hal, item: !!(isiNo || isiQty) || lanjutan };
  }
  return dariKolom(baris, peran);
}
