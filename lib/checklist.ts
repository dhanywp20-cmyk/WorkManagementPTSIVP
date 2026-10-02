/**
 * lib/checklist.ts - tipe, pembaca impor, dan hitungan progres Checklist Tools.
 *
 * Berkas ini MURNI (tanpa supabase, tanpa DOM) supaya bisa dipakai di tiga
 * tempat sekaligus: halaman admin (pratinjau impor), route server (validasi
 * ulang isi impor), dan halaman link share.
 *
 * DUA JALAN IMPOR, satu bentuk hasil (DraftChecklist):
 *
 *  1. Teks / Markdown - bentuk yang keluar dari dokumen checklist (ekspor
 *     Markdown) atau diketik bebas:
 *        # Judul checklist          -> judul (baris # pertama saja)
 *        ## 1. Persiapan            -> bagian
 *        ### Zona WALL / **Zona WALL** sebaris penuh -> kelompok di dalam bagian
 *        - [ ] Pasang bracket       -> item (- [x] = sudah selesai)
 *        teks lain, tabel |..|      -> catatan bagian (tetap tampil, tidak dicentang)
 *
 *  2. Baris tabel dari Excel/CSV - kolom Bagian | Kelompok | Item | Catatan
 *     (+ Status opsional). Hasil Ekspor Excel dari modul ini bisa diimpor balik.
 */

export interface DraftItem {
  kelompok: string;
  teks: string;
  catatan: string;
  selesai: boolean;
}

export interface DraftBagian {
  judul: string;
  catatan: string;
  items: DraftItem[];
}

export interface DraftChecklist {
  judul: string;
  keterangan: string;
  bagian: DraftBagian[];
}

export type SumberChecklist = 'teks' | 'excel' | 'duplikat';
export type LewatCentang = 'admin' | 'link';

export interface ChecklistDaftar {
  id: string;
  judul: string;
  keterangan: string;
  sumber: SumberChecklist;
  share_aktif: boolean;
  /** Hanya dikirim ke admin. Halaman share tidak pernah menerimanya. */
  share_token?: string | null;
  dibuat_oleh_nama: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistBagian {
  id: string;
  daftar_id: string;
  judul: string;
  catatan: string;
  urutan: number;
}

export interface ChecklistItem {
  id: string;
  daftar_id: string;
  bagian_id: string;
  kelompok: string;
  teks: string;
  catatan: string;
  urutan: number;
  selesai: boolean;
  selesai_oleh: string | null;
  selesai_pada: string | null;
  selesai_lewat: LewatCentang | null;
}

export interface ChecklistRiwayat {
  id: number;
  item_id: string | null;
  teks_item: string;
  aksi: 'centang' | 'batal';
  nama: string;
  lewat: LewatCentang;
  created_at: string;
}

export interface ChecklistDetail {
  daftar: ChecklistDaftar;
  bagian: ChecklistBagian[];
  items: ChecklistItem[];
  riwayat?: ChecklistRiwayat[];
}

/** Ringkasan untuk daftar di halaman admin. */
export interface ChecklistRingkas extends ChecklistDaftar {
  total: number;
  selesai: number;
}

// Batas teknis (bukan aturan bisnis): menjaga satu impor tidak membengkak
// sampai request-nya ditolak server atau halamannya berat dibuka di HP.
export const BATAS = {
  bagian: 100,
  item: 1500,
  judul: 200,
  teks: 1000,
  catatan: 5000,
  keterangan: 5000,
  nama: 60,
} as const;

// ── Progres ────────────────────────────────────────────────────────────────

export interface Progres { selesai: number; total: number; persen: number }

export function hitungProgres(items: { selesai: boolean }[]): Progres {
  const total = items.length;
  const selesai = items.filter(i => i.selesai).length;
  return { selesai, total, persen: total ? Math.round((selesai / total) * 100) : 0 };
}

export function progresDari(selesai: number, total: number): Progres {
  return { selesai, total, persen: total ? Math.round((selesai / total) * 100) : 0 };
}

// ── Pembaca teks / Markdown ────────────────────────────────────────────────

/** Buang penanda Markdown sebaris supaya teks item bersih saat dicentang. */
export function bersihkanSebaris(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')   // [teks](url) -> teks
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, '$1$2')
    .replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '$1') // escape Markdown
    .trim();
}

/** Rapikan kumpulan baris catatan: buang baris kosong di ujung & yang beruntun. */
function rapikanCatatan(baris: string[]): string {
  const hasil: string[] = [];
  for (const b of baris) {
    if (b.trim() === '' && (hasil.length === 0 || hasil[hasil.length - 1].trim() === '')) continue;
    hasil.push(b.trimEnd());
  }
  while (hasil.length && hasil[hasil.length - 1].trim() === '') hasil.pop();
  return hasil.join('\n');
}

const RE_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+\[( |x|X)\]\s+(.+)$/;
const RE_BULLET_ANAK = /^\s{2,}(?:[-*+]|\d+[.)])\s+(.+)$/;

export function bacaTeks(sumber: string): DraftChecklist {
  const baris = sumber
    .replace(/\r/g, '')
    // Token blok/chip dari dokumen Claude (mis. tanggal, embed) tidak berarti
    // apa-apa di luar dokumennya.
    .replace(/<\?claude[^?]*\?>/g, '')
    .split('\n');

  let judul = '';
  const keterangan: string[] = [];
  const bagian: (DraftBagian & { _catatan: string[] })[] = [];
  let kini: (DraftBagian & { _catatan: string[] }) | null = null;
  let kelompok = '';
  let itemTerakhir: DraftItem | null = null;
  // Judul kelompok yang belum diikuti item. Bila yang menyusul justru catatan
  // (mis. "**Peta port**" lalu tabel), judulnya ikut ke catatan supaya tabel
  // tidak kehilangan keterangannya.
  let judulTertunda: string | null = null;

  const pastikanBagian = () => {
    if (!kini) {
      kini = { judul: 'Umum', catatan: '', items: [], _catatan: [] };
      bagian.push(kini);
      kelompok = '';
    }
    return kini;
  };

  for (const mentah of baris) {
    const t = mentah.trim();

    if (t === '') {
      itemTerakhir = null;
      if (kini) kini._catatan.push('');
      else keterangan.push('');
      continue;
    }

    // Gambar/embed (mis. grafik progres di dokumen) tidak ikut.
    if (/^!\[[^\]]*\]\([^)]*\)$/.test(t)) continue;
    // ...termasuk penggantinya saat dokumen diekspor ke Markdown.
    if (/^(&#91;|\\?\[)embedded content/i.test(t)) continue;

    let m = /^#\s+(.+)$/.exec(t);
    if (m) {
      if (!judul && !kini) { judul = bersihkanSebaris(m[1]); continue; }
      kini = { judul: bersihkanSebaris(m[1]), catatan: '', items: [], _catatan: [] };
      bagian.push(kini);
      kelompok = '';
      judulTertunda = null;
      itemTerakhir = null;
      continue;
    }

    m = /^##\s+(.+)$/.exec(t);
    if (m) {
      kini = { judul: bersihkanSebaris(m[1]), catatan: '', items: [], _catatan: [] };
      bagian.push(kini);
      kelompok = '';
      judulTertunda = null;
      itemTerakhir = null;
      continue;
    }

    m = /^#{3,6}\s+(.+)$/.exec(t) ?? /^\*\*([^*]+)\*\*:?$/.exec(t);
    if (m) {
      pastikanBagian();
      kelompok = bersihkanSebaris(m[1]);
      judulTertunda = kelompok;
      itemTerakhir = null;
      continue;
    }

    m = RE_ITEM.exec(mentah);
    if (m) {
      const b = pastikanBagian();
      judulTertunda = null;
      itemTerakhir = { kelompok, teks: bersihkanSebaris(m[2]), catatan: '', selesai: m[1].toLowerCase() === 'x' };
      if (itemTerakhir.teks) b.items.push(itemTerakhir);
      continue;
    }

    // Poin menjorok tepat di bawah item = rincian item itu, bukan catatan bagian.
    m = RE_BULLET_ANAK.exec(mentah);
    if (m && itemTerakhir) {
      itemTerakhir.catatan = [itemTerakhir.catatan, bersihkanSebaris(m[1])].filter(Boolean).join('\n');
      continue;
    }

    itemTerakhir = null;
    if (kini) {
      if (judulTertunda) { kini._catatan.push('', `**${judulTertunda}**`); judulTertunda = null; }
      kini._catatan.push(mentah);
    } else keterangan.push(mentah);
  }

  return {
    judul,
    keterangan: rapikanCatatan(keterangan),
    bagian: bagian
      .map(({ _catatan, ...b }) => ({ ...b, catatan: rapikanCatatan(_catatan) }))
      .filter(b => b.items.length > 0 || b.catatan !== ''),
  };
}

// ── Pembaca baris tabel (Excel / CSV) ──────────────────────────────────────

export const KOLOM_TEMPLATE = ['Bagian', 'Kelompok', 'Item', 'Catatan', 'Status'] as const;

type KunciKolom = 'bagian' | 'kelompok' | 'item' | 'catatan' | 'status';

const SINONIM: Record<KunciKolom, string[]> = {
  bagian: ['bagian', 'section', 'tahap', 'kategori'],
  kelompok: ['kelompok', 'sub bagian', 'subbagian', 'zona', 'group', 'grup'],
  item: ['item', 'pekerjaan', 'tugas', 'task', 'checklist', 'uraian'],
  catatan: ['catatan', 'keterangan', 'note', 'notes'],
  status: ['status', 'selesai', 'done'],
};

function sel(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\r/g, '').trim();
}

function statusSelesai(v: string): boolean {
  return ['selesai', 'done', 'ya', 'yes', 'v', 'x', '✓', '✔', 'true', '1'].includes(v.toLowerCase());
}

/**
 * baris[0] dianggap header bila memuat salah satu nama kolom yang dikenali;
 * kalau tidak, urutan kolom template (Bagian, Kelompok, Item, Catatan, Status)
 * dipakai. Sel Bagian yang kosong mewarisi baris di atasnya - sel gabungan
 * (merge) di Excel terbaca kosong di baris kedua dan seterusnya.
 */
export function bacaBaris(baris: unknown[][], judulCadangan = ''): DraftChecklist {
  const rows = baris.map(r => (Array.isArray(r) ? r.map(sel) : []))
    .filter(r => r.some(c => c !== ''));

  const posisi: Record<KunciKolom, number> = { bagian: 0, kelompok: 1, item: 2, catatan: 3, status: 4 };
  let mulai = 0;
  if (rows.length) {
    const kepala = rows[0].map(c => c.toLowerCase());
    const ketemu: Partial<Record<KunciKolom, number>> = {};
    (Object.keys(SINONIM) as KunciKolom[]).forEach(k => {
      const i = kepala.findIndex(c => SINONIM[k].includes(c));
      if (i !== -1) ketemu[k] = i;
    });
    if (ketemu.item !== undefined) {
      mulai = 1;
      (Object.keys(posisi) as KunciKolom[]).forEach(k => { posisi[k] = ketemu[k] ?? -1; });
    }
  }

  const ambil = (r: string[], k: KunciKolom) => (posisi[k] >= 0 ? r[posisi[k]] ?? '' : '');
  const bagian: DraftBagian[] = [];
  let kini: DraftBagian | null = null;
  let namaBagian = '';

  for (const r of rows.slice(mulai)) {
    const b = ambil(r, 'bagian');
    if (b) namaBagian = b;
    const judulBagian = namaBagian || 'Umum';
    if (!kini || kini.judul !== judulBagian) {
      kini = bagian.find(x => x.judul === judulBagian) ?? null;
      if (!kini) { kini = { judul: judulBagian, catatan: '', items: [] }; bagian.push(kini); }
    }
    const teks = ambil(r, 'item');
    const catatan = ambil(r, 'catatan');
    if (teks) {
      kini.items.push({ kelompok: ambil(r, 'kelompok'), teks, catatan, selesai: statusSelesai(ambil(r, 'status')) });
    } else if (catatan) {
      // Baris tanpa item tapi bercatatan = catatan untuk bagiannya.
      kini.catatan = [kini.catatan, catatan].filter(Boolean).join('\n');
    }
  }

  return { judul: judulCadangan, keterangan: '', bagian: bagian.filter(b => b.items.length || b.catatan) };
}

/** Isi contoh untuk tombol "Unduh template Excel". */
export const CONTOH_TEMPLATE: string[][] = [
  [...KOLOM_TEMPLATE],
  ['1. Persiapan', '', 'Cek fisik semua perangkat sesuai daftar', 'Jumlah, model, aksesori', ''],
  ['1. Persiapan', '', 'Siapkan alat: crimping, LAN tester, multimeter', '', ''],
  ['2. Instalasi', 'Zona WALL', 'Pasang bracket dan display', 'Level, tinggi sesuai gambar', ''],
  ['2. Instalasi', 'Zona TABLE', 'Pasang tabletop box di meja', '', ''],
  ['3. Pengujian', '', 'Uji semua sumber tampil di display', '', ''],
];

// ── Validasi (dipakai server; klien memakai hasil yang sama untuk pratinjau) ──

export function hitungItemDraft(d: DraftChecklist): number {
  return d.bagian.reduce((s, b) => s + b.items.length, 0);
}

/**
 * Pastikan draf dari klien utuh dan dalam batas. Mengembalikan pesan galat
 * yang bisa ditampilkan apa adanya, atau draf yang sudah dipangkas & rapi.
 */
export function validasiDraft(masuk: unknown): { galat: string } | { draft: DraftChecklist } {
  const d = masuk as Partial<DraftChecklist> | null;
  if (!d || typeof d !== 'object') return { galat: 'Isi checklist tidak terbaca.' };
  const judul = sel(d.judul).slice(0, BATAS.judul);
  if (!judul) return { galat: 'Judul checklist wajib diisi.' };
  if (!Array.isArray(d.bagian) || d.bagian.length === 0) return { galat: 'Tidak ada bagian yang diimpor.' };
  if (d.bagian.length > BATAS.bagian) return { galat: `Maksimal ${BATAS.bagian} bagian per checklist.` };

  const bagian: DraftBagian[] = [];
  for (const b of d.bagian as Partial<DraftBagian>[]) {
    const items = (Array.isArray(b?.items) ? b.items : [])
      .map(i => ({
        kelompok: sel(i?.kelompok).slice(0, BATAS.judul),
        teks: sel(i?.teks).slice(0, BATAS.teks),
        catatan: sel(i?.catatan).slice(0, BATAS.catatan),
        selesai: i?.selesai === true,
      }))
      .filter(i => i.teks);
    const catatan = sel(b?.catatan).slice(0, BATAS.catatan);
    if (!items.length && !catatan) continue;
    bagian.push({ judul: sel(b?.judul).slice(0, BATAS.judul) || 'Umum', catatan, items });
  }

  const draft = { judul, keterangan: sel(d.keterangan).slice(0, BATAS.keterangan), bagian };
  const n = hitungItemDraft(draft);
  if (n === 0) return { galat: 'Belum ada item yang bisa dicentang. Pastikan baris item ditulis "- [ ] ..." atau kolom Item terisi.' };
  if (n > BATAS.item) return { galat: `Maksimal ${BATAS.item} item per checklist (terbaca ${n}).` };
  return { draft };
}

export function validasiNama(v: unknown): string | null {
  const nama = sel(v).replace(/\s+/g, ' ');
  if (nama.length < 2 || nama.length > BATAS.nama) return null;
  return nama;
}

// ── Lain-lain ──────────────────────────────────────────────────────────────

/** URL absolut halaman share - aman dipanggil hanya di browser. */
export function urlShareChecklist(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/checklist/share/${token}`;
}

export function formatWaktu(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/** Item dikelompokkan per kelompok, urutan pertama kemunculan dipertahankan. */
export function kelompokkan<T extends { kelompok: string }>(items: T[]): { kelompok: string; items: T[] }[] {
  const hasil: { kelompok: string; items: T[] }[] = [];
  for (const it of items) {
    const ada = hasil.find(h => h.kelompok === it.kelompok);
    if (ada) ada.items.push(it);
    else hasil.push({ kelompok: it.kelompok, items: [it] });
  }
  return hasil;
}
