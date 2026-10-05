/**
 * uji/piket-akses.ts - aturan siapa melihat & mengisi Piket Showroom.
 *
 * Jalankan: npx tsx uji/piket-akses.ts
 */
import { bisaLihatSemuaTamu, bisaIsiKegiatan, adalahPTS } from '../lib/piket-akses';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\n1. Melihat: bawaan semua, "lingkup" hanya bila disetel eksplisit');
cek('Sales tanpa pengaturan (bawaan) melihat semua', bisaLihatSemuaTamu({ role: 'guest', piket_akses: null }));
cek('Marketing tanpa pengaturan melihat semua', bisaLihatSemuaTamu({ role: 'guest' }));
cek('piket_akses "semua" melihat semua', bisaLihatSemuaTamu({ role: 'guest', piket_akses: 'semua' }));
cek('piket_akses "lingkup" dibatasi', !bisaLihatSemuaTamu({ role: 'guest', piket_akses: 'lingkup' }));
cek('Tim PTS selalu melihat semua, walau disetel lingkup', bisaLihatSemuaTamu({ role: 'team', piket_akses: 'lingkup' }));

console.log('\n2. Mengisi / menyunting: Tim PTS, atau pengaturan eksplisit');
cek('Sales bawaan: tidak bisa mengisi', !bisaIsiKegiatan({ role: 'guest' }));
cek('Sales piket_ubah false: tidak bisa', !bisaIsiKegiatan({ role: 'guest', piket_ubah: false }));
cek('Sales piket_ubah null: tidak bisa', !bisaIsiKegiatan({ role: 'guest', piket_ubah: null }));
cek('Sales yang diberi piket_ubah true: bisa', bisaIsiKegiatan({ role: 'guest', piket_ubah: true }));
cek('Resepsionis (semua) tetap tidak bisa tanpa pengaturan', !bisaIsiKegiatan({ role: 'guest', piket_akses: 'semua' }));
cek('Tim PTS selalu bisa', bisaIsiKegiatan({ role: 'team' }) && bisaIsiKegiatan({ role: 'admin' }) && bisaIsiKegiatan({ role: 'superadmin' }));
cek('nilai selain true (string "true") tidak dianggap hak', !bisaIsiKegiatan({ role: 'guest', piket_ubah: 'true' as unknown as boolean }));
cek('adalahPTS tidak terpengaruh pengaturan', !adalahPTS({ role: 'guest', piket_ubah: true }));

console.log('\n3. Tanpa pengguna');
cek('null: tidak bisa mengisi', !bisaIsiKegiatan(null) && !bisaIsiKegiatan(undefined));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
