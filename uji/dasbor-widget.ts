import { readFileSync } from 'node:fs';
import { DAFTAR_WIDGET, rapikanDasbor, susunBaris } from '../lib/dasbor-widget';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

console.log('\nSusunan baris');
const atas = (sembunyi: string[]) => susunBaris([
  { kunci: 'tiket', lebar: 2 }, { kunci: 'jadwal', lebar: 2 }, { kunci: 'telat', lebar: 2 }, { kunci: 'grafik', lebar: 4 }, { kunci: 'piket', lebar: 2 },
].filter(x => !sembunyi.includes(x.kunci)), 6);
cek('semua tampil: susunan asli (2-2-2 lalu 4-2)', JSON.stringify(atas([])) === JSON.stringify({ tiket: 2, jadwal: 2, telat: 2, grafik: 4, piket: 2 }));
const satuHilang = atas(['jadwal']);
cek('satu kartu angka disembunyikan: dua sisanya melebar 3-3, tanpa lubang', satuHilang.tiket === 3 && satuHilang.telat === 3);
cek('piket disembunyikan: grafik penuh 6 kolom', atas(['piket']).grafik === 6);
const bawah = susunBaris([{ kunci: 'tim', lebar: 5 }, { kunci: 'unit', lebar: 3 }, { kunci: 'sumber', lebar: 5 }, { kunci: 'tren', lebar: 7 }], 12);
cek('setiap baris bento selalu genap 12 kolom', bawah.tim + bawah.unit === 12 && bawah.sumber + bawah.tren === 12);
const acak = susunBaris([3, 3, 3, 3, 4, 5, 7, 2].map((lebar, i) => ({ kunci: `k${i}`, lebar })), 12);
cek('tidak ada kartu selebar 0', Object.values(acak).every(v => v >= 1));

console.log('\nPengaturan');
cek('nilai rusak -> bawaan (semua tampil, latar redup)', JSON.stringify(rapikanDasbor('rusak')) === JSON.stringify({ sembunyi: [], latarRedup: true }));
cek('kunci tak dikenal & ganda dibuang', JSON.stringify(rapikanDasbor({ sembunyi: ['piket', 'piket', 'hapus-db', 3], latarRedup: false }).sembunyi) === '["piket"]');
cek('16 widget terdaftar, kunci unik', DAFTAR_WIDGET.length === 16 && new Set(DAFTAR_WIDGET.map(w => w.kunci)).size === 16);

console.log('\nTerpasang di dashboard');
const isi = readFileSync('app/(portal)/dashboard/_components/beranda/IsiBeranda.tsx', 'utf8') + readFileSync('app/(portal)/dashboard/_components/beranda/RincianBento.tsx', 'utf8');
cek('setiap widget dipakai di dashboard', DAFTAR_WIDGET.every(w => isi.includes(`'${w.kunci}'`) || isi.includes(`.${w.kunci}`) || w.kunci === 'agenda'));
cek('pengaturan bisa diubah dari Admin Panel', /WidgetDasborInline/.test(readFileSync('app/(portal)/dashboard/_components/modal-admin-panel.tsx', 'utf8')));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
