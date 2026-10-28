/**
 * uji/sesi-habis.ts - menu "macet" sesudah platform dibuka berjam-jam.
 *
 * Sebabnya: cookie sesi (httpOnly) mati 6 jam sesudah login, sementara portal tetap tampak masuk dari
 * sessionStorage. Setiap pindah menu dialihkan proxy.ts ke /dashboard?lanjut=... - sorotan menu tertahan,
 * layar diam di Dashboard, dan muat ulang jaring pengaman kembali ke Dashboard yang sama.
 *
 * Kini sesi praktis tidak habis (400 hari, permintaan pemilik: tidak perlu sesi habis, terutama di HP), dan
 * bila cookie tetap hilang portal langsung menampilkan layar masuk - tanpa permintaan berkala ke server.
 *
 * Jalankan: npm test -- sesi-habis
 */
import { existsSync, readFileSync } from 'fs';
import { SESSION_DURATION_MS } from '../lib/constants';
import { SESSION_HOURS } from '../lib/masuk-server';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };
const baca = (f: string) => readFileSync(f, 'utf8');

console.log('\n1. Sesi praktis tidak habis');
cek('cookie & baris sesi 400 hari (batas umur cookie Chrome)', SESSION_HOURS === 400 * 24);
cek('jam sesi di peramban sama dengan cookie', SESSION_DURATION_MS === SESSION_HOURS * 3600 * 1000);
cek('banner "Sesi akan berakhir / Perpanjang Sesi" dihapus', !existsSync('app/_components/SessionExpiryBanner.tsx')
  && !/SessionExpiryBanner/.test(baca('app/(portal)/_kerangka/KerangkaPortal.tsx')));

console.log('\n2. Cookie hilang -> layar masuk, bukan menu macet');
const portal = baca('app/(portal)/_kerangka/KerangkaPortal.tsx');
const efek = portal.slice(portal.indexOf('COOKIE SESI HILANG'), portal.indexOf('// Auto-navigate sales/guest'));
cek('server ditanya HANYA bila alamat membawa ?lanjut= (tanpa polling)',
  /const lanjut = new URLSearchParams\(window\.location\.search\)\.get\('lanjut'\);\s*if \(!lanjut\) return;/.test(efek) && /cekSesiServer\(\)/.test(efek) && !/setInterval/.test(efek));
cek('401 -> layar masuk (sesiBerakhir)', /if \(hasil === 'habis'\) sesiBerakhir\(\);/.test(efek));
cek('masih sah -> lanjut ke halaman tujuan yang aman', /tujuanLanjutAman\(lanjut\)/.test(efek) && /router\.replace\(tujuan\)/.test(efek));
cek('diperiksa sesudah setiap perpindahan selesai', /\}, \[pathname, sedangPindah, isLoggedIn, sesiBerakhir, router\]\);/.test(efek));
cek('sesiBerakhir melepas tujuan menu (jaring pengaman 12 dtk tidak memuat ulang)', /setTujuanMenu\(null\); urlTujuan\.current = null;/.test(portal));
cek('Keluar memakai jalur yang sama', /const handleLogout = \(\) => \{\s*sesiBerakhir\(\);\s*router\.push\('\/dashboard'\);/.test(portal));
cek('sesudah login kembali ke ?lanjut=', /const lanjut = tujuanLanjutAman\(new URLSearchParams\(window\.location\.search\)\.get\('lanjut'\)\);\s*if \(lanjut\) router\.replace\(lanjut\);/.test(portal));
cek('proxy.ts tetap memasang ?lanjut= saat cookie tidak ada', /keLogin\.searchParams\.set\('lanjut'/.test(baca('proxy.ts')));
const auth = baca('lib/auth.ts');
cek('cekSesiServer: hanya 401 dianggap habis (sinyal jelek bukan alasan keluar)', /if \(res\.status === 401\) return 'habis';\s*if \(!res\.ok\) return 'gagal';/.test(auth));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
