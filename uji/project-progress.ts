/**
 * uji/project-progress.ts - logika murni Project Progress & Checklist:
 * jadwal, progres, pembaca teks/Excel, validasi isian dari server.
 *
 * Jalankan: npx tsx uji/project-progress.ts
 */
import {
  keadaanJadwal, hitungProgres, progresDari, statDari, bersihkanSebaris,
  bacaTeks, bacaBaris, validasiDraft, validasiNama, kelompokkan, hitungItemDraft, BATAS,
} from '../lib/checklist';
import { isianProyek, tanggal, daftarId, statusProyek } from '../lib/checklist-isian';
import { triggersProjectProgress } from '../lib/project-progress-sync';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\n1. Keadaan jadwal terhadap target');
const H = '2026-10-09';
cek('tuntas selalu "selesai" walau lewat target', keadaanJadwal('2026-01-01', true, H).keadaan === 'selesai');
cek('tanpa target -> "tanpa"', keadaanJadwal(null, false, H).keadaan === 'tanpa');
cek('kemarin -> terlambat 1 hari', keadaanJadwal('2026-10-08', false, H).label === 'Terlambat 1 hari');
cek('hari ini -> dekat, "Target hari ini"', keadaanJadwal(H, false, H).label === 'Target hari ini');
cek('3 hari lagi masih "dekat"', keadaanJadwal('2026-10-12', false, H).keadaan === 'dekat');
cek('4 hari lagi sudah "aman"', keadaanJadwal('2026-10-13', false, H).keadaan === 'aman');
cek('timestamp penuh dipotong ke tanggal', keadaanJadwal('2026-10-08T23:59:00Z', false, H).keadaan === 'terlambat');
cek('lintas bulan dihitung benar (31 Okt -> 1 Nov = 1 hari)', keadaanJadwal('2026-11-01', false, '2026-10-31').label === 'Target 1 hari lagi');

console.log('\n2. Progres & statistik');
cek('daftar kosong = 0%, bukan NaN', hitungProgres([]).persen === 0);
cek('1 dari 3 = 33%', hitungProgres([{ selesai: true }, { selesai: false }, { selesai: false }]).persen === 33);
cek('2 dari 3 dibulatkan = 67%', progresDari(2, 3).persen === 67);
cek('progresDari total 0 = 0%', progresDari(0, 0).persen === 0);
const st = statDari([
  { selesai: true, kendala: true },   // kendala yang sudah selesai tidak dihitung
  { selesai: false, kendala: true },
  { selesai: false, kendala: false },
]);
cek('kendala yang sudah selesai tidak dihitung sebagai kendala', st.kendala === 1 && st.selesai === 1 && st.total === 3);

console.log('\n3. Pembaca teks / Markdown');
cek('link markdown jadi teksnya saja', bersihkanSebaris('Cek [manual](http://x)') === 'Cek manual');
cek('tebal & kode dibuang', bersihkanSebaris('**Pasang** `HDMI`') === 'Pasang HDMI');
const d1 = bacaTeks('# Instalasi Ruang Rapat\n\n## Persiapan\n- [ ] Cek perangkat\n- [x] Siapkan alat\n\n## Pengujian\n- [  ] Uji display\n');
cek('judul dari heading #', d1.judul === 'Instalasi Ruang Rapat');
cek('dua bagian dari heading ##', d1.bagian.length === 2 && d1.bagian[0].judul === 'Persiapan');
cek('item [x] terbaca selesai, [ ] belum', d1.bagian[0].items[1]?.selesai === true && d1.bagian[0].items[0]?.selesai === false);
cek('kurung berspasi ganda "[  ]" tetap item', d1.bagian[1].items.length === 1);
cek('total item = 3', hitungItemDraft(d1) === 3);
const d2 = bacaTeks('- [ ] Tanpa heading');
cek('item tanpa heading masuk bagian "Umum"', d2.bagian[0]?.judul === 'Umum' && d2.bagian[0].items.length === 1);

console.log('\n4. Pembaca baris Excel');
const x1 = bacaBaris([
  ['Tahap', 'Tugas', 'Status'],
  ['Persiapan', 'Cek fisik', 'selesai'],
  ['', 'Siapkan alat', ''],          // sel gabungan Excel terbaca kosong
  ['Instalasi', 'Pasang bracket', 'x'],
], 'Cadangan');
cek('header sinonim (Tahap/Tugas) dikenali', x1.bagian.length === 2);
cek('sel Bagian kosong mewarisi baris atasnya', x1.bagian[0].items.length === 2);
cek('status "selesai" dan "x" terbaca selesai', x1.bagian[0].items[0].selesai && x1.bagian[1].items[0].selesai);
cek('judul cadangan dipakai', x1.judul === 'Cadangan');
const x2 = bacaBaris([['1. Persiapan', '', 'Cek', 'catatan', '']]);
cek('tanpa header -> urutan kolom template', x2.bagian[0]?.items[0]?.teks === 'Cek' && x2.bagian[0].items[0].catatan === 'catatan');
cek('baris kosong diabaikan', bacaBaris([[], ['', ''], [null, undefined]]).bagian.length === 0);

console.log('\n5. Validasi draf dari klien (server)');
const g = (r: ReturnType<typeof validasiDraft>) => ('galat' in r ? r.galat : '');
cek('null ditolak', g(validasiDraft(null)) !== '');
cek('tanpa judul ditolak', g(validasiDraft({ judul: ' ', bagian: [{ judul: 'A', catatan: '', items: [{ kelompok: '', teks: 'x', catatan: '', selesai: false }] }] })).includes('Judul'));
cek('tanpa item yang bisa dicentang ditolak', g(validasiDraft({ judul: 'J', bagian: [{ judul: 'A', catatan: 'hanya catatan', items: [] }] })).includes('Belum ada item'));
const banyak = Array.from({ length: BATAS.item + 1 }, (_, i) => ({ kelompok: '', teks: `i${i}`, catatan: '', selesai: false }));
cek(`lebih dari ${BATAS.item} item ditolak`, g(validasiDraft({ judul: 'J', bagian: [{ judul: 'A', catatan: '', items: banyak }] })).includes('Maksimal'));
const ok = validasiDraft({ judul: 'J', bagian: [{ judul: '', catatan: '', items: [{ kelompok: '', teks: 'a'.repeat(2000), catatan: '', selesai: 'true' }] }] });
cek('draf sah diterima', 'draft' in ok);
if ('draft' in ok) {
  cek('teks item dipangkas ke batas', ok.draft.bagian[0].items[0].teks.length === BATAS.teks);
  cek('judul bagian kosong jadi "Umum"', ok.draft.bagian[0].judul === 'Umum');
  cek('selesai hanya true boolean (string "true" bukan)', ok.draft.bagian[0].items[0].selesai === false);
}
cek('nama 1 huruf ditolak', validasiNama('A') === null);
cek('spasi ganda dirapikan', validasiNama('  Budi   Santoso ') === 'Budi Santoso');

console.log('\n6. Isian proyek (route server)');
const ip = (b: Record<string, unknown>) => isianProyek(b);
cek('nama kosong ditolak', 'galat' in ip({ nama: '  ' }));
cek('target sebelum mulai ditolak', 'galat' in ip({ nama: 'P', start_date: '2026-10-10', target_date: '2026-10-01' }));
const ip2 = ip({ nama: 'P', client: '', status: 'hapus-semua', start_date: '2026-13-45' });
cek('client kosong jadi null, status asing jadi in_progress, tanggal rusak jadi null',
  'isian' in ip2 && ip2.isian.client === null && ip2.isian.status === 'in_progress' && ip2.isian.start_date === null);
cek('tanggal sah lolos', tanggal('2026-10-09') === '2026-10-09');
cek('tanggal format salah ditolak', tanggal('09/10/2026') === null);
cek('daftarId hanya uuid', daftarId(['b6b0a1c2-1111-4222-8333-444455556666', 'x', 5, "1' or 1=1"]).length === 1);
cek('statusProyek menerima done & blocked', statusProyek('done') === 'done' && statusProyek('blocked') === 'blocked');

console.log('\n7. Pengelompokan & pemicu sinkron');
const kel = kelompokkan([{ kelompok: 'B' }, { kelompok: 'A' }, { kelompok: 'B' }]);
cek('urutan kemunculan pertama dipertahankan', kel.map(k => k.kelompok).join() === 'B,A' && kel[0].items.length === 2);
cek('Konfigurasi memicu Project Progress', triggersProjectProgress('Konfigurasi') && triggersProjectProgress(' Konfigurasi & Training '));
cek('Demo Product / null tidak memicu', !triggersProjectProgress('Demo Product') && !triggersProjectProgress(null));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
