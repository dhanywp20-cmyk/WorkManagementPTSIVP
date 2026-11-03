#!/usr/bin/env node
/**
 * scripts/ukur-struktur.mjs - ukur "kesehatan struktur" kode aplikasi (app/, lib/, components/).
 *
 * Tiga gejala yang diukur - lihat docs/audit/struktur-kode.md:
 *   baris      jumlah baris per berkas            (berkas "dewa" - terlalu banyak tanggung jawab)
 *   barisPanjang jumlah baris > BATAS.karakter    (God line - JSX dipadatkan, daftar props/return raksasa)
 *   propsMaks  atribut `nama={` terbanyak di SATU baris (props drilling - komponen menerima puluhan props)
 *
 * Dipakai dua cara:
 *   node scripts/ukur-struktur.mjs            -> tabel pelanggar teratas
 *   node scripts/ukur-struktur.mjs --baseline -> tulis ulang uji/data/struktur-baseline.json
 *                                               (HANYA setelah angkanya membaik - lihat uji/struktur-kode.mjs)
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/** Ambang. Berkas di atas ambang ini tercatat di baseline dan tidak boleh memburuk; berkas baru tidak boleh melewatinya. */
export const BATAS = { baris: 600, karakter: 300, props: 25 };

export function daftarBerkas() {
  //  Bukan pola 'lib/**/*.ts': pathspec git itu melewatkan berkas yang langsung di lib/ (mis. lib/auth.ts).
  return execSync('git ls-files -- app lib components', { encoding: 'utf8' })
    //  existsSync: berkas yang sudah dihapus tapi belum di-commit masih terdaftar di git.
    .split('\n').filter(f => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts') && existsSync(f));
}

/** Ukuran satu berkas dari isinya (murni - dipakai juga oleh uji). */
export function ukurIsi(isi) {
  const baris = isi.split('\n');
  let barisPanjang = 0, propsMaks = 0;
  for (const b of baris) {
    if (b.length > BATAS.karakter) barisPanjang++;
    const props = (b.match(/[A-Za-z_][\w]*=\{/g) ?? []).length;
    if (props > propsMaks) propsMaks = props;
  }
  //  Baris kosong terakhir (newline di ujung berkas) tidak dihitung.
  const n = baris.length - (baris[baris.length - 1] === '' ? 1 : 0);
  return { baris: n, barisPanjang, propsMaks };
}

export function ukurSemua() {
  const hasil = {};
  for (const f of daftarBerkas()) hasil[f] = ukurIsi(readFileSync(f, 'utf8'));
  return hasil;
}

/** Hanya berkas yang melewati salah satu ambang - itulah isi baseline. */
export function pelanggar(hasil) {
  const keluar = {};
  for (const [f, u] of Object.entries(hasil)) {
    if (u.baris > BATAS.baris || u.barisPanjang > 0 || u.propsMaks >= BATAS.props) keluar[f] = u;
  }
  return keluar;
}

const JALUR_BASELINE = 'uji/data/struktur-baseline.json';

if (import.meta.url === `file://${process.argv[1]}`) {
  const semua = ukurSemua();
  const p = pelanggar(semua);
  if (process.argv.includes('--baseline')) {
    const urut = Object.fromEntries(Object.entries(p).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(JALUR_BASELINE, JSON.stringify({ batas: BATAS, berkas: urut }, null, 2) + '\n');
    console.log(`Baseline ditulis: ${Object.keys(urut).length} berkas -> ${JALUR_BASELINE}`);
  } else {
    const total = Object.values(semua).reduce((t, u) => ({ baris: t.baris + u.baris, panjang: t.panjang + u.barisPanjang }), { baris: 0, panjang: 0 });
    console.log(`${Object.keys(semua).length} berkas, ${total.baris} baris, ${total.panjang} baris > ${BATAS.karakter} karakter, ${Object.keys(p).length} berkas melewati ambang\n`);
    const tampil = (judul, kunci, n = 12) => {
      console.log(judul);
      Object.entries(semua).sort((a, b) => b[1][kunci] - a[1][kunci]).slice(0, n)
        .forEach(([f, u]) => console.log(`  ${String(u[kunci]).padStart(5)}  ${f}`));
      console.log('');
    };
    tampil('Baris per berkas:', 'baris');
    tampil(`Baris > ${BATAS.karakter} karakter:`, 'barisPanjang');
    tampil('Props terbanyak di satu baris:', 'propsMaks');
  }
}
