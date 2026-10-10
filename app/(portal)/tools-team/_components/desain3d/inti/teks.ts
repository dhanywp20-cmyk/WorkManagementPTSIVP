/**
 * Teks / keterangan manual di Desain 3D (jenis 'teks'): tulisan bebas di dinding, di lantai, atau
 * melayang menghadap kamera - untuk penanda yang tidak punya benda sendiri ("Area tamu", "Jalur kabel
 * lewat plafon", "Stop kontak 2×", dsb.).
 *
 * Ukuran kotak benda (w × h) diturunkan dari isi teks & tinggi huruf, supaya gizmo, pilih, dan tempel
 * ke dinding tetap bekerja seperti benda lain. Murni - tanpa three.js / DOM (diuji di uji/desain3d-teks.ts).
 */
import type { Benda, HadapTeks } from './tipe';

export const MAKS_TEKS = 300;
export const MAKS_BARIS_TEKS = 8;
/** Tinggi huruf bawaan & batasnya (m). */
export const TINGGI_HURUF_AWAL = 0.12;
export const TINGGI_HURUF_MIN = 0.02;
export const TINGGI_HURUF_MAKS = 1.5;
/** Perbandingan lebar rata-rata satu huruf terhadap tingginya (huruf tebal sans-serif). */
const LEBAR_HURUF = 0.58;
/** Jarak antar baris (kali tinggi huruf) & tepi latar (kali tinggi huruf). */
const SPASI_BARIS = 1.25, TEPI = 0.35;

export const LABEL_HADAP_TEKS: Record<HadapTeks, string> = {
  berdiri: 'Berdiri / di dinding',
  lantai: 'Rebah di lantai / meja',
  kamera: 'Selalu menghadap kamera',
};

/** Baris-baris teks yang digambar: dipangkas, maks MAKS_BARIS_TEKS baris; kosong = "Teks". */
export function barisTeks(teks: string | undefined): string[] {
  const baris = String(teks ?? '').slice(0, MAKS_TEKS).replace(/\r/g, '').split('\n')
    .map(s => s.replace(/\s+$/, '')).slice(0, MAKS_BARIS_TEKS);
  while (baris.length > 1 && !baris[baris.length - 1]) baris.pop();
  return baris.some(s => s.trim()) ? baris : ['Teks'];
}

export function tinggiHurufSah(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : TINGGI_HURUF_AWAL;
  return Math.min(TINGGI_HURUF_MAKS, Math.max(TINGGI_HURUF_MIN, n));
}

/** Kotak teks (m): lebar mengikuti baris terpanjang, tinggi mengikuti jumlah baris. */
export function ukuranTeks(teks: string | undefined, tinggiHuruf: number | undefined): { w: number; h: number } {
  const t = tinggiHurufSah(tinggiHuruf);
  const baris = barisTeks(teks);
  const terpanjang = Math.max(1, ...baris.map(s => Array.from(s).length));
  const bulat = (m: number) => Math.round(m * 1000) / 1000;
  return {
    w: bulat(terpanjang * LEBAR_HURUF * t + 2 * TEPI * t),
    h: bulat((baris.length - 1) * SPASI_BARIS * t + t + 2 * TEPI * t),
  };
}

/** Benda teks dengan ukuran kotak yang sesuai isinya (dipanggil terapkanUkuran). */
export function terapkanUkuranTeks(b: Benda): Benda {
  const { w, h } = ukuranTeks(b.teks, b.tinggiHuruf);
  //  Rebah di lantai: kotaknya pipih (tinggi = tebal tipis), lebar & "dalam" = ukuran tulisan.
  if (b.hadapTeks === 'lantai') return { ...b, tinggiHuruf: tinggiHurufSah(b.tinggiHuruf), w, d: h, h: 0.005 };
  return { ...b, tinggiHuruf: tinggiHurufSah(b.tinggiHuruf), w, h, d: 0.01 };
}
