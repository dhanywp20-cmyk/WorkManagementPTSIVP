'use client';
/**
 * Gambar desain yang disimpan sekali di server (lib/gambar-desain-server.ts): data desain membawa
 * "ref:<hash>", gambarnya diambil dari /api/tools-team/aset (cache permanen). Data URL lama (desain
 * sebelum migrasi 044, file laptop) tetap dipakai apa adanya.
 */
import type * as T from 'three';
import type { Mesin } from '../mesin/tipe';

export const POLA_REF_ASET = /^ref:[0-9a-f]{40}$/;
export const urlAset = (v: string) => (POLA_REF_ASET.test(v) ? `/api/tools-team/aset?h=${v.slice(4)}` : v);
export const nilaiGambarSah = (v: unknown): v is string => typeof v === 'string' && (POLA_REF_ASET.test(v) || v.startsWith('data:image/'));

/**
 * Pasang gambar konten layar benda `id` dari data URL / ref. Ref dicatat di tekstur, jadi menyimpan desain
 * lagi mengirim ref yang sama (tidak mengompres & mengunggah ulang gambar yang tidak berubah).
 */
export function muatGambarLayar(m: Mesin, id: string, v: string, peta: Map<string, T.Texture>, sesudah: () => void) {
  if (!nilaiGambarSah(v)) return;
  new m.THREE.TextureLoader().load(urlAset(v), tex => {
    tex.colorSpace = m.THREE.SRGBColorSpace;
    if (POLA_REF_ASET.test(v)) tex.userData.ref = v;
    peta.set(id, tex);
    sesudah();
  });
}
