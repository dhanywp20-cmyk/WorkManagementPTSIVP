/**
 * uji/pecah-berkas-aman.ts - penjaga hasil pemecahan berkas besar (Okt 2026) dan satu perbaikan simpan.
 *
 * 1. Tidak ada hook (use*.ts) yang memuat return milik komponen - ekstraksi sempat memindahkan
 *    `if (!appReady) return <LoadingScreen/>` ke dalam hook (ditangkap tsc, lalu alatnya diperbaiki).
 * 2. Impor dinamis relatif di hook/komponen pecahan menunjuk berkas yang benar-benar ada.
 * 3. Daily Report: isian tim (admin) disimpan lebih dulu dan hasilnya DIPERIKSA - dulu diabaikan,
 *    jadi kegagalannya tampil sebagai "berhasil" dan isiannya hilang diam-diam.
 *
 * Jalankan: npm test -- pecah-berkas-aman
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { spawnSync } from 'child_process';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, detail = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${detail ? `\n         ${detail}` : ''}`); }
}
function berkas(dir: string, pola: RegExp, hasil: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) berkas(p, pola, hasil); else if (pola.test(n)) hasil.push(p);
  }
  return hasil;
}

console.log('\n1. Hook tanpa return milik komponen');
const hook = [...berkas('app', /^use[A-Z]\w*\.ts$/), ...berkas('lib', /^use[A-Z]\w*\.ts$/)];
const r = spawnSync(process.execPath, ['scripts/cek-hook-return.mjs', ...hook], { encoding: 'utf8' });
cek(`${hook.length} hook diperiksa, semuanya bersih`, r.status === 0, (r.stdout || '') + (r.stderr || ''));

console.log('\n2. Impor dinamis relatif menunjuk berkas yang ada');
const salah: string[] = [];
for (const f of berkas('app', /\.(ts|tsx)$/)) {
  for (const m of readFileSync(f, 'utf8').matchAll(/import\((['"])(\.{1,2}\/[^'"]+)\1\)/g)) {
    const dasar = resolve(dirname(f), m[2]);
    if (!['', '.ts', '.tsx', '/index.ts', '/index.tsx'].some(ext => existsSync(dasar + ext))) salah.push(`${f} -> ${m[2]}`);
  }
}
cek('semua import("./...") dapat ditemukan', salah.length === 0, salah.join('\n         '));

console.log('\n3. Daily Report: isian tim tidak hilang diam-diam');
const form = readFileSync('app/(portal)/daily-report/_components/useFormLaporan.ts', 'utf8');
const iTim = form.indexOf('await saveTeamEntries(');
const iCek = form.indexOf('if (!hasilTim.ok)');
const iReport = form.indexOf('await saveReport(');
cek('hasil saveTeamEntries diperiksa', iTim > 0 && iCek > iTim);
cek('isian tim disimpan SEBELUM report (gagal = form tetap terbuka)', iCek > 0 && iReport > iCek);
cek('tidak ada lagi pemanggilan saveTeamEntries yang hasilnya dibuang', !/^\s*if \([^)]*\) await saveTeamEntries\(/m.test(form));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
