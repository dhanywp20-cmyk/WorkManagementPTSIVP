import { gabungHasilProyek, type BarisHasilProyek } from '@/lib/gabung-hasil-proyek';

// Penjaga lib/gabung-hasil-proyek.ts - pencarian "Project yang sudah ada" di
// Create Ticket. Kasus nyata: MHU Coal di CFX TOWER punya jadwal Konfigurasi
// (30 Jun) dan Standby Event (9 Jul); dulu hanya Standby Event yang tampil.

type B = BarisHasilProyek & { id: string };
const jadwal = (id: string, nama: string, alamat: string, kategori: string): B =>
  ({ id, project_name: nama, address: alamat, category: kategori, _sumber: 'reminder' });
const tiket = (id: string, nama: string, alamat: string): B =>
  ({ id, project_name: nama, address: alamat, category: 'Ticket', _sumber: 'ticket' });

const insentif = (k: string) => ['Konfigurasi', 'Konfigurasi & Training', 'Training'].includes(k);
const CFX = 'CFX TOWER, Jl. Gatot Subroto No.Kav. 35-36';

let gagal = 0;
const cek = (syarat: boolean, label: string) => {
  console.log(`${syarat ? 'OK  ' : 'GAGAL'}  ${label}`);
  if (!syarat) gagal++;
};

// Urutan masuk = terbaru dulu, seperti kueri aslinya.
const h1 = gabungHasilProyek([
  jadwal('se', 'MHU Coal', CFX, 'Standby Event'),
  jadwal('kf', 'MHU Coal', CFX, 'Konfigurasi'),
], [], 15, insentif);
cek(h1.length === 2, `Kategori berbeda = dua pilihan (dapat ${h1.length})`);
cek(h1[0]?.id === 'kf', 'Konfigurasi (kategori insentif) di atas Standby Event');

const h2 = gabungHasilProyek([
  jadwal('m2', 'Polres Bogor', 'Jl. Kapten Muslihat', 'Maintenance'),
  jadwal('m1', 'Polres Bogor', 'Jl.  kapten muslihat ', 'Maintenance'),
], [], 15, insentif);
cek(h2.length === 1 && h2[0].id === 'm2', 'Kategori sama + alamat beda spasi/huruf = satu pilihan, yang terbaru');

const h3 = gabungHasilProyek(
  [jadwal('kf', 'MHU Coal', CFX, 'Konfigurasi')],
  [tiket('t1', 'mhu coal', CFX), tiket('t2', 'Proyek Tanpa Jadwal', 'Jl. A'), tiket('t3', 'Proyek Tanpa Jadwal', 'Jl. A')],
  15, insentif);
cek(!h3.some(r => r.id === 't1'), 'Ticket lama tidak menggeser project yang punya jadwal');
cek(h3.filter(r => r.project_name === 'Proyek Tanpa Jadwal').length === 1, 'Project tanpa jadwal tetap muncul sekali dari ticket lama');

const h4 = gabungHasilProyek([
  jadwal('a-se', 'A', 'x', 'Standby Event'),
  jadwal('b-kf', 'B', 'y', 'Konfigurasi'),
  jadwal('a-kf', 'A', 'x', 'Konfigurasi'),
], [], 15, insentif);
cek(h4.map(r => r.id).join(',') === 'a-kf,a-se,b-kf', `Pilihan satu project berkumpul, urutan antar project tetap (dapat ${h4.map(r => r.id).join(',')})`);

cek(gabungHasilProyek(h4, [], 2).length === 2, 'Batas jumlah dihormati');

console.log(gagal === 0 ? '\nLULUS' : `\n${gagal} GAGAL`);
process.exit(gagal ? 1 : 0);
