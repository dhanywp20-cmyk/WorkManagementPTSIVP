import { calculateStandardScheme } from '@/app/incentive-pts/_components/calc';
import { SKEMA_BAWAAN, type SkemaInsentif } from '@/lib/incentive-scheme';

const POOL = 1_000_000;
const sk: SkemaInsentif = JSON.parse(JSON.stringify(SKEMA_BAWAAN));
sk.porsi = [
  { peran: 'pic', label: 'PIC Proyek', persen: 60, bagiRata: false },
  { peran: 'support', label: 'Tim Support', persen: 17, bagiRata: true },
  { peran: 'supervisor', label: 'Supervisor', persen: 15, bagiRata: true },
  { peran: 'manager', label: 'Manager', persen: 8, bagiRata: false },
];
sk.tanpaSupport = { pic: 55, supervisor: 30, manager: 15 };

const tampil = (judul: string, r: any[]) => {
  console.log('\n' + judul);
  for (const s of r) console.log(`   ${s.role.padEnd(11)} ${(s.user_name || '-').padEnd(18)} ${String(s.percentage).padStart(5)}%  Rp ${s.amount.toLocaleString('id-ID')}`);
  const tot = r.reduce((a, b) => a + b.amount, 0);
  const pct = r.reduce((a, b) => a + b.percentage, 0);
  console.log(`   ${''.padEnd(30)} ${pct.toFixed(1).padStart(5)}%  Rp ${tot.toLocaleString('id-ID')}`);
  return { tot, pct, r };
};

let gagal = 0;
const cek = (s: boolean, l: string) => { console.log(`${s ? 'OK  ' : 'GAGAL'}  ${l}`); if (!s) gagal++; };

// KASUS NYATA: pic_id KOSONG (kolomnya tidak diisi alur normal), PIC & Supervisor
// orang yang sama - Yoga KS. Inilah yang di layar membayar Yoga dua kali.
const A = tampil('BPKP ICT Timur — PIC & Supervisor sama-sama Yoga KS, pic_id kosong',
  calculateStandardScheme(sk, POOL, 'onsite', '', 'Yoga KS', 'u-dhany', 'Dhany Wahyu',
    'u-yoga', 'Yoga KS', [{ user_id: 'ferdinan', user_name: 'Ferdinan Agustinus' }]));

const yoga = A.r.filter(s => s.user_name === 'Yoga KS');
cek(yoga.length === 1, `Yoga KS hanya muncul SEKALI (dapat ${yoga.length} baris)`);
cek(!A.r.some(s => s.role === 'supervisor'), 'Baris Supervisor hilang saat ia jadi PIC');
cek(Math.abs(A.tot - POOL) <= 1, `Total tetap Rp ${POOL.toLocaleString('id-ID')}`);
cek(Math.abs(A.pct - 100) < 0.01, 'Total persen tetap 100%');

// Porsi Supervisor yang hangus mengikuti setting hangusSupervisorKe.
sk.hangusSupervisorKe = 'manager';
const B = tampil('Porsi Supervisor dialihkan ke MANAGER (setting sekarang)',
  calculateStandardScheme(sk, POOL, 'onsite', '', 'Yoga KS', 'u-dhany', 'Dhany Wahyu',
    'u-yoga', 'Yoga KS', [{ user_id: 'ferdinan', user_name: 'Ferdinan Agustinus' }]));
cek(B.r.find(s => s.role === 'manager')?.percentage === 23, 'Manager jadi 23% (8 + 15)');

sk.hangusSupervisorKe = 'pic';
const C = tampil('Porsi Supervisor dialihkan ke PIC (setting alternatif)',
  calculateStandardScheme(sk, POOL, 'onsite', '', 'Yoga KS', 'u-dhany', 'Dhany Wahyu',
    'u-yoga', 'Yoga KS', [{ user_id: 'ferdinan', user_name: 'Ferdinan Agustinus' }]));
cek(C.r.find(s => s.role === 'pic')?.percentage === 75, 'PIC jadi 75% (60 + 15)');
cek(C.r.find(s => s.role === 'manager')?.percentage === 8, 'Manager tetap 8%');
cek(Math.abs(C.tot - POOL) <= 1 && Math.abs(C.pct - 100) < 0.01, 'Tetap 100% / Rp 1.000.000');

// Kendali: PIC dan Supervisor orang BERBEDA - tidak boleh ikut terhapus.
sk.hangusSupervisorKe = 'manager';
const D = tampil('Kendali — PIC Pandu, Supervisor Yoga (orang berbeda)',
  calculateStandardScheme(sk, POOL, 'onsite', '', 'Pandu Kusuma Adji', 'u-dhany', 'Dhany Wahyu',
    'u-yoga', 'Yoga KS', [{ user_id: 'ferdinan', user_name: 'Ferdinan Agustinus' }]));
cek(D.r.find(s => s.role === 'supervisor')?.percentage === 15, 'Supervisor tetap dapat 15%');
cek(D.r.find(s => s.role === 'manager')?.percentage === 8, 'Manager tetap 8%');

console.log(gagal === 0 ? '\nLULUS' : `\n${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
