/**
 * uji/eskalasi-tahap.ts - request tertahan di gerbang routing untuk briefing pagi.
 *
 * Jalankan: npx tsx uji/eskalasi-tahap.ts
 */
import { itemTahapTertahan, type BarisTahap } from '../lib/eskalasi-tahap';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const sekarang = Date.parse('2026-10-07T00:00:00Z');
const jamLalu = (j: number) => new Date(sekarang - j * 3_600_000).toISOString();
const dasar: BarisTahap = { sumber: 'Jadwal', project_name: 'Proyek A', routing_status: 'supervisor_assign', status: 'pending', assigned_supervisor_id: 'spv-1', sejak: jamLalu(30) };

console.log('\nEskalasi tahap routing');
cek('belum 24 jam -> tidak diingatkan', itemTahapTertahan([{ ...dasar, sejak: jamLalu(20) }], sekarang).length === 0);
const satu = itemTahapTertahan([dasar], sekarang);
cek('30 jam di Supervisor -> ke supervisor, ringan (push/Telegram saja)', satu.length === 1 && satu[0].penerima.join() === 'spv-1' && satu[0].ringan && !satu[0].terlambat);
const lama = itemTahapTertahan([{ ...dasar, sejak: jamLalu(60) }], sekarang);
cek('> 48 jam -> terlambat & ikut WA, label menyebut 2 hari', lama[0].terlambat && !lama[0].ringan && lama[0].label.includes('2 hari'));
const review = itemTahapTertahan([{ ...dasar, routing_status: 'internal_review', internal_sales_id: 'is-1', internal_sales_id_2: 'is-2' }], sekarang);
cek('review Sales Internal -> kedua reviewer', review[0].penerima.join() === 'is-1,is-2');
cek('tahap Admin -> semua admin', itemTahapTertahan([{ ...dasar, routing_status: 'admin_review' }], sekarang)[0].penerima.join() === 'admin');
cek('sudah selesai / dibatalkan -> dilewati', itemTahapTertahan([{ ...dasar, status: 'done' }, { ...dasar, status: 'Rejected' }], sekarang).length === 0);
cek('tanpa pemegang gerbang (supervisor kosong) -> dilewati', itemTahapTertahan([{ ...dasar, assigned_supervisor_id: null }], sekarang).length === 0);
cek('tahap di luar routing -> dilewati', itemTahapTertahan([{ ...dasar, routing_status: null }], sekarang).length === 0);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
