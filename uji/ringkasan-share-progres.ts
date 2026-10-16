/**
 * uji/ringkasan-share-progres.ts - ringkasan & grafik Project Progress (semua tampilan):
 * angka (app/(portal)/project-progress/_components/ringkasan/hitung.ts), "Dikerjakan Oleh" hanya
 * handler (lib/checklist-ringkasan.ts), dan aturan "tiap fakta tampil sekali".
 *
 * Jalankan: npm test -- ringkasan-share-progres
 */
import { readFileSync } from 'fs';
import {
  hitungRingkasan, MAKS_HARI_LAJU, lajuDariPeta, ringkasChecklist, ringkasDaftarProyek, ringkasDariLokasi,
} from '../app/(portal)/project-progress/_components/ringkasan/hitung';
import { aktivitasProyek, kontribusiHandler, selesaiPerHari, tanggalWIB } from '../lib/checklist-ringkasan';
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
const anggota = [{ daftar_id: 'a', nama: 'Ade' }, { daftar_id: 'b', nama: 'Yoga KS' }];
const items = [
  item('a', { selesai: true, selesai_oleh: 'Ade', selesai_pada: '2026-10-01T03:00:00Z' }),
  item('a', { selesai: true, selesai_oleh: 'Dhany (Admin)', selesai_pada: '2026-10-02T03:00:00Z' }),   // admin bantu
  item('b', { selesai: true, selesai_oleh: 'yoga ks ', selesai_pada: '2026-10-02T04:00:00Z' }),         // beda huruf/spasi
  item('b', { kendala: true }),
  item('c', { selesai: true, selesai_oleh: 'Ade', selesai_pada: '2026-10-03T04:00:00Z' }),              // Ade bukan handler di c
  item('c'),
];
const r = hitungRingkasan({ start_date: '2026-09-25', target_date: '2026-10-23' }, daftar, items, anggota, HARI);

console.log('\n1. Dikerjakan Oleh = handler saja');
cek('admin yang membantu tidak dihitung', !r.perOrang.some(o => /admin/i.test(o.nama)));
cek('nama dicocokkan tanpa beda huruf/spasi', r.perOrang.find(o => o.nama === 'Yoga KS')?.jumlah === 1);
cek('handler dihitung per checklist-nya sendiri (Ade di c bukan handler)', r.perOrang.find(o => o.nama === 'Ade')?.jumlah === 1);
cek('total kontribusi 2 dari 4 item selesai', r.perOrang.reduce((n, o) => n + o.jumlah, 0) === 2);
cek('laju tetap menghitung SEMUA item selesai (laju pekerjaan, bukan kontribusi)', r.laju[r.laju.length - 1].kumulatif === 4);
cek('tanggal per hari memakai WIB', tanggalWIB('2026-10-01T18:30:00Z') === '2026-10-02');

console.log('\n2. Proyek');
cek('progres 4/6 = 67%', r.total.selesai === 4 && r.total.total === 6 && r.persen === 67);
cek('status lokasi: 1 selesai(a), 2 berjalan(b,c), 1 tanpa item', r.perStatus.selesai === 1 && r.perStatus.berjalan === 2 && r.perStatus.kosong === 1);
cek('tenggat hanya lokasi BELUM selesai (selesai tidak diulang)', !('selesai' in r.perTenggat) && r.perTenggat.terlambat === 1 && r.perTenggat.dekat === 1 && r.perTenggat.tanpa === 1);
cek('waktu: hari ke-18 dari 28, sisa 10', r.hariBerjalan === 18 && r.sisaHari === 10 && r.waktuPersen === 64);
const dl = ringkasDariLokasi({ start_date: '2026-09-25', target_date: '2026-10-23' },
  r.lokasi.map(l => ({ id: l.id, judul: l.judul, target_date: daftar.find(d => d.id === l.id)!.target_date, stat: l.stat })),
  aktivitasProyek(items, anggota), HARI);
cek('detail proyek (agregat server) = hasil dari item', dl.persen === r.persen && JSON.stringify(dl.perOrang) === JSON.stringify(r.perOrang) && JSON.stringify(dl.laju) === JSON.stringify(r.laju));
cek('tanpa aktivitas: tanpa donat orang & laju', ringkasDariLokasi({ start_date: null, target_date: null }, [], null, HARI).perOrang.length === 0);

console.log('\n3. Laju');
const lama = lajuDariPeta({ '2026-01-01': 1, '2026-10-12': 1 }, HARI);
cek(`dibatasi ${MAKS_HARI_LAJU} hari, kumulatif membawa yang lama`, lama.length === MAKS_HARI_LAJU && lama[0].kumulatif === 1 && lama[lama.length - 1].kumulatif === 2);
cek('kosong -> tanpa grafik', lajuDariPeta({}, HARI).length === 0);
cek('selesaiPerHari mengabaikan item belum selesai', Object.values(selesaiPerHari(items)).reduce((a, b) => a + b, 0) === 4);
cek('kontribusiHandler tanpa anggota -> kosong', kontribusiHandler(items, []).length === 0);

console.log('\n4. Daftar proyek & checklist');
const pr = (id: string, div: string | null, sales: string | null, total: number, selesai: number, kendala = 0) =>
  ({ id, nama: id, status: 'in_progress', sales_division: div, sales_name: sales, stat: { total, selesai, kendala } }) as unknown as Parameters<typeof ringkasDaftarProyek>[0][number];
const rd = ringkasDaftarProyek([pr('A', 'Pegasus', 'Budi', 10, 5, 1), pr('B', 'Pegasus', 'Sari', 4, 4), pr('C', null, 'Budi', 0, 0)]);
cek('daftar: item dijumlah', rd.item.total === 14 && rd.item.selesai === 9 && rd.item.kendala === 1);
cek('daftar: per divisi (kosong -> Tanpa divisi)', rd.perDivisi[0].label === 'Pegasus' && rd.perDivisi[0].value === 2 && rd.perDivisi.some(d => d.label === 'Tanpa divisi'));
cek('daftar: per Sales', rd.perSales[0].label === 'Budi' && rd.perSales[0].value === 2);
const rc = ringkasChecklist({ start_date: '2026-10-01', target_date: '2026-10-20' }, items.filter(i => i.daftar_id === 'a'), anggota, HARI);
cek('checklist: handler saja & waktu', rc.perOrang.length === 1 && rc.perOrang[0].nama === 'Ade' && rc.sisaHari === 7 && rc.persen === 100);

console.log('\n5. Tiap fakta sekali');
const komp = readFileSync('app/(portal)/project-progress/_components/ringkasan/Ringkasan.tsx', 'utf8');
cek('tidak ada "Progres per Lokasi" / "Progres per Bagian" (sudah di kartu bawah)', !/Progres per Lokasi|Progres per Bagian|Progres Proyek Berjalan/.test(komp));
cek('donat jadwal tanpa slice "Selesai"', !/perTenggat\.selesai/.test(komp));
cek('tampilan depan tanpa donat status/jadwal (sudah di kartu filter)', !/Status Proyek|Jadwal Proyek/.test(komp));
const share = readFileSync('app/project-progress/share/[token]/page.tsx', 'utf8');
cek('View-Only: bar progres header dihapus (ada di kartu Progres)', !/BarProgres progres=\{progresDariStat\(total\)\}/.test(share));
cek('View-Only: handler dikirim ke ringkasan', /hitungRingkasan\(data\.proyek, data\.daftar, data\.items, data\.anggota/.test(share));
const detail = readFileSync('app/(portal)/project-progress/_components/DetailProyek.tsx', 'utf8');
cek('detail proyek: bar header hanya bila belum ada checklist', /checklist\.length === 0 && \(\s*<div className="flex items-center gap-3 flex-wrap">\s*<div className="flex-1 min-w-\[220px\]"><BarProgres/.test(detail));
cek('detail proyek: aktivitas dari server', /data\.aktivitas \?\? null/.test(detail));
const server = readFileSync('lib/checklist-server.ts', 'utf8');
cek('server: hanya item selesai, kolom kecil, diagregasi', /select\('daftar_id,selesai,selesai_oleh,selesai_pada'\)[\s\S]{0,80}\.eq\('selesai', true\)/.test(server) && /aktivitasProyek\(selesai,/.test(server));
cek('link tim publik: nama handler tanpa user_id', /user_id: '', nama: x\.nama/.test(server));

console.log('\n6. Panel lokasi desktop');
const panel = readFileSync('app/project-progress/share/[token]/_bagian/PanelLokasi.tsx', 'utf8');
cek('desktop lebar dengan daftar lokasi', /lg:w-\[min\(1480px,96vw\)\]/.test(panel) && /hidden lg:flex flex-col w-72/.test(panel));
cek('bagian 2 kolom di layar lebar', /xl:columns-2/.test(panel) && /break-inside-avoid/.test(panel));
cek('item selesai tanpa coretan', !/line-through/.test(readFileSync('app/(portal)/project-progress/_components/tampilan.tsx', 'utf8')));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
