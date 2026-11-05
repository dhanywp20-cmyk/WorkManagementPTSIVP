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
    for (const m of s.matchAll(new RegExp(`\\.from\\(['"]${t}['"]\\)[^;]{0,400}`, 'g'))) {
      const select = /\.select\((['"`])([\s\S]*?)\1/.exec(m[0])?.[2] ?? '';
      if (/(^|[\s,(])users\(/.test(select)) salah.push(`${f} (${t})`);
    }
  }
}
cek('tidak ada embed users(...) tanpa penunjuk relasi pada tabel berelasi ganda', salah.length === 0, salah.join(', '));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
