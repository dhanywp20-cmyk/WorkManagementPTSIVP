import { generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { cocokDomain, jalurPro, menuBoleh, periksaIsianTerbit, uraiKunci } from '../lib/lisensi/inti';
import { periksaKunci, statusLisensi, terbitkanKunci } from '../lib/lisensi/server';
import { KUNCI_PUBLIK_LISENSI } from '../lib/lisensi/kunci-publik';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const privat = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
const SEKARANG = Date.parse('2026-11-08T03:00:00Z');
const terbit = (isi: Partial<Parameters<typeof terbitkanKunci>[0]>) => terbitkanKunci({ pelanggan: 'PT Uji', edisi: 'pro', domain: [], kedaluwarsa: null, ...isi }, privat).kunci;
const periksa = (kunci: string, host: string, waktu = SEKARANG) => periksaKunci(kunci, host, waktu, publicKey);

console.log('\nTanda tangan');
const pro = terbit({ domain: ['wm.contoh.com'] });
cek('kunci asli sah di domainnya', periksa(pro, 'wm.contoh.com').sah && periksa(pro, 'wm.contoh.com').edisi === 'pro');
const [awal, isi, tanda] = pro.split('.');
const klaimUbah = Buffer.from(Buffer.from(isi.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8').replace('"pro"', '"pro","pemilik":true'))
  .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
cek('isi kunci diubah (menambah pemilik) -> tanda tangan tidak sah', periksa(`${awal}.${klaimUbah}.${tanda}`, 'wm.contoh.com').alasan === 'tanda-tangan');
const lain = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
cek('kunci dari kunci privat lain ditolak', periksa(terbitkanKunci({ pelanggan: 'Palsu', edisi: 'pro', domain: [], kedaluwarsa: null }, lain).kunci, 'a.com').alasan === 'tanda-tangan');
cek('kunci terpotong -> format', periksa(pro.slice(0, 40), 'wm.contoh.com').alasan === 'format');
cek('kunci kosong -> tidak-ada', periksa('', 'wm.contoh.com').alasan === 'tidak-ada');
cek('kunci publik di kode valid (Ed25519 DER base64)', KUNCI_PUBLIK_LISENSI.length > 40 && !!uraiKunci(pro));

console.log('\nDomain & masa berlaku');
cek('domain lain ditolak', periksa(pro, 'wm.lain.com').alasan === 'domain');
cek('port diabaikan saat mencocokkan domain', periksa(pro, 'wm.contoh.com:3000').sah);
cek('wildcard pratinjau Vercel cocok satu segmen', cocokDomain('app-git-fitur-tim.vercel.app', 'app-*-tim.vercel.app') && !cocokDomain('jahat.com.app-x-tim.vercel.app', 'app-*-tim.vercel.app'));
cek('tanpa domain = berlaku di semua alamat', periksa(terbit({}), 'apa.saja.id').sah);
const habis = terbit({ kedaluwarsa: '2026-11-07' });
cek('lewat tanggal berakhir -> kedaluwarsa', periksa(habis, 'x.com').alasan === 'kedaluwarsa');
cek('masih berlaku sampai akhir hari tanggal berakhir (WIB)', periksa(habis, 'x.com', Date.parse('2026-11-07T16:00:00Z')).sah);
const demo = periksa(terbit({ domain: ['wm.contoh.com'], kedaluwarsa: '2026-12-07', demo: true }), 'wm.contoh.com');
cek('lisensi demo terbaca sebagai demo, lisensi biasa tidak', demo.sah && demo.demo && !periksa(pro, 'wm.contoh.com').demo);
cek('isian demo tanpa tanggal berakhir ditolak', !periksaIsianTerbit({ pelanggan: 'PT A', edisi: 'pro', domain: [], demo: true }, '2026-11-08').ok);
cek('sisa hari dihitung', periksa(terbit({ kedaluwarsa: '2026-11-20' }), 'x.com').sisaHari === 13);

console.log('\nEdisi & menu');
const lite = { sah: true, edisi: 'lite' as const, pemilik: false };
cek('Lite: AV Tools, Learning Center, Incentive terkunci', !menuBoleh('tools-team', lite) && !menuBoleh('learning-center', lite) && !menuBoleh('incentive-pts', lite));
cek('Lite: menu lain tetap terbuka', menuBoleh('ticket-troubleshooting', lite) && menuBoleh('project-progress', lite) && menuBoleh('kpi-team', lite));
cek('Pro: menu Pro terbuka, Database PTS tetap tertutup', menuBoleh('tools-team', { ...lite, edisi: 'pro' }) && !menuBoleh('database-pts', { ...lite, edisi: 'pro' }));
cek('Database PTS hanya untuk lisensi pemilik', menuBoleh('database-pts', { sah: true, edisi: 'pro', pemilik: true }));
cek('lisensi tidak sah: semua menu tertutup', !menuBoleh('ticket-troubleshooting', { sah: false, edisi: 'pro', pemilik: true }));
cek('jalur Pro dikenali (halaman & API)', jalurPro('/tools-team') && jalurPro('/api/incentive/splits') && jalurPro('/kelas/abc') && !jalurPro('/ticketing') && !jalurPro('/tools-teamx'));

console.log('\nIsian License Manager');
cek('domain dengan http:// ditolak', !periksaIsianTerbit({ pelanggan: 'PT A', edisi: 'pro', domain: ['https://a.com'] }, '2026-11-08').ok);
cek('tanggal berakhir di masa lalu ditolak', !periksaIsianTerbit({ pelanggan: 'PT A', edisi: 'lite', domain: [], kedaluwarsa: '2026-01-01' }, '2026-11-08').ok);
const isian = periksaIsianTerbit({ pelanggan: ' PT A ', edisi: 'lite', domain: ['WM.A.com', ''], kedaluwarsa: '2027-01-01' }, '2026-11-08');
cek('isian sah dirapikan (huruf kecil, kosong dibuang)', isian.ok && isian.isian.domain.join() === 'wm.a.com' && isian.isian.pelanggan === 'PT A');

console.log('\nPenjagaan');
const proxy = readFileSync('proxy.ts', 'utf8');
cek('proxy menolak semua jalur bila lisensi tidak sah dan jalur Pro untuk Lite', /!lisensi\.sah\) return tolakLisensi/.test(proxy) && /edisi !== 'pro' && jalurPro\(pathname\)/.test(proxy));
cek('platform tidak bisa menerbitkan lisensi (License Manager terpisah)', !existsSync('app/api/admin/lisensi/route.ts')
  && !/LISENSI_KUNCI_PRIVAT|terbitkanKunci/.test(readFileSync('app/(portal)/dashboard/_components/modal-lisensi.tsx', 'utf8') + readFileSync('proxy.ts', 'utf8')));

console.log('\nServer pemilik vs paket pelanggan');
const pemilik = statusLisensi('work-management-ptsivp.vercel.app', false);
cek('server pemilik: tanpa kunci tetap Pro + menu Database, tidak pernah terkunci', pemilik.sah && pemilik.edisi === 'pro' && pemilik.pemilik && menuBoleh('database-pts', pemilik));
cek('saklar di repo mati (server pemilik)', /WAJIB_LISENSI: boolean = false/.test(readFileSync('lib/lisensi/mode.ts', 'utf8')));
const lamaEnv = process.env.LISENSI_KUNCI;
delete process.env.LISENSI_KUNCI;
const paket = statusLisensi('wm.pelanggan.com', true);
if (lamaEnv !== undefined) process.env.LISENSI_KUNCI = lamaEnv;
cek('paket pelanggan tanpa kunci -> terkunci', !paket.sah && paket.alasan === 'tidak-ada');

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
