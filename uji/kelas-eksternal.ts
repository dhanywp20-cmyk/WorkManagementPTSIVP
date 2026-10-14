/**
 * uji/kelas-eksternal.ts - Kelas Eksternal Learning Center (quiz customer tanpa akun).
 * Aturan (lib/kelas-eksternal.ts) + pengaman route: kunci jawaban tidak pernah keluar, tabel
 * terkunci, halaman publik tanpa header platform.
 *
 * Jalankan: npm test -- kelas-eksternal
 */
import { readFileSync } from 'fs';
import {
  acakUrutan, lewatWaktu, nilaiJawaban, rapikanKelas, rapikanNama, saringJawaban, sisaWaktuMs, statusKelas,
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
cek('soal untuk customer TANPA kunci jawaban', /select\('id,question,option_a,option_b,option_c,option_d'\)/.test(mulai) && !/correct_answer/.test(mulai));
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

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
