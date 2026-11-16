import { readFileSync } from 'fs';
import { geserTanggal, hitungPer, kodeIsu, pecahProduk,labelStatusPada, peranPada, ringkasHarian, teksRingkasan, terbukaPada, umurIsu, type Isu } from '../lib/isu/inti';
import { hakIsu, isianIsu, kolomBerubah, normalNama, statusTiket } from '../lib/isu/server';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

const dasar: Isu = {
  id: '', grup_id: 'g', nomor: 0, daftar_id: null, lokasi: '', tanggal: '', kategori: 'Audio', prioritas: 'sedang',
  judul: '', produk: '', deskripsi: '', pelapor: '', pic: '', status: 'open', action: '', solusi: '', catatan_internal: 'rahasia',
  foto_url: null, foto_thumb_url: null, selesai_pada: null, dibuat_oleh_nama: null, diubah_oleh_nama: null, created_at: '', updated_at: '',
};
const isu = (x: Partial<Isu>): Isu => ({ ...dasar, ...x });

// 16 Nov 2026 WIB. selesai_pada disimpan UTC: 17:30Z tgl 15 = 00:30 WIB tgl 16.
const data = [
  isu({ id: 'a', nomor: 1, lokasi: 'BPKP Medan', tanggal: '2026-11-14', judul: 'Mic mati', status: 'progress', action: 'Kirim unit', pic: 'Andi' }),
  isu({ id: 'b', nomor: 2, lokasi: 'BPKP Medan', tanggal: '2026-11-16', judul: 'Display blank' }),
  isu({ id: 'c', nomor: 3, lokasi: 'BPKP Aceh', tanggal: '2026-11-15', judul: 'Jaringan putus', status: 'solved', solusi: 'Ganti switch', selesai_pada: '2026-11-15T17:30:00Z' }),
  isu({ id: 'd', nomor: 4, lokasi: 'BPKP Bali', tanggal: '2026-11-10', judul: 'Lama', status: 'solved', solusi: 'ok', selesai_pada: '2026-11-11T03:00:00Z' }),
  isu({ id: 'e', nomor: 5, lokasi: 'BPKP Papua', tanggal: '2026-11-17', judul: 'Besok' }),
];

console.log('\n1. Ringkasan harian 16 Nov');
const r = ringkasHarian(data, '2026-11-16');
cek('isu baru = #2', r.baru.map(i => i.nomor).join() === '2');
cek('solved hari ini = #3 (zona WIB, bukan UTC)', r.selesai.map(i => i.nomor).join() === '3');
cek('masih terbuka = #1 & #2', r.terbuka.map(i => i.nomor).sort().join() === '1,2');
cek('isu lama yang sudah solved tidak ikut', !r.relevan.some(i => i.nomor === 4));
cek('isu bertanggal sesudahnya tidak ikut', !r.relevan.some(i => i.nomor === 5));
cek('lokasi terdampak = 1 (Medan)', r.kotaTerdampak === 1);
cek('Medan di urutan pertama', r.kota[0]?.lokasi === 'BPKP Medan' && r.kota[0].terbuka === 2 && r.kota[0].baru === 1);
cek('Aceh tercatat solved 1, terbuka 0', r.kota.some(k => k.lokasi === 'BPKP Aceh' && k.selesai === 1 && k.terbuka === 0));

console.log('\n2. Peran & umur');
cek('#1 lanjutan di 16 Nov', peranPada(data[0], '2026-11-16') === 'lanjutan');
cek('#1 umur 2 hari', umurIsu(data[0], '2026-11-16') === 2);
cek('#3 masih terbuka di akhir 15 Nov (solved 16 WIB)', terbukaPada(data[2], '2026-11-15'));
cek('#3 dilihat dari 15 Nov berlabel "Solved 16 Nov"', labelStatusPada(data[2], '2026-11-15').startsWith('Solved 16'));
cek('geser tanggal lewat akhir bulan', geserTanggal('2026-11-30', 1) === '2026-12-01');

console.log('\n3. Teks WhatsApp');
const t = teksRingkasan('BPKP 33 Kota', r);
cek('memuat judul grup', t.includes('*Ringkasan Isu BPKP 33 Kota*'));
cek('memuat angka', t.includes('Baru: 1 · Solved: 1 · Masih terbuka: 2 (1 lokasi)'));
cek('menyebut action & PIC', t.includes('Action: Kirim unit (PIC Andi)'));
cek('menyebut solusi untuk yang solved', t.includes('Solusi: Ganti switch'));
cek('tidak membocorkan catatan internal', !t.includes('rahasia'));

console.log('\n4. Validasi isian');
const lokasi = [{ id: '11111111-1111-1111-1111-111111111111', nama: 'BPKP Medan', proyek: 'P' }];
const ok = isianIsu({ daftar_id: lokasi[0].id, judul: ' Mic ', tanggal: '2026-11-01', status: 'open' }, lokasi, false);
cek('lokasi dari checklist diisi namanya', 'isian' in ok && ok.isian.lokasi === 'BPKP Medan' && ok.isian.judul === 'Mic');
cek('judul kosong ditolak', 'galat' in isianIsu({ daftar_id: lokasi[0].id, judul: '', tanggal: '2026-11-01' }, lokasi, false));
cek('tanggal masa depan ditolak', 'galat' in isianIsu({ daftar_id: lokasi[0].id, judul: 'x', tanggal: '2999-01-01' }, lokasi, false));
cek('status asing ditolak', 'galat' in isianIsu({ status: 'hapus' }, lokasi, true));
const sebagian = isianIsu({ status: 'pending' }, lokasi, true);
cek('PATCH sebagian hanya kolom yang dikirim', 'isian' in sebagian && Object.keys(sebagian.isian).join() === 'status');
cek('riwayat tidak menyebut catatan internal', kolomBerubah(data[0], { catatan_internal: 'baru', pic: 'Budi' }).join() === 'PIC');

console.log('\n5. Link eksternal tidak membawa catatan internal');
const srv = readFileSync('lib/isu/server.ts', 'utf8');
const publik = /const KOLOM_ISU_PUBLIK = '([^']+)'/.exec(srv)?.[1] ?? '';
cek('kolom publik tanpa catatan_internal', !!publik && !publik.includes('catatan_internal'));
const share = readFileSync('app/api/project-progress/share/isu/[token]/route.ts', 'utf8');
cek('route share memuat isu mode publik', share.includes('muatSemuaIsu(db, grup, true)'));
cek('kolom grup publik tanpa share_token', !/KOLOM_GRUP_PUBLIK = '[^']*share_token/.test(srv));

console.log('\n6. Tiket otomatis jadi isu');
cek('nama tiket = nama lokasi tanpa nama klien', normalNama('BPKP MEdan', ['bpkp']) === normalNama('bpkp medan', ['bpkp']));
cek('lokasi tanpa awalan klien tetap cocok', normalNama('Kalimantan Barat', ['bpkp']) === normalNama('BPKP Kalimantan Barat', ['bpkp']));
cek('tanda baca diabaikan', normalNama('BPKP Maluku - Ambon', ['bpkp']) === 'maluku ambon');
cek('lokasi lain tidak cocok', normalNama('BPKP Yogyakarta', ['bpkp']) !== normalNama('BPKP Jawa Tengah', ['bpkp']));
cek('Solved -> solved', statusTiket('Solved', true) === 'solved');
cek('Pending tanpa aktivitas -> open', statusTiket('Pending', false) === 'open');
cek('Pending dengan aktivitas -> progress', statusTiket('Pending', true) === 'progress');
cek('Call -> progress', statusTiket('Call', false) === 'progress');
cek('link publik tanpa nomor HP customer & username', /customer_phone: publik \? null/.test(srv) && /created_by: publik \? null/.test(srv) && /handler_username: publik \? null/.test(srv));
const detailIsu = readFileSync('app/(portal)/project-progress/_components/isu/DetailIsu.tsx', 'utf8');
cek('detail tiket memakai komponen Troubleshooting', /if \(isu\.tiket\) return <ModalDetailTiket/.test(detailIsu)
  && readFileSync('app/(portal)/project-progress/_components/isu/DetailTiket.tsx', 'utf8').includes('<IsiDetailTicket'));
cek('PDF memakai cetakTicket yang sama', detailIsu.includes('cetakTicket(isuKeTicket('));
cek('kode isu tiket', kodeIsu(isu({ sumber: 'tiket' })) === 'Tiket' && kodeIsu(isu({ nomor: 7 })) === '#7');

console.log('\n7. Grafik kendala & produk');
cek('produk tiket dipecah per brand', pecahProduk('Philips, Wyrestorm, Cue System').join('|') === 'Philips|Wyrestorm|Cue System');
cek('pemisah & / dan / + dikenali', pecahProduk('Cue Versatile & Philips 10BDL3351T').length === 2 && pecahProduk('LG dan Samsung').length === 2);
cek('produk kosong = tanpa batang', pecahProduk('').length === 0 && pecahProduk(null).length === 0);
cek('nama produk beda huruf besar dianggap sama', pecahProduk('LG, lg').length === 1);
const g = hitungPer([
  isu({ kategori: 'Audio', produk: 'Fonestar, LG', status: 'open' }),
  isu({ kategori: 'Audio', produk: 'fonestar', status: 'solved' }),
  isu({ kategori: 'Display', produk: 'LG', status: 'solved' }),
], i => pecahProduk(i.produk));
cek('produk terbanyak di atas, hitung terbuka', g[0]?.label === 'Fonestar' && g[0].total === 2 && g[0].terbuka === 1);
cek('satu isu dihitung sekali per produk', g.find(b => b.kunci === 'lg')?.total === 2);
cek('kategori dihitung per isu', hitungPer(data, i => [i.kategori])[0]?.total === data.length);

console.log('\n8. Atur grup: admin & Manager PTS');
const akun = (role: string, jabatan = '') => ({ id: 'x', nama: 'x', role, jabatan });
cek('Manager role team boleh atur grup', hakIsu(akun('team', 'Manager')).kelola === true);
cek('admin boleh atur grup', hakIsu(akun('admin')).kelola === true);
cek('team biasa tidak boleh atur grup, tetap bisa catat isu', hakIsu(akun('team', 'Engineer')).kelola === false && hakIsu(akun('team', 'Engineer')).edit === true);
cek('guest berjabatan Manager tidak boleh', hakIsu(akun('guest', 'Manager')).kelola === false);
cek('General Manager tamu tidak boleh', hakIsu(akun('team', 'General Manager')).kelola === false);
const rGrup = readFileSync('app/api/project-progress/isu/route.ts', 'utf8');
const rGrupId = readFileSync('app/api/project-progress/isu/[grupId]/route.ts', 'utf8');
cek('buat grup dijaga hak kelola', rGrup.includes('hakIsu(s.akun).kelola)'));
cek('daftar proyek hanya untuk hak kelola', rGrup.includes('if (hak.kelola) {'));
cek('ubah nama & proyek grup dijaga hak kelola', rGrupId.includes('if (!hak.kelola) return galat'));
cek('jabatan akun dibaca dari users', readFileSync('lib/checklist/server.ts', 'utf8').includes(".select('pimpinan,jabatan')"));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
