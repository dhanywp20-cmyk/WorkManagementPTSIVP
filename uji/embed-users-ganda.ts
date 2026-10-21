/**
 * uji/embed-users-ganda.ts - embed `users(...)` pada tabel yang punya LEBIH DARI SATU relasi ke users.
 *
 * PostgREST menolak embed seperti itu ("more than one relationship was found") - data jadi null dan
 * halaman tampil kosong tanpa pesan apa pun. Persis yang terjadi di Learning Center -> Analytics:
 * lc_quiz_attempts punya user_id DAN graded_by (penilai essay), embed users(...) gagal, seluruh
 * Top Performers & Statistik Per Sesi kosong walau ada puluhan peserta.
 *
 * Aturannya: di tabel-tabel ini embed wajib menyebut relasinya (users!kolom) atau data pengguna diambil
 * terpisah lalu digabung di JS.
 *
 * Jalankan: npm test -- embed-users-ganda
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean, ket = '') => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}${ket ? ' - ' + ket : ''}`); } };
function semua(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? (n === 'node_modules' ? [] : semua(p)) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

//  Tabel dengan >= 2 FK ke users (sql/full-schema/02_constraints.sql).
const skema = readFileSync('sql/full-schema/02_constraints.sql', 'utf8');
const hitung: Record<string, number> = {};
for (const m of skema.matchAll(/ALTER TABLE public\.(\w+) ADD CONSTRAINT \w+ FOREIGN KEY \(\w+\) REFERENCES users\(id\)/g)) hitung[m[1]] = (hitung[m[1]] ?? 0) + 1;
const ganda = Object.keys(hitung).filter(t => hitung[t] > 1);
cek('lc_quiz_attempts terdeteksi punya dua relasi ke users', ganda.includes('lc_quiz_attempts'), ganda.join(', '));

const berkas = [...semua('app'), ...semua('lib')];
const salah: string[] = [];
for (const f of berkas) {
  const s = readFileSync(f, 'utf8');
  for (const t of ganda) {
    //  Potongan kueri: dari .from('tabel') sampai titik koma / 400 karakter berikutnya.
    for (const m of s.matchAll(new RegExp(`\\.from\\(['"]${t}['"]\\)[^;]{0,400}`, 'g'))) {
      const select = /\.select\((['"`])([\s\S]*?)\1/.exec(m[0])?.[2] ?? '';
      if (/(^|[\s,(])users\(/.test(select)) salah.push(`${f} (${t})`);
    }
  }
}
cek('tidak ada embed users(...) tanpa penunjuk relasi pada tabel berelasi ganda', salah.length === 0, salah.join(', '));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
