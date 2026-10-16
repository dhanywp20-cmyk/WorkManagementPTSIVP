/**
 * uji/halus-refresh-login.ts - refresh halaman, menu, dan animasi sukses login.
 *
 * Keluhan: setelah refresh / pindah menu terasa macet; animasi sukses login terlalu berat.
 * Sebabnya (dijaga di sini supaya tidak kembali):
 *  - menu ditahan timer "memuat" 400 ms yang terulang tiap objek currentUser diganti;
 *  - portal menunggu 3 permintaan berantai sebelum tampil.
 *
 * Jalankan: npm test -- halus-refresh-login
 */
import { readFileSync } from 'fs';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

const portal = readFileSync('app/(portal)/_kerangka/KerangkaPortal.tsx', 'utf8');
const sidebar = readFileSync('app/(portal)/_kerangka/SidebarPortal.tsx', 'utf8');
const masuk = readFileSync('app/(portal)/_kerangka/LayarMasuk.tsx', 'utf8');
const css = readFileSync('app/globals.css', 'utf8');

console.log('\n1. Menu tanpa penundaan buatan');
cek('tidak ada state/penanda menuLoading', !/menuLoading/.test(portal) && !/menuLoading/.test(sidebar));
cek('tidak ada setTimeout 400 ms untuk menu', !/setTimeout\([\s\S]{0,400}\}, 400\)/.test(portal));
cek('daftar menu dihitung dengan useMemo dari isi menu', /const visibleMenuItems: MenuItem\[\] = useMemo\(/.test(portal) && /\[kunciMenu\]/.test(portal));
cek('Full Access / tanpa allowed_menus -> semua menu', /!allowedMenus \|\| hasFullAccess\(currentUser\)/.test(portal));
cek('urutan menu mengikuti DAFTAR_MENU', /DAFTAR_MENU\.filter\(m => izin\.includes\(m\.key\)\)/.test(portal));

console.log('\n2. Refresh: tampil dulu, segarkan di latar belakang');
const load = portal.slice(portal.indexOf('const load = async () => {'), portal.indexOf('// isAdmin TETAP admin'));
const iTampil = load.search(/setLoading\(false\);\s+try \{/);
const iProfil = load.indexOf("supabase.from('users').select('id,username");
cek('setLoading(false) SEBELUM kueri profil', iTampil > 0 && iProfil > iTampil);
cek('profil & pimpinan dimuat bersamaan (Promise.all)', /Promise\.all\(\[\s*supabase\.from\('users'\)\.select\('id,username/.test(load));
cek('objek user hanya diganti bila isinya berubah', /beda \? \{ \.\.\.lama, \.\.\.segar \} : lama/.test(load));
cek('efek dibatalkan saat unmount', /useEffect\(\(\) => \{\s+let batal = false;\s+const load = async/.test(portal) && /load\(\);\s+return \(\) => \{ batal = true; \};/.test(portal));
cek('sesi tab dipakai lebih dulu, cookie hanya bila kosong', /let parsed = getSession<User>\(\);\s*if \(!parsed\) parsed = await verifySessionFromCookie/.test(load));
cek('layar memuat tanpa kartu & tertunda 200 ms', /animation: 'fadeIn 400ms ease 200ms both'/.test(portal) && !/Memuat portal\.\.\./.test(portal));

console.log('\n3. Animasi sukses login');
cek('animasi lama (bongkar / koper / clip-path) hilang', !/lc-bongkar|lc-dasbor-muncul|lcDasborMuncul|lcBongkar/.test(css + masuk + portal));
const durasi = Number(/window\.setTimeout\(onSelesai, pakaiAnimasi \? (\d+) : 0\)/.exec(masuk)?.[1] ?? 0);
const mudar = /\.lc-masuk-pudar \{ animation: lcMasukPudar (\d+)ms ease-in (\d+)ms forwards; \}/.exec(css);
cek('onSelesai tepat di akhir pemudaran halaman login', !!mudar && durasi === Number(mudar[1]) + Number(mudar[2]));
cek('total <= 1000 ms (dulu 1500)', durasi > 0 && durasi <= 1000);
cek('sapaan memakai nama depan', /setNamaSapa\(/.test(masuk) && /Selamat datang\{namaSapa/.test(masuk));
cek('overlay sukses di dalam kartu (tinggi tidak berubah)', /lc-sukses absolute inset-0/.test(masuk));
const dasbor = /\.lc-dasbor-pudar \{[^}]*\}\s*@keyframes lcDasborPudar \{[^}]*\}/.exec(css)?.[0] ?? '';
cek('dashboard hanya opacity (tanpa transform/clip-path di akar)', dasbor !== '' && !/transform|clip-path|scale|translate/.test(dasbor));
cek('gerak dikurangi: semua animasi baru dimatikan', /prefers-reduced-motion: reduce\)[\s\S]*\.lc-sukses,[\s\S]*\.lc-masuk-pudar,[\s\S]*\.lc-dasbor-pudar \{ animation: none; \}/.test(css));
cek('gerak dikurangi: centang langsung penuh', /\.lc-sukses-centang \{ animation: none; stroke-dashoffset: 0; \}/.test(css));
cek('dashboard memakai kelas pudar & dilepas lagi', (portal.match(/lc-dasbor-pudar/g) ?? []).length === 2 && /setDasborMuncul\(false\), 520\)/.test(portal));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
