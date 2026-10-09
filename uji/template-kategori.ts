/**
 * uji/template-kategori.ts - daftar kategori yang diterima server (/api/tools-team/template-kategori)
 * harus persis sama dengan kategori di panel Desain 3D, dan id asing ditolak.
 *
 * Jalankan: npx tsx uji/template-kategori.ts
 */
import { ID_KATEGORI_RUANG, kategoriRuangSah } from '../lib/tools-team';
import { KATEGORI_RUANG } from '../app/(portal)/tools-team/_components/desain3d/inti/template';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\nTemplate default kategori');
const klien = KATEGORI_RUANG.map(k => k.id).sort().join();
const server = [...ID_KATEGORI_RUANG].sort().join();
cek('daftar kategori server = daftar kategori panel', klien === server);
cek('semua kategori panel diterima server', KATEGORI_RUANG.every(k => kategoriRuangSah(k.id)));
cek('id asing ditolak', !kategoriRuangSah('lobby') && !kategoriRuangSah('') && !kategoriRuangSah(null) && !kategoriRuangSah("meeting' or 1=1"));
cek('bukan string ditolak', !kategoriRuangSah(1) && !kategoriRuangSah({}));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
