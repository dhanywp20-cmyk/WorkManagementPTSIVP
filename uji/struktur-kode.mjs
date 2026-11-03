/**
 * uji/struktur-kode.mjs - penjaga struktur kode ("ratchet"): boleh membaik, TIDAK boleh memburuk.
 *
 *  - Berkas di uji/data/struktur-baseline.json (pelanggar lama) tidak boleh menambah baris di atas ambang,
 *    menambah God line (> 300 karakter), atau menambah props di satu baris.
 *  - Berkas BARU / yang belum tercatat tidak boleh melewati ambang sama sekali.
 *  - Bila sebuah berkas membaik, uji tetap lulus dan mengingatkan untuk menurunkan baseline
 *    (node scripts/ukur-struktur.mjs --baseline) supaya perbaikannya terkunci.
 *
 * Latar & aturan: docs/audit/struktur-kode.md.  Jalankan: node uji/struktur-kode.mjs
 */
import { readFileSync } from 'node:fs';
import { BATAS, ukurSemua, ukurIsi } from '../scripts/ukur-struktur.mjs';

let lulus = 0, gagal = 0;
const cek = (nama, syarat) => {
  if (syarat) { lulus++; } else { gagal++; console.log(`  GAGAL ${nama}`); }
};

console.log('\n1. Pengukur');
{
  const u = ukurIsi(['a', 'x'.repeat(BATAS.karakter + 1), '<A a={1} b={2} c={3} />', ''].join('\n'));
  cek('menghitung baris tanpa newline akhir', u.baris === 3);
  cek('menghitung God line', u.barisPanjang === 1);
  cek('menghitung props di satu baris', u.propsMaks === 3);
  console.log(`  ok   ${lulus} cek pengukur`);
}

console.log('\n2. Tidak ada yang memburuk');
const { berkas: baseline } = JSON.parse(readFileSync('uji/data/struktur-baseline.json', 'utf8'));
const sekarang = ukurSemua();
const membaik = [];
let dicek = 0;
for (const [f, u] of Object.entries(sekarang)) {
  dicek++;
  const b = baseline[f];
  const batasBaris = b ? Math.max(b.baris, BATAS.baris) : BATAS.baris;
  const batasPanjang = b ? b.barisPanjang : 0;
  const batasProps = b ? Math.max(b.propsMaks, BATAS.props - 1) : BATAS.props - 1;
  const label = b ? 'tercatat' : 'baru';
  cek(`${f} (${label}): ${u.baris} baris > batas ${batasBaris} - pecah per tanggung jawab`, u.baris <= batasBaris);
  cek(`${f} (${label}): ${u.barisPanjang} baris > ${BATAS.karakter} karakter > batas ${batasPanjang} - pecah barisnya`, u.barisPanjang <= batasPanjang);
  cek(`${f} (${label}): ${u.propsMaks} props di satu baris > batas ${batasProps} - kelompokkan / pakai konteks modul`, u.propsMaks <= batasProps);
  if (b && (u.baris < b.baris || u.barisPanjang < b.barisPanjang || u.propsMaks < b.propsMaks)) membaik.push(f);
}
console.log(`  ${dicek} berkas diperiksa, ${Object.keys(baseline).length} pelanggar lama tercatat`);
if (membaik.length) {
  console.log(`  info ${membaik.length} berkas membaik - kunci dengan: node scripts/ukur-struktur.mjs --baseline`);
}

console.log(`\n${gagal ? 'GAGAL' : 'LULUS'}: ${gagal ? `${gagal} pelanggaran` : 'struktur tidak memburuk'}`);
if (gagal) process.exit(1);
