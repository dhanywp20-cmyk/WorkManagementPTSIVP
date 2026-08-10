/**
 * components/shared/Username.tsx — menampilkan username apa adanya.
 *
 * Di platform ini kolom `username` menampung dua bentuk yang berbeda: pegawai
 * internal memakai nama pendek (`amed`, `abrhml01`), sedangkan sebagian besar
 * akun Sales/Guest memakai alamat email penuh (`rafi@indovisual.co.id`).
 *
 * Layar-layar yang menampilkannya menulis `@{user.username}` — kebiasaan gaya
 * media sosial. Untuk nama pendek itu memang membantu membedakan username dari
 * nama orang. Tapi pada akun yang isinya email, hasilnya jadi
 * `@rafi@indovisual.co.id`: satu alamat dengan dua tanda @, yang bukan hanya
 * jelek tapi juga tidak bisa disalin-tempel sebagai email yang sah.
 *
 * Aturannya karena itu jadi sederhana: awalan @ hanya dipasang bila nilainya
 * BELUM mengandung @.
 */

/** Bentuk tampil sebuah username. Dipakai bila hasilnya perlu berupa string. */
export function formatUsername(username: string | null | undefined): string {
  const u = (username ?? '').trim();
  if (!u) return '';
  return u.includes('@') ? u : '@' + u;
}

/**
 * Versi komponen. Dipakai di JSX supaya pemanggilnya cukup menulis
 * <Username value={user.username} /> tanpa mengulang aturan di atas.
 */
export function Username({ value }: { value: string | null | undefined }) {
  return <>{formatUsername(value)}</>;
}
