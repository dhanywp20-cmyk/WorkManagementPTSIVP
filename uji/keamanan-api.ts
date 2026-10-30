/**
 * uji/keamanan-api.ts - penjaga regresi audit keamanan 30 Okt 2026.
 *
 * 1. Setiap route di app/api WAJIB memeriksa sesi / token SENDIRI. proxy.ts hanya memeriksa ADA-nya cookie
 *    ivp_session (bukan keabsahannya), jadi route tanpa pemeriksaan sendiri terbuka bagi cookie palsu - begitulah
 *    /api/ai/generate (token Gemini perusahaan) dan pengiriman /api/notifikasi/telegram ditemukan terbuka.
 *    Route yang memang publik harus tercantum di PUBLIK beserta alasannya.
 * 2. Lembar cetak: escObjek meng-escape semua teks (XSS tersimpan di jendela cetak), urlAman hanya http(s) / jalur.
 *
 * Jalankan: npx tsx uji/keamanan-api.ts
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { escObjek, urlAman } from '../lib/lembar-cetak';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, info = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${info ? ` - ${info}` : ''}`); }
}

/** Pemeriksaan sesi / token yang sah di route (diverifikasi ke tabel, bukan sekadar ada-nya cookie). */
const PENJAGA = /pastikanMasuk|pastikanAdmin|getSessionUser|ambilAkun|verifikasiToken|jawabMonitor|CRON_SECRET|cariChecklistShare|tokenSah|pesertaDari|muatKelasToken/;
/** Route publik yang disengaja. */
const PUBLIK: Record<string, string> = {
  'auth/login': 'masuk', 'auth/login-2fa': 'masuk tahap 2 (tantangan bertanda tangan)', 'auth/logout': 'keluar',
  'auth/forgot-password': 'minta OTP (dibatasi per username)', 'auth/verify-otp': 'ganti password dengan OTP (dibatasi)',
  'auth/register': 'pendaftaran akun tamu (Pending Approval)', 'auth/session': 'cek sesi milik cookie sendiri',
  'auth/2fa': 'tantangan 2FA', 'health': 'tanda hidup tanpa DB', 'galat': 'laporan galat klien (dibatasi)',
  'push/vapid-public-key': 'kunci publik', 'android': 'info rilis aplikasi', 'android/unduh': 'unduh APK',
  'kelas/[token]': 'kelas eksternal: token kelas (TOKEN_SAH) + token peserta (x-peserta, di-hash)',
};

const rute: string[] = [];
const jelajah = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) jelajah(p); else if (n === 'route.ts') rute.push(p); } };
jelajah('app/api');

console.log(`\n1. ${rute.length} route API memeriksa sesi / token sendiri`);
for (const p of rute.sort()) {
  const kunci = p.replace(/\\/g, '/').replace(/^app\/api\//, '').replace(/\/route\.ts$/, '');
  const isi = readFileSync(p, 'utf8');
  if (PUBLIK[kunci]) { cek(`${kunci}: publik (${PUBLIK[kunci]})`, true); continue; }
  cek(`${kunci}: dijaga`, PENJAGA.test(isi), 'tidak ada pemeriksaan sesi/token - tambahkan penjaga atau daftarkan sebagai PUBLIK beserta alasannya');
}
//  Telegram: penjaga harus berada SEBELUM sendMessage pada jalur kirim biasa (aksi lain punya penjaga sendiri).
const tg = readFileSync('app/api/notifikasi/telegram/route.ts', 'utf8');
const iKirim = tg.indexOf('/sendMessage'), iJaga = tg.lastIndexOf('pastikanMasuk(req)', iKirim);
cek('telegram: jalur kirim biasa memanggil pastikanMasuk sebelum sendMessage', iKirim > 0 && iJaga > tg.indexOf("body.aksi === 'putuskan'"));
const ai = readFileSync('app/api/ai/generate/route.ts', 'utf8');
cek('ai/generate: sesi diperiksa sebelum token Gemini dibaca', ai.indexOf('pastikanMasuk(request)') > 0 && ai.indexOf('pastikanMasuk(request)') < ai.indexOf("bacaRahasia('ai.gemini_token"));

console.log('\n2. Lembar cetak: escape & tautan aman');
const t = escObjek({ project_name: '<img src=x onerror=alert(1)>', n: 3, activity_logs: [{ notes: '"><script>x</script>', ok: true }] });
cek('teks di-escape (termasuk di dalam array log)', t.project_name === '&lt;img src=x onerror=alert(1)&gt;' && t.activity_logs[0].notes === '&quot;&gt;&lt;script&gt;x&lt;/script&gt;');
cek('angka & boolean tidak diubah', t.n === 3 && t.activity_logs[0].ok === true);
cek('urlAman: https & jalur aplikasi lolos', urlAman('https://x.supabase.co/a.png') === 'https://x.supabase.co/a.png' && urlAman('/ticketing') === '/ticketing');
cek('urlAman: javascript:, data:, //luar ditolak', urlAman('javascript:alert(1)') === '' && urlAman(' JaVaScRiPt:x') === '' && urlAman('data:text/html,x') === '' && urlAman('//evil.com') === '');
for (const f of ['app/(portal)/ticketing/_components/cetak-ticket.ts', 'app/(portal)/form-require-project/_components/cetak-request.ts']) {
  const isi = readFileSync(f, 'utf8');
  cek(`${f.split('/').pop()}: data di-escape lewat escObjek sebelum ditulis`, /= escObjek\(asli\)/.test(isi) && isi.indexOf('escObjek(asli)') < isi.indexOf('document.write'));
}

console.log(`\n${lulus}/${lulus + gagal} lulus`);
process.exit(gagal ? 1 : 0);
