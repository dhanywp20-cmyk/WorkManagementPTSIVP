/**
 * lib/cache-singkat.ts - Ingatan singkat (per tab browser) untuk data rujukan yang jarang berubah.
 *
 * Panel notifikasi memuat ulang SEMUA datanya tiap 2 menit & tiap ada perubahan realtime, dan tiap
 * widget dashboard mengambil daftar pengguna sendiri-sendiri - padahal daftar akun, anggota tim, dan
 * pemetaan divisi hampir tidak pernah berubah dalam hitungan menit. Data seperti itu diambil lewat
 * `ingat()`: permintaan yang sama dalam jangka umurnya memakai hasil yang sudah ada (termasuk yang
 * masih dalam perjalanan), jadi Supabase cukup ditanya sekali.
 *
 * Hasil yang GAGAL tidak diingat - permintaan berikutnya mencoba lagi.
 */

interface Isi { waktu: number; janji: Promise<unknown> }

const simpanan = new Map<string, Isi>();

/** Umur bawaan data rujukan (akun, anggota tim, pemetaan): 5 menit. */
export const UMUR_RUJUKAN = 5 * 60_000;

/** Ambil lewat `ambil()`, atau pakai hasil `kunci` yang sama bila umurnya belum lewat. */
export function ingat<F extends () => PromiseLike<unknown>>(kunci: string, ambil: F, umurMs = UMUR_RUJUKAN): Promise<Awaited<ReturnType<F>>> {
  type T = Awaited<ReturnType<F>>;
  const ada = simpanan.get(kunci);
  if (ada && Date.now() - ada.waktu < umurMs) return ada.janji as Promise<T>;
  const janji = Promise.resolve(ambil() as PromiseLike<T>).then(hasil => {
    //  Hasil query Supabase membawa `error` alih-alih melempar - jangan diingat.
    if ((hasil as { error?: unknown } | null)?.error) simpanan.delete(kunci);
    return hasil;
  }, galat => { simpanan.delete(kunci); throw galat; });
  simpanan.set(kunci, { waktu: Date.now(), janji });
  return janji;
}

/** Lupakan semua kunci yang diawali `awalan` (semua bila kosong) - panggil setelah data itu diubah. */
export function lupakan(awalan = ''): void {
  for (const k of Array.from(simpanan.keys())) if (k.startsWith(awalan)) simpanan.delete(k);
}
