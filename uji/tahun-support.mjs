// Replika aturan penyaringan di fetchSupportFromTickets - menguji TAHUN mana
// yang mendapat porsi Support, memakai jendela dari jendelaSupportTahap().
const tglSaja = v => (v ?? '').slice(0, 10);
const didalam = (t, r) => {
  if (!t) return false;
  if (r?.dari && !(t > r.dari)) return false;
  if (r?.sampai && !(t <= r.sampai)) return false;
  return true;
};
// Salinan jendelaSupportTahap(): tahun 1 tanpa batas bawah (termasuk pra-BAST).
function jendela(bast, tahunKe) {
  const t = n => { const d = new Date(bast + 'T00:00:00'); d.setFullYear(d.getFullYear() + n); return d.toISOString().slice(0,10); };
  return { dari: tahunKe === 1 ? null : t(tahunKe - 1), sampai: t(tahunKe) };
}

const BAST = '2026-02-09';                      // BPKP ICT Timur
console.log('BAST', BAST);
[1,2,3].forEach(th => { const j = jendela(BAST, th); console.log(`  Tahun ${th}: ${j.dari ?? '(tanpa batas bawah)'} -> ${j.sampai}`); });

const kasus = [
  { nama: 'Ticket Ferdinan solved 27 Agu 2026 (kasus nyata)', tgl: '2026-08-27', tahun: 1 },
  { nama: 'Solved sebelum BAST (01 Jan 2026)',                tgl: '2026-01-01', tahun: 1 },
  { nama: 'Solved tepat di ulang tahun BAST ke-1',            tgl: '2027-02-09', tahun: 1 },
  { nama: 'Solved sehari setelahnya',                          tgl: '2027-02-10', tahun: 2 },
  { nama: 'Solved tahun ke-3',                                 tgl: '2029-01-15', tahun: 3 },
  { nama: 'Solved lewat 3 tahun (tidak dibayar)',              tgl: '2029-06-01', tahun: 0 },
];

let gagal = 0;
for (const k of kasus) {
  const kena = [1,2,3].filter(th => didalam(k.tgl, jendela(BAST, th)));
  const ok = k.tahun === 0 ? kena.length === 0 : (kena.length === 1 && kena[0] === k.tahun);
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'}  ${k.nama.padEnd(46)} -> ${kena.length ? 'Tahun ' + kena.join(',') : 'tidak dibayar'}`);
}

// Tiap tanggal hanya boleh masuk SATU tahun - kalau tumpang tindih, satu orang
// dibayar dua kali untuk pekerjaan yang sama.
let tumpang = 0;
const d = new Date(BAST + 'T00:00:00');
for (let i = -400; i < 1200; i++) {
  const t = new Date(d); t.setDate(t.getDate() + i);
  const s = t.toISOString().slice(0,10);
  if ([1,2,3].filter(th => didalam(s, jendela(BAST, th))).length > 1) tumpang++;
}
console.log(`${tumpang === 0 ? 'OK  ' : 'GAGAL'}  1.600 tanggal berturut-turut: ${tumpang} tumpang tindih antar tahun`);
if (tumpang) gagal++;

console.log(gagal === 0 ? '\nLULUS' : `\n${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
