/**
 * lib/galat-klien.ts - aturan pencatatan galat di layar pengguna (murni, dipakai klien & server).
 * Pengirimnya lib/lapor-galat.ts, penerimanya /api/galat, tampilannya Admin Panel -> Kesehatan Sistem.
 */

export type SumberGalat = 'halaman' | 'skrip' | 'janji';

export interface LaporanGalat {
  pesan: string;
  jalur?: string;
  sumber: SumberGalat;
  digest?: string;
}

export const BATAS_PESAN = 300;
export const BATAS_JALUR = 200;
/** Paling banyak laporan per muat halaman - satu galat yang berulang di loop tidak membanjiri. */
export const BATAS_PER_HALAMAN = 10;
/** Jenis galat baru per hari yang diterima server - pengaman kuota paket Free. */
export const BATAS_JENIS_PER_HARI = 300;

/**
 * Galat yang bukan kesalahan platform dan hanya menambah kebisingan: ekstensi peramban, skrip
 * pihak ketiga tanpa detail ("Script error."), peringatan ResizeObserver yang tidak berbahaya,
 * permintaan yang sengaja dibatalkan, dan berkas lama sesudah deploy (sudah dimuat ulang sendiri).
 */
export function abaikanGalat(pesan: string, berkasSkrip?: string, asal?: string): boolean {
  const p = (pesan || '').trim();
  if (!p) return true;
  if (/^Script error\.?$/i.test(p)) return true;
  if (/ResizeObserver loop/i.test(p)) return true;
  if (/AbortError|The user aborted a request|signal is aborted/i.test(p)) return true;
  if (/ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(p)) return true;
  if (berkasSkrip && /^(chrome|moz|safari|safari-web)-extension:/i.test(berkasSkrip)) return true;
  if (berkasSkrip && asal && /^https?:/i.test(berkasSkrip) && !berkasSkrip.startsWith(asal)) return true;
  return false;
}

/** Rapikan laporan sebelum dikirim / disimpan: potong panjang, buang angka acak yang membuat galat sama terlihat berbeda. */
export function rapikanLaporan(l: LaporanGalat): LaporanGalat {
  const pesan = (l.pesan || '').replace(/\s+/g, ' ').trim().slice(0, BATAS_PESAN);
  //  Id & angka di jalur (/ticketing?open=uuid) membuat satu galat tercatat ratusan kali sebagai baris berbeda.
  const jalur = (l.jalur || '').split('?')[0].replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id').slice(0, BATAS_JALUR);
  const sumber: SumberGalat = l.sumber === 'skrip' || l.sumber === 'janji' ? l.sumber : 'halaman';
  return { pesan, jalur, sumber, digest: l.digest ? String(l.digest).slice(0, 60) : undefined };
}
