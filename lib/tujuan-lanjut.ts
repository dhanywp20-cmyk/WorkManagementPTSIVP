/**
 * lib/tujuan-lanjut.ts - Halaman yang dituju sebelum diminta login (?lanjut=...).
 *
 * proxy.ts mengalihkan pengunjung tanpa sesi ke /dashboard (layar masuk) sambil membawa alamat
 * aslinya, supaya setelah login orang mendarat di halaman yang tadi dibuka (mis. tautan ticket dari
 * WA), bukan di beranda. Nilainya datang dari URL, jadi HANYA jalur internal yang diterima - kalau
 * tidak, tautan ?lanjut=//situs-lain jadi pintu pengalihan ke luar (open redirect).
 */
export function tujuanLanjutAman(nilai: string | null | undefined): string | null {
  if (!nilai) return null;
  const t = nilai.trim();
  if (!t.startsWith('/') || t.startsWith('//') || t.startsWith('/\\')) return null;
  if (/^\/(api|_next)(\/|$)/.test(t)) return null;
  if (/[\u0000-\u001f]/.test(t)) return null;
  //  Pastikan tetap satu asal setelah diurai peramban.
  try {
    const u = new URL(t, 'https://contoh.invalid');
    if (u.origin !== 'https://contoh.invalid') return null;
    const hasil = u.pathname + u.search + u.hash;
    return hasil === '/dashboard' ? null : hasil;
  } catch { return null; }
}
