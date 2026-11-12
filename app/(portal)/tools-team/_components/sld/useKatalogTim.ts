'use client';
import { useCallback, useEffect, useState } from 'react';
import { bersihkanItemTim, MAKS_FOTO_TIM, SISI_FOTO_TIM, type IsiItemTim, type ItemTim } from '@/lib/sld/katalog-tim';
import { templatIkon } from '@/lib/sld/katalog';
import type { Perangkat } from '@/lib/sld/tipe';

const API = '/api/tools-team/sld/katalog';

export interface FotoTim { dataUrl: string; rasio: number }
export interface FormTim { item?: ItemTim; isi: IsiItemTim; sumberFoto?: string }

function muatGambar(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, gagal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => gagal(new Error('Foto tidak bisa dibaca. Gunakan PNG atau JPG.'));
    img.src = src;
  });
}

export async function fotoUntukTim(sumber: Blob | string): Promise<FotoTim> {
  if (typeof sumber !== 'string' && !/^image\//.test(sumber.type)) throw new Error('Pilih berkas gambar (PNG / JPG).');
  const url = typeof sumber === 'string' ? sumber : URL.createObjectURL(sumber);
  try {
    const img = await muatGambar(url);
    const sw = img.naturalWidth || 1, sh = img.naturalHeight || 1;
    let s = Math.min(1, SISI_FOTO_TIM / Math.max(sw, sh));
    const kanvas = document.createElement('canvas'), c = kanvas.getContext('2d');
    if (!c) throw new Error('Peramban tidak mendukung pengolahan gambar.');
    for (let coba = 0; coba < 6; coba++) {
      kanvas.width = Math.max(1, Math.round(sw * s)); kanvas.height = Math.max(1, Math.round(sh * s));
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, kanvas.width, kanvas.height);
      c.drawImage(img, 0, 0, kanvas.width, kanvas.height);
      const hasil = kanvas.toDataURL('image/jpeg', coba < 3 ? 0.82 : 0.7);
      if (hasil.length - 23 <= MAKS_FOTO_TIM * 0.95) return { dataUrl: hasil, rasio: sw / sh };
      s *= 0.8;
    }
    throw new Error('Foto tetap terlalu besar setelah dikecilkan.');
  } finally {
    if (typeof sumber !== 'string') URL.revokeObjectURL(url);
  }
}

export const isiDariPerangkat = (p: Perangkat): IsiItemTim => bersihkanItemTim({
  nama: p.nama, kategori: p.kategori, model: p.model, ket: p.ket, port: p.port, ikon: p.ikon, lebar: p.w, kelompok: templatIkon(p.ikon)?.kelompok,
}) ?? { nama: 'Object', kategori: '', kelompok: 'sumber', ikon: 'umum', model: '', port: [], ket: '', lebar: 40 };

const isiKosong = (): IsiItemTim => ({ nama: '', kategori: '', kelompok: 'sumber', ikon: 'umum', model: '', port: [], ket: '', lebar: 40 });

async function jsonDari(r: Response | null) {
  if (!r) return { ok: false, alasan: 'Tidak bisa terhubung ke server.' };
  try { return (await r.json()) as { ok: boolean; alasan?: string; daftar?: ItemTim[]; item?: ItemTim }; } catch { return { ok: false, alasan: `Server membalas ${r.status}.` }; }
}

async function ambilDaftar(): Promise<ItemTim[] | null> {
  const j = await jsonDari(await fetch(API, { credentials: 'include', cache: 'no-store' }).catch(() => null));
  return j.ok && j.daftar ? j.daftar : null;
}

export function useKatalogTim() {
  const [daftar, setDaftar] = useState<ItemTim[]>([]);
  const [status, setStatus] = useState<'muat' | 'siap' | 'galat'>('muat');
  const [form, setForm] = useState<FormTim | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const terapkan = useCallback((d: ItemTim[] | null) => { if (d) { setDaftar(d); setStatus('siap'); } else setStatus('galat'); }, []);
  useEffect(() => {
    let hidup = true;
    void ambilDaftar().then(d => { if (hidup) terapkan(d); });
    return () => { hidup = false; };
  }, [terapkan]);
  const muat = useCallback(async () => { setStatus('muat'); terapkan(await ambilDaftar()); }, [terapkan]);

  const simpan = useCallback(async (isi: IsiItemTim, id?: string, foto?: FotoTim | null): Promise<string | null> => {
    setSibuk(true);
    try {
      const body = { ...isi, id, ...(foto === undefined ? {} : foto === null ? { foto: null } : { foto: foto.dataUrl, rasio: foto.rasio }) };
      const r = await fetch(API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
      const j = await jsonDari(r);
      if (!j.ok || !j.item) return j.alasan ?? 'Gagal menyimpan object.';
      const baru = j.item;
      setDaftar(d => [...d.filter(x => x.id !== baru.id), baru].sort((a, b) => a.kelompok.localeCompare(b.kelompok) || a.nama.localeCompare(b.nama)));
      return null;
    } finally { setSibuk(false); }
  }, []);

  const hapus = useCallback(async (id: string): Promise<string | null> => {
    const j = await jsonDari(await fetch(`${API}?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' }).catch(() => null));
    if (!j.ok) return j.alasan ?? 'Gagal menghapus object.';
    setDaftar(d => d.filter(x => x.id !== id));
    return null;
  }, []);

  const bukaBaru = useCallback(() => setForm({ isi: isiKosong() }), []);
  const bukaUbah = useCallback((item: ItemTim) => setForm({ item, isi: { ...item, port: [...item.port] } }), []);
  const bukaDari = useCallback((p: Perangkat) => setForm({ isi: isiDariPerangkat(p), sumberFoto: p.gambar ?? p.foto }), []);
  const tutup = useCallback(() => setForm(null), []);

  return { daftar, status, sibuk, form, muat, simpan, hapus, bukaBaru, bukaUbah, bukaDari, tutup };
}

export type KatalogTim = ReturnType<typeof useKatalogTim>;
