/**
 * uji/menu-instan.ts - pindah menu terasa langsung (KerangkaPortal).
 *
 * Keluhan: tombol menu baru tersorot belakangan dan layar seperti macet. Penyebabnya: sorotan
 * dibaca dari pathname (baru berganti setelah halaman tujuan selesai dimuat), menu memakai
 * router.push tanpa prefetch, dan tidak ada tanda sedang memuat. Uji ini menjaga ketiganya.
 *
 * Jalankan: npm test -- menu-instan
 */
import { readFileSync } from 'fs';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const kp = readFileSync('app/(portal)/_kerangka/KerangkaPortal.tsx', 'utf8');
const css = readFileSync('app/globals.css', 'utf8');

console.log('\n1. Sorotan langsung saat diklik');
cek('sorotan memakai tujuan yang diklik lebih dulu (jalurSorot)', /const jalurSorot = tujuanMenu \?\? pathname;/.test(kp));
cek('aktifUrl membaca jalurSorot, bukan pathname', /const aktifUrl = \(url: string\) => jalurSorot === url/.test(kp));
cek('tujuan dilepas saat alamat benar-benar berganti', /useEffect\(\(\) => \{ setTujuanMenu\(null\); urlTujuan\.current = null; \}, \[pathname\]\);/.test(kp));
cek('jaring pengaman: menggantung 12 dtk -> sorotan dilepas & alamat tujuan dibuka muat penuh', /setTujuanMenu\(null\);\s*if \(url && navigator\.onLine !== false\) window\.location\.assign\(url\);\s*\}, 12_000\)/.test(kp));
cek('sidebar & menu bawah memakai sorotan baru', /showDashboardPanel=\{berandaTersorot\}/.test(kp) && /aktif: showSidebar \? berandaTersorot : true/.test(kp));

console.log('\n2. Semua jalur pindah menu lewat pindahKe (transition)');
cek('handleMenuClick memakai pindahKe', /setShowSidebar\(true\);\s*pindahKe\(item\.url\);/.test(kp));
cek('notifikasi memakai pindahKe', /pindahKe\(urlDenganTarget\)/.test(kp));
cek('router.push hanya di pindahKe dan logout', (kp.match(/router\.push\(/g) ?? []).length === 2);
cek('pindahKe membungkus router.push dalam startTransition', /mulaiPindah\(\(\) => router\.push\(url\)\)/.test(kp));

console.log('\n3. Tanda sedang memuat');
cek('bilah tampil selama perpindahan', /\{sedangPindah && <div aria-hidden="true" className="bilah-pindah-menu" \/>\}/.test(kp));
cek('CSS bilah & redup ada', /\.bilah-pindah-menu::before/.test(css) && /\.isi-sedang-pindah > :not\(\.bilah-pindah-menu\)/.test(css));
cek('redup ditunda (perpindahan cepat tidak berkedip)', /redupPindahMenu 0\.2s ease 0\.15s/.test(css));

console.log('\n4. Prefetch kode menu saat menganggur');
cek('router.prefetch dipanggil', /router\.prefetch\(urls\[i\]\)/.test(kp));
cek('menunggu peramban menganggur', /requestIdleCallback/.test(kp));
cek('menghormati mode hemat data', /saveData/.test(kp));
cek('dibatasi sekali per 30 menit per tab (hemat kuota)', /prefetch-menu-terakhir/.test(kp) && /30 \* 60 \* 1000/.test(kp));
cek('hanya menu internal (bukan tautan luar)', /\.filter\(it => it\.internal \|\| \(it\.embed && !it\.external\)\)/.test(kp));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
