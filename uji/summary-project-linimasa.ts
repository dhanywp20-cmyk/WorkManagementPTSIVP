/**
 * uji/summary-project-linimasa.ts - Summary Project Phase 1 (quick wins), lihat docs/audit/project-summary-current-state.md.
 *
 *  1. Label status linimasa = label menu asalnya (Request Schedule STATUS_CONFIG, Design statusConfig) - dibaca dari
 *     berkas sumbernya supaya tidak bisa melenceng diam-diam.
 *  2. Terbuka / terlambat menurut aturan menu asal; tanggal Design = diajukan, Form Review = diisi (dulu "-").
 *  3. Penyaring "Belum selesai / Terlambat", penanda jadwal yang akan datang.
 *  4. Halaman: keadaan izin, galat dengan Coba Lagi (tanpa pesan teknis), kosong dengan Reset filter, konteks
 *     project di alamat (?project=), kartu mengikuti pencarian.
 *
 * Jalankan: npx tsx uji/summary-project-linimasa.ts
 */
import { readFileSync } from 'fs';
import type { DetailProject } from '../lib/summary-project';
import { bangunLinimasa, diMasaDepan, LABEL_STATUS, saringLinimasa } from '../app/(portal)/summary-project/_components/linimasa';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, info = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${info ? ` - ${info}` : ''}`); }
}

console.log('\n1. Label status = menu asal');
/** Ambil `kode: { label: '...'` dari sebuah objek konfigurasi di berkas sumber (ikon/emoji dibuang). */
const labelDari = (berkas: string, nama: string) => {
  const src = readFileSync(berkas, 'utf8');
  const blok = src.slice(src.indexOf(`export const ${nama}`), src.indexOf('};', src.indexOf(`export const ${nama}`)));
  return Object.fromEntries([...blok.matchAll(/(\w+):\s*\{\s*label:\s*'([^']+)'/g)]
    .map(m => [m[1], m[2].replace(/[^\p{L}\p{N} ]/gu, '').trim()]));
};
const sch = labelDari('app/(portal)/reminder-schedule/_components/shared.ts', 'STATUS_CONFIG');
const dsg = labelDari('app/(portal)/form-require-project/_components/shared.ts', 'statusConfig');
cek(`Request Schedule: ${JSON.stringify(LABEL_STATUS.schedule)}`, JSON.stringify(sch) === JSON.stringify(LABEL_STATUS.schedule), JSON.stringify(sch));
cek(`Design Project: ${JSON.stringify(LABEL_STATUS.design)}`, JSON.stringify(dsg) === JSON.stringify(LABEL_STATUS.design), JSON.stringify(dsg));

console.log('\n2. Linimasa');
const now = new Date(2026, 9, 31, 10);
const detail: DetailProject = {
  reminders: [
    { id: 'r1', project_name: 'X', category: 'Konfigurasi', mode_penyelesaian: 'onsite', due_date: '2026-10-20', bast_date: null, status: 'pending', assign_name: 'Andi', address: 'Jakarta' },
    { id: 'r2', project_name: 'X', category: 'Training', mode_penyelesaian: 'remote', due_date: '2026-11-05', bast_date: null, status: 'pending', assign_name: 'Budi', address: null },
    { id: 'r3', project_name: 'X', category: 'Survey', mode_penyelesaian: null, due_date: '2026-09-01', bast_date: null, status: 'done', assign_name: 'Andi', address: null },
  ],
  tickets: [
    { id: 't1', project_name: 'X', issue_case: 'Proyektor mati', description: null, status: 'Overdue', date: '2026-10-01', assign_name: 'Citra' },
    { id: 't2', project_name: 'X', issue_case: 'Audio', description: null, status: 'Solved', date: '2026-08-01', assign_name: '' },
  ],
  requests: [
    { id: 'p1', project_name: 'X', status: 'in_progress', requester_name: 'Sales A', due_date: '2026-10-25', assigned_handler: null, created_at: '2026-10-10T03:00:00Z' },
  ],
  reviews: [
    { id: 'f1', project_name: 'X', reminder_id: 'r3', review_category: 'Training', guest_fullname: 'Sales A', grade_product_knowledge: 4, grade_training_customer: 4, grade_product_knowledge_bast: null, created_at: '2026-09-02T05:00:00Z' },
  ],
  linkId: { 'reminders:r1': 'L1', 'tickets:t1': 'L2' }, tidakTampil: 0,
};
const L = bangunLinimasa(detail, now);
const cari = (id: string) => L.find(a => a.id === id)!;
cek('7 aktivitas dari 4 sumber', L.length === 7);
cek('status tampil dengan label menu asal (done -> Completed, in_progress -> In Progress)', cari('r-r3').labelStatus === 'Completed' && cari('p-p1').labelStatus === 'In Progress' && cari('t-t1').labelStatus === 'Overdue');
cek('jadwal pending lewat tanggal = terbuka & terlambat', cari('r-r1').terbuka && cari('r-r1').terlambat);
cek('jadwal pending yang akan datang = terbuka, belum terlambat', cari('r-r2').terbuka && !cari('r-r2').terlambat && diMasaDepan(cari('r-r2').tanggal, now));
cek('jadwal Completed tidak terbuka', !cari('r-r3').terbuka);
cek('ticket Overdue terlambat; Solved selesai', cari('t-t1').terlambat && !cari('t-t2').terbuka);
cek('ticket tanpa handler ditulis jelas', cari('t-t2').meta === 'Belum ada handler');
cek('Design: posisi = tanggal diajukan, deadline di keterangan, lewat deadline = terlambat',
  cari('p-p1').tanggal === '2026-10-10T03:00:00Z' && cari('p-p1').meta.includes('deadline 2026-10-25') && cari('p-p1').terlambat);
cek('Form Review punya tanggal (dulu "-") & tidak dihitung terbuka', cari('f-f1').tanggal === '2026-09-02T05:00:00Z' && !cari('f-f1').terbuka);
cek('urut terbaru dulu (jadwal mendatang paling atas)', L[0].id === 'r-r2' && L.findIndex(a => a.id === 'f-f1') < L.findIndex(a => a.id === 't-t2'));
cek('linkId tetap ikut (untuk Pindah / Lepas admin)', cari('r-r1').linkId === 'L1' && cari('t-t1').linkId === 'L2' && cari('r-r2').linkId === undefined);
cek('deep link ke record asal', cari('t-t1').href === '/ticketing?open=t1' && cari('p-p1').href === '/form-require-project?open=p1');

console.log('\n3. Penyaring "Perlu perhatian"');
cek('Belum selesai = 4 (r1, r2, t1, p1)', saringLinimasa(L, 'terbuka').map(a => a.id).sort().join() === ['p-p1', 'r-r1', 'r-r2', 't-t1'].join());
cek('Terlambat = 3 (r1, t1, p1)', saringLinimasa(L, 'terlambat').map(a => a.id).sort().join() === ['p-p1', 'r-r1', 't-t1'].join());
cek('Semua = 7', saringLinimasa(L, 'semua').length === 7);
cek('diMasaDepan: hari ini bukan masa depan, null aman', !diMasaDepan('2026-10-31', now) && diMasaDepan('2026-11-01', now) && !diMasaDepan(null, now));

console.log('\n4. Halaman & detail');
const hal = readFileSync('app/(portal)/summary-project/page.tsx', 'utf8');
const mod = readFileSync('app/(portal)/summary-project/_components/ModalDetailProject.tsx', 'utf8');
const lib = readFileSync('lib/summary-project.ts', 'utf8');
cek('keadaan izin: menu tidak diberikan -> layar terkunci (aturan sama dengan sidebar)', /function bolehBukaMenu/.test(hal) && /includes\('summary-project'\)/.test(hal) && /hasFullAccess\(u\)/.test(hal) && /!bolehBukaMenu\(currentUser\)/.test(hal));
cek('galat daftar: ErrorState + Coba Lagi, tanpa pesan teknis', /<ErrorState message=\{galat\} onRetry=/.test(hal) && !/Gagal memuat project: \{galat\}/.test(hal));
cek('kosong: ListEmptyState dengan Reset filter', /<ListEmptyState adaFilterAktif=/.test(hal) && /onReset=\{resetFilter\}/.test(hal));
cek('kartu mengikuti pencarian (cocokCari)', /&& cocokCari\(p\)\);/.test(hal));
cek('konteks project di alamat (?project=) & dibuka lagi saat kembali', /searchParams\.set\('project'/.test(hal) && /get\('project'\)/.test(hal));
cek('detail: galat kueri tidak lagi tampil sebagai "belum ada aktivitas"', /<ErrorState message=\{galat\} onRetry=/.test(mod) && (lib.match(/if \(error\) throw new Error\(error\.message\)/g) ?? []).length >= 2 && /if \(galatLink\) throw/.test(lib));
cek('detail: record di luar akses dijelaskan (tidakTampil)', /detail\.tidakTampil > 0/.test(mod) && /tidakTampil: Math\.max\(0, terhubung - terlihat\)/.test(lib));
cek('detail: tanggal Design & Form Review ikut dimuat', /assigned_handler, created_at'/.test(lib) && /grade_product_knowledge_bast, created_at'/.test(lib));

console.log(`\n${lulus}/${lulus + gagal} lulus`);
process.exit(gagal ? 1 : 0);
