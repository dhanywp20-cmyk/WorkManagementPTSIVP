/**
 * uji/tahun-support.ts - tanggal selesainya Troubleshooting jatuh di tahun pencairan yang mana.
 *
 * Memakai jendelaSupportTahap() ASLI dari calc.ts. Versi lama (.mjs) menyalin rumusnya dan
 * menambahkan 'T00:00:00' - di komputer WIB salinan itu mundur sehari dan tesnya gagal,
 * padahal kode aslinya benar; karena runner hanya menjalankan *.ts, kegagalan itu tidak
 * pernah terlihat di CI. Sekarang diuji di DUA zona waktu: hasilnya wajib sama.
 *
 * Jalankan: npm test -- tahun-support
 */
import { jendelaSupportTahap } from '@/app/(portal)/incentive-pts/_components/calc';

// Replika aturan penyaringan di fetchSupportFromTickets: (dari, sampai].
const didalam = (t: string, r: { dari: string | null; sampai: string | null }) => {
  if (!t) return false;
  if (r.dari && !(t > r.dari)) return false;
  if (r.sampai && !(t <= r.sampai)) return false;
  return true;
};

const BAST = '2026-02-09'; // BPKP ICT Timur
const kasus = [
  { nama: 'Ticket Ferdinan solved 27 Agu 2026 (kasus nyata)', tgl: '2026-08-27', tahun: 1 },
  { nama: 'Solved sebelum BAST (01 Jan 2026)',                tgl: '2026-01-01', tahun: 1 },
  { nama: 'Solved tepat di ulang tahun BAST ke-1',            tgl: '2027-02-09', tahun: 1 },
  { nama: 'Solved sehari setelahnya',                          tgl: '2027-02-10', tahun: 2 },
  { nama: 'Solved tahun ke-3',                                 tgl: '2029-01-15', tahun: 3 },
  { nama: 'Solved lewat 3 tahun (tidak dibayar)',              tgl: '2029-06-01', tahun: 0 },
];

let gagal = 0;
for (const tz of ['Asia/Jakarta', 'UTC']) {
  process.env.TZ = tz;
  console.log(`\nZona ${tz} - BAST ${BAST}`);
  [1, 2, 3].forEach(th => {
    const j = jendelaSupportTahap(BAST, th);
    console.log(`  Tahun ${th}: ${j.dari ?? '(tanpa batas bawah)'} -> ${j.sampai}`);
  });
  for (const k of kasus) {
    const kena = [1, 2, 3].filter(th => didalam(k.tgl, jendelaSupportTahap(BAST, th)));
    const ok = k.tahun === 0 ? kena.length === 0 : (kena.length === 1 && kena[0] === k.tahun);
    if (!ok) gagal++;
    console.log(`${ok ? 'OK  ' : 'GAGAL'}  ${k.nama.padEnd(46)} -> ${kena.length ? 'Tahun ' + kena.join(',') : 'tidak dibayar'}`);
  }
  // Tiap tanggal hanya boleh masuk SATU tahun - kalau tumpang tindih, satu orang
  // dibayar dua kali untuk pekerjaan yang sama.
  let tumpang = 0;
  const awal = Date.UTC(2026, 1, 9);
  for (let i = -400; i < 1200; i++) {
    const s = new Date(awal + i * 86400000).toISOString().slice(0, 10);
    if ([1, 2, 3].filter(th => didalam(s, jendelaSupportTahap(BAST, th))).length > 1) tumpang++;
  }
  console.log(`${tumpang === 0 ? 'OK  ' : 'GAGAL'}  1.600 tanggal berturut-turut: ${tumpang} tumpang tindih antar tahun`);
  if (tumpang) gagal++;
}

console.log(gagal === 0 ? '\nLULUS' : `\n${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
