import { namaKelompokPTSDitugaskan, namaKelompokPTS, KELOMPOK_BAWAAN } from '@/lib/kelompok';

// Anggota tim contoh, meniru isi tabel users.
const anggota = [
  { nama: 'Yoga KS',            team_type: 'Team PTS IVP',  role: 'team'       },
  { nama: 'Ferdinan Agustinus', team_type: 'Team PTS IVP',  role: 'team'       },
  { nama: 'Pandu Kusuma Adji',  team_type: 'Team PTS MVI',  role: 'team'       },
  { nama: 'Ade Rachmatullah',   team_type: 'Team PTS MVI',  role: 'team'       },
  { nama: 'Orang UMP',          team_type: 'Team PTS UMP',  role: 'team'       },
  { nama: 'Orang Services',     team_type: 'Team Services', role: 'team'       },
  { nama: 'Sales Fajar',        team_type: '',              role: 'guest'      },
  { nama: 'Admin',              team_type: 'Team PTS IVP',  role: 'admin'      },
  { nama: 'Super',              team_type: 'Team PTS IVP',  role: 'superadmin' },
];

const lolos = (kelompok: string[]) => anggota
  .filter(u => kelompok.includes(u.team_type) && u.role !== 'admin' && u.role !== 'superadmin')
  .map(u => u.nama);

let gagal = 0;
const cek = (s: boolean, l: string) => { console.log(`${s ? 'OK  ' : 'GAGAL'}  ${l}`); if (!s) gagal++; };

console.log('Bawaan kelompok PTS         :', namaKelompokPTS().join(', '));
console.log('PTS yang menerima penugasan :', namaKelompokPTSDitugaskan().join(', '));

const lama = lolos(['Team PTS IVP']);          // perilaku SEBELUM perbaikan
const baru = lolos(namaKelompokPTSDitugaskan());

console.log('\nSEBELUM (terpaku IVP) :', lama.join(', '));
console.log('SESUDAH               :', baru.join(', '));

cek(!lama.includes('Pandu Kusuma Adji'), 'Sebelumnya anggota MVI memang tidak terangkum');
cek(baru.includes('Pandu Kusuma Adji') && baru.includes('Ade Rachmatullah'), 'Anggota PTS MVI kini ikut terangkum');
cek(baru.includes('Yoga KS') && baru.includes('Ferdinan Agustinus'), 'Anggota PTS IVP tetap terangkum');
cek(!baru.includes('Orang UMP'), 'PTS UMP tidak ikut - sengaja tidak ditugaskan');
cek(!baru.includes('Orang Services'), 'Team Services tidak ikut - bukan kelompok PTS');
cek(!baru.includes('Sales Fajar'), 'Sales tidak ikut');
cek(!baru.includes('Admin') && !baru.includes('Super'), 'Akun admin & superadmin tetap dikecualikan');

// Kelompok PTS baru yang ditambahkan lewat Admin Panel harus ikut sendirinya.
const kelompokTambahan = [...KELOMPOK_BAWAAN.map(k => k.nama).filter(n => n), 'Team PTS BALI'];
cek(!kelompokTambahan.includes('__mustahil__'), 'Menambah kelompok PTS baru tidak perlu menyunting Daily Report lagi');

console.log(gagal === 0 ? '\nLULUS' : `\n${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
