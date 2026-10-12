/**
 * uji/incentive-nominal.ts - nominal total proyek insentif TERKUNCI di server.
 *
 * Yang dijaga: siapa boleh melihat nominal (lib/incentive-nominal.ts), nominal tidak
 * pernah bocor dari sisa kolom lama, dan tidak ada kode peramban yang menulis nominal
 * ke tabel jadwal (reminders) lagi.
 *
 * Jalankan: npm test -- incentive-nominal
 */
import { readdirSync, readFileSync } from 'fs';
import {
  ATURAN_NOMINAL_BAWAAN, bolehLihatBrand, nominalTerbuka, rapikanAturanNominal, tempelkanNominal, terlibatDiProyek,
} from '../lib/incentive-nominal';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, detail = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${detail ? `\n         ${detail}` : ''}`); }
}

const baris = { id: 'r1', brand: 'IVP', pic_id: 'u-pic', assigned_to: 'budi', assign_name: 'Budi Santoso' };
const pengguna = (o: Partial<{ id: string; username: string; full_name: string }> = {}) =>
  ({ id: 'u-x', username: 'xx', full_name: 'Orang Lain', ...o });
const petugas = { role: 'team', incentive_akses: 'input' };
const biasa = { role: 'team', incentive_akses: 'lihat' };
const tanya = (hak: object, aturan: 'petugas' | 'terlibat', o: Partial<Parameters<typeof nominalTerbuka>[0]> = {}) =>
  nominalTerbuka({
    hak, lingkupBrand: null, aturan: { lihat: aturan }, baris, pengguna: pengguna(), punyaBagian: false, ...o,
  } as Parameters<typeof nominalTerbuka>[0]);

console.log('\n1. Aturan bawaan ketat');
cek('bawaan = petugas saja', ATURAN_NOMINAL_BAWAAN.lihat === 'petugas');
cek('isian tak dikenal jatuh ke petugas', rapikanAturanNominal({ lihat: 'semua' }).lihat === 'petugas' && rapikanAturanNominal(null).lihat === 'petugas');
cek('terlibat dikenali', rapikanAturanNominal({ lihat: 'terlibat' }).lihat === 'terlibat');

console.log('\n2. Petugas (input/penuh)');
cek('petugas melihat nominal', tanya(petugas, 'petugas'));
cek('admin melihat nominal', tanya({ role: 'admin' }, 'petugas'));
cek('Full Access dianggap penuh', tanya({ role: 'team', access_level: 'full' }, 'petugas'));
cek('petugas berlingkup brand MVI tidak melihat proyek IVP', !tanya(petugas, 'petugas', { lingkupBrand: 'MVI' }));
cek('petugas berlingkup MVI melihat proyek Kedua Brand', tanya(petugas, 'petugas', { lingkupBrand: 'MVI', baris: { ...baris, brand: 'BOTH' } }));
cek('proyek tanpa brand tetap terlihat (supaya bisa dibetulkan)', tanya(petugas, 'petugas', { lingkupBrand: 'MVI', baris: { ...baris, brand: null } }));

console.log('\n3. Orang biasa (tingkat lihat)');
cek('aturan petugas: PIC proyek sendiri TIDAK melihat nominal', !tanya(biasa, 'petugas', { pengguna: pengguna({ id: 'u-pic' }) }));
cek('aturan petugas: yang punya bagian juga tidak', !tanya(biasa, 'petugas', { punyaBagian: true }));
cek('aturan terlibat: PIC (id) melihat', tanya(biasa, 'terlibat', { pengguna: pengguna({ id: 'u-pic' }) }));
cek('aturan terlibat: handler (username) melihat', tanya(biasa, 'terlibat', { pengguna: pengguna({ username: 'BUDI' }) }));
cek('aturan terlibat: handler (nama) melihat', tanya(biasa, 'terlibat', { pengguna: pengguna({ full_name: 'budi santoso' }) }));
cek('aturan terlibat: punya bagian melihat', tanya(biasa, 'terlibat', { punyaBagian: true }));
cek('aturan terlibat: orang lain tidak melihat', !tanya(biasa, 'terlibat'));
cek('username/nama kosong tidak mencocokkan baris tanpa handler',
  !terlibatDiProyek({ id: 'r', assigned_to: '', assign_name: null, pic_id: null }, { id: '', username: '', full_name: '' }, false));

console.log('\n4. Nominal tidak bocor dari sisa kolom lama');
const proyek = [
  { id: 'a', incentive_value: 7_000_000, nama: 'A' },   // sisa kolom lama, tidak ada di peta
  { id: 'b', incentive_value: 0, nama: 'B' },
  { id: 'c', incentive_value: 1, nama: 'C' },
];
const hasil = tempelkanNominal(proyek, { b: 2_500_000 });
cek('proyek di peta memakai nilai peta', hasil[1].incentive_value === 2_500_000);
cek('sisa nilai lama yang tidak ada di peta DINOLKAN', hasil[0].incentive_value === 0 && hasil[2].incentive_value === 0);
cek('kolom lain tidak berubah', hasil[0].nama === 'A');
cek('baris asli tidak dimutasi', proyek[0].incentive_value === 7_000_000);
cek('nilai bukan angka dianggap 0', tempelkanNominal([{ id: 'z', incentive_value: 5 }], { z: NaN as unknown as number })[0].incentive_value === 0);
cek('bolehLihatBrand tanpa lingkup = bebas', bolehLihatBrand(null, 'IVP'));

console.log('\n5. Tidak ada tulis nominal ke reminders dari peramban');
const page = readFileSync('app/(portal)/incentive-pts/page.tsx', 'utf8');
cek('layar menyimpan lewat server (simpanNominal)', /simpanNominal\(/.test(page));
cek('tidak ada update reminders berisi incentive_value', !/from\('reminders'\)\s*\.update\(\s*\{[^}]*incentive_value/.test(page) && !/incentive_value:\s*Number\(nominalValue\)/.test(page));
//  calc.ts dipecah menjadi calc-*.ts (calc.ts tinggal barrel) - periksa gabungan semuanya.
const DIR_CALC = 'app/(portal)/incentive-pts/_components/';
const calc = readdirSync(DIR_CALC).filter(f => /^calc(-[a-z]+)?\.ts$/.test(f)).map(f => readFileSync(DIR_CALC + f, 'utf8')).join('\n');
cek('daftar proyek ditempeli nominal dari server', /lengkapiNominal\(gabungkanProyek/.test(calc));
cek('jadwal tahapan ditempeli nominal dari server', /tempelkanNominal\(\[t\.project\]/.test(calc));
cek('Process Batch berhenti bila nominal tidak terbuka', /if \(!nominal\.terbuka\)/.test(calc) && /nominal belum diisi - dilewati/.test(calc));
const route = readFileSync('app/api/incentive/nominal/route.ts', 'utf8');
cek('route menolak ubah nominal setelah tahapan dibuat', /status: 409/.test(route) && /incentive_tranches/.test(route));
cek('route tidak menulis incentive_value ke reminders', !/\.update\(\{[^}]*incentive_value/.test(route));
const sql = readFileSync('supabase/migrations/047_incentive_nominal_sembunyikan.sql', 'utf8');
cek('migrasi 047 memasang penjaga trigger', /CREATE TRIGGER trg_kunci_nominal_reminders/.test(sql));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
