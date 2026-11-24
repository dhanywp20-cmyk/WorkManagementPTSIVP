import { readFileSync } from 'node:fs';
import { KUNCI_GAYA, KUNCI_GAYA_BAWAAN, SKRIP_TEMA_AWAL, WARNA_BILAH } from '../components/shared/Tema';

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
cek('tema dipasang sebelum halaman tergambar (tanpa kedip putih)', SKRIP_TEMA_AWAL.includes(KUNCI_GAYA) && /SKRIP_TEMA_AWAL/.test(readFileSync('app/layout.tsx', 'utf8')) && /tema-gelap\.css/.test(readFileSync('app/layout.tsx', 'utf8')));
const navHp = readFileSync('app/(portal)/dashboard/_components/NavBawahMobile.tsx', 'utf8'), sidebar = readFileSync('app/(portal)/_kerangka/SidebarPortal.tsx', 'utf8');
cek('tombol Glass/Matte di nav bawah HP & sidebar desktop; tombol mode gelap sudah tidak ada', /tukarGaya/.test(navHp) && /tukarGaya/.test(sidebar) && !/useTema|tukarTema/.test(navHp + sidebar));
cek('mode gelap tidak pernah dipasang lagi', !SKRIP_TEMA_AWAL.includes('gelap'));
cek('HP: Matte kecuali memilih Glass; desktop: pilihan pengguna, lalu bawaan Admin Panel', SKRIP_TEMA_AWAL.includes(`h?g!=='glass':(g||l.getItem('${KUNCI_GAYA_BAWAAN}'))==='matte'`) && SKRIP_TEMA_AWAL.includes('gaya-matte'));
const tema = readFileSync('components/shared/Tema.tsx', 'utf8'), apk = readFileSync('android/app/src/main/java/id/ptsivp/workmanagement/MainActivity.java', 'utf8');
cek('bilah status ikut tampilan: meta theme-color & APK (AndroidApp.warnaBilah)', /theme-color/.test(tema) && /AndroidApp\?\.warnaBilah/.test(tema) && /public void warnaBilah\(String hex\)/.test(apk) && /^#[0-9a-f]{6}$/.test(WARNA_BILAH.matte) && /^#[0-9a-f]{6}$/.test(WARNA_BILAH.glass));
cek('gaya bawaan desktop dari Admin Panel ditulis ke kunci yang sama, bawaan Glass',
  readFileSync('lib/merek/inti.ts', 'utf8').includes(`'${KUNCI_GAYA_BAWAAN}'`) && /gayaBawaan: 'glass'/.test(readFileSync('lib/merek/bawaan.ts', 'utf8')));
cek('Matte memakai latar sendiri, bukan foto latar Glass',
  /\.kerangka-bingkai:has\(\.sidebar-3d\) \{\s*background: var\(--kc-latar\) !important/.test(readFileSync('app/tema-aksen-biru.css', 'utf8')));
const biru = readFileSync('app/tema-aksen-biru.css', 'utf8');
cek('tema aksen biru hanya aktif di html.gaya-matte', /tema-aksen-biru\.css/.test(readFileSync('app/layout.tsx', 'utf8')) && !/html(:not\(\.gelap\)|\.gelap)[ :]/.test(biru) && biru.includes('html.gaya-matte'));
cek('selalu Light Mode: tidak mengikuti mode gelap sistem', !/prefers-color-scheme/.test(gelap + global));
cek('masuk & keluar akun selalu kembali ke Light Mode', /kembaliTerang\(\)/.test((readFileSync('app/(portal)/_kerangka/LayarMasuk.tsx', 'utf8') + readFileSync('app/(portal)/_kerangka/useLayarMasuk.ts', 'utf8'))) && /kembaliTerang\(\)/.test((readFileSync('app/(portal)/_kerangka/KerangkaPortal.tsx', 'utf8') + readFileSync('app/(portal)/_kerangka/useKerangkaPortal.ts', 'utf8'))));
cek('baris CSS tidak melebihi 300 karakter', gelap.split('\n').every(b => b.length <= 300));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
