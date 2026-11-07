'use client';
import { kunciTeksturDipakai, POLA_KUNCI_TEKSTUR, type Ruang } from '../inti';
import type { KeadaanDesain } from '../useKeadaanDesain';
import { nilaiGambarSah, POLA_REF_ASET, urlAset } from './aset';

type PetaTekstur = Pick<KeadaanDesain, 'sumberTekstur' | 'gambarTekstur' | 'setVersiTekstur'>;

const MAKS_DATA_URL = 195_000;
const SISI_MAKS = 1024;

export function daftarkanTekstur(K: PetaTekstur, peta: Record<string, string> | null | undefined): void {
  for (const [kunci, url] of Object.entries(peta ?? {})) {
    if (!POLA_KUNCI_TEKSTUR.test(kunci) || !nilaiGambarSah(url)) continue;
    if (K.sumberTekstur.current.get(kunci) === url && K.gambarTekstur.current.has(kunci)) continue;
    K.sumberTekstur.current.set(kunci, url);
    const img = new Image();
    img.onload = () => { K.gambarTekstur.current.set(kunci, img); K.setVersiTekstur(v => v + 1); };
    img.src = urlAset(url);
  }
}

export function teksturUntukSimpan(K: Pick<KeadaanDesain, 'sumberTekstur'>, ruang: Ruang): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const k of kunciTeksturDipakai(ruang)) { const url = K.sumberTekstur.current.get(k); if (url) hasil[k] = url; }
  return hasil;
}

export function teksturUntukFile(K: Pick<KeadaanDesain, 'sumberTekstur' | 'gambarTekstur'>, ruang: Ruang): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const [k, v] of Object.entries(teksturUntukSimpan(K, ruang))) {
    if (!POLA_REF_ASET.test(v)) { hasil[k] = v; continue; }
    const img = K.gambarTekstur.current.get(k);
    if (!img?.width) continue;
    try {
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      cv.getContext('2d')?.drawImage(img, 0, 0);
      hasil[k] = cv.toDataURL('image/jpeg', 0.85);
    } catch {  }
  }
  return hasil;
}

export async function berkasKeTekstur(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, gagal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = gagal; i.src = url; });
    const skala = Math.min(1, SISI_MAKS / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.width * skala)); cv.height = Math.max(1, Math.round(img.height * skala));
    cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
    for (const q of [0.82, 0.7, 0.58, 0.45, 0.35]) { const u = cv.toDataURL('image/jpeg', q); if (u.length <= MAKS_DATA_URL) return u; }
    return null;
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}
