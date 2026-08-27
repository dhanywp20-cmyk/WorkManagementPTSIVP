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


// ── PIC menangani sendiri Troubleshooting-nya ──────────────────────────────
// Yoga PIC, dan Yoga juga yang menangani ticket. Ia TIDAK boleh menerima
// porsi Support di atas porsi PIC-nya.
sk.hangusSupervisorKe = 'manager';
const E = tampil('PIC Pandu, dan yang menangani Troubleshooting Pandu sendiri',
  calculateStandardScheme(sk, POOL, 'onsite', '', 'Pandu Kusuma Adji', 'u-dhany', 'Dhany Wahyu',
    'u-yoga', 'Yoga KS', [{ user_id: 'pandu', user_name: 'Pandu Kusuma Adji' }]));
cek(!E.r.some(s => s.role === 'support'), 'Tidak ada baris Support — PIC tidak dobel');
cek(E.r.filter(s => s.user_name === 'Pandu Kusuma Adji').length === 1, 'Pandu muncul sekali saja');
cek(E.r.find(s => s.role === 'pic')?.percentage === 55, 'Beralih ke skema tanpa support: PIC 55%');
cek(Math.abs(E.tot - POOL) <= 1 && Math.abs(E.pct - 100) < 0.01, 'Tetap 100% / Rp 1.000.000');

const F = tampil('PIC Pandu; yang menangani Pandu SENDIRI + Ferdinan (orang lain)',
  calculateStandardScheme(sk, POOL, 'onsite', '', 'Pandu Kusuma Adji', 'u-dhany', 'Dhany Wahyu',
    'u-yoga', 'Yoga KS', [
      { user_id: 'pandu', user_name: 'Pandu Kusuma Adji' },
      { user_id: 'ferdinan', user_name: 'Ferdinan Agustinus' },
    ]));
const sup = F.r.filter(s => s.role === 'support');
cek(sup.length === 1 && sup[0].user_name === 'Ferdinan Agustinus',
    'Hanya Ferdinan yang dapat porsi Support — Pandu disaring');
cek(sup[0]?.percentage === 17, 'Ferdinan dapat 17% PENUH, bukan dibagi dua dengan PIC');
cek(F.r.find(s => s.role === 'pic')?.percentage === 60, 'PIC tetap 60% (skema ada support)');
cek(Math.abs(F.tot - POOL) <= 1 && Math.abs(F.pct - 100) < 0.01, 'Tetap 100% / Rp 1.000.000');

// Supervisor merangkap PIC DAN menangani sendiri Troubleshooting-nya.
const G = tampil('Yoga = PIC + Supervisor + penangan Troubleshooting (tiga-tiganya)',
  calculateStandardScheme(sk, POOL, 'onsite', '', 'Yoga KS', 'u-dhany', 'Dhany Wahyu',
    'u-yoga', 'Yoga KS', [{ user_id: 'u-yoga', user_name: 'Yoga KS' }]));
cek(G.r.filter(s => s.user_name === 'Yoga KS').length === 1, 'Yoga tetap muncul SEKALI saja');
cek(Math.abs(G.tot - POOL) <= 1 && Math.abs(G.pct - 100) < 0.01, 'Tetap 100% / Rp 1.000.000');


// ── Supervisor & Manager juga tidak boleh terdeteksi sebagai Support ───────
// Menangani Troubleshooting anak buah MEMANG tugas mereka, dan itulah yang
// dibayar porsi koordinasi. Mendeteksinya lagi sebagai Support = dobel.
const H = tampil('PIC Pandu; yang menangani Troubleshooting justru Supervisor Yoga',
  calculateStandardScheme(sk, POOL, 'onsite', '', 'Pandu Kusuma Adji', 'u-dhany', 'Dhany Wahyu',
    'u-yoga', 'Yoga KS', [{ user_id: 'u-yoga', user_name: 'Yoga KS' }]));
cek(!H.r.some(s => s.role === 'support'), 'Supervisor tidak terdeteksi sebagai Support');
cek(H.r.filter(s => s.user_name === 'Yoga KS').length === 1, 'Yoga muncul sekali (hanya sebagai Supervisor)');
cek(H.r.find(s => s.role === 'supervisor')?.percentage === 30, 'Yoga dapat porsi Supervisor skema tanpa-support (30%)');
cek(Math.abs(H.tot - POOL) <= 1 && Math.abs(H.pct - 100) < 0.01, 'Tetap 100% / Rp 1.000.000');

const I = tampil('PIC Pandu; yang menangani Manager Dhany sendiri',
  calculateStandardScheme(sk, POOL, 'onsite', '', 'Pandu Kusuma Adji', 'u-dhany', 'Dhany Wahyu',
    'u-yoga', 'Yoga KS', [{ user_id: 'u-dhany', user_name: 'Dhany Wahyu' }]));
cek(!I.r.some(s => s.role === 'support'), 'Manager tidak terdeteksi sebagai Support');
cek(I.r.filter(s => s.user_name === 'Dhany Wahyu').length === 1, 'Dhany muncul sekali (hanya sebagai Manager)');
cek(Math.abs(I.tot - POOL) <= 1 && Math.abs(I.pct - 100) < 0.01, 'Tetap 100% / Rp 1.000.000');

const J = tampil('Campuran: Supervisor Yoga + Manager Dhany + Ferdinan (orang luar)',
  calculateStandardScheme(sk, POOL, 'onsite', '', 'Pandu Kusuma Adji', 'u-dhany', 'Dhany Wahyu',
    'u-yoga', 'Yoga KS', [
      { user_id: 'u-yoga',   user_name: 'Yoga KS' },
      { user_id: 'u-dhany',  user_name: 'Dhany Wahyu' },
      { user_id: 'ferdinan', user_name: 'Ferdinan Agustinus' },
    ]));
const supJ = J.r.filter(s => s.role === 'support');
cek(supJ.length === 1 && supJ[0].user_name === 'Ferdinan Agustinus',
    'Hanya Ferdinan yang dapat Support — Supervisor & Manager disaring');
cek(supJ[0]?.percentage === 17, 'Ferdinan dapat 17% PENUH, tidak dibagi bertiga');
cek(Math.abs(J.tot - POOL) <= 1 && Math.abs(J.pct - 100) < 0.01, 'Tetap 100% / Rp 1.000.000');

console.log(gagal === 0 ? '\nLULUS' : `\n${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
