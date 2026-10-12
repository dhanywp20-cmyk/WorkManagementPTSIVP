import { supabase } from '@/lib/supabase';
import { gabungkanProyek } from '@/lib/kelompok-insentif';
import { ambilPetaNominal, lengkapiNominal } from '@/lib/incentive-nominal-api';
import { tempelkanNominal } from '@/lib/incentive-nominal';
import { createNotification } from '@/lib/notifications';
import {
  SkemaInsentif, PenerimaPeran, hitungPembagian, hitungManagerSebagaiPic, ambilSkema,
  persenInstaller, persenPicBerlaku, petaPorsiBerlaku, bagikanTepat, labelSkema, INCENTIVE_CATEGORIES,
  kategoriInsentif, muatKategoriInsentif, adalahKategoriInsentif,
} from '@/lib/incentive-scheme';
export type { SkemaInsentif };
export { ambilSkema, persenInstaller, persenPicBerlaku, petaPorsiBerlaku, bagikanTepat, labelSkema };
// Dipindah ke lib/incentive-scheme.ts - lihat catatan di sana. Di-ekspor
// ulang supaya pemanggil lama tidak perlu diubah.
export { INCENTIVE_CATEGORIES, kategoriInsentif, muatKategoriInsentif, adalahKategoriInsentif };
/*
  Penggabungan jadwal jadi satu proyek insentif pindah ke lib/kelompok-insentif.ts.

  Sebabnya bukan kerapian: aturannya kini dipakai DUA layar - daftar insentif di
  sini dan pertanyaan "kelanjutan atau terpisah?" saat jadwal dibuat. Dua salinan
  aturan uang yang bisa menyimpang diam-diam adalah cara paling mudah membuat
  layar dan basis data tidak sepakat.
*/
export { gabungkanProyek, deteksiKandidatGabung, idUntukDigabung } from '@/lib/kelompok-insentif';
export type { KandidatGabung } from '@/lib/kelompok-insentif';
export * from './calc-tipe';
export * from './calc-pembagian';
export * from './calc-data';
export * from './calc-support';
export * from './calc-batch';
export * from './calc-pembatalan';
export * from './calc-format';
