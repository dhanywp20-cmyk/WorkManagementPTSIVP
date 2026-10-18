/**
 * uji/kelas-eksternal.ts - Kelas Eksternal Learning Center (quiz customer tanpa akun).
 * Aturan (lib/kelas-eksternal.ts) + pengaman route: kunci jawaban tidak pernah keluar, tabel
 * terkunci, halaman publik tanpa header platform.
 *
 * Jalankan: npm test -- kelas-eksternal
 */
import { readFileSync } from 'fs';
import {
  acakUrutan, acuanWaktu, alasanKirimSah, jenisPelanggaranSah, lewatWaktu, menungguAdmin, nilaiJawaban, rapikanDataPeserta,
  rapikanIsianPeserta, rapikanKelas, rapikanNama, saringJawaban, sisaWaktuMs, statusKelas,
} from '../lib/kelas-eksternal';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

console.log('\n1. Nama');
const n1 = rapikanNama('  budi   SANTOSO ');
cek('spasi dirapikan, pembanding huruf kecil', 'nama' in n1 && n1.nama === 'budi SANTOSO' && n1.norm === 'budi santoso');
cek('terlalu pendek ditolak', 'galat' in rapikanNama(' a '));
cek('tanpa huruf ditolak', 'galat' in rapikanNama('12345'));
cek('tag HTML dibuang', 'nama' in rapikanNama('<b>Ana</b>') && (rapikanNama('<b>Ana</b>') as { nama: string }).nama === 'bAna/b');
cek('maks 80 karakter', 'galat' in rapikanNama('a'.repeat(81)));

console.log('\n2. Status kelas');
const k = { aktif: true, buka_pada: null, tutup_pada: null, maks_peserta: 2 };
const T = Date.parse('2026-10-14T10:00:00Z');
cek('buka', statusKelas(k, 0, T) === 'buka');
cek('nonaktif', statusKelas({ ...k, aktif: false }, 0, T) === 'nonaktif');
cek('belum dibuka', statusKelas({ ...k, buka_pada: '2026-10-15T00:00:00Z' }, 0, T) === 'belum');
cek('sudah ditutup', statusKelas({ ...k, tutup_pada: '2026-10-14T09:00:00Z' }, 0, T) === 'selesai');
cek('kuota penuh', statusKelas(k, 2, T) === 'penuh');

console.log('\n3. Penilaian');
const urutan = ['q1', 'q2', 'q3', 'q4'];
const kunci = { q1: 'A', q2: 'b', q3: 'C', q4: 'D' };
const j = saringJawaban({ q1: 'a', q2: 'B', q3: 'X', q9: 'A', q4: 7 }, urutan);
cek('jawaban di luar soal / bukan A-D dibuang', JSON.stringify(j) === JSON.stringify({ q1: 'A', q2: 'B' }));
const nilai = nilaiJawaban(kunci, urutan, j, 50);
cek('2 dari 4 benar = 50, lulus (>= 50)', nilai.benar === 2 && nilai.jumlah === 4 && nilai.skor === 50 && nilai.lulus);
cek('tidak dijawab = salah, nilai lulus dihormati', !nilaiJawaban(kunci, urutan, {}, 1).lulus && nilaiJawaban(kunci, urutan, {}, 0).skor === 0);
cek('jawaban bukan objek -> kosong', Object.keys(saringJawaban('A,B', urutan)).length === 0);

console.log('\n4. Waktu & acak');
cek('sisa waktu', sisaWaktuMs('2026-10-14T10:00:00Z', 10, T + 4 * 60_000) === 6 * 60_000);
cek('tanpa batas -> null', sisaWaktuMs('2026-10-14T10:00:00Z', null, T) === null);
cek('lewat waktu hanya sesudah toleransi 60 dtk', !lewatWaktu('2026-10-14T10:00:00Z', 10, T + 10 * 60_000 + 59_000) && lewatWaktu('2026-10-14T10:00:00Z', 10, T + 10 * 60_000 + 61_000));
const acak = acakUrutan(['a', 'b', 'c', 'd', 'e'], () => 0);
cek('acak tetap berisi soal yang sama', [...acak].sort().join() === 'a,b,c,d,e' && acak.join() !== 'a,b,c,d,e');

console.log('\n5. Isian admin');
const id = '11111111-2222-3333-4444-555555555555';
cek('judul wajib', 'galat' in rapikanKelas({ judul: ' ', question_ids: [id] }));
cek('minimal satu soal', 'galat' in rapikanKelas({ judul: 'A', question_ids: ['bukan-uuid'] }));
cek('tutup harus sesudah buka', 'galat' in rapikanKelas({ judul: 'A', question_ids: [id], buka_pada: '2026-10-15', tutup_pada: '2026-10-14' }));
const r = rapikanKelas({ judul: 'A', question_ids: [id, id], timer_menit: '999', passing_grade: '-5', maks_peserta: '' });
cek('angka dibatasi & duplikat soal dibuang', !('galat' in r) && r.timer_menit === 300 && r.passing_grade === 0 && r.maks_peserta === 200 && r.question_ids.length === 1);

console.log('\n6. Pengaman');
const route = readFileSync('app/api/kelas/[token]/route.ts', 'utf8');
const mulai = route.slice(route.indexOf("if (aksi === 'mulai')"), route.indexOf("if (aksi === 'kirim')"));
cek('soal untuk customer TANPA kunci jawaban', /select\('id,question,option_a,option_b,option_c,option_d,gambar_url'\)/.test(mulai) && !/correct_answer/.test(mulai));
cek('kunci jawaban hanya dibaca saat menilai', !/correct_answer/.test(route.slice(0, route.indexOf("if (aksi === 'kirim')"))) && /correct_answer/.test(route.slice(route.indexOf("if (aksi === 'kirim')"))));
cek('hanya soal ABCD dipakai', /\.eq\('question_type', 'abcd'\)/.test(route));
cek('token peserta disimpan sebagai hash', /token_hash: hash\(tokenPeserta\)/.test(route) && /\.eq\('token_hash', hash\(t\)\)/.test(route));
cek('kiriman ganda tidak menimpa nilai', /\.is\('selesai_pada', null\)/.test(route));
cek('satu kali kerja dihormati', /selesai && kelas\.satu_kali/.test(route));
const proxy = readFileSync('proxy.ts', 'utf8');
cek('proxy: /kelas/ & /api/kelas/ publik, route admin tidak', proxy.includes("'/kelas/'") && proxy.includes("'/api/kelas/'") && !proxy.includes('kelas-eksternal'));
const admin = readFileSync('app/api/admin/kelas-eksternal/route.ts', 'utf8');
cek('admin: ubah hanya Full Access, pimpinan baca', /hasFullAccess\(/.test(admin) && /if \(!h\.ubah\) return jawab\(\{ error: 'Akun ini hanya bisa melihat\.' \}, 403\)/.test(admin));
const sql = readFileSync('supabase/migrations/050_lc_kelas_eksternal.sql', 'utf8');
cek('050: tabel terkunci dari peramban', (sql.match(/FORCE ROW LEVEL SECURITY/g) ?? []).length === 3 && /REVOKE ALL ON public\.lc_eks_kelas, public\.lc_eks_peserta, public\.lc_eks_hasil FROM PUBLIC, anon, authenticated/.test(sql));
cek('050: nama unik per kelas', /UNIQUE \(kelas_id, nama_norm\)/.test(sql));
const hal = readFileSync('app/kelas/[token]/page.tsx', 'utf8') + readFileSync('app/kelas/[token]/_bagian/LayarQuiz.tsx', 'utf8');
cek('halaman customer tanpa header/logo platform', !/LogoMerek|useMerek|Indovisual|PTS IVP|KerangkaPortal/.test(hal));
cek('menu Kelas Eksternal di Learning Center', /key: 'eksternal', icon: '🌐', label: 'Kelas Eksternal'/.test(readFileSync('app/(portal)/learning-center/page.tsx', 'utf8')));

console.log('\n7. Mode mulai & pelanggaran');
cek('mode admin belum dimulai = menunggu', menungguAdmin({ mode_mulai: 'admin', dimulai_pada: null }) && !menungguAdmin({ mode_mulai: 'admin', dimulai_pada: '2026-10-14T10:00:00Z' }) && !menungguAdmin({ mode_mulai: 'auto', dimulai_pada: null }));
cek('mode admin: batas waktu dari saat admin menekan Mulai (serentak)', acuanWaktu({ mode_mulai: 'admin', dimulai_pada: '2026-10-14T10:00:00Z' }, '2026-10-14T10:07:00Z') === '2026-10-14T10:00:00Z');
cek('mode auto: batas waktu dari mulai peserta sendiri', acuanWaktu({ mode_mulai: 'auto', dimulai_pada: null }, '2026-10-14T10:07:00Z') === '2026-10-14T10:07:00Z');
cek('peserta telat di mode admin mendapat sisa waktu yang sama', sisaWaktuMs(acuanWaktu({ mode_mulai: 'admin', dimulai_pada: '2026-10-14T10:00:00Z' }, '2026-10-14T10:07:00Z'), 10, T + 7 * 60_000) === 3 * 60_000);
cek('jenis pelanggaran dikenali, selain itu ditolak', jenisPelanggaranSah('pindah_tab') && jenisPelanggaranSah('salin_tempel') && !jenisPelanggaranSah('lain') && !jenisPelanggaranSah(undefined));
cek('alasan kirim otomatis disaring', alasanKirimSah('pelanggaran') === 'pelanggaran' && alasanKirimSah('diakhiri') === 'diakhiri' && alasanKirimSah('hack') === null);
const rk = rapikanKelas({ judul: 'A', question_ids: [id], mode_mulai: 'admin', batas_pelanggaran: '99' });
cek('isian: mode admin & batas pelanggaran dibatasi 50', !('galat' in rk) && rk.mode_mulai === 'admin' && rk.batas_pelanggaran === 50);
const rk2 = rapikanKelas({ judul: 'A', question_ids: [id], mode_mulai: 'aneh' });
cek('isian: mode tak dikenal -> auto, batas kosong -> hanya dicatat', !('galat' in rk2) && rk2.mode_mulai === 'auto' && rk2.batas_pelanggaran === null);
cek('route: mulai ditahan saat menunggu admin', /if \(menungguAdmin\(kelas\)\) return jawab\(\{ error: 'Menunggu pengajar memulai\.', menunggu: true \}, 409\)/.test(route));
cek('route: pelanggaran dicatat atomik lewat fungsi DB', /db\.rpc\('lc_eks_catat_pelanggaran', \{ p_hasil: terbuka\.id, p_jenis: body\.jenis \}\)/.test(route));
cek('route: batas waktu & lewat waktu memakai acuan serentak', /sisaWaktuMs\(acuanWaktu\(kelas, h\.mulai_pada\)/.test(route) && /lewatWaktu\(acuanWaktu\(kelas, terbuka\.mulai_pada\)/.test(route));
const sql51 = readFileSync('supabase/migrations/051_lc_eks_mulai_pelanggaran.sql', 'utf8');
cek('051: fungsi pelanggaran tidak bisa dipanggil peramban', /REVOKE EXECUTE ON FUNCTION public\.lc_eks_catat_pelanggaran\(uuid, text\) FROM PUBLIC, anon, authenticated/.test(sql51));
cek('051: hanya percobaan terbuka & log dibatasi 100', /WHERE id = p_hasil AND selesai_pada IS NULL/.test(sql51) && />= 100 THEN log_pelanggaran/.test(sql51));
const pengawas = readFileSync('app/kelas/[token]/_bagian/usePengawas.ts', 'utf8');
cek('pengawas: pindah tab, keluar jendela, salin/tempel/klik kanan', /visibilitychange/.test(pengawas) && /'blur'/.test(pengawas) && /\['copy', 'cut', 'paste', 'contextmenu'\]/.test(pengawas) && /e\.preventDefault\(\)/.test(pengawas));
cek('pengawas: laporan tetap terkirim saat halaman disembunyikan (keepalive)', /keepalive: true/.test(readFileSync('app/kelas/[token]/_bagian/api.ts', 'utf8')));
const quiz = readFileSync('app/kelas/[token]/_bagian/LayarQuiz.tsx', 'utf8');
cek('quiz: kirim otomatis waktu / pelanggaran / diakhiri', /kirim\('waktu'\)/.test(quiz) && /kirim\('pelanggaran'\)/.test(quiz) && /kirim\('diakhiri'\)/.test(quiz));
const adminR = readFileSync('app/api/admin/kelas-eksternal/route.ts', 'utf8');
cek('admin: Mulai sekarang / Akhiri / Buka lagi', /aksi === 'mulai' \|\| body\.aksi === 'akhiri' \|\| body\.aksi === 'buka_lagi'/.test(adminR) && /dimulai_pada: sekarang/.test(adminR));

console.log('\n8. Data peserta (perusahaan & kontak, migrasi 054)');
cek('isian: nilai tak dikenal -> nama saja', rapikanIsianPeserta('aneh') === 'nama' && rapikanIsianPeserta('kontak') === 'kontak');
cek('kelas: isian_peserta disimpan, bawaan nama', !('galat' in rk2) && rk2.isian_peserta === 'nama'
  && (rapikanKelas({ judul: 'A', question_ids: [id], isian_peserta: 'instansi' }) as { isian_peserta: string }).isian_peserta === 'instansi');
const dNama = rapikanDataPeserta('nama', { instansi: 'PT Selundupan', kontak: 'x@y.co', izin_kontak: true });
cek('nama saja: data yang tidak diminta dibuang', !('galat' in dNama) && dNama.instansi === null && dNama.kontak === null && dNama.izin_kontak === false);
cek('instansi: wajib diisi', 'galat' in rapikanDataPeserta('instansi', { instansi: ' ' }));
const dIns = rapikanDataPeserta('instansi', { instansi: '  PT   Maju <b>Jaya</b> ', kontak: 'a@b.co' });
cek('instansi: dirapikan, kontak tidak diminta -> dibuang', !('galat' in dIns) && dIns.instansi === 'PT Maju bJaya/b' && dIns.kontak === null);
const dKosong = rapikanDataPeserta('kontak', { instansi: 'PT A', kontak: '', izin_kontak: true });
cek('kontak opsional: kosong boleh, izin ikut kosong', !('galat' in dKosong) && dKosong.kontak === null && dKosong.izin_kontak === false);
const dEmail = rapikanDataPeserta('kontak', { instansi: 'PT A', kontak: 'budi@ptA.co.id', izin_kontak: true });
cek('kontak: email + izin', !('galat' in dEmail) && dEmail.kontak === 'budi@ptA.co.id' && dEmail.izin_kontak === true);
const dHp = rapikanDataPeserta('kontak', { instansi: 'PT A', kontak: '+62 812-3456-7890', izin_kontak: 'ya' });
cek('kontak: nomor HP diterima, izin harus boolean true', !('galat' in dHp) && dHp.kontak === '+62 812-3456-7890' && dHp.izin_kontak === false);
cek('kontak: bukan email/HP ditolak', 'galat' in rapikanDataPeserta('kontak', { instansi: 'PT A', kontak: 'hubungi saya' }));
cek('route: daftar menyimpan data sesuai pengaturan kelas', /rapikanDataPeserta\(rapikanIsianPeserta\(kelas\.isian_peserta\), body\)/.test(route) && /token_hash: hash\(tokenPeserta\), \.\.\.data \}/.test(route));
cek('route: data kontak TIDAK dikirim ke peramban peserta', !/kontak: peserta\.kontak/.test(route) && /select\('id,nama,instansi'\)/.test(route));
cek('route: gambar soal hanya URL unggahan sendiri', /gambar: rapikanUrlGambar\(s\.gambar_url\)/.test(route));
cek('admin: perusahaan & kontak di hasil + CSV live', /select\('id,nama,created_at,instansi,kontak,izin_kontak'\)/.test(adminR) && /papan: papanLengkap/.test(adminR));
const sql54 = readFileSync('supabase/migrations/054_kuis_eksternal_lanjut.sql', 'utf8');
cek('054: kolom & batas panjang', /isian_peserta IN \('nama', 'instansi', 'kontak'\)/.test(sql54) && /char_length\(instansi\) BETWEEN 2 AND 120/.test(sql54) && /ADD COLUMN IF NOT EXISTS gambar_url text/.test(sql54));
const halaman = readFileSync('app/kelas/[token]/page.tsx', 'utf8');
cek('sertifikat: hanya bila lulus, nomor dari id hasil', /hasil\.lulus && info\.peserta && hasil\.id \?/.test(halaman) && /attempt: \{ id: hasil\.id, passed: true/.test(halaman));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
