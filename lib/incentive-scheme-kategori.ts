/** incentive-scheme-kategori.ts - dipecah dari incentive-scheme.ts (scripts/pecah-modul.mjs); incentive-scheme.ts tetap mengekspor ulang semuanya. */
import { ambilSkema } from './incentive-scheme-simpan';
import { INCENTIVE_CATEGORIES } from './incentive-scheme-kategori-bawaan';

export { INCENTIVE_CATEGORIES };

/**
 * Kategori Request Schedule yang menghasilkan proyek insentif.
 *
 * Tinggal di sini, bukan di modul Incentive, karena Request Schedule juga
 * membutuhkannya - untuk tombol "Sync ke Incentive". Menaruhnya di modul
 * Incentive akan memaksa halaman jadwal menarik seluruh mesin hitung insentif
 * hanya demi sebuah daftar tiga kata. Konstantanya sendiri ada di incentive-scheme-kategori-bawaan
 * (modul tanpa impor) supaya urutan muat modul tidak bisa merusaknya.
 */

/*
  KATEGORI ITU KEBIJAKAN, BUKAN KODE.

  Daftar di atas kini hanya BAWAAN - yang berlaku disimpan di skema
  (`kategoriProyek`) dan disunting dari layar Skema Pembagian. Perusahaan lain
  menamai layanannya sendiri ("Instalasi", "Commissioning", ...), dan sebelum
  ini menambah satu nama berarti mengubah berkas ini lalu deploy ulang.

  Bacaannya lewat cache modul supaya pemakaian yang sudah ada tetap
  SINKRON - dipanggil di tengah render dan di dalam fungsi biasa, di mana
  `await` tidak tersedia. Cache diisi setiap kali skema dibaca (rapikan()
  di bawah), dan halaman yang bergantung padanya memanggil
  muatKategoriInsentif() sekali saat dibuka.
*/
let kategoriBerlaku: string[] = [...INCENTIVE_CATEGORIES];
/** Dipanggil saat skema dibaca (incentive-scheme-simpan.ts rapikan). */
export function aturKategoriBerlaku(kategori: string[]) { kategoriBerlaku = kategori; }

/** Kategori Request Schedule yang berlaku sebagai proyek insentif. */
export function kategoriInsentif(): string[] {
  return kategoriBerlaku;
}

/** Apakah satu kategori termasuk proyek insentif menurut skema yang berlaku. */
export function adalahKategoriInsentif(kategori: string | null | undefined): boolean {
  return !!kategori && kategoriBerlaku.includes(kategori);
}

/**
 * Muat kategori dari skema. Dipanggil sekali saat halaman dibuka; nilainya
 * tersimpan di cache modul sehingga adalahKategoriInsentif() tetap sinkron.
 */
export async function muatKategoriInsentif(): Promise<string[]> {
  const sk = await ambilSkema();   // rapikan() di dalamnya yang mengisi cache
  return sk.kategoriProyek;
}
