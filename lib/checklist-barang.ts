/**
 * lib/checklist-barang.ts - Checklist Barang (AV Solution Tools): baca daftar barang dari Excel / PDF,
 * ringkasan hasil cek, dan gambar PDF hasil checklist (pdfkit) lengkap dengan kolom tanda tangan.
 *
 * MURNI (tanpa DOM / React / jaringan) supaya dipakai peramban (pdfkit standalone) & uji Node
 * (uji/checklist-barang.ts). Semua berjalan di peramban - berkas tidak pernah diunggah ke server.
 *
 * Impor - dua sumber, satu pemetaan kolom:
 *  - Excel / CSV: baris sel (string[][]) -> cari baris kepala (Nama Barang | Qty | Satuan | ...).
 *  - PDF: potongan teks pdf.js (x, y) -> disusun jadi baris & sel; bila ada baris kepala, tiap sel
 *    ditempatkan ke kolom kepala terdekat (sel kosong di tabel PDF tidak menggeser kolom). PDF tanpa
 *    tabel (daftar biasa "1. Speaker 2 pcs") dibaca per baris.
 */

export type StatusCek = '' | 'ok' | 'tidak';

export interface ItemBarang {
  id: string;
  nama: string;
  /** Merk / tipe / kode / SN - tampil kecil di bawah nama. */ spek: string;
  qty: string;
  satuan: string;
  ket: string;
  status: StatusCek;
  /** Baris judul kelompok (mis. "AUDIO SYSTEM") - tidak dicentang. */ grup?: boolean;
}

export interface Penanda { label: string; nama: string; /** PNG data URL dari pad tanda tangan, '' = tanda tangan basah. */ ttd: string }

export interface DokChecklist {
  judul: string;
  nomor: string;
  project: string;
  lokasi: string;
  /** YYYY-MM-DD (input date). */ tanggal: string;
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

/** Draf tersimpan di perangkat (localStorage) -> dokumen yang sah, atau null bila rusak / bentuk lama. */
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
/** "2026-10-29" -> "29 Oktober 2026" (tanpa locale, hasil sama di peramban & Node). */
export function tglIndo(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m && +m[2] >= 1 && +m[2] <= 12 ? `${+m[3]} ${BULAN[+m[2] - 1]} ${m[1]}` : s;
}

/** Checklist-Barang-<judul>-<tanggal>.pdf, aman untuk nama berkas. */
export function namaBerkasPdf(d: Pick<DokChecklist, 'judul' | 'project' | 'tanggal'>): string {
  const bersih = (s: string) => s.normalize('NFKD').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 50);
  const bagian = ['Checklist-Barang', bersih(d.project) || (d.judul === 'Checklist Barang' ? '' : bersih(d.judul)), d.tanggal].filter(Boolean);
  return `${bagian.join('-')}.pdf`;
}

// ---------------------------------------------------------------------------------------------
// Pemetaan kolom
// ---------------------------------------------------------------------------------------------

type Peran = 'no' | 'nama' | 'spek' | 'qty' | 'satuan' | 'ket' | 'status';

/** Urutan penting: kepala dicocokkan ke peran PERTAMA yang cocok ("Kode Barang" = spek, bukan nama). */
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

/** Peran tiap kolom baris kepala; null bila baris ini bukan kepala tabel barang. */
function petakanKepala(baris: string[]): (Peran | null)[] | null {
  const peran: (Peran | null)[] = baris.map(peranKepala);
  //  Peran tunggal kecuali spek/nama/ket (boleh gabungan "Merk" + "Tipe"): kolom kedua dengan peran sama diabaikan.
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

/** Teks sel yang bersih: tanpa karakter kendali, spasi dirapikan. */
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

/** Tebak kolom saat berkas tidak punya baris kepala. */
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

/** Baris kepala yang terulang (tabel PDF per halaman / lembar Excel bertumpuk). */
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
    //  "2 pcs" dalam satu sel qty.
    const qs = RE_QTY_SATUAN.exec(qty);
    if (qs && qs[2] && !satuan) { qty = qs[1]; satuan = qs[2]; }
    //  Judul kelompok: tanpa qty, tanpa nomor urut angka, tanpa isian lain (tabel yang memang punya kolom qty).
    const grup = adaKolomQty && !qty && !/^\d+\.?$/.test(no) && !spek && !satuan && !ket && !status;
    out.push(itemBaru(grup ? { nama, grup: true } : { nama, spek, qty, satuan, ket, status: statusDari(status) }));
  }
  //  Kelompok tanpa isi (judul terakhir / judul berurutan) bukan kelompok - jadikan item biasa.
  return out.filter((it, i) => !it.grup || (out[i + 1] && !out[i + 1].grup));
}

/** Excel / CSV: baris sel (lembar apa adanya) -> daftar barang. */
export function bacaTabel(baris: unknown[][]): ItemBarang[] {
  const bersih = baris.map(r => (Array.isArray(r) ? r.map(sel) : [])).filter(r => r.some(Boolean));
  const kepala = cariKepala(bersih);
  if (kepala) return dariKolom(bersih.slice(kepala.i + 1), kepala.peran);
  return dariKolom(bersih, tebakPeran(bersih));
}

// ---------------------------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------------------------

/** Satu potongan teks pdf.js: x, y (koordinat PDF, y ke atas), lebar & tinggi huruf. */
export interface PotongPdf { str: string; x: number; y: number; w: number; h: number }
interface SelPdf { t: string; x0: number; x1: number }
interface BarisPdf { y: number; h: number; sel: SelPdf[] }

/** Potongan per halaman -> baris (atas ke bawah) berisi sel; jarak lebar antar potongan = batas sel. */
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

/** Sel baris PDF -> kolom kepala yang paling menutupi sel (atau terdekat). */
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

/** Daftar tanpa tabel: "1. Speaker ceiling   8 pcs" / "- HDMI 5m x2". */
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

/** PDF: potongan teks per halaman -> daftar barang. */
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
    //  Nama barang yang terbungkus 2 baris di tabel PDF: baris lanjutan tanpa nomor & qty, rapat di bawah item.
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

// ---------------------------------------------------------------------------------------------
// PDF hasil (pdfkit)
// ---------------------------------------------------------------------------------------------

/** Bagian pdfkit yang dipakai. Huruf didaftarkan pemanggil: 'Sans' & 'SansBold'. */
export interface DokCek {
  page: { width: number; height: number };
  font(n: string): DokCek; fontSize(s: number): DokCek; fillColor(c: string): DokCek; strokeColor(c: string): DokCek;
  lineWidth(w: number): DokCek; lineCap(c: string): DokCek; lineJoin(c: string): DokCek;
  text(t: string, x: number, y: number, o?: object): DokCek;
  heightOfString(t: string, o?: object): number; widthOfString(t: string, o?: object): number;
  rect(x: number, y: number, w: number, h: number): DokCek; roundedRect(x: number, y: number, w: number, h: number, r: number): DokCek;
  fill(c?: string): DokCek; stroke(c?: string): DokCek;
  moveTo(x: number, y: number): DokCek; lineTo(x: number, y: number): DokCek;
  image(src: string, x: number, y: number, o?: object): DokCek;
  addPage(): DokCek; switchToPage(n: number): DokCek; bufferedPageRange(): { start: number; count: number };
}

const W = {
  navy: '#0f2a4a', biru: '#1d4ed8', eyebrow: '#93c5fd', putih: '#ffffff', teks: '#1e293b', redup: '#64748b',
  garis: '#d7dee7', zebra: '#f6f8fb', kepala: '#e8eef6', grup: '#eef2f7', hijau: '#15803d', merah: '#b91c1c', abu: '#94a3b8',
};
const M = 36, PAD = 5, BAWAH = 44;

/** Kotak status: centang hijau / silang merah / kosong (digambar - tidak bergantung huruf). */
function kotakCek(doc: DokCek, x: number, y: number, s: number, st: StatusCek) {
  if (!st) { doc.lineWidth(0.8).roundedRect(x, y, s, s, 2).stroke(W.abu); return; }
  doc.roundedRect(x, y, s, s, 2).fill(st === 'ok' ? W.hijau : W.merah);
  doc.lineWidth(1.4).lineCap('round').lineJoin('round').strokeColor(W.putih);
  if (st === 'ok') doc.moveTo(x + s * 0.24, y + s * 0.53).lineTo(x + s * 0.43, y + s * 0.72).lineTo(x + s * 0.78, y + s * 0.3).stroke();
  else doc.moveTo(x + s * 0.28, y + s * 0.28).lineTo(x + s * 0.72, y + s * 0.72).moveTo(x + s * 0.72, y + s * 0.28).lineTo(x + s * 0.28, y + s * 0.72).stroke();
  doc.lineCap('butt').lineJoin('miter');
}

interface Kolom { k: 'no' | 'nama' | 'qty' | 'satuan' | 'cek' | 'ket'; l: string; w: number; rata?: 'center' | 'right' }

export interface OpsiPdf { /** Teks kaki kiri, mis. "Dicetak 29 Oktober 2026 14:05 oleh Budi". */ dicetak?: string }

/** Gambar seluruh dokumen ke `doc` (pdfkit dengan bufferPages: true, margin 0). */
export function gambarChecklist(doc: DokCek, d: DokChecklist, o: OpsiPdf = {}) {
  const PW = doc.page.width, PH = doc.page.height, CW = PW - 2 * M;
  const judul = d.judul.trim() || 'Checklist Barang';
  const r = ringkas(d.items);

  const kol: Kolom[] = [
    { k: 'no', l: 'No', w: 26, rata: 'center' },
    { k: 'nama', l: 'Nama Barang', w: 0 },
    { k: 'qty', l: 'Qty', w: 38, rata: 'center' },
    { k: 'satuan', l: 'Satuan', w: 46, rata: 'center' },
    { k: 'cek', l: 'Cek', w: 34, rata: 'center' },
    { k: 'ket', l: 'Keterangan', w: 118 },
  ];
  kol[1].w = CW - kol.reduce((s, k) => s + k.w, 0);
  const xKol = kol.map((_, i) => M + kol.slice(0, i).reduce((s, k) => s + k.w, 0));

  let y = 0;

  // -- Kepala halaman pertama
  doc.rect(0, 0, PW, 84).fill(W.navy);
  doc.font('SansBold').fontSize(7.5).fillColor(W.eyebrow).text('CHECKLIST BARANG', M, 22, { characterSpacing: 1.2, lineBreak: false });
  const lebarJudul = CW - 170;
  doc.font('SansBold').fontSize(16);
  const hJudul = Math.min(doc.heightOfString(judul, { width: lebarJudul }), 40);
  doc.fillColor(W.putih).text(judul, M, 34, { width: lebarJudul, height: 40, ellipsis: true });
  const kanan = [['No. Dokumen', d.nomor || '-'], ['Tanggal', tglIndo(d.tanggal) || '-']];
  kanan.forEach(([l, v], i) => {
    doc.font('Sans').fontSize(7).fillColor(W.eyebrow).text(l.toUpperCase(), PW - M - 160, 22 + i * 26, { width: 160, align: 'right', lineBreak: false });
    doc.font('SansBold').fontSize(9.5).fillColor(W.putih).text(v, PW - M - 160, 31 + i * 26, { width: 160, align: 'right', height: 12, ellipsis: true });
  });
  y = Math.max(84, 34 + hJudul + 12) + 14;

  // -- Info project / lokasi
  const info = [['Project / Customer', d.project], ['Lokasi', d.lokasi]].filter(([, v]) => v.trim());
  if (info.length) {
    const w = CW / info.length;
    let tinggi = 0;
    info.forEach(([l, v], i) => {
      doc.font('Sans').fontSize(7).fillColor(W.redup).text(l.toUpperCase(), M + i * w, y, { width: w - 10, characterSpacing: 0.6, lineBreak: false });
      doc.font('SansBold').fontSize(10).fillColor(W.teks).text(v, M + i * w, y + 10, { width: w - 10 });
      tinggi = Math.max(tinggi, 10 + doc.heightOfString(v, { width: w - 10 }));
    });
    y += tinggi + 12;
  }

  // -- Ringkasan
  const ubin: [string, number, string][] = [['Total item', r.total, W.teks], ['Sesuai / ada', r.ok, W.hijau], ['Tidak sesuai', r.tidak, W.merah], ['Belum dicek', r.belum, W.redup]];
  const wu = (CW - 3 * 8) / 4;
  ubin.forEach(([l, n, c], i) => {
    const x = M + i * (wu + 8);
    doc.lineWidth(0.8).roundedRect(x, y, wu, 36, 5).fill(W.zebra);
    doc.font('Sans').fontSize(7).fillColor(W.redup).text(l.toUpperCase(), x + 9, y + 7, { width: wu - 18, lineBreak: false });
    doc.font('SansBold').fontSize(13).fillColor(c).text(String(n), x + 9, y + 17, { width: wu - 18, lineBreak: false });
  });
  y += 36 + 14;

  // -- Tabel
  const kepalaTabel = () => {
    doc.rect(M, y, CW, 20).fill(W.kepala);
    kol.forEach((k, i) => doc.font('SansBold').fontSize(8).fillColor(W.teks)
      .text(k.l, xKol[i] + PAD, y + 6.5, { width: k.w - 2 * PAD, align: k.rata ?? 'left', lineBreak: false }));
    y += 20;
  };
  const halamanBaru = () => {
    doc.addPage();
    y = M;
    doc.font('SansBold').fontSize(10).fillColor(W.teks).text(judul, M, y, { width: CW - 120, lineBreak: false, ellipsis: true });
    doc.font('Sans').fontSize(8).fillColor(W.redup).text('(lanjutan)', PW - M - 120, y + 1.5, { width: 120, align: 'right', lineBreak: false });
    y += 22;
  };
  const batas = () => PH - BAWAH;

  kepalaTabel();
  let no = 0, zebra = false;
  const wNama = kol[1].w - 2 * PAD, wKet = kol[5].w - 2 * PAD;
  if (!d.items.length) {
    doc.font('Sans').fontSize(9).fillColor(W.redup).text('Belum ada barang.', M + PAD, y + 8, { width: CW - 2 * PAD });
    y += 26;
  }
  d.items.forEach(it => {
    if (it.grup) {
      doc.font('SansBold').fontSize(8.5);
      const h = doc.heightOfString(it.nama, { width: CW - 2 * PAD }) + 2 * PAD + 2;
      //  Judul kelompok tidak boleh tertinggal sendirian di dasar halaman.
      if (y + h + 24 > batas()) { halamanBaru(); kepalaTabel(); }
      doc.rect(M, y, CW, h).fill(W.grup);
      doc.font('SansBold').fontSize(8.5).fillColor(W.navy).text(it.nama, M + PAD, y + PAD + 1, { width: CW - 2 * PAD });
      y += h;
      zebra = false;
      return;
    }
    no++;
    doc.font('Sans').fontSize(8.5);
    const hNama = doc.heightOfString(it.nama || '-', { width: wNama });
    doc.font('Sans').fontSize(7);
    const hSpek = it.spek ? doc.heightOfString(it.spek, { width: wNama }) + 1.5 : 0;
    doc.font('Sans').fontSize(8);
    const hKet = it.ket ? doc.heightOfString(it.ket, { width: wKet }) : 0;
    const h = Math.max(20, Math.max(hNama + hSpek, hKet, 10) + 2 * PAD + 1);
    if (y + h > batas()) { halamanBaru(); kepalaTabel(); zebra = false; }
    if (zebra) doc.rect(M, y, CW, h).fill(W.zebra);
    zebra = !zebra;
    const ty = y + PAD + 1;
    doc.font('Sans').fontSize(8.5).fillColor(W.redup).text(String(no), xKol[0] + PAD, ty, { width: kol[0].w - 2 * PAD, align: 'center', lineBreak: false });
    doc.font('Sans').fontSize(8.5).fillColor(W.teks).text(it.nama || '-', xKol[1] + PAD, ty, { width: wNama });
    if (it.spek) doc.font('Sans').fontSize(7).fillColor(W.redup).text(it.spek, xKol[1] + PAD, ty + hNama + 1.5, { width: wNama });
    doc.font('Sans').fontSize(8.5).fillColor(W.teks).text(it.qty || '-', xKol[2] + PAD, ty, { width: kol[2].w - 2 * PAD, align: 'center', lineBreak: false, ellipsis: true });
    doc.font('Sans').fontSize(8).fillColor(W.teks).text(it.satuan || '-', xKol[3] + PAD, ty + 0.5, { width: kol[3].w - 2 * PAD, align: 'center', lineBreak: false, ellipsis: true });
    kotakCek(doc, xKol[4] + (kol[4].w - 11) / 2, y + Math.min(PAD + 0.5, (h - 11) / 2), 11, it.status);
    if (it.ket) doc.font('Sans').fontSize(8).fillColor(it.status === 'tidak' ? W.merah : W.teks).text(it.ket, xKol[5] + PAD, ty + 0.5, { width: wKet });
    doc.lineWidth(0.5).moveTo(M, y + h).lineTo(M + CW, y + h).stroke(W.garis);
    y += h;
  });

  // -- Legenda
  y += 8;
  if (y + 14 > batas()) halamanBaru();
  let lx = M;
  doc.font('Sans').fontSize(7.5).fillColor(W.redup).text('Keterangan cek:', lx, y + 1, { lineBreak: false });
  lx += doc.widthOfString('Keterangan cek:') + 8;
  ([['ok', 'sesuai / ada'], ['tidak', 'tidak sesuai / tidak ada'], ['', 'belum dicek']] as [StatusCek, string][]).forEach(([st, l]) => {
    kotakCek(doc, lx, y, 9, st);
    doc.font('Sans').fontSize(7.5).fillColor(W.redup).text(l, lx + 13, y + 1, { lineBreak: false });
    lx += 13 + doc.widthOfString(l) + 14;
  });
  y += 20;

  // -- Catatan
  const catatan = d.catatan.trim();
  if (catatan) {
    doc.font('Sans').fontSize(8.5);
    const h = doc.heightOfString(catatan, { width: CW - 20 }) + 24;
    if (y + Math.min(h, 80) > batas()) halamanBaru();
    doc.lineWidth(0.8).roundedRect(M, y, CW, h, 5).stroke(W.garis);
    doc.font('SansBold').fontSize(7).fillColor(W.redup).text('CATATAN', M + 10, y + 7, { characterSpacing: 0.6, lineBreak: false });
    doc.font('Sans').fontSize(8.5).fillColor(W.teks).text(catatan, M + 10, y + 17, { width: CW - 20 });
    y += h + 14;
  }

  // -- Tanda tangan (satu blok utuh, pindah halaman bila tidak muat)
  const pen = d.penanda.slice(0, MAKS_PENANDA);
  if (pen.length) {
    const T = 112;
    if (y + T > batas()) halamanBaru();
    y += 6;
    const w = CW / pen.length;
    pen.forEach((p, i) => {
      const x = M + i * w;
      doc.font('Sans').fontSize(8.5).fillColor(W.teks).text(p.label || '', x + 6, y, { width: w - 12, align: 'center', height: 12, ellipsis: true });
      if (/^data:image\/(png|jpeg);base64,/.test(p.ttd)) {
        try { doc.image(p.ttd, x + 18, y + 16, { fit: [w - 36, 58], align: 'center', valign: 'center' }); } catch { /* gambar rusak: biarkan kosong untuk tanda tangan basah */ }
      }
      doc.lineWidth(0.7).moveTo(x + 18, y + 80).lineTo(x + w - 18, y + 80).stroke(W.teks);
      doc.font('SansBold').fontSize(8.5).fillColor(W.teks).text(p.nama.trim() ? p.nama.trim() : '', x + 6, y + 84, { width: w - 12, align: 'center', height: 12, ellipsis: true });
    });
    y += T;
  }

  // -- Kaki tiap halaman
  const { start, count } = doc.bufferedPageRange();
  for (let i = 0; i < count; i++) {
    doc.switchToPage(start + i);
    doc.lineWidth(0.5).moveTo(M, PH - 30).lineTo(PW - M, PH - 30).stroke(W.garis);
    doc.font('Sans').fontSize(7).fillColor(W.redup).text(o.dicetak ?? judul, M, PH - 24, { width: CW - 90, lineBreak: false, ellipsis: true });
    doc.font('Sans').fontSize(7).fillColor(W.redup).text(`Halaman ${i + 1} dari ${count}`, PW - M - 90, PH - 24, { width: 90, align: 'right', lineBreak: false });
  }
}
