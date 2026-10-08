import { ALUR_STATUS_PTS, statusTerkunci, type StatusAlurPTS } from '@/app/ticketing/_components/alur-status';

// Aturan tombol status di panel "Update Status" Ticketing (Team PTS).

let gagal = 0;
const cek = (s: boolean, l: string) => { console.log(`${s ? 'OK  ' : 'GAGAL'}  ${l}`); if (!s) gagal++; };

/** Daftar status yang BOLEH dipilih, untuk dibandingkan utuh. */
const boleh = (sekarang: string, riwayat: string[] = []) =>
  ALUR_STATUS_PTS.filter(s => !statusTerkunci(s as StatusAlurPTS, sekarang, riwayat)).join(',');

// ── Permintaan baru: Pending Action langsung dari Call / Onsite ───────────
cek(boleh('Call') === 'Call,Onsite,In Progress,Pending Action',
  `Call -> boleh Pending Action tanpa In Progress dulu (${boleh('Call')})`);
cek(boleh('Onsite') === 'Onsite,In Progress,Pending Action,Solved',
  `Onsite -> boleh Pending Action (${boleh('Onsite')})`);

// ── Perilaku lama tetap ────────────────────────────────────────────────────
cek(boleh('Pending') === 'Pending,Call,Onsite,In Progress',
  `Pending: Pending Action & Solved masih dikunci (${boleh('Pending')})`);
cek(boleh('In Progress') === 'In Progress,Pending Action,Solved',
  `In Progress: tidak bisa mundur ke Call/Onsite (${boleh('In Progress')})`);
cek(boleh('Waiting Approval') === 'Pending,Call,Onsite,In Progress',
  `Status di luar alur: Pending Action & Solved dikunci (${boleh('Waiting Approval')})`);

// ── Keluar dari Pending Action: lanjut dari titik terakhir sebelum tertahan ─
cek(boleh('Pending Action', ['Pending', 'Call', 'Pending Action']) === 'Call,Onsite,In Progress,Pending Action',
  'Tertahan dari Call: boleh lanjut Call/Onsite/In Progress, Solved belum');
cek(boleh('Pending Action', ['Pending', 'Call', 'Onsite', 'Pending Action']) === 'Onsite,In Progress,Pending Action,Solved',
  'Tertahan dari Onsite: boleh Onsite/In Progress/Solved, tidak mundur ke Call');
cek(boleh('Pending Action', ['Pending', 'Call', 'Onsite', 'In Progress', 'Pending Action']) === 'In Progress,Pending Action,Solved',
  'Tertahan dari In Progress: sama seperti aturan lama (balik In Progress / Solved)');
cek(boleh('Pending Action', []) === 'Call,Onsite,In Progress,Pending Action',
  'Riwayat kosong: dianggap dari Call, tidak terkunci total');

if (gagal) { console.error(`\n${gagal} cek gagal`); process.exit(1); }
console.log('\nSemua cek lolos');
