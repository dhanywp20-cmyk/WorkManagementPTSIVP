'use client';
import type { PetaFoto } from '@/lib/sld/dok';

export interface FotoGaleri { id: string; nama: string; gambar: string; rasio: number }

const DB = 'tools-team-sld', TOKO = 'foto', MAKS_GALERI = 60;

function buka(): Promise<IDBDatabase> {
  return new Promise((ok, gagal) => {
    if (typeof indexedDB === 'undefined') { gagal(new Error('IndexedDB tidak tersedia')); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(TOKO)) r.result.createObjectStore(TOKO); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => gagal(r.error ?? new Error('IndexedDB gagal dibuka'));
  });
}

async function jalankan<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  const db = await buka();
  try {
    return await new Promise<T | undefined>((ok, gagal) => {
      const t = db.transaction(TOKO, mode);
      const r = f(t.objectStore(TOKO));
      t.oncomplete = () => ok(r.result as T | undefined);
      t.onerror = () => gagal(t.error ?? new Error('IndexedDB gagal'));
    });
  } finally { db.close(); }
}

export const muatFotoDraf = async () => (await jalankan<PetaFoto>('readonly', s => s.get('draf'))) ?? {};
export const simpanFotoDraf = (p: PetaFoto) => jalankan('readwrite', s => s.put(p, 'draf'));
export const muatGaleri = async () => (await jalankan<FotoGaleri[]>('readonly', s => s.get('galeri'))) ?? [];
export const simpanGaleri = (g: FotoGaleri[]) => jalankan('readwrite', s => s.put(g.slice(0, MAKS_GALERI), 'galeri'));
export const muatLogo = async () => (await jalankan<string>('readonly', s => s.get('logo'))) ?? null;
export const simpanLogo = (logo: string | null) => jalankan('readwrite', s => (logo ? s.put(logo, 'logo') : s.delete('logo')));
