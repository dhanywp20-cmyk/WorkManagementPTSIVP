import { FOTO_PRODUK, fotoSah } from './foto-produk';
import { cariTemplat } from './katalog';
import { rasioDinding } from './dinding';
import { URUTAN_JENIS } from './gaya';
import { sudutSah } from './geometri';
import {
  AREA, areaDok, type BlokJudul, type CatatanPasang, type DokSLD, halamanDok, HURUF_MAKS, HURUF_MIN, type JenisKabel, type Kabel, type Kertas, KERTAS,
  MAKS_BYTE_GAMBAR_SLD, MAKS_CATATAN, MAKS_KABEL, MAKS_PERANGKAT, MAKS_RUANG, MAKS_TEKS, MAKS_ZONA, type Perangkat, type PilihSisi, POSISI_LABEL, type PosisiLabel, type RuangSLD, type TeksBebas, type Ujung, UKURAN_MIN, type WarnaTeks, type WarnaZona, type ZonaSLD,
} from './tipe';

let urut = 0;
export const idBaru = (awal = 's') => `${awal}${Date.now().toString(36)}${(urut++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const tanggalSLD = (t = new Date()) => `${t.getDate()} ${bulan[t.getMonth()]} ${t.getFullYear()}`;

export function blokBaru(dibuat = ''): BlokJudul {
  return {
    proyek: '', lokasi: '', sistem: '', ringkas: '', lingkup: '', acuan: '', acuanSingkat: '', catatanRev: '',
    nomor: 'SLD-01', rev: 'A', tanggal: tanggalSLD(), skala: 'NTS', dibuat, diperiksa: '', disetujui: 'DWP',
  };
}

export const dokBaru = (dibuat = ''): DokSLD => ({ versi: 1, blok: blokBaru(dibuat), perangkat: [], kabel: [], teks: [], catatan: [], watermark: true, kertas: '169' });

export const zonaBaru = (x: number, y: number, label = 'Area'): ZonaSLD => ({ id: idBaru('z'), x, y, w: 90, h: 60, label, warna: 'abu' });

export const teksBaru = (x: number, y: number, isi = 'Teks'): TeksBebas => ({ id: idBaru('t'), x, y, isi, ukuran: 3, warna: 'hitam', tebal: false });

export function perangkatBaru(k: string, x: number, y: number, isi: Partial<Perangkat> = {}): Perangkat {
  const t = cariTemplat(k);
  const fp = t.foto ? FOTO_PRODUK[t.foto] : undefined;
  const w = isi.w ?? t.w;
  const rd = rasioDinding(t.ikon, { nama: t.nama, ket: t.ket });
  const ukuran = fp ? { foto: fp.src, rasio: fp.rasio, h: isi.h ?? Math.round(Math.min(40, Math.max(10, w / fp.rasio)) * 2) / 2 }
    : { h: isi.h ?? (rd ? Math.round(Math.min(60, Math.max(10, w / rd)) * 2) / 2 : t.h) };
  return {
    id: idBaru('p'), no: '', nama: t.nama, peran: '', ket: t.ket ?? '', kategori: t.kategori, model: '', qty: 1, satuan: 'unit',
    subGambar: '', ikon: t.ikon, port: [...t.port], x, y, w, ...ukuran, ...isi,
  };
}

export const ujungBaru = (p = '', port = ''): Ujung => ({ p, nama: '', port, sisi: 'auto' });

export function kabelBaru(dari: string, ke: string, isi: Partial<Kabel> = {}): Kabel {
  return {
    id: idBaru('k'), jenis: 'catx', daya: false, duaArah: false, dari: ujungBaru(dari), ke: ujungBaru(ke), cabang: [],
    media: 'Cat6', teksGaris: '', fungsi: '', catatan: '', labelBalik: false, ...isi,
  };
}

const teks = (v: unknown, maks = 400) => (typeof v === 'string' ? v.slice(0, maks) : '');
const angka = (v: unknown, min: number, maks: number, awal: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(maks, Math.max(min, x)) : awal;
};
const SISI: PilihSisi[] = ['auto', 'kiri', 'kanan', 'atas', 'bawah'];

function bersihkanUjung(v: unknown): Ujung {
  const u = (v ?? {}) as Record<string, unknown>;
  return { p: teks(u.p, 40), nama: teks(u.nama, 120), port: teks(u.port, 120), sisi: SISI.includes(u.sisi as PilihSisi) ? (u.sisi as PilihSisi) : 'auto' };
}

export function bersihkanGambarSLD(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > MAKS_BYTE_GAMBAR_SLD * 1.4) return undefined;
  return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : undefined;
}

export const hurufSah = (v: unknown) => {
  const x = Number(v);
  if (!Number.isFinite(x) || x <= 0) return undefined;
  const h = Math.min(HURUF_MAKS, Math.max(HURUF_MIN, Math.round(x * 100) / 100));
  return h === 1 ? undefined : h;
};

type Area = { x: number; y: number; w: number; h: number };

function bersihkanPerangkat(v: unknown, area: Area = AREA): Perangkat | null {
  const p = (v ?? {}) as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id) return null;
  const w = angka(p.w, UKURAN_MIN.w, AREA.w, 46), h = angka(p.h, UKURAN_MIN.h, AREA.h, 30);
  return {
    id: p.id.slice(0, 40), no: teks(p.no, 12), nama: teks(p.nama, 120), peran: teks(p.peran, 160), ket: teks(p.ket, 600),
    kategori: teks(p.kategori, 120), model: teks(p.model, 200), qty: angka(p.qty, 0, 100000, 1), satuan: teks(p.satuan, 20) || 'unit',
    subGambar: teks(p.subGambar, 160), ikon: teks(p.ikon, 30) || 'umum',
    port: Array.isArray(p.port) ? p.port.map(x => teks(x, 60)).filter(Boolean).slice(0, 48) : [],
    x: angka(p.x, area.x - w / 2, area.x + area.w - w / 2, area.x), y: angka(p.y, area.y - h / 2, area.y + area.h - h / 2, area.y), w, h,
    gambar: bersihkanGambarSLD(p.gambar),
    foto: fotoSah(p.foto) ? p.foto : undefined,
    rasio: Number.isFinite(Number(p.rasio)) && Number(p.rasio) > 0 ? angka(p.rasio, 0.1, 10, 1.6) : undefined,
    putar: sudutSah(p.putar) || undefined,
    balikH: p.balikH === true || undefined,
    balikV: p.balikV === true || undefined,
    huruf: hurufSah(p.huruf),
    labelDi: POSISI_LABEL.includes(p.labelDi as PosisiLabel) && p.labelDi !== 'bawah' ? (p.labelDi as PosisiLabel) : undefined,
  };
}

function bersihkanKabel(v: unknown, id: Set<string>): Kabel | null {
  const c = (v ?? {}) as Record<string, unknown>;
  if (typeof c.id !== 'string' || !c.id) return null;
  const tengah = Number(c.tengah);
  return {
    id: c.id.slice(0, 40), jenis: URUTAN_JENIS.includes(c.jenis as JenisKabel) ? (c.jenis as JenisKabel) : 'lain',
    daya: c.daya === true, duaArah: c.duaArah === true, dari: bersihkanUjung(c.dari), ke: bersihkanUjung(c.ke),
    cabang: Array.isArray(c.cabang) ? c.cabang.slice(0, 8).map(bersihkanUjung).filter(u => id.has(u.p)) : [],
    media: teks(c.media, 120), teksGaris: teks(c.teksGaris, 80), fungsi: teks(c.fungsi, 300), catatan: teks(c.catatan, 300),
    labelBalik: c.labelBalik === true, tengah: Number.isFinite(tengah) ? tengah : undefined, huruf: hurufSah(c.huruf),
  };
}

const WARNA_TEKS: WarnaTeks[] = ['hitam', 'merah', 'abu', 'biru'];

function bersihkanTeks(v: unknown, area: Area): TeksBebas | null {
  const t = (v ?? {}) as Record<string, unknown>;
  if (typeof t.id !== 'string' || !t.id) return null;
  return {
    id: t.id.slice(0, 40), isi: teks(t.isi, 500) || 'Teks', ukuran: angka(t.ukuran, 1, 20, 3), tebal: t.tebal === true,
    x: angka(t.x, area.x - 10, area.x + area.w, area.x), y: angka(t.y, area.y - 5, area.y + area.h, area.y),
    warna: WARNA_TEKS.includes(t.warna as WarnaTeks) ? (t.warna as WarnaTeks) : 'hitam', putar: sudutSah(t.putar) || undefined,
  };
}

type Isi = Pick<DokSLD, 'perangkat' | 'kabel' | 'teks' | 'catatan' | 'boq' | 'zona'>;
const WARNA_ZONA_SAH: WarnaZona[] = ['abu', 'biru', 'merah', 'hijau', 'oranye'];

function bersihkanZona(v: unknown, area: Area): ZonaSLD | null {
  const z = (v ?? {}) as Record<string, unknown>;
  if (typeof z.id !== 'string' || !z.id) return null;
  const w = angka(z.w, 10, area.w + 20, 80), h = angka(z.h, 8, area.h + 20, 50);
  return { id: z.id.slice(0, 40), label: teks(z.label, 60), warna: WARNA_ZONA_SAH.includes(z.warna as WarnaZona) ? (z.warna as WarnaZona) : 'abu',
    x: angka(z.x, area.x - 10, area.x + area.w, area.x), y: angka(z.y, area.y - 5, area.y + area.h, area.y), w, h };
}
const BIDANG_BOQ = { kategori: 120, merek: 120, model: 200, spek: 800, fungsi: 600 } as const;

function bersihkanIsi(d: Record<string, unknown>, area: Area): Isi {
  const perangkat = (Array.isArray(d.perangkat) ? d.perangkat : []).slice(0, MAKS_PERANGKAT).map(x => bersihkanPerangkat(x, area)).filter((p): p is Perangkat => !!p);
  const teksBebas = (Array.isArray(d.teks) ? d.teks : []).slice(0, MAKS_TEKS).map(x => bersihkanTeks(x, area)).filter((t): t is TeksBebas => !!t);
  const id = new Set(perangkat.map(p => p.id));
  const kabel = (Array.isArray(d.kabel) ? d.kabel : []).slice(0, MAKS_KABEL).map(c => bersihkanKabel(c, id)).filter((c): c is Kabel => !!c);
  const catatan = (Array.isArray(d.catatan) ? d.catatan : []).slice(0, MAKS_CATATAN)
    .map(x => ({ judul: teks((x as CatatanPasang)?.judul, 120), isi: teks((x as CatatanPasang)?.isi, 1200) }))
    .filter(x => x.judul || x.isi);
  const boq = Object.fromEntries(Object.entries((d.boq && typeof d.boq === 'object' ? d.boq : {}) as Record<string, unknown>).slice(0, MAKS_PERANGKAT * 2)
    .map(([k, v]) => {
      const x = (v ?? {}) as Record<string, unknown>;
      return [k.slice(0, 200), Object.fromEntries(Object.entries(BIDANG_BOQ).map(([b, maks]) => [b, teks(x[b], maks)]).filter(([, isi]) => isi))] as const;
    })
    .filter(([, v]) => Object.keys(v).length));
  const zona = (Array.isArray(d.zona) ? d.zona : []).slice(0, MAKS_ZONA).map(x => bersihkanZona(x, area)).filter((z): z is ZonaSLD => !!z);
  return { perangkat, kabel, teks: teksBebas, catatan, ...(Object.keys(boq).length ? { boq } : {}), ...(zona.length ? { zona } : {}) };
}

export function bersihkanDok(v: unknown): DokSLD | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Record<string, unknown>;
  const b = (d.blok ?? {}) as Record<string, unknown>;
  const awal = blokBaru();
  const blok = Object.fromEntries(Object.keys(awal).map(k => [k, typeof b[k] === 'string' ? (b[k] as string).slice(0, 600) : awal[k as keyof BlokJudul]])) as unknown as BlokJudul;
  if (!blok.disetujui.trim()) blok.disetujui = awal.disetujui;
  const kertas: Kertas = d.kertas === '169' ? '169' : 'a3', area = areaDok({ kertas });
  const h = (d.huruf ?? {}) as Record<string, unknown>, huruf = { perangkat: hurufSah(h.perangkat), kabel: hurufSah(h.kabel) };
  const ruangLain: RuangSLD[] = (Array.isArray(d.ruangLain) ? d.ruangLain : []).slice(0, MAKS_RUANG - 1).map(r => {
    const x = (r ?? {}) as Record<string, unknown>;
    return { id: typeof x.id === 'string' && x.id ? x.id.slice(0, 40) : idBaru('r'), nama: teks(x.nama, 80), ...bersihkanIsi(x, area) };
  });
  return {
    versi: 1, blok, ...bersihkanIsi(d, area), watermark: d.watermark !== false, kertas,
    ...(teks(d.namaRuang, 80) ? { namaRuang: teks(d.namaRuang, 80) } : {}),
    ...(ruangLain.length ? { ruangLain } : {}),
    ...(huruf.perangkat || huruf.kabel ? { huruf } : {}),
  };
}

const setengah = (v: number) => Math.round(v * 2) / 2;

function skalaIsi<T extends Pick<DokSLD, 'perangkat' | 'kabel' | 'teks' | 'zona'>>(r: T, k: number): T {
  const Y = (y: number) => AREA.y + (y - AREA.y) * k;
  return {
    ...r,
    perangkat: r.perangkat.map(p => {
      const w = setengah(Math.max(UKURAN_MIN.w, p.w * k)), h = setengah(Math.max(UKURAN_MIN.h, p.h * k));
      return { ...p, x: setengah(p.x + (p.w - w) / 2), y: setengah(Y(p.y + p.h / 2) - h / 2), w, h };
    }),
    kabel: r.kabel.map(c => ({ ...c, tengah: undefined })),
    teks: r.teks.map(t => ({ ...t, y: setengah(Y(t.y)) })),
    ...(r.zona ? { zona: r.zona.map(z => ({ ...z, y: setengah(Y(z.y)), h: setengah(Math.max(8, z.h * k)) })) } : {}),
  };
}

export function ubahKertas(d: DokSLD, kertas: Kertas): DokSLD {
  const lama = halamanDok(d).h, baru = KERTAS[kertas].h;
  if (lama === baru) return { ...d, kertas };
  const k = (baru - 18) / (lama - 18);
  return { ...skalaIsi(d, k), kertas, ...(d.ruangLain ? { ruangLain: d.ruangLain.map(r => skalaIsi(r, k)) } : {}) };
}

export function hapusPerangkat(d: DokSLD, id: string): DokSLD {
  const kabel = d.kabel.flatMap(c => {
    const cabang = c.cabang.filter(u => u.p !== id);
    if (c.dari.p === id) return [];
    if (c.ke.p !== id) return [{ ...c, cabang }];
    return cabang.length ? [{ ...c, ke: cabang[0], cabang: cabang.slice(1) }] : [];
  });
  return { ...d, perangkat: d.perangkat.filter(p => p.id !== id), kabel };
}

export function kabelYatim(d: DokSLD): Kabel[] {
  const ada = new Set(d.perangkat.map(p => p.id));
  return d.kabel.filter(c => !c.daya && (!ada.has(c.dari.p) || ![c.ke, ...c.cabang].some(u => ada.has(u.p))));
}

export type PetaFoto = Record<string, { gambar: string; rasio?: number }>;

export const tanpaFotoIsi = <T extends { perangkat: Perangkat[] }>(r: T): T => ({ ...r, perangkat: r.perangkat.map(p => ({ ...p, gambar: undefined })) });

export const tanpaFoto = (d: DokSLD): DokSLD => ({ ...tanpaFotoIsi(d), ...(d.ruangLain ? { ruangLain: d.ruangLain.map(tanpaFotoIsi) } : {}) });

const semuaPerangkatDok = (d: DokSLD) => [...d.perangkat, ...(d.ruangLain ?? []).flatMap(r => r.perangkat)];

export function petaFoto(d: DokSLD): PetaFoto {
  return Object.fromEntries(semuaPerangkatDok(d).filter(p => p.gambar).map(p => [p.id, { gambar: p.gambar!, rasio: p.rasio }]));
}

export function pasangFoto(d: DokSLD, peta: PetaFoto): DokSLD {
  const pasang = (p: Perangkat) => {
    const f = peta[p.id];
    const gambar = f ? bersihkanGambarSLD(f.gambar) : undefined;
    return gambar ? { ...p, gambar, rasio: f.rasio ?? p.rasio } : p;
  };
  return { ...d, perangkat: d.perangkat.map(pasang), ...(d.ruangLain ? { ruangLain: d.ruangLain.map(r => ({ ...r, perangkat: r.perangkat.map(pasang) })) } : {}) };
}
