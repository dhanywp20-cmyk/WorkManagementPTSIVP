'use client';
/**
 * Tekstur lantai / dinding dari gambar sendiri: kompres di peramban, daftarkan ke peta di memori, dan
 * kumpulkan yang dipakai ruang untuk disimpan (server tim, file laptop, template default Admin).
 * Aturan murni (kunci, ubin, pengulangan) ada di inti/teksturRuang.ts.
 */
import { kunciTeksturDipakai, POLA_KUNCI_TEKSTUR, type Ruang } from '../inti';
import type { KeadaanDesain } from '../useKeadaanDesain';

type PetaTekstur = Pick<KeadaanDesain, 'sumberTekstur' | 'gambarTekstur' | 'setVersiTekstur'>;

/** Batas data URL satu tekstur - sama dengan gambar layar di server (MAKS_BYTE_LAYAR). */
const MAKS_DATA_URL = 195_000;
const SISI_MAKS = 1024;

/** Daftarkan gambar tekstur (dari desain yang dibuka / template / unggahan) lalu bangun ulang ruangan. */
export function daftarkanTekstur(K: PetaTekstur, peta: Record<string, string> | null | undefined): void {
  for (const [kunci, url] of Object.entries(peta ?? {})) {
    if (!POLA_KUNCI_TEKSTUR.test(kunci) || typeof url !== 'string' || !url.startsWith('data:image/')) continue;
    if (K.sumberTekstur.current.get(kunci) === url && K.gambarTekstur.current.has(kunci)) continue;
    K.sumberTekstur.current.set(kunci, url);
    const img = new Image();
    img.onload = () => { K.gambarTekstur.current.set(kunci, img); K.setVersiTekstur(v => v + 1); };
    img.src = url;
  }
}

/** Gambar tekstur yang dipakai ruang ini, untuk ikut disimpan (kunci -> data URL). */
export function teksturUntukSimpan(K: Pick<KeadaanDesain, 'sumberTekstur'>, ruang: Ruang): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const k of kunciTeksturDipakai(ruang)) { const url = K.sumberTekstur.current.get(k); if (url) hasil[k] = url; }
  return hasil;
}

/** Berkas gambar -> data URL JPEG persegi panjang maks 1024 px, kualitas diturunkan sampai muat batas server. */
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
