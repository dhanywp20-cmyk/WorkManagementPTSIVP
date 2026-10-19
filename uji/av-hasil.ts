/**
 * uji/av-hasil.ts - hasil Kalkulator AV disimpan ke proyek (lib/av-hasil.ts, migrasi 055).
 * Lembar dari peramban dibersihkan sebelum disimpan & dicetak ulang orang lain: hanya seksi
 * info/tabel, tanpa HTML mentah, teks dibatasi. Plus pemasangan route, tombol, dan detail proyek.
 *
 * Jalankan: npm test -- av-hasil
 */
import { readFileSync } from 'fs';
import { BATAS_HASIL, bersihkanLembar, periksaHasilAV } from '../lib/av-hasil';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

const PROYEK = '11111111-2222-3333-4444-555555555555';
const lembar = {
  judul: 'Kebutuhan Rak', subjudul: 'Kalkulator AV · AV Solution Tools', kepala: [['Tanggal', '18 Oktober 2026']],
  seksi: [
    { judul: 'Masukan & hasil', jenis: 'info', kiri: [{ label: 'Cadangan', nilai: '25%' }], kanan: [{ label: 'Ukuran rak', nilai: '12U', sorot: true }] },
    { judul: 'Daftar perangkat', jenis: 'tabel', kepala: ['Perangkat', 'U'], isi: [['DSP', '1U']], rataKanan: [1] },
    { judul: 'Sisipan', jenis: 'html', html: '<img src=x onerror=alert(1)>' },
  ],
  catatan: 'Ventilasi 1U.', warna: ['#000', '#fff'], kaki: '<script>alert(1)</script>', mendatar: false,
};

console.log('\n1. Lembar dibersihkan');
const b = bersihkanLembar(lembar)!;
cek('seksi info & tabel dipertahankan', b.seksi.length === 2 && b.seksi[0].jenis === 'info' && b.seksi[1].jenis === 'tabel');
cek('seksi html DIBUANG', !JSON.stringify(b).includes('onerror') && !b.seksi.some(s => (s as { jenis: string }).jenis === 'html'));
cek('kunci asing (warna, kaki) dibuang', !('warna' in b) && !('kaki' in b));
cek('sorot & rataKanan ikut', JSON.stringify(b).includes('"sorot":true') && (b.seksi[1] as { rataKanan?: number[] }).rataKanan?.[0] === 1);
cek('teks panjang dipotong', (bersihkanLembar({ ...lembar, seksi: [{ judul: 'x', jenis: 'info', kiri: [{ label: 'a'.repeat(1000), nilai: 'b' }] }] })!.seksi[0] as { kiri: { label: string }[] }).kiri[0].label.length === BATAS_HASIL.teks);
cek('baris tabel dibatasi', (bersihkanLembar({ ...lembar, seksi: [{ judul: 't', jenis: 'tabel', kepala: ['a'], isi: Array.from({ length: 999 }, () => ['x']) }] })!.seksi[0] as { isi: unknown[] }).isi.length === BATAS_HASIL.baris);
cek('tanpa seksi sah -> ditolak', bersihkanLembar({ ...lembar, seksi: [{ judul: 'h', jenis: 'html', html: '<b>' }] }) === null);
cek('bukan objek -> ditolak', bersihkanLembar('lembar') === null && bersihkanLembar(null) === null);

console.log('\n2. Isian simpan');
const ok = periksaHasilAV({ proyek_id: PROYEK, judul: '  Rak R. Rapat  ', ringkasan: 'Rak 12U', catatan: 'versi 2', lembar });
cek('isian sah', !('galat' in ok) && ok.judul === 'Rak R. Rapat' && ok.ringkasan === 'Rak 12U' && ok.catatan === 'versi 2');
cek('judul kosong -> judul lembar', !('galat' in periksaHasilAV({ proyek_id: PROYEK, lembar })) && (periksaHasilAV({ proyek_id: PROYEK, lembar }) as { judul: string }).judul === 'Kebutuhan Rak');
cek('proyek wajib & harus uuid', 'galat' in periksaHasilAV({ lembar }) && 'galat' in periksaHasilAV({ proyek_id: "1' or 1=1", lembar }));
cek('lembar rusak ditolak', 'galat' in periksaHasilAV({ proyek_id: PROYEK, lembar: { judul: 'x' } }));
cek('ringkasan dibatasi', !('galat' in ok) && (periksaHasilAV({ proyek_id: PROYEK, lembar, ringkasan: 'r'.repeat(9000) }) as { ringkasan: string }).ringkasan.length === BATAS_HASIL.ringkasan);

console.log('\n3. Pemasangan');
const route = readFileSync('app/api/tools-team/hasil-av/route.ts', 'utf8');
cek('route: hak lihat mengikuti proyek (GET & POST)', (route.match(/bolehLihatProyek\(s\.db, s\.akun/g) ?? []).length === 2);
cek('route: pimpinan tidak bisa menulis/menghapus', (route.match(/if \(s\.akun\.pimpinan\) return galat\(PESAN_HANYA_LIHAT, 403\)/g) ?? []).length === 2);
cek('route: hapus hanya pembuat / admin', /dibuat_oleh !== s\.akun\.id && !\(await bolehKelolaSemua/.test(route));
cek('route: isian lewat periksaHasilAV', /const isian = periksaHasilAV\(body\)/.test(route) && /insert\(\{ \.\.\.isian, dibuat_oleh: s\.akun\.id/.test(route));
cek('route: id pembuat tidak dikirim ke peramban', /map\(\(\{ dibuat_oleh, \.\.\.h \}\)/.test(route));
const lembarAV = readFileSync('app/(portal)/tools-team/_components/av/lembar.ts', 'utf8');
cek('semua hasil Kalkulator AV punya Simpan ke proyek (aksiLembar)', /simpan: \{ judul: nama, lembar: l \}/.test(lembarAV));
cek('detail proyek menampilkan Hitungan AV', /<HitunganAV proyekId=\{proyekId\}/.test(readFileSync('app/(portal)/project-progress/_components/DetailProyek.tsx', 'utf8')));
const sql = readFileSync('supabase/migrations/055_tools_av_hasil.sql', 'utf8');
cek('055: terkunci dari peramban & ikut terhapus bersama proyek', /REVOKE ALL ON public\.tools_av_hasil FROM PUBLIC, anon, authenticated/.test(sql) && /REFERENCES public\.checklist_proyek\(id\) ON DELETE CASCADE/.test(sql));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
