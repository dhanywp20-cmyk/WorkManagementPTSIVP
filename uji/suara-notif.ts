/**
 * uji/suara-notif.ts - pengaturan suara notifikasi dari Admin Panel: bawaan saat belum diatur /
 * rusak, URL hanya https atau jalur lokal, volume dijepit, batas tipe, ukuran & durasi berkas.
 *
 * Jalankan: npx tsx uji/suara-notif.ts
 */
import { bacaSuaraNotif, BERKAS_BAWAAN, periksaBerkasSuara, periksaDurasiSuara, SUARA_BAWAAN, sumberSuara, urlSuaraSah } from '../lib/suara-notif-bawaan';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const sama = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

console.log('\nBaca pengaturan');
cek('belum diatur / rusak -> bawaan (denting, volume 0,55)', sama(bacaSuaraNotif(null), SUARA_BAWAAN) && sama(bacaSuaraNotif('{rusak'), SUARA_BAWAAN) && sama(bacaSuaraNotif([1]), SUARA_BAWAAN));
const u = 'https://x.supabase.co/storage/v1/object/public/merek-files/suara/a.mp3';
cek('teks JSON tersimpan dibaca', sama(bacaSuaraNotif(JSON.stringify({ url: u, nama: 'Bel', volume: 0.8 })), { url: u, nama: 'Bel', volume: 0.8 }));
cek('volume dijepit 0,1 - 1', bacaSuaraNotif({ volume: 5 }).volume === 1 && bacaSuaraNotif({ volume: 0 }).volume === 0.1);
cek('tanpa url: nama selalu "Bawaan" walau nama tersimpan', bacaSuaraNotif({ nama: 'Bel lama' }).nama === SUARA_BAWAAN.nama);
cek('sumber = url, atau /notif.wav bila bawaan', sumberSuara(bacaSuaraNotif({ url: u })) === u && sumberSuara(SUARA_BAWAAN) === BERKAS_BAWAAN);

console.log('\nURL aman');
cek('https & jalur lokal diterima', urlSuaraSah(u) === u && urlSuaraSah('/suara/a.mp3') === '/suara/a.mp3');
cek('http, javascript:, data:, //host ditolak', [ 'http://a/b.mp3', 'javascript:alert(1)', 'data:audio/wav;base64,AA', '//evil/a.mp3', '' ].every(x => urlSuaraSah(x) === null));

console.log('\nBerkas unggahan');
cek('MP3 500 KB boleh', periksaBerkasSuara('audio/mpeg', 500_000) === null);
cek('gambar ditolak, 2 MB ditolak, kosong ditolak', !!periksaBerkasSuara('image/png', 10) && !!periksaBerkasSuara('audio/wav', 2 * 1048576) && !!periksaBerkasSuara('audio/ogg', 0));
cek('durasi 1,65 s boleh; 10 s & tak terbaca ditolak', periksaDurasiSuara(1.65) === null && !!periksaDurasiSuara(10) && !!periksaDurasiSuara(NaN));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
