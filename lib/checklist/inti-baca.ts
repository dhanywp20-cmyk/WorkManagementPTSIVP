import { DraftItem, DraftBagian, DraftChecklist, BATAS, sel } from './inti';

export function bersihkanSebaris(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, '$1$2')
    .replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '$1')
    .trim();
}

export function rapikanCatatan(baris: string[]): string {
  const hasil: string[] = [];
  for (const b of baris) {
    if (b.trim() === '' && (hasil.length === 0 || hasil[hasil.length - 1].trim() === '')) continue;
    hasil.push(b.trimEnd());
  }
  while (hasil.length && hasil[hasil.length - 1].trim() === '') hasil.pop();
  return hasil.join('\n');
}

export const RE_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+\[\s*([xX]?)\s*\]\s+(.+)$/;

export const RE_BULLET_ANAK = /^\s{2,}(?:[-*+]|\d+[.)])\s+(.+)$/;

export function bacaTeks(sumber: string): DraftChecklist {
  const baris = sumber
    .replace(/\r/g, '')
    .replace(/<\?claude[^?]*\?>/g, '')
    .split('\n');

  let judul = '';
  const keterangan: string[] = [];
  const bagian: (DraftBagian & { _catatan: string[] })[] = [];
  let kini: (DraftBagian & { _catatan: string[] }) | null = null;
  let kelompok = '';
  let itemTerakhir: DraftItem | null = null;
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

    if (/^!\[[^\]]*\]\([^)]*\)$/.test(t)) continue;
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

export const KOLOM_TEMPLATE = ['Bagian', 'Kelompok', 'Item', 'Catatan', 'Status'] as const;

export type KunciKolom = 'bagian' | 'kelompok' | 'item' | 'catatan' | 'status';

export const SINONIM: Record<KunciKolom, string[]> = {
  bagian: ['bagian', 'section', 'tahap', 'kategori'],
  kelompok: ['kelompok', 'sub bagian', 'subbagian', 'zona', 'group', 'grup'],
  item: ['item', 'pekerjaan', 'tugas', 'task', 'checklist', 'uraian'],
  catatan: ['catatan', 'keterangan', 'note', 'notes'],
  status: ['status', 'selesai', 'done'],
};

export function statusSelesai(v: string): boolean {
  return ['selesai', 'done', 'ya', 'yes', 'v', 'x', '✓', '✔', 'true', '1'].includes(v.toLowerCase());
}

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
      kini.catatan = [kini.catatan, catatan].filter(Boolean).join('\n');
    }
  }

  return { judul: judulCadangan, keterangan: '', bagian: bagian.filter(b => b.items.length || b.catatan) };
}

export const CONTOH_TEMPLATE: string[][] = [
  [...KOLOM_TEMPLATE],
  ['1. Persiapan', '', 'Cek fisik semua perangkat sesuai daftar', 'Jumlah, model, aksesori', ''],
  ['1. Persiapan', '', 'Siapkan alat: crimping, LAN tester, multimeter', '', ''],
  ['2. Instalasi', 'Zona WALL', 'Pasang bracket dan display', 'Level, tinggi sesuai gambar', ''],
  ['2. Instalasi', 'Zona TABLE', 'Pasang tabletop box di meja', '', ''],
  ['3. Pengujian', '', 'Uji semua sumber tampil di display', '', ''],
];

export function hitungItemDraft(d: DraftChecklist): number {
  return d.bagian.reduce((s, b) => s + b.items.length, 0);
}

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
