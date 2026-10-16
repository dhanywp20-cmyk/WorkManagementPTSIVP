/**
 * uji/perbandingan.ts - Product Comparison (Tools Team): validasi berkas & kiriman, aturan akses & verifikasi,
 * anti-karangan (kutipan wajib ada di brosur), output AI tidak sah, PDF template (2/3/4 produk) dibaca ulang
 * dengan pdf.js, dan pemeriksaan statis rute (tanpa Storage, tanpa berkas sementara, tanpa log isi).
 *
 * Jalankan: npm test -- perbandingan
 */
import { readFileSync } from 'fs';
import PDFDocument from 'pdfkit';
import {
  bolehPerbandingan, jumlahCek, type KartuBanding, kutipanAda, loloskanSemua, MAKS_BYTE_BERKAS,
  namaBerkasPdf, periksaBerkas, periksaDaftarBerkas, periksaHasil, periksaKartu,
} from '../lib/perbandingan';
import { ATURAN_BAWAAN, bolehLangsungUnduh, bolehVerifikasi, rapikanAturan } from '../lib/perbandingan-aturan';
import { ambilJson, periksaKiriman, promptPengguna, promptSistem } from '../lib/perbandingan-prompt';
import { type DokPenuh, gambarPerbandingan } from '../lib/perbandingan-pdf';
import { CONTOH } from './data/perbandingan-contoh';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const F = 'public/fonts/perbandingan/';

function pdfKe(k: KartuBanding | ((d: DokPenuh) => void)): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  doc.registerFont('Sans', readFileSync(F + 'Arimo_400Regular.ttf'));
  doc.registerFont('SansBold', readFileSync(F + 'Arimo_700Bold.ttf'));
  doc.registerFont('SansItalic', readFileSync(F + 'Arimo_400Regular_Italic.ttf'));
  doc.registerFont('Centang', readFileSync(F + 'DejaVuSans-Bold-centang.ttf'));
  const potong: Buffer[] = [];
  return new Promise(ok => {
    doc.on('data', (c: Buffer) => potong.push(c));
    doc.on('end', () => ok(new Uint8Array(Buffer.concat(potong))));
    if (typeof k === 'function') k(doc as unknown as DokPenuh); else gambarPerbandingan(doc as unknown as DokPenuh, k);
    doc.end();
  });
}
async function bacaPdf(data: Uint8Array): Promise<{ halaman: string[]; lebarMaks: number }> {
  const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const dok = await lib.getDocument({ data, disableFontFace: true }).promise;
  const halaman: string[] = []; let lebarMaks = 0;
  for (let i = 1; i <= dok.numPages; i++) {
    const p = await dok.getPage(i);
    const isi = await p.getTextContent();
    halaman.push(isi.items.map(it => ('str' in it ? it.str : '')).join(' '));
    for (const it of isi.items) if ('transform' in it) lebarMaks = Math.max(lebarMaks, it.transform[4] + it.width);
  }
  return { halaman, lebarMaks };
}

async function main() {
  console.log('\n1. Berkas');
  cek('kurang dari dua brosur ditolak', !!periksaDaftarBerkas([{ nama: 'a.pdf', ukuran: 10 }]));
  cek('lebih dari empat brosur ditolak', !!periksaDaftarBerkas(Array.from({ length: 5 }, (_, i) => ({ nama: `${i}.pdf`, ukuran: 10 }))));
  cek('bukan PDF (tanda tangan berkas) ditolak walau berekstensi .pdf', !!periksaBerkas('palsu.pdf', 100, new Uint8Array([0x50, 0x4b, 3, 4, 0])));
  cek('PDF terlalu besar ditolak', !!periksaBerkas('besar.pdf', MAKS_BYTE_BERKAS + 1, PDF));
  cek('PDF valid diterima', periksaBerkas('ok.pdf', 2000, PDF) === null);
  cek('nama unduhan aman', namaBerkasPdf([{ nama: 'LG 22SM3G-B' }, { nama: '../DigiSIGN <x>' }]) === 'Product-Comparison-LG-22SM3G-B-vs-..DigiSIGN-x.pdf');

  console.log('\n2. PDF berteks dibaca (pdfkit -> pdf.js) & PDF tanpa teks');
  const brosur = await pdfKe(d => { d.font('Sans').fontSize(11); d.text('Model ABC-55 Brightness 500 cd/m² Resolution 3840 x 2160', 50, 60); });
  const terbaca = await bacaPdf(brosur);
  cek('teks brosur terbaca', terbaca.halaman[0].includes('ABC-55') && terbaca.halaman[0].includes('500'));
  const teksPanjang = 'Brightness 500 cd/m2 Resolution 3840 x 2160 Panel IPS Warranty 3 years '.repeat(3);
  cek('kiriman berteks diterima', periksaKiriman({ produk: [{ nama: 'A', berkas: 'a.pdf', halaman: [teksPanjang] }, { nama: 'B', berkas: 'b.pdf', halaman: [teksPanjang] }] }).ok);
  const scan = periksaKiriman({ produk: [{ berkas: 'scan.pdf', halaman: [' ', ''] }, { berkas: 'b.pdf', halaman: [teksPanjang] }] });
  cek('PDF hasil scan / tanpa teks ditolak dengan pesan jelas', !scan.ok && /scan/.test(scan.alasan));
  cek('kiriman satu produk ditolak di server', !periksaKiriman({ produk: [{ berkas: 'a.pdf', halaman: [teksPanjang] }] }).ok);
  cek('nama berkas disanitasi', periksaKiriman({ produk: [{ berkas: '../../etc/x<y>.pdf', halaman: [teksPanjang] }, { berkas: 'b.pdf', halaman: [teksPanjang] }] }).ok);
  cek('nama produk kosong -> AI diminta membaca dari brosur', promptPengguna([{ nama: '', berkas: 'a.pdf', halaman: ['x'] }, { nama: 'B', berkas: 'b.pdf', halaman: ['y'] }]).teks.includes('name not given'));

  console.log('\n3. Anti-karangan & satuan');
  const sumber = ['[Page 1]\nModel ABC-55\nBrightness 500 cd/m²\nPanel life 50,000 hrs', '[Page 1]\nModel XYZ-55\nBrightness 450 nits'];
  const nilai = (teks: string, kutipan?: string, status = 'ada', unggul = false) => ({ teks, status, unggul, ...(kutipan ? { bukti: { kutipan, halaman: 1 } } : {}) });
  const hasilAI = (baris: unknown[]) => ({ kategori: 'X', judul: 'ABC vs XYZ', pengantar: 'p', produk: [{ merek: 'A', nama: 'ABC-55', judulKartu: 'ABC', deskripsi: 'd' }, { merek: 'B', nama: 'XYZ-55', judulKartu: 'XYZ', deskripsi: 'd' }], bagian: [{ judul: 'Panel', baris }], ringkasan: 'r', sorotan: [], rekomendasi: 'x', catatan: 'c' });
  const h = periksaHasil(hasilAI([
    { spesifikasi: 'Brightness', nilai: [nilai('500 cd/m²', '500 cd/m2', 'ada', true), nilai('450 nits', 'Brightness 450 nits')] },
    { spesifikasi: 'Warranty', nilai: [nilai('3 years', '3 years warranty'), nilai('', undefined, 'tidak-disebut')] },
    { spesifikasi: 'Contrast', nilai: [nilai('5000:1'), nilai('', undefined, 'tidak-disebut')] },
    { spesifikasi: 'Brightness (nits)', nilai: [nilai('500 nits', '500 nits'), nilai('450 nits', '450 nits')] },
  ]), sumber, 'en');
  if (!h.ok) { cek(`hasil valid diterima (${h.alasan})`, false); } else {
    const b = h.data.bagian[0].baris;
    cek('kutipan yang ada di brosur -> tetap "ada" (², spasi & huruf dinormalkan)', b[0].nilai[0].status === 'ada' && b[0].nilai[0].unggul === true);
    cek('spesifikasi yang tidak ada di brosur (kutipan karangan) -> "cek"', b[1].nilai[0].status === 'cek');
    cek('nilai tanpa kutipan -> "cek", tidak diloloskan', b[2].nilai[0].status === 'cek');
    cek('satuan diganti AI (500 nits padahal brosur cd/m²) -> "cek"', b[3].nilai[0].status === 'cek' && b[3].nilai[1].status === 'ada');
    cek('"tidak disebut" tetap kosong (tidak diisi tebakan)', b[1].nilai[1].teks === '' && b[1].nilai[1].status === 'tidak-disebut');
    cek('jumlah "cek" dihitung -> unduh PDF terkunci', jumlahCek(h.data) === 3 && h.dicek === 3);
  }
  cek('kutipanAda: frasa pendek / kosong tidak dianggap bukti', !kutipanAda('', sumber[0]) && !kutipanAda('x', sumber[0]));

  console.log('\n4. Output AI tidak sah');
  cek('jumlah produk tidak sama ditolak', !periksaHasil({ ...hasilAI([]), produk: [{ nama: 'A' }] }, sumber, 'en').ok);
  cek('baris dengan jumlah nilai salah ditolak', !periksaHasil(hasilAI([{ spesifikasi: 'X', nilai: [nilai('1', '1')] }]), sumber, 'en').ok);
  cek('nama produk kosong ditolak', !periksaHasil({ ...hasilAI([{ spesifikasi: 'X', nilai: [nilai('a'), nilai('b')] }]), produk: [{ nama: '' }, { nama: 'B' }] }, sumber, 'en').ok);
  cek('bukan objek ditolak', !periksaHasil('teks', sumber, 'en').ok && !periksaHasil(null, sumber, 'en').ok);
  cek('ambilJson: ```json ... ``` & teks pengantar', (ambilJson('Berikut:\n```json\n{"a":1}\n```') as { a: number })?.a === 1 && ambilJson('maaf, tidak bisa') === null);
  cek('prompt sistem melarang tebakan & mewajibkan kutipan', /never guess/i.test(promptSistem('en')) && /bukti\.kutipan/.test(promptSistem('id')));

  console.log('\n5. Akses & verifikasi');
  cek('akun tanpa menu Tools Team ditolak', !bolehPerbandingan({ role: 'guest', allowed_menus: ['dashboard'] }) && !bolehPerbandingan(null));
  cek('Sales dengan menu Tools Team boleh membuat', bolehPerbandingan({ role: 'guest', allowed_menus: ['tools-team'] }));
  cek('Sales / Marketing TIDAK boleh unduh langsung', !bolehLangsungUnduh({ role: 'guest' }));
  cek('Team PTS & Admin unduh langsung', bolehLangsungUnduh({ role: 'team' }) && bolehLangsungUnduh({ role: 'admin' }));
  cek('verifikator: Admin, Supervisor / Manager PTS IVP & MVI', bolehVerifikasi({ role: 'admin' }) && bolehVerifikasi({ role: 'team', team_type: 'Team PTS MVI', jabatan: 'Supervisor' }) && bolehVerifikasi({ role: 'team', team_type: 'Team PTS IVP', jabatan: 'Manager' }));
  cek('bukan verifikator: staff PTS, tim lain, Supervisor Marketing', !bolehVerifikasi({ role: 'team', team_type: 'Team PTS IVP', jabatan: 'Staff' }) && !bolehVerifikasi({ role: 'team', team_type: 'Team PTS UMP', jabatan: 'Supervisor' }) && !bolehVerifikasi({ role: 'guest', team_type: 'Marketing', jabatan: 'Supervisor' }));
  console.log('\n5b. Aturan dari Admin Panel (bukan hardcode)');
  const kosong = rapikanAturan(null);
  cek('belum diatur -> bawaan', JSON.stringify(kosong) === JSON.stringify(ATURAN_BAWAAN));
  const atur = rapikanAturan({ wajibVerifikasi: true, langsungRole: ['admin', 'bukan-role'], verifikatorRole: [], verifikatorTim: ['Team PTS UMP'], verifikatorJabatan: ['Manager', 'Jabatan Palsu'], simpanHari: 9999, maksMenunggu: -5 });
  cek('isian tak dikenal dibuang, angka dijepit', atur.langsungRole.join() === 'admin' && atur.verifikatorJabatan.join() === 'Manager' && atur.simpanHari === 365 && atur.maksMenunggu === 1);
  cek('Admin selalu verifikator walau dihapus dari daftar', atur.verifikatorRole.includes('admin') && bolehVerifikasi({ role: 'admin' }, atur));
  cek('kelompok & jabatan pilihan Admin dipakai', bolehVerifikasi({ role: 'team', team_type: 'Team PTS UMP', jabatan: 'Manager' }, atur) && !bolehVerifikasi({ role: 'team', team_type: 'Team PTS IVP', jabatan: 'Supervisor' }, atur));
  cek('Team tidak lagi unduh langsung bila dicabut Admin', !bolehLangsungUnduh({ role: 'team' }, atur));
  cek('verifikasi dimatikan -> semua unduh langsung', bolehLangsungUnduh({ role: 'guest' }, rapikanAturan({ wajibVerifikasi: false })));

  console.log('\n5c. Loloskan semua');
  if (h.ok) {
    const lolos = loloskanSemua(h.data);
    cek('semua "cek" selesai sekaligus', jumlahCek(lolos) === 0);
    cek('nilai berteks -> "ada", nilai lain tidak disentuh', lolos.bagian[0].baris[1].nilai[0].status === 'ada' && lolos.bagian[0].baris[1].nilai[1].status === 'tidak-disebut' && lolos.bagian[0].baris[0].nilai[0].unggul === true);
  }
  const simpan = periksaKartu(CONTOH);
  cek('kartu contoh lolos pemeriksaan simpan', simpan.ok && jumlahCek(simpan.data) === 0);
  cek('kartu rusak ditolak saat diajukan', !periksaKartu({ produk: [] }).ok);

  console.log('\n6. PDF template (dibaca ulang dengan pdf.js)');
  const pdf2 = await bacaPdf(await pdfKe(CONTOH));
  //  pdf.js memecah kata (huruf berjarak) menjadi potongan - bandingkan tanpa spasi.
  const rapat = (t: string) => t.replace(/\s+/g, '');
  const semua = rapat(pdf2.halaman.join(' '));
  cek('3 halaman seperti PDF contoh', pdf2.halaman.length === 3);
  cek('bagian & label template lengkap & berurutan', ['PRODUCT COMPARISON', 'RECOMMENDED', 'Panel & Display', 'SPECIFICATION', 'Operating System, CMS', 'Connectivity, Physical Build', 'Certification, Warranty', 'Summary & Recommendation', 'Recommendation:', 'Note:']
    .map(rapat).every((t, i, a) => semua.indexOf(t) >= 0 && (i === 0 || semua.indexOf(t) > semua.indexOf(a[i - 1]))));
  cek('kepala tabel berulang di halaman lanjutan', pdf2.halaman[1].trimStart().startsWith('SPECIFICATION') || pdf2.halaman[1].includes('SPECIFICATION'));
  cek('"Not officially published" untuk nilai tak disebut', semua.includes(rapat('Not officially published')));
  cek('tanpa footer perusahaan', !/Page\d+of|Halaman\d+|©/.test(semua));
  for (const n of [3, 4]) {
    const k: KartuBanding = structuredClone(CONTOH);
    k.produk = Array.from({ length: n }, (_, i) => ({ ...CONTOH.produk[i % 2], nama: `${CONTOH.produk[i % 2].nama} #${i + 1}` }));
    k.bagian.forEach(b => b.baris.forEach(r => { r.nilai = Array.from({ length: n }, (_, i) => r.nilai[i % 2]); }));
    const pn = await bacaPdf(await pdfKe(k));
    cek(`${n} produk: PDF jadi, semua nama tampil, teks tidak keluar halaman`, rapat(pn.halaman.join(' ')).includes(`#${n}`) && pn.lebarMaks <= 595.28 - 40);
  }
  cek('2 produk: teks tidak keluar halaman', pdf2.lebarMaks <= 595.28 - 40);

  console.log('\n7. Rute: tanpa Storage, tanpa berkas sementara, tanpa log isi');
  const rute = ['app/api/tools-team/perbandingan/route.ts', 'app/api/tools-team/perbandingan/pengajuan/route.ts'].map(f => readFileSync(f, 'utf8'));
  cek('tidak memakai Supabase Storage', rute.every(s => !/\.storage\b/.test(s)));
  cek('tidak menulis berkas sementara (fs / tmp)', rute.every(s => !/from 'fs'|require\('fs'\)|tmpdir|writeFile/.test(s)));
  cek('tidak menulis isi ke log', rute.every(s => !/console\.(log|info|warn|error)/.test(s)));
  cek('rute otomatis tidak menyimpan ke tabel', !/\.from\('tools_perbandingan'\)|\.insert\(/.test(rute[0]));
  const halaman = readFileSync('app/(portal)/tools-team/page.tsx', 'utf8');
  cek('menu Tools Team lengkap & tiap alat punya cabang render', ['3d', 'led', 'av', 'banding', 'pustaka'].every(k => halaman.includes(`k: '${k}'`))
    && ["aktif === 'led'", "aktif === 'av'", "aktif === 'pustaka'", "aktif === 'banding'"].every(t => halaman.includes(t)));

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  if (gagal) process.exit(1);
}
void main();
