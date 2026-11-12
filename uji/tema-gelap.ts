import { readFileSync } from 'node:fs';
import { KUNCI_TEMA, SKRIP_TEMA_AWAL } from '../components/shared/Tema';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

const gelap = readFileSync('app/tema-gelap.css', 'utf8');
const global = readFileSync('app/globals.css', 'utf8');

console.log('\nMode gelap');
cek('palet Tailwind dibalik di bawah html.gelap (slate, blue, red, amber, ...)', ['slate', 'gray', 'blue', 'red', 'amber', 'emerald'].every(w => gelap.includes(`--color-${w}-50:`) && gelap.includes(`--color-${w}-900:`)));
cek('token platform (permukaan, tinta, garis, halaman) punya nilai gelap', ['--permukaan:', '--tinta:', '--garis:', '--halaman:'].every(t => gelap.includes(t)));
const variabel = [...global.matchAll(/var\(--(g[bgst]-[0-9a-f]{6}), (#[0-9a-fA-F]{3,6})\)/g)];
cek('warna terang di globals.css tetap punya nilai asli (mode terang tidak berubah)', variabel.length > 50 && variabel.every(([, nama, hex]) => {
  const h = hex.slice(1).toLowerCase(); const penuh = h.length === 3 ? h.split('').map(c => c + c).join('') : h; return nama.endsWith(penuh);
}));
cek('setiap variabel warna punya pengganti gelap', [...new Set(variabel.map(v => v[1]))].every(n => gelap.includes(`--${n}:`)));
cek('tema dipasang sebelum halaman tergambar (tanpa kedip putih)', SKRIP_TEMA_AWAL.includes(KUNCI_TEMA) && /SKRIP_TEMA_AWAL/.test(readFileSync('app/layout.tsx', 'utf8')) && /tema-gelap\.css/.test(readFileSync('app/layout.tsx', 'utf8')));
cek('tombol tema di samping Sign out (sidebar) dan Keluar (HP)', /tukarTema/.test(readFileSync('app/(portal)/_kerangka/SidebarPortal.tsx', 'utf8')) && /__tema/.test(readFileSync('app/(portal)/dashboard/_components/NavBawahMobile.tsx', 'utf8')));
cek('bawaan Light Mode: gelap hanya bila dipilih sendiri', SKRIP_TEMA_AWAL.includes(`==='gelap'`) && !/prefers-color-scheme/.test(gelap + global));
cek('masuk & keluar akun selalu kembali ke Light Mode', /kembaliTerang\(\)/.test((readFileSync('app/(portal)/_kerangka/LayarMasuk.tsx', 'utf8') + readFileSync('app/(portal)/_kerangka/useLayarMasuk.ts', 'utf8'))) && /kembaliTerang\(\)/.test((readFileSync('app/(portal)/_kerangka/KerangkaPortal.tsx', 'utf8') + readFileSync('app/(portal)/_kerangka/useKerangkaPortal.ts', 'utf8'))));
cek('baris CSS tidak melebihi 300 karakter', gelap.split('\n').every(b => b.length <= 300));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
