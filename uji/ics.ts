/**
 * uji/ics.ts - berkas kalender .ics: WIB -> UTC, acara sehari penuh, escape teks, lipatan baris 75
 * oktet (termasuk karakter multi-byte), struktur VCALENDAR/VEVENT/VALARM.
 *
 * Jalankan: npx tsx uji/ics.ts
 */
import { buatIcs, escIcs, lipat, utcDariWib } from '../lib/ics';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const tetap = new Date(Date.UTC(2026, 9, 9, 3, 4, 5));

console.log('\nWaktu');
cek('09:30 WIB = 02:30 UTC', utcDariWib('2026-10-12', '09:30') === '20261012T023000Z');
cek('03:00 WIB = hari sebelumnya 20:00 UTC', utcDariWib('2026-10-12', '03:00') === '20261011T200000Z');
cek('durasi menambah menit (09:30 + 120)', utcDariWib('2026-10-12', '09:30', 120) === '20261012T043000Z');
const ics = buatIcs({ uid: 'r1', judul: 'Demo Product - Gedung Sate', tanggal: '2026-10-12', jam: '09:30', lokasi: 'Jl. Diponegoro, Bandung', keterangan: 'Sales: Budi\nPIC: Sari' }, tetap);
cek('DTSTART/DTEND UTC', ics.includes('DTSTART:20261012T023000Z') && ics.includes('DTEND:20261012T043000Z'));
const sehari = buatIcs({ uid: 'r2', judul: 'Standby Event', tanggal: '2026-12-31', jam: '' }, tetap);
cek('tanpa jam = sehari penuh, akhir = hari berikut (lintas tahun)', sehari.includes('DTSTART;VALUE=DATE:20261231') && sehari.includes('DTEND;VALUE=DATE:20270101'));

console.log('\nTeks & format');
cek('escape koma, titik koma, garis miring terbalik, baris baru', escIcs('a,b;c\\d\ne') === 'a\\,b\\;c\\\\d\\ne');
cek('lokasi koma ter-escape', ics.includes('LOCATION:Jl. Diponegoro\\, Bandung'));
cek('baris dipisah CRLF, diawali VCALENDAR & diakhiri END:VCALENDAR', ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
cek('pengingat 1 jam sebelumnya', ics.includes('BEGIN:VALARM') && ics.includes('TRIGGER:-PT1H'));
const panjang = lipat('DESCRIPTION:' + 'é'.repeat(80));
const enc = new TextEncoder();
cek('lipatan: tiap baris ≤ 75 oktet & lanjutan diawali spasi', panjang.split('\r\n').every(b => enc.encode(b).length <= 75) && panjang.split('\r\n').slice(1).every(b => b.startsWith(' ')));
cek('baris pendek tidak dilipat', lipat('SUMMARY:x') === 'SUMMARY:x');

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
