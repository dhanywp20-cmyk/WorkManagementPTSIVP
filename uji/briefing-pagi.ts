/**
 * uji/briefing-pagi.ts - saklar Briefing Pagi & aturan alert Telegram kesehatan sistem.
 *
 * Jalankan: npx tsx uji/briefing-pagi.ts
 */
import { rapikanBriefing, BRIEFING_BAWAAN } from '../lib/briefing-pagi';
import { pesanAlert, perluKirimAlert, sidikPeringatan, JEDA_ALERT_JAM } from '../lib/kesehatan-server';
import type { Peringatan } from '../lib/kesehatan';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\nSaklar Briefing Pagi');
cek('belum pernah diatur -> bawaan: semuanya menyala', JSON.stringify(rapikanBriefing(undefined)) === JSON.stringify(BRIEFING_BAWAAN) && BRIEFING_BAWAAN.aktif && BRIEFING_BAWAAN.pengingatDailyReport);
cek('objek tersimpan dibaca apa adanya', (() => { const p = rapikanBriefing({ aktif: false, pengingatDailyReport: true }); return !p.aktif && p.pengingatDailyReport; })());
cek('hanya pengingat Daily Report dimatikan', (() => { const p = rapikanBriefing({ aktif: true, pengingatDailyReport: false }); return p.aktif && !p.pengingatDailyReport; })());
cek('teks JSON (gaya pengaturan notifikasi) ikut terbaca', !rapikanBriefing('{"aktif":false}').aktif);
cek('nilai rusak / bukan boolean -> bawaan menyala, bukan mati', (() => { const p = rapikanBriefing({ aktif: 'tidak', pengingatDailyReport: 0 }); return p.aktif && p.pengingatDailyReport; })());
cek('JSON rusak -> bawaan', rapikanBriefing('{bukan json').aktif === true);

console.log('\nAlert Telegram kesehatan');
const merah: Peringatan[] = [{ tingkat: 'merah', teks: 'Cron "Briefing pagi" tidak jalan sejak 40 jam lalu' }, { tingkat: 'merah', teks: 'CRON_SECRET belum diisi' }];
const teks = pesanAlert(merah);
cek('pesan memuat jumlah, tiap peringatan bernomor, dan petunjuk ke halaman', teks.includes('2 peringatan merah') && teks.includes('1. Cron') && teks.includes('2. CRON_SECRET') && teks.includes('Kesehatan Sistem'));
const sidik = sidikPeringatan(merah);
const sekarang = Date.parse('2026-10-07T01:00:00Z');
cek('belum pernah dikirim -> kirim', perluKirimAlert(sidik, null, sekarang));
cek('isi sama, baru 2 jam lalu -> tidak dikirim lagi (cron kedua di hari yang sama)', !perluKirimAlert(sidik, { sidik, waktu: new Date(sekarang - 2 * 3_600_000).toISOString() }, sekarang));
cek(`isi sama, > ${JEDA_ALERT_JAM} jam -> kirim ulang (pengingat harian)`, perluKirimAlert(sidik, { sidik, waktu: new Date(sekarang - 25 * 3_600_000).toISOString() }, sekarang));
cek('isi berubah (masalah baru) -> langsung kirim walau baru dikirim', perluKirimAlert(sidikPeringatan([...merah, { tingkat: 'merah', teks: 'masalah baru' }]), { sidik, waktu: new Date(sekarang - 1 * 3_600_000).toISOString() }, sekarang));
cek('sidik stabil untuk isi yang sama', sidikPeringatan(merah) === sidikPeringatan([...merah]));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
