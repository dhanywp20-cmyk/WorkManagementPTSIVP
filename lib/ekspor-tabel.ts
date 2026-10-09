/**
 * lib/ekspor-tabel.ts - SATU cara ekspor daftar ke Excel & cetak (A4 / PNG) untuk semua menu:
 * judul, keterangan filter yang sedang aktif, kolom & baris. Bagian murni (susunAoa, lebarKolom,
 * lembarTabel) diuji di uji/ekspor-tabel.ts; Excel memakai SheetJS dari lib/xlsx-loader.ts, cetak
 * memakai lib/lembar-cetak.ts.
 */
import { loadXLSX } from './xlsx-loader';
import { bukaCetak, type Lembar, namaBerkas, unduhLembarPNG } from './lembar-cetak';

type Sel = string | number | null | undefined;
export interface KolomEkspor<T> { judul: string; ambil: (r: T) => Sel; angka?: boolean }
export interface Ekspor<T> {
  judul: string;
  /** Nama menu / subjudul lembar, mis. "Daily Report". */ menu: string;
  kolom: KolomEkspor<T>[];
  baris: T[];
  /** Filter yang sedang aktif - ikut tercetak supaya pembaca tahu isinya sebagian. Nilai kosong dilewati. */
  filter?: [string, Sel][];
  /** Warna kepala lembar cetak. */ warna?: [string, string];
}

const teks = (v: Sel) => (v === null || v === undefined ? '' : typeof v === 'number' ? v : String(v).replace(/\s+/g, ' ').trim());
export const filterAktif = (f: [string, Sel][] = []) => f.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');

/**
 * Larik baris untuk SheetJS: judul, tanggal ekspor, filter aktif, baris kosong, kepala, data.
 * `kepala` = indeks baris kepala (untuk autofilter & bekukan panel).
 */
export function susunAoa<T>(e: Ekspor<T>, tanggal: string): { aoa: (string | number)[][]; kepala: number } {
  const atas: (string | number)[][] = [[e.judul], [`${e.menu} · diekspor ${tanggal} · ${e.baris.length} baris`]];
  const f = filterAktif(e.filter);
  if (f.length) atas.push([`Filter: ${f.map(([k, v]) => `${k} = ${teks(v)}`).join('; ')}`]);
  atas.push([]);
  const kepala = atas.length;
  const isi = e.baris.map(r => e.kolom.map(k => teks(k.ambil(r))));
  return { aoa: [...atas, e.kolom.map(k => k.judul), ...isi], kepala };
}

/** Lebar kolom Excel (karakter) dari isi terpanjang, 8 - 60. */
export function lebarKolom(aoa: (string | number)[][], kepala: number, jumlah: number): number[] {
  return Array.from({ length: jumlah }, (_, i) => {
    let m = 8;
    for (let r = kepala; r < aoa.length; r++) m = Math.max(m, String(aoa[r][i] ?? '').length + 2);
    return Math.min(60, m);
  });
}

const kolomExcel = (n: number) => { let s = ''; for (let x = n; x >= 0; x = Math.floor(x / 26) - 1) s = String.fromCharCode(65 + (x % 26)) + s; return s; };

export function eksporExcel<T>(e: Ekspor<T>): Promise<void> {
  //  SheetJS dimuat dari CDN tanpa deklarasi tipe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Promise((ok, gagal) => loadXLSX((XLSX: any) => {
    try {
      const tanggal = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      const { aoa, kepala } = susunAoa(e, tanggal);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = lebarKolom(aoa, kepala, e.kolom.length).map(wch => ({ wch }));
      if (e.baris.length) ws['!autofilter'] = { ref: `A${kepala + 1}:${kolomExcel(e.kolom.length - 1)}${kepala + 1 + e.baris.length}` };
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, e.kolom.length - 1) } }];
      ws['!freeze'] = { xSplit: 0, ySplit: kepala + 1 };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, e.menu.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Data');
      const hariIni = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `${namaBerkas(e.judul, e.judul.includes(hariIni) ? '' : hariIni)}.xlsx`);
      ok();
    } catch (x) { gagal(x); }
  }, () => gagal(new Error('Library Excel gagal dimuat - periksa koneksi.'))));
}

/** Lembar cetak dari tabel: kolom banyak -> kertas mendatar. */
export function lembarTabel<T>(e: Ekspor<T>): Lembar {
  const f = filterAktif(e.filter);
  return {
    judul: e.judul, subjudul: `${e.menu} · ${e.baris.length} baris`,
    kepala: f.map(([k, v]) => [k, String(teks(v))] as [string, string]),
    seksi: [{ judul: e.judul, jenis: 'tabel', kepala: e.kolom.map(k => k.judul),
      isi: e.baris.map(r => e.kolom.map(k => String(teks(k.ambil(r))))),
      rataKanan: e.kolom.flatMap((k, i) => (k.angka ? [i] : [])) }],
    warna: e.warna, kaki: `Work Management PTS IVP — ${e.menu}`, mendatar: e.kolom.length > 6,
  };
}

export const cetakTabel = <T>(e: Ekspor<T>) => bukaCetak(lembarTabel(e));
export const pngTabel = <T>(e: Ekspor<T>) => unduhLembarPNG(lembarTabel(e), namaBerkas(e.judul));
