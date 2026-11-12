import { idBaru } from './dok';
import { POLA_FOTO_TIM } from './foto-produk';
import { DAFTAR_IKON } from './ikon';
import { URUTAN_KELOMPOK, type KelompokKatalog } from './katalog';
import type { DokSLD, Perangkat } from './tipe';

export interface IsiItemTim { nama: string; kategori: string; kelompok: KelompokKatalog; ikon: string; model: string; port: string[]; ket: string; lebar: number }
export interface ItemTim extends IsiItemTim { id: string; versi: number; adaFoto: boolean; rasio: number | null; oleh: string; bolehUbah: boolean }

export const SISI_FOTO_TIM = 400;
export const MAKS_FOTO_TIM = 160_000;
export const POLA_DATA_FOTO_TIM = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/;

const teks = (v: unknown, maks: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, maks) : '');

export function bersihkanItemTim(v: unknown): IsiItemTim | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const nama = teks(o.nama, 80);
  if (!nama) return null;
  const lebar = Number(o.lebar);
  const port = (Array.isArray(o.port) ? o.port : typeof o.port === 'string' ? o.port.split(',') : []).map(x => teks(x, 40)).filter(Boolean).slice(0, 48);
  return {
    nama, kategori: teks(o.kategori, 80), model: teks(o.model, 120), ket: typeof o.ket === 'string' ? o.ket.trim().slice(0, 400) : '', port,
    kelompok: URUTAN_KELOMPOK.includes(o.kelompok as KelompokKatalog) ? (o.kelompok as KelompokKatalog) : 'sumber',
    ikon: DAFTAR_IKON.some(i => i.v === o.ikon) ? String(o.ikon) : 'umum',
    lebar: Number.isFinite(lebar) ? Math.round(Math.min(200, Math.max(12, lebar)) * 2) / 2 : 40,
  };
}

export const urlFotoTim = (id: string, versi: number) => `/api/tools-team/sld/katalog/${id}/${versi}`;
export const idFotoTim = (src?: string) => (src && POLA_FOTO_TIM.test(src) ? src.split('/')[5] : undefined);

export function segarkanFotoTim(d: DokSLD, daftar: ItemTim[]): DokSLD | null {
  if (!daftar.length) return null;
  const peta = new Map(daftar.map(t => [t.id, t]));
  let berubah = false;
  const segar = (p: Perangkat): Perangkat => {
    const t = peta.get(idFotoTim(p.foto) ?? '');
    if (!t) return p;
    if (!t.adaFoto || !t.rasio) { berubah = true; return { ...p, foto: undefined, rasio: undefined }; }
    const url = urlFotoTim(t.id, t.versi);
    if (p.foto === url && p.rasio === t.rasio) return p;
    berubah = true;
    return { ...p, foto: url, rasio: t.rasio };
  };
  const hasil = { ...d, perangkat: d.perangkat.map(segar), ...(d.ruangLain ? { ruangLain: d.ruangLain.map(r => ({ ...r, perangkat: r.perangkat.map(segar) })) } : {}) };
  return berubah ? hasil : null;
}

export const fotoLokal = (d: Pick<DokSLD, 'perangkat'>) => d.perangkat.filter(p => !!p.gambar);

export function perangkatDariTim(t: ItemTim, x: number, y: number): Perangkat {
  const rasio = t.adaFoto && t.rasio ? t.rasio : undefined;
  const h = Math.round(Math.min(60, Math.max(10, t.lebar / (rasio ?? 1.6))) * 2) / 2;
  return {
    id: idBaru('p'), no: '', nama: t.nama, peran: '', ket: t.ket, kategori: t.kategori || 'Perangkat', model: t.model || t.nama, qty: 1, satuan: 'unit',
    subGambar: '', ikon: t.ikon, port: [...t.port], x, y, w: t.lebar, h, ...(rasio ? { foto: urlFotoTim(t.id, t.versi), rasio } : {}),
  };
}
