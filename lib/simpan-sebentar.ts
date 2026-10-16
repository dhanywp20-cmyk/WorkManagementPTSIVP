/**
 * lib/simpan-sebentar.ts - simpanan singkat di memori server untuk data yang SAMA bagi banyak
 * pemanggil (mis. status Kuis Live yang dibaca 100 HP tiap 2,5 detik).
 *
 * Yang disimpan adalah Promise-nya, jadi permintaan yang datang bersamaan saat data sedang diambil
 * ikut menunggu pengambilan yang sama - satu query ke basis data, bukan seratus. Fungsi Vercel
 * (fluid compute) melayani banyak permintaan dalam satu instance, jadi simpanan ini benar-benar
 * terpakai; instance lain punya simpanannya sendiri (paling lama `ttlMs` berbeda).
 *
 * Hanya untuk data yang boleh basi sebentar. Data milik satu orang (jawaban sendiri, token)
 * dan semua penulisan JANGAN lewat sini.
 */

interface Isi { sampai: number; nilai: Promise<unknown> }

const simpanan = new Map<string, Isi>();
const BATAS_ISI = 1000;

export function simpanSebentar<T>(kunci: string, ttlMs: number, ambil: () => Promise<T>, sekarang = Date.now()): Promise<T> {
  const ada = simpanan.get(kunci);
  if (ada && ada.sampai > sekarang) return ada.nilai as Promise<T>;
  const nilai = ambil();
  simpanan.set(kunci, { sampai: sekarang + ttlMs, nilai });
  //  Gagal tidak boleh ikut disimpan: permintaan berikutnya mencoba lagi.
  nilai.catch(() => { if (simpanan.get(kunci)?.nilai === nilai) simpanan.delete(kunci); });
  if (simpanan.size > BATAS_ISI) {
    for (const [k, v] of simpanan) if (v.sampai <= sekarang) simpanan.delete(k);
    if (simpanan.size > BATAS_ISI) simpanan.clear();
  }
  return nilai;
}

/** Untuk uji. */
export const kosongkanSimpanan = () => simpanan.clear();
