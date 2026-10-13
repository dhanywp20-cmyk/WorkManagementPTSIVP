/**
 * uji/ringkasan-share-progres.ts - angka ringkasan link View-Only Project Progress
 * (app/project-progress/share/[token]/_bagian/hitung-ringkasan.ts).
 *
 * Jalankan: npm test -- ringkasan-share-progres
 */
import { readFileSync } from 'fs';
import { hitungRingkasan, MAKS_HARI_LAJU, ringkasChecklist, ringkasDaftarProyek, ringkasDariLokasi } from '../app/(portal)/project-progress/_components/ringkasan/hitung';
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

console.log('\n4. Detail proyek, daftar proyek, checklist');
const dl = ringkasDariLokasi({ start_date: '2026-09-25', target_date: '2026-10-23' },
  r.lokasi.map(l => ({ id: l.id, judul: l.judul, target_date: daftar.find(d => d.id === l.id)!.target_date, stat: l.stat })), null, HARI);
cek('dari angka per lokasi = hasil dari item (total, status, jadwal)', dl.persen === r.persen && JSON.stringify(dl.perStatus) === JSON.stringify(r.perStatus) && dl.lokasiTerlambat === r.lokasiTerlambat);
cek('tanpa item: tanpa "dikerjakan oleh" & laju', dl.perOrang.length === 0 && dl.laju.length === 0);
const pr = (id: string, status: 'in_progress' | 'done' | 'blocked', target: string | null, total: number, selesai: number, kendala = 0) =>
  ({ id, nama: id, status, target_date: target, target_terdekat: null, stat: { total, selesai, kendala } }) as unknown as Parameters<typeof ringkasDaftarProyek>[0][number];
const rd = ringkasDaftarProyek([pr('A', 'in_progress', '2026-10-01', 10, 5, 1), pr('B', 'done', null, 4, 4), pr('C', 'blocked', '2026-12-01', 0, 0)], HARI);
cek('daftar: per status', rd.perStatus.in_progress === 1 && rd.perStatus.done === 1 && rd.perStatus.blocked === 1);
cek('daftar: A terlambat, B selesai, C aman', rd.perJadwal.terlambat === 1 && rd.perJadwal.selesai === 1 && rd.perJadwal.aman === 1);
cek('daftar: item dijumlah', rd.item.total === 14 && rd.item.selesai === 9 && rd.item.kendala === 1);
cek('daftar: progres hanya proyek berjalan yang ada item', rd.progres.length === 1 && rd.progres[0].label === 'A' && rd.progres[0].value === 50);
const bag = [{ id: 'b1', daftar_id: 'a', judul: 'Instalasi', catatan: '', urutan: 0 }, { id: 'b2', daftar_id: 'a', judul: 'Uji', catatan: '', urutan: 1 }, { id: 'b3', daftar_id: 'a', judul: 'Catatan', catatan: 'x', urutan: 2 }];
const its = [item('a', { bagian_id: 'b1', selesai: true, selesai_oleh: 'Ade', selesai_pada: '2026-10-12T03:00:00Z' }), item('a', { bagian_id: 'b1', selesai: true, selesai_oleh: 'Ade', selesai_pada: '2026-10-13T03:00:00Z' }), item('a', { bagian_id: 'b2' })];
const rc = ringkasChecklist({ start_date: '2026-10-01', target_date: '2026-10-20' }, bag, its, HARI);
cek('checklist: 2/3 = 67%', rc.persen === 67 && rc.total.total === 3);
cek('checklist: bagian tanpa item tidak dihitung', rc.jumlahBagian === 2 && rc.bagianSelesai === 1);
cek('checklist: per bagian %', rc.perBagian[0].value === 100 && rc.perBagian[1].value === 0);
cek('checklist: orang & laju', rc.perOrang[0].nama === 'Ade' && rc.laju.length === 2 && rc.sisaHari === 7);

console.log('\n5. Halaman');
const depan = readFileSync('app/(portal)/project-progress/page.tsx', 'utf8');
cek('tampilan depan: donat & progres proyek', /<RingkasanDaftarProyek r=\{ringkasanDaftar\} \/>/.test(depan));
cek('detail proyek: ringkasan', /<RingkasanProyek r=\{ringkasDariLokasi\(/.test(readFileSync('app/(portal)/project-progress/_components/DetailProyek.tsx', 'utf8')));
cek('detail checklist: ringkasan (terlipat di HP)', /<LipatRingkasan hpTerlipat>\s*<RingkasanChecklist/.test(readFileSync('app/(portal)/project-progress/_components/DetailChecklist.tsx', 'utf8')));
cek('link checklist tim: ringkasan (terlipat di HP)', /<LipatRingkasan hpTerlipat>\s*<RingkasanChecklist/.test(readFileSync('app/checklist/share/[token]/page.tsx', 'utf8')));
const hal = readFileSync('app/project-progress/share/[token]/page.tsx', 'utf8');
cek('halaman memakai ringkasan', /<RingkasanProyek r=\{ringkasan\} \/>/.test(hal));
cek('desktop: lokasi grid 2 kolom', /lg:grid-cols-2/.test(hal));
cek('detail lokasi di panel samping, bukan menumpuk ke bawah', /<PanelLokasi /.test(hal) && !/lg:col-span-2/.test(hal));
cek('item selesai tanpa coretan', !/line-through/.test(readFileSync('app/(portal)/project-progress/_components/tampilan.tsx', 'utf8')));
cek('tanpa kueri tambahan (hanya route share yang sama)', (hal.match(/fetch\(/g) ?? []).length === 1);

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
