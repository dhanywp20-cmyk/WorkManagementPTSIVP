/**
 * uji/kpi-sumber.ts - pemilahan baris sumber KPI per periode harus sama persis dengan filter
 * .gte()/.lte() di query-nya, karena dua periode kini diambil sekali lalu dipilah di browser.
 *
 * Jalankan: npx tsx uji/kpi-sumber.ts
 */
import { saringSumberKPI, type SumberKPI } from '../lib/kpi-sumber';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

const kosong = (): SumberKPI => ({ tickets: [], actLogs: [], reminders: [], lcAttempts: [], piketRows: [], formReviews: [], techNotes: [] });
const s = kosong();
s.tickets = [
  { id: 'awal-tepat', created_at: '2026-10-01T00:00:00+00:00' },
  { id: 'sebelum', created_at: '2026-09-30T23:59:58+00:00' },
  { id: 'pecahan-detik', created_at: '2026-09-30T23:59:59.999+00:00' },
  { id: 'akhir-tepat', created_at: '2026-10-31T23:59:59+00:00' },
  { id: 'lewat-sedetik', created_at: '2026-10-31T23:59:59.5+00:00' },
  { id: 'zona-wib', created_at: '2026-11-01T06:00:00+07:00' },
  { id: 'kosong', created_at: null },
];
s.lcAttempts = [{ id: 'lc-dalam', started_at: '2026-10-15T08:00:00+00:00', created_at: '2025-01-01T00:00:00+00:00' }];
s.piketRows = [{ day_date: '2026-10-31' }, { day_date: '2026-11-01' }, { day_date: '2026-09-30' }];
s.techNotes = [{ id: 'tn', reviewed_at: '2026-10-02T00:00:00+00:00', created_at: '2026-08-01T00:00:00+00:00' }];

console.log('\nPemilahan sumber KPI');
const okt = saringSumberKPI(s, '2026-10-01', '2026-10-31');
const id = okt.tickets.map(t => t.id).sort().join(',');
cek('batas awal & akhir ikut, sebelum/sesudahnya tidak (seperti gte/lte server)', id === 'akhir-tepat,awal-tepat,zona-wib');
cek('stempel berzona dibaca sebagai waktu mutlak (06:00 WIB = 23:00 UTC hari sebelumnya)', okt.tickets.some(t => t.id === 'zona-wib'));
cek('LC disaring menurut started_at, bukan created_at', okt.lcAttempts.length === 1);
cek('tech note disaring menurut reviewed_at', okt.techNotes.length === 1);
cek('piket memakai tanggal polos: akhir bulan ikut, hari sesudah/sebelum tidak', okt.piketRows.map(p => p.day_date).join() === '2026-10-31');
cek('baris tanpa tanggal dibuang', !okt.tickets.some(t => t.id === 'kosong'));
const sep = saringSumberKPI(s, '2026-09-01', '2026-09-30');
cek('periode sebelumnya mengambil sisanya', sep.tickets.map(t => t.id).join() === 'sebelum' && sep.piketRows.length === 1);
cek('pecahan detik sesudah 23:59:59 tidak masuk periode mana pun - sama dengan lte server', !okt.tickets.some(t => t.id === 'pecahan-detik') && !sep.tickets.some(t => t.id === 'pecahan-detik'));
cek('urutan baris dipertahankan', saringSumberKPI(s, '2026-01-01', '2026-12-31').tickets.map(t => t.id).join() === 'awal-tepat,sebelum,pecahan-detik,akhir-tepat,lewat-sedetik,zona-wib');

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
