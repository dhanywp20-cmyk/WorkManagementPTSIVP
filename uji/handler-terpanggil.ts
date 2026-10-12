/**
 * uji/handler-terpanggil.ts - penjaga satu jenis bug yang lolos tsc & lint: handler yang hanya DISEBUT, tidak
 * DIPANGGIL, mis. onClick={() => onAdminPanel} (tombol Admin Panel di sidebar mati sejak refactor 8 Okt 2026).
 * Memindai seluruh app/ & components/ (.tsx) mencari lambda yang mengembalikan nama handler tanpa tanda kurung.
 *
 * Jalankan: npm test -- handler-terpanggil
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, detail = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${detail ? `\n         ${detail}` : ''}`); }
}

function berkas(dir: string, hasil: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) berkas(p, hasil); else if (p.endsWith('.tsx')) hasil.push(p);
  }
  return hasil;
}

//  Atribut event JSX berisi lambda tanpa argumen/argumen biasa yang hanya mengembalikan nama handler (tanpa ()).
const POLA = /\bon[A-Z][A-Za-z]*=\{\s*\(\s*[A-Za-z_,\s]*\)\s*=>\s*(?:on|handle|toggle|buka|tutup|simpan|hapus)[A-Z][A-Za-z0-9]*\s*\}/g;

console.log('\n1. Handler JSX selalu dipanggil');
const temuan: string[] = [];
for (const f of [...berkas('app'), ...berkas('components')]) {
  const isi = readFileSync(f, 'utf8');
  for (const m of isi.matchAll(POLA)) {
    const baris = isi.slice(0, m.index).split('\n').length;
    temuan.push(`${f}:${baris}  ${m[0].slice(0, 80)}`);
  }
}
cek(`tidak ada lambda yang hanya menyebut handler (${temuan.length} temuan)`, temuan.length === 0, temuan.join('\n         '));

console.log('\n2. Tombol Admin Panel di sidebar');
const sidebar = readFileSync('app/(portal)/_kerangka/SidebarPortal.tsx', 'utf8');
const jumlahTombol = (sidebar.match(/onClick=\{onAdminPanel\}/g) ?? []).length + (sidebar.match(/onClick=\{\(\) => onAdminPanel\(\)\}/g) ?? []).length;
cek('kedua tombol Admin Panel (lebar & ciut) memanggil onAdminPanel', jumlahTombol === 2);
cek('tidak ada onClick={() => onAdminPanel} tanpa panggilan', !/onClick=\{\(\) => onAdminPanel\}/.test(sidebar));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
