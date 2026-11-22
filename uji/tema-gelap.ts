import { readFileSync } from 'node:fs';
import { KUNCI_TEMA, SKRIP_TEMA_AWAL, kelasTampilan, rapikanTampilan, type Tampilan } from '../components/shared/Tema';

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
cek('tema dipasang sebelum halaman tergambar (tanpa kedip putih)', SKRIP_TEMA_AWAL.includes(KUNCI_TEMA) && /SKRIP_TEMA_AWAL/.test(readFileSync('app/layout.tsx', 'utf8')) && /tema-gelap\.css/.test(readFileSync('app/layout.tsx', 'utf8')) && /tema-pts-kaca\.css/.test(readFileSync('app/layout.tsx', 'utf8')));
cek('tombol tema di samping Sign out (sidebar) dan Keluar (HP)', /tukarTema/.test(readFileSync('app/(portal)/_kerangka/SidebarPortal.tsx', 'utf8')) && /__tema/.test(readFileSync('app/(portal)/dashboard/_components/NavBawahMobile.tsx', 'utf8')));
const kaca = readFileSync('app/tema-pts-kaca.css', 'utf8');
cek('tidak mengikuti prefers-color-scheme sistem', !/prefers-color-scheme/.test(gelap + global + kaca));

// Jalankan skrip awal di lingkungan tiruan, bandingkan dengan kelasTampilan().
function jalankanSkrip(simpanan: string | null, jalur: string) {
  const kelas = new Set<string>();
  const fungsi = new Function('localStorage', 'location', 'document', SKRIP_TEMA_AWAL);
  fungsi({ getItem: () => simpanan }, { pathname: jalur }, { documentElement: { classList: { add: (k: string) => kelas.add(k) } } });
  return { kaca: kelas.has('pts-kaca'), gelap: kelas.has('gelap'), lc: kelas.has('rute-lc') };
}
const KASUS: [string | null, string][] = [];
for (const v of [null, 'kaca', 'terang', 'gelap', 'lain']) for (const j of ['/dashboard', '/ticketing', '/learning-center', '/kelas/abc', '/project-progress/share/x', '/']) KASUS.push([v, j]);
cek('skrip awal sama persis dengan kelasTampilan() di semua rute', KASUS.every(([v, j]) => JSON.stringify(jalankanSkrip(v, j)) === JSON.stringify(kelasTampilan(rapikanTampilan(v), j))));
const k = (t: Tampilan, j: string) => kelasTampilan(t, j);
cek('bawaan PTS Kaca: tanpa pilihan tersimpan -> kaca + isi gelap', rapikanTampilan(null) === 'kaca' && k('kaca', '/dashboard').kaca && k('kaca', '/dashboard').gelap);
cek('Learning Center tidak berubah: di tampilan kaca isinya tetap terang (tanpa html.gelap)', !k('kaca', '/learning-center').gelap && k('kaca', '/learning-center').lc && !k('kaca', '/kelas/x').gelap);
cek('Learning Center tetap gelap bila pengguna memilih mode gelap lama', k('gelap', '/learning-center').gelap && !k('gelap', '/learning-center').kaca);
cek('mode terang tetap bisa dipilih & tidak berubah', JSON.stringify(k('terang', '/dashboard')) === JSON.stringify({ kaca: false, gelap: false, lc: false }));
cek('halaman bagikan publik tidak ikut kaca', !k('kaca', '/project-progress/share/abc').kaca && !k('kaca', '/project-progress/share/abc').gelap);
cek('aturan kaca tidak menyentuh kelas Learning Center (.lc-*)', !/\.lc-/.test(kaca));
cek('masuk & keluar akun selalu kembali ke tampilan bawaan', /kembaliBawaan\(\)/.test((readFileSync('app/(portal)/_kerangka/LayarMasuk.tsx', 'utf8') + readFileSync('app/(portal)/_kerangka/useLayarMasuk.ts', 'utf8'))) && /kembaliBawaan\(\)/.test((readFileSync('app/(portal)/_kerangka/KerangkaPortal.tsx', 'utf8') + readFileSync('app/(portal)/_kerangka/useKerangkaPortal.ts', 'utf8'))));
cek('baris CSS tidak melebihi 300 karakter', `${gelap}\n${kaca}`.split('\n').every(b => b.length <= 300));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
