import { FOTO_PRODUK, fotoSah } from './foto-produk';
import { cariTemplat } from './katalog';
import { rasioDinding } from './dinding';
import { URUTAN_JENIS } from './gaya';
import { sudutSah } from './geometri';
import {
  AREA, type BlokJudul, type CatatanPasang, type DokSLD, type JenisKabel, type Kabel, MAKS_BYTE_GAMBAR_SLD, MAKS_CATATAN, MAKS_KABEL,
  MAKS_PERANGKAT, type Perangkat, type PilihSisi, type Ujung, UKURAN_MIN,
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

export const dokBaru = (dibuat = ''): DokSLD => ({ versi: 1, blok: blokBaru(dibuat), perangkat: [], kabel: [], catatan: [], watermark: true });

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

function bersihkanPerangkat(v: unknown): Perangkat | null {
  const p = (v ?? {}) as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id) return null;
  const w = angka(p.w, UKURAN_MIN.w, AREA.w, 46), h = angka(p.h, UKURAN_MIN.h, AREA.h, 30);
  return {
    id: p.id.slice(0, 40), no: teks(p.no, 12), nama: teks(p.nama, 120), peran: teks(p.peran, 160), ket: teks(p.ket, 600),
    kategori: teks(p.kategori, 120), model: teks(p.model, 200), qty: angka(p.qty, 0, 100000, 1), satuan: teks(p.satuan, 20) || 'unit',
    subGambar: teks(p.subGambar, 160), ikon: teks(p.ikon, 30) || 'umum',
    port: Array.isArray(p.port) ? p.port.map(x => teks(x, 60)).filter(Boolean).slice(0, 48) : [],
    x: angka(p.x, AREA.x - w / 2, AREA.x + AREA.w - w / 2, AREA.x), y: angka(p.y, AREA.y - h / 2, AREA.y + AREA.h - h / 2, AREA.y), w, h,
    gambar: bersihkanGambarSLD(p.gambar),
    foto: fotoSah(p.foto) ? p.foto : undefined,
    rasio: Number.isFinite(Number(p.rasio)) && Number(p.rasio) > 0 ? angka(p.rasio, 0.1, 10, 1.6) : undefined,
    putar: sudutSah(p.putar) || undefined,
    balikH: p.balikH === true || undefined,
    balikV: p.balikV === true || undefined,
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
    labelBalik: c.labelBalik === true, tengah: Number.isFinite(tengah) ? tengah : undefined,
  };
}

export function bersihkanDok(v: unknown): DokSLD | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Record<string, unknown>;
  const b = (d.blok ?? {}) as Record<string, unknown>;
  const awal = blokBaru();
  const blok = Object.fromEntries(Object.keys(awal).map(k => [k, typeof b[k] === 'string' ? (b[k] as string).slice(0, 600) : awal[k as keyof BlokJudul]])) as unknown as BlokJudul;
  if (!blok.disetujui.trim()) blok.disetujui = awal.disetujui;
  const perangkat = (Array.isArray(d.perangkat) ? d.perangkat : []).slice(0, MAKS_PERANGKAT).map(bersihkanPerangkat).filter((p): p is Perangkat => !!p);
  const id = new Set(perangkat.map(p => p.id));
  const kabel = (Array.isArray(d.kabel) ? d.kabel : []).slice(0, MAKS_KABEL).map(c => bersihkanKabel(c, id)).filter((c): c is Kabel => !!c);
  const catatan = (Array.isArray(d.catatan) ? d.catatan : []).slice(0, MAKS_CATATAN)
    .map(x => ({ judul: teks((x as CatatanPasang)?.judul, 120), isi: teks((x as CatatanPasang)?.isi, 1200) }))
    .filter(x => x.judul || x.isi);
  return { versi: 1, blok, perangkat, kabel, catatan, watermark: d.watermark !== false };
}

export function hapusPerangkat(d: DokSLD, id: string): DokSLD {
  const lepas = (u: Ujung): Ujung => (u.p === id ? { ...u, p: '', nama: u.nama || namaDari(d, id) } : u);
  const kabel = d.kabel
    .map(c => ({ ...c, cabang: c.cabang.filter(u => u.p !== id), dari: lepas(c.dari), ke: lepas(c.ke) }))
    .filter(c => c.dari.p || c.ke.p || c.dari.nama || c.ke.nama);
  return { ...d, perangkat: d.perangkat.filter(p => p.id !== id), kabel };
}

const namaDari = (d: DokSLD, id: string) => d.perangkat.find(p => p.id === id)?.nama ?? '';

export type PetaFoto = Record<string, { gambar: string; rasio?: number }>;

export const tanpaFoto = (d: DokSLD): DokSLD => ({ ...d, perangkat: d.perangkat.map(p => ({ ...p, gambar: undefined })) });

export function petaFoto(d: DokSLD): PetaFoto {
  return Object.fromEntries(d.perangkat.filter(p => p.gambar).map(p => [p.id, { gambar: p.gambar!, rasio: p.rasio }]));
}

export function pasangFoto(d: DokSLD, peta: PetaFoto): DokSLD {
  return { ...d, perangkat: d.perangkat.map(p => {
    const f = peta[p.id];
    const gambar = f ? bersihkanGambarSLD(f.gambar) : undefined;
    return gambar ? { ...p, gambar, rasio: f.rasio ?? p.rasio } : p;
  }) };
}
