/**
 * uji/modal-seragam.ts - semua popup memakai SATU wujud: kerangka Modal bersama, atau (untuk kerangka khusus
 * seperti form tiga kolom / detail dua panel) KepalaModal + latar & kartu yang sama nilainya.
 *
 * Dulu tiap menu punya latar (bg-black/40..70), kartu (rounded-2xl/3xl), kepala bergradasi berwarna sendiri
 * (merah Ticketing, cyan Schedule, teal Design, ungu Review, merah-ungu Incentive, dst) dan tombol kirim
 * berwarna per menu. Permintaan pemilik: tidak ada menu yang punya tema/pola sendiri.
 *
 * Jalankan: npm test -- modal-seragam
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean, ket = '') => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}${ket ? ' - ' + ket : ''}`); } };
function semua(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? semua(p) : p.endsWith('.tsx') ? [p] : [];
  });
}
//  Pengecualian yang disengaja: layar masuk adalah halaman penuh (bukan popup), dan hero Profil memakai warna
//  MEREK (bukan warna menu) untuk menyapa pemilik akun - tombol tutupnya putih karena duduk di atas hero itu.
const KECUALI = ['_kerangka/LayarMasuk.tsx'];
const KECUALI_TUTUP = ['dashboard/_components/modal-profil.tsx'];
const ditulis = (f: string, daftar: string[]) => daftar.some(k => f.replace(/\\/g, '/').endsWith(k));
const berkas = semua('app/(portal)').filter(f => !ditulis(f, KECUALI)).map(f => ({ f, s: readFileSync(f, 'utf8') }));

console.log('\n1. Kerangka bersama');
const modal = readFileSync('components/shared/Modal.tsx', 'utf8');
cek('KepalaModal dipakai Modal sendiri (satu sumber kepala)', /<KepalaModal judul=\{judul\}/.test(modal) && /export function KepalaModal/.test(modal));
cek('kelas tombol baku ada di globals.css', /\.tombol-utama \{[^}]*--merek-utama/.test(readFileSync('app/globals.css', 'utf8')) && /\.tombol-kedua/.test(readFileSync('app/globals.css', 'utf8')) && /\.tombol-bahaya/.test(readFileSync('app/globals.css', 'utf8')));
const formActions = readFileSync('components/shared/FormActions.tsx', 'utf8');
cek('tombol kirim form selalu warna merek', /var\(--merek-utama\), var\(--merek-utama-2\)/.test(formActions) && !/background: gradient/.test(formActions));
const pakaiGradien = berkas.filter(x => /<SubmitFormButton[\s\S]{0,400}?gradient=/.test(x.s)).map(x => x.f);
cek('tidak ada menu yang memberi warna sendiri pada tombol kirim form', pakaiGradien.length === 0, pakaiGradien.join(', '));

console.log('\n2. Popup tidak lagi merakit latar & kartu sendiri');
//  Baris overlay dialog: role="dialog" + fixed inset-0 di satu tag pembuka.
const latarSendiri = berkas.filter(x => /role="dialog"[^>]*className="fixed inset-0[^"]*bg-black\/\d0/.test(x.s) || /className="fixed inset-0[^"]*bg-black\/\d0[^"]*"[^>]*role="dialog"/.test(x.s)).map(x => x.f);
cek('tidak ada latar dialog bg-black/NN sendiri', latarSendiri.length === 0, latarSendiri.join(', '));
const kartuLama = berkas.filter(x => /role="dialog"/.test(x.s) && /bg-white(?:\/9[05])?(?: backdrop-blur-(?:md|sm))? rounded-(?:2xl|3xl) shadow-2xl/.test(x.s)).map(x => x.f);
cek('kartu popup memakai rounded-kartu shadow-modal', kartuLama.length === 0, kartuLama.join(', '));
const tutupLama = berkas.filter(x => !ditulis(x.f, KECUALI_TUTUP) && /aria-label="Tutup"[^>]*className="[^"]*(?:bg-white\/(?:10|15|20) hover:bg-white\/(?:20|25|30) text-white|rounded-full bg-black\/20 hover:bg-black\/35 text-white)/.test(x.s)).map(x => x.f);
cek('tombol tutup baku (bukan putih-transparan di kepala berwarna)', tutupLama.length === 0, tutupLama.join(', '));

console.log('\n3. Menu utama memakai Modal / KepalaModal');
const WAJIB: Record<string, RegExp> = {
  'ticketing/_components/NewTicketModal.tsx': /<Modal buka/,
  'ticketing/_components/AdminEditModal.tsx': /<Modal buka/,
  'reminder-schedule/_components/ReminderFormModal.tsx': /<KepalaModal/,
  'reminder-schedule/_components/RescheduleModal.tsx': /<Modal buka/,
  'form-require-project/_components/Modals.tsx': /<KepalaModal/,
  'form-review/_components/ModalFormReview.tsx': /<KepalaModal/,
  'incentive-pts/_components/ModalKonfirmBatch.tsx': /<Modal buka/,
};
for (const [f, re] of Object.entries(WAJIB)) cek(f, re.test(readFileSync(`app/(portal)/${f}`, 'utf8')));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
