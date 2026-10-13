/**
 * uji/ringkasan-share-progres.ts - angka ringkasan link View-Only Project Progress
 * (app/project-progress/share/[token]/_bagian/hitung-ringkasan.ts).
 *
 * Jalankan: npm test -- ringkasan-share-progres
 */
import { readFileSync } from 'fs';
import { hitungRingkasan, MAKS_HARI_LAJU } from '../app/project-progress/share/[token]/_bagian/hitung-ringkasan';
import type { ChecklistItem } from '../lib/checklist';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

let no = 0;
const item = (daftar_id: string, o: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id: `i${++no}`, daftar_id, bagian_id: 'b', kelompok: '', teks: 't', catatan: '', urutan: no,
  selesai: false, selesai_oleh: null, selesai_pada: null, selesai_lewat: null,
  kendala: false, kendala_catatan: '', kendala_oleh: null, kendala_pada: null, foto_url: null, foto_thumb_url: null, ...o,
});

const HARI = '2026-10-13';
const daftar = [
  { id: 'a', judul: 'Banten', target_date: '2026-10-01' },
  { id: 'b', judul: 'Bali', target_date: '2026-10-10' },
  { id: 'c', judul: 'NTB', target_date: '2026-10-15' },
  { id: 'd', judul: 'Kosong', target_date: null },
];
const items = [
  item('a', { selesai: true, selesai_oleh: 'Ade', selesai_pada: '2026-10-01T03:00:00Z' }),
  item('a', { selesai: true, selesai_oleh: 'Ade', selesai_pada: '2026-10-02T03:00:00Z' }),
  item('b', { selesai: true, selesai_oleh: 'Yoga', selesai_pada: '2026-10-02T04:00:00Z' }),
  item('b', { kendala: true }),
  item('c'), item('c'),
];
const r = hitungRingkasan({ start_date: '2026-09-25', target_date: '2026-10-23' }, daftar, items, HARI);

console.log('\n1. Total & lokasi');
cek('progres total 3/6 = 50%', r.total.selesai === 3 && r.total.total === 6 && r.persen === 50);
cek('kendala aktif 1', r.total.kendala === 1);
cek('status lokasi: 1 selesai, 1 berjalan, 1 belum, 1 tanpa item', r.perStatus.selesai === 1 && r.perStatus.berjalan === 1 && r.perStatus.belum === 1 && r.perStatus.kosong === 1);
cek('lokasi selesai tidak dihitung terlambat walau target lewat', r.lokasi[0].jadwal === 'selesai');
cek('Bali terlambat (target 10 Okt, belum tuntas)', r.lokasi[1].jadwal === 'terlambat' && r.lokasiTerlambat === 1);
cek('NTB target 2 hari lagi = dekat', r.lokasi[2].jadwal === 'dekat');

console.log('\n2. Waktu');
cek('hari berjalan 18', r.hariBerjalan === 18);
cek('sisa 10 hari', r.sisaHari === 10);
cek('waktu terpakai 18/28 = 64%', r.waktuPersen === 64);
const tanpaTgl = hitungRingkasan({ start_date: null, target_date: null }, daftar, items, HARI);
cek('tanpa tanggal proyek -> waktu null', tanpaTgl.waktuPersen === null && tanpaTgl.sisaHari === null);

console.log('\n3. Orang & laju');
cek('Ade 2, Yoga 1 (urut terbanyak)', r.perOrang[0].nama === 'Ade' && r.perOrang[0].jumlah === 2 && r.perOrang[1].jumlah === 1);
cek('laju dari hari pertama aktivitas s.d. hari ini', r.laju[0].tanggal === '2026-10-01' && r.laju[r.laju.length - 1].tanggal === HARI);
cek('kumulatif akhir = total selesai bertanggal', r.laju[r.laju.length - 1].kumulatif === 3);
const lama = hitungRingkasan({ start_date: null, target_date: null }, daftar,
  [item('a', { selesai: true, selesai_pada: '2026-01-01T03:00:00Z' }), item('a', { selesai: true, selesai_pada: '2026-10-12T03:00:00Z' })], HARI);
cek(`laju dibatasi ${MAKS_HARI_LAJU} hari, kumulatif tetap membawa yang lama`, lama.laju.length === MAKS_HARI_LAJU && lama.laju[0].kumulatif === 1 && lama.laju[lama.laju.length - 1].kumulatif === 2);
const kosong = hitungRingkasan({ start_date: null, target_date: null }, [], [], HARI);
cek('proyek kosong tidak meledak', kosong.persen === 0 && kosong.laju.length === 0 && kosong.lokasi.length === 0);

console.log('\n4. Halaman');
const hal = readFileSync('app/project-progress/share/[token]/page.tsx', 'utf8');
cek('halaman memakai ringkasan', /<RingkasanProyek r=\{ringkasan\} \/>/.test(hal));
cek('desktop: lokasi grid 2 kolom', /lg:grid-cols-2/.test(hal));
cek('tanpa kueri tambahan (hanya route share yang sama)', (hal.match(/fetch\(/g) ?? []).length === 1);

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
