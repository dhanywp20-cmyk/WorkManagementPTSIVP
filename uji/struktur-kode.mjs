import { readFileSync } from 'node:fs';
import { BATAS, ukurSemua, ukurIsi, komentarPenjelasan, daftarBerkas } from '../scripts/ukur-struktur.mjs';

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

console.log('\n3. Tanpa komentar penjelasan (direktif eslint / @ts- tetap boleh)');
cek('pendeteksi menangkap komentar baris, blok & JSX', komentarPenjelasan('const a = 1; // x\n/* y */\nconst b = <i>{/* z */}</i>;', 'a.tsx').length === 3);
cek('pendeteksi membiarkan direktif & teks', komentarPenjelasan('// eslint-disable-next-line\nconst u = "http://a"; const j = <p>a // b</p>;', 'a.tsx').length === 0);
let berkomentar = 0;
for (const f of daftarBerkas()) {
  const k = komentarPenjelasan(readFileSync(f, 'utf8'), f);
  if (k.length) { berkomentar++; cek(`${f}: ${k.length} komentar penjelasan, mis. ${JSON.stringify(k[0].slice(0, 60))}`, false); }
}
if (!berkomentar) console.log('  ok   0 komentar penjelasan');

console.log(`\n${gagal ? 'GAGAL' : 'LULUS'}: ${gagal ? `${gagal} pelanggaran` : 'struktur tidak memburuk'}`);
if (gagal) process.exit(1);
