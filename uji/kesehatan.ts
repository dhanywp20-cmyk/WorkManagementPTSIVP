/**
 * uji/kesehatan.ts - aturan peringatan halaman Admin Panel -> Sistem -> Kesehatan Sistem.
 *
 * Jalankan: npx tsx uji/kesehatan.ts
 */
import { readFileSync } from 'fs';
import { ringkasKesehatan, BATAS_DB, type DataKesehatan } from '../lib/kesehatan';
import { KATALOG_EVENT, eventTersambung } from '../lib/notifikasi/katalog';
import { kanalUntuk, BAWAAN } from '../lib/notifikasi/pengaturan';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

const sekarang = Date.parse('2026-10-07T03:00:00Z');
const jamLalu = (j: number) => new Date(sekarang - j * 3_600_000).toISOString();
const sehat: DataKesehatan = {
  sistem: { db_bytes: 30e6, tabel: [], bucket: [{ bucket: 'ticket-photos', bytes: 40e6, jumlah: 150 }], cron: [], pemicu_http: [], fungsi_berahasia: [] },
  sqlBelum: false,
  cronVercel: { escalate: { waktu: jamLalu(19), ok: true, ringkas: '0 ticket' }, digest: { waktu: jamLalu(21), ok: true, ringkas: '5 penerima' } },
  ai: { jam24: 3, hari7: 20 }, waJam24: 2, apkTerakhir: null, kanal: { in_app: true, whatsapp: true, telegram: true },
  env: { serviceRole: true, cronSecret: true },
  galatKlien: [],
};

console.log('\nKesehatan sistem');
cek('semua normal -> tanpa peringatan', ringkasKesehatan(sehat, sekarang).length === 0);
const macet = ringkasKesehatan({ ...sehat, cronVercel: { ...sehat.cronVercel, escalate: { waktu: jamLalu(36), ok: true, ringkas: "" } } }, sekarang);
cek('cron tidak jalan > 30 jam -> merah', macet.length === 1 && macet[0].tingkat === 'merah' && macet[0].teks.includes('Eskalasi'));
const gagalJalan = ringkasKesehatan({ ...sehat, cronVercel: { ...sehat.cronVercel, digest: { waktu: jamLalu(1), ok: false, ringkas: 'timeout' } } }, sekarang);
cek('cron gagal -> merah dengan alasannya', gagalJalan[0]?.tingkat === 'merah' && gagalJalan[0].teks.includes('timeout'));
cek('cron belum pernah tercatat -> kuning', ringkasKesehatan({ ...sehat, cronVercel: {} }, sekarang).filter(p => p.tingkat === 'kuning').length === 2);
const rahasia = ringkasKesehatan({ ...sehat, sistem: { ...sehat.sistem!, fungsi_berahasia: ['check_pending_tickets'], pemicu_http: [{ trigger: 'on_ticket_assigned', tabel: 'tickets', fungsi: 'handle_ticket_assignment' }] } }, sekarang);
cek('fungsi berahasia & trigger HTTP -> dua peringatan merah', rahasia.filter(p => p.tingkat === 'merah').length === 2);
const galatRamai = ringkasKesehatan({ ...sehat, galatKlien: [{ pesan: 'TypeError: x', jalur: '/ticketing', sumber: 'halaman', jumlah: 25, terakhir: jamLalu(2), hari: '2026-10-07' }] }, sekarang);
cek('galat di layar >= 20 dalam 24 jam -> kuning', galatRamai.length === 1 && galatRamai[0].tingkat === 'kuning');
cek('galat lama (> 24 jam) tidak memicu peringatan', ringkasKesehatan({ ...sehat, galatKlien: [{ pesan: 'x', jalur: null, sumber: null, jumlah: 99, terakhir: jamLalu(30), hari: '2026-10-06' }] }, sekarang).length === 0);
const penuh = ringkasKesehatan({ ...sehat, sistem: { ...sehat.sistem!, db_bytes: BATAS_DB * 0.9 } }, sekarang);
cek('DB 90% -> kuning; 96% -> merah', penuh[0]?.tingkat === 'kuning' && ringkasKesehatan({ ...sehat, sistem: { ...sehat.sistem!, db_bytes: BATAS_DB * 0.96 } }, sekarang)[0]?.tingkat === 'merah');
cek('migrasi 036 belum -> kuning', ringkasKesehatan({ ...sehat, sistem: null, sqlBelum: true }, sekarang).some(p => p.teks.includes('036')));
const env = ringkasKesehatan({ ...sehat, env: { serviceRole: false, cronSecret: false }, sqlBelum: true, sistem: null }, sekarang);
cek('kunci Vercel hilang -> merah, diurutkan sebelum kuning', env[0].tingkat === 'merah' && env[1].tingkat === 'merah' && env[env.length - 1].tingkat === 'kuning');

const diriSendiri = ringkasKesehatan({ ...sehat, sistem: { ...sehat.sistem!, fungsi_berahasia: ['kesehatan_sistem'] } }, sekarang);
cek('kesehatan_sistem tidak menandai dirinya sendiri (alert merah palsu tiap hari)', diriSendiri.length === 0);
const campur = ringkasKesehatan({ ...sehat, sistem: { ...sehat.sistem!, fungsi_berahasia: ['kesehatan_sistem', 'check_pending_tickets'] } }, sekarang);
cek('fungsi berahasia sungguhan tetap merah', campur.length === 1 && campur[0].teks.includes('check_pending_tickets') && !campur[0].teks.includes('kesehatan_sistem'));
cek('alert kesehatan terdaftar & tersambung ke saklar per-kejadian Admin Panel', !!KATALOG_EVENT.find(e => e.key === 'system.health_alert') && eventTersambung('system.health_alert'));
const tgNyala = { ...BAWAAN, aktif: { ...BAWAAN.aktif, telegram: true } };
cek('bawaan: alert lewat Telegram', kanalUntuk('system.health_alert', tgNyala).includes('telegram'));
cek('dimatikan di Admin Panel -> tidak lewat Telegram', !kanalUntuk('system.health_alert', { ...tgNyala, perEvent: { 'system.health_alert': [] } }).includes('telegram'));
cek('kirimAlertKesehatan memeriksa saklar per-kejadian', /kanalUntuk\('system\.health_alert', pengaturan\)\.includes\('telegram'\)/.test(readFileSync('lib/kesehatan-server.ts', 'utf8')));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
