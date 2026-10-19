/**
 * lib/av-hasil.ts - hasil Kalkulator AV yang disimpan ke proyek (tabel tools_av_hasil, migrasi 055).
 * Murni (tanpa basis data): dipakai /api/tools-team/hasil-av dan diuji di uji/av-hasil.ts.
 *
 * `lembar` dari peramban dibersihkan di sini sebelum disimpan, karena lembar yang tersimpan nanti
 * dicetak ulang oleh orang lain (htmlLembar menulis ke jendela baru). Hanya seksi 'info' & 'tabel'
 * yang diterima - seksi 'html' (HTML mentah) dibuang - dan semua teks dibatasi panjangnya.
 */
import type { Lembar, Seksi } from './lembar-cetak';

export const BATAS_HASIL = { judul: 120, catatan: 500, ringkasan: 4000, teks: 300, seksi: 12, baris: 200, kolom: 12 } as const;

export interface IsianHasilAV { proyek_id: string; judul: string; catatan: string; ringkasan: string; lembar: Lembar }

const teks = (v: unknown, maks: number = BATAS_HASIL.teks) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, maks);
const daftar = (v: unknown, maks: number): unknown[] => (Array.isArray(v) ? v.slice(0, maks) : []);
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function info(v: unknown) {
  return daftar(v, BATAS_HASIL.baris).map(x => {
    const i = (x ?? {}) as Record<string, unknown>;
    return { label: teks(i.label), nilai: teks(i.nilai), ...(i.sorot === true ? { sorot: true } : {}) };
  });
}

function seksi(v: unknown): Seksi | null {
  const s = (v ?? {}) as Record<string, unknown>;
  const judul = teks(s.judul, BATAS_HASIL.judul);
  if (s.jenis === 'info') {
    const kanan = info(s.kanan);
    return { judul, jenis: 'info', kiri: info(s.kiri), ...(kanan.length ? { kanan } : {}) };
  }
  if (s.jenis === 'tabel') {
    const kepala = daftar(s.kepala, BATAS_HASIL.kolom).map(x => teks(x));
    const isi = daftar(s.isi, BATAS_HASIL.baris).map(b => daftar(b, BATAS_HASIL.kolom).map(x => teks(x)));
    const rataKanan = daftar(s.rataKanan, BATAS_HASIL.kolom).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < BATAS_HASIL.kolom);
    return { judul, jenis: 'tabel', kepala, isi, ...(rataKanan.length ? { rataKanan } : {}) };
  }
  return null;   // 'html' & jenis lain dibuang
}

/** Lembar bersih: hanya judul, subjudul, kepala, seksi info/tabel, catatan, mendatar. */
export function bersihkanLembar(v: unknown): Lembar | null {
  if (!v || typeof v !== 'object') return null;
  const l = v as Record<string, unknown>;
  const judul = teks(l.judul, BATAS_HASIL.judul);
  if (!judul) return null;
  const isiSeksi = daftar(l.seksi, BATAS_HASIL.seksi).map(seksi).filter((x): x is Seksi => x !== null);
  if (!isiSeksi.length) return null;
  const kepala = daftar(l.kepala, 8).map(x => {
    const p = Array.isArray(x) ? x : [];
    return [teks(p[0]), teks(p[1])] as [string, string];
  });
  const catatan = teks(l.catatan, BATAS_HASIL.catatan * 2);
  return {
    judul, subjudul: teks(l.subjudul, BATAS_HASIL.judul), kepala, seksi: isiSeksi,
    ...(catatan ? { catatan } : {}), ...(l.mendatar === true ? { mendatar: true } : {}),
  };
}

/** Isian POST yang sah, atau pesan galat. */
export function periksaHasilAV(b: Record<string, unknown>): IsianHasilAV | { galat: string } {
  const proyek_id = String(b.proyek_id ?? '');
  if (!POLA_UUID.test(proyek_id)) return { galat: 'Pilih proyeknya dulu.' };
  const lembar = bersihkanLembar(b.lembar);
  if (!lembar) return { galat: 'Hasil kalkulator tidak terbaca.' };
  const judul = teks(b.judul, BATAS_HASIL.judul) || lembar.judul;
  return { proyek_id, judul, catatan: teks(b.catatan, BATAS_HASIL.catatan), ringkasan: teks(b.ringkasan, BATAS_HASIL.ringkasan), lembar };
}
