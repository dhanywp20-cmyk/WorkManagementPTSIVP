import { hitungJadwal, hitungTiket, rentangPeriode, tanggalLokal } from '../app/(portal)/dashboard/_components/beranda/periode';

let gagal = 0;
const cek = (nama: string, ok: boolean) => { console.log(`  ${ok ? 'ok  ' : 'GAGAL'} ${nama}`); if (!ok) gagal++; };

const deret = {
  tiket: [
    { t: '2026-11-01', s: 'Solved' }, { t: '2026-11-01', s: 'Pending' }, { t: '2026-11-03', s: 'Overdue' },
    { t: '2026-11-03', s: 'Cancelled' }, { t: '2026-09-01', s: 'Solved' },
  ],
  jadwal: [
    { t: '2026-11-01', s: 'done' }, { t: '2026-11-02', s: 'pending' }, { t: '2026-11-05', s: 'pending' },
    { t: '2026-11-04', s: 'cancelled' }, { t: '2026-12-20', s: 'pending' },
  ],
};

const t = hitungTiket(deret, '2026-11-01', '2026-11-05');
cek('tiket di luar periode & batal tidak dihitung', t.total === 3);
cek('selesai + belum = total', t.selesai + t.belum === t.total);
cek('tiket overdue terhitung', t.terlambat === 1);
cek('jumlah titik grafik = total', t.titik.reduce((n, p) => n + p.total, 0) === t.total);
cek('satu titik per hari sampai 45 hari', t.titik.length === 5);

const j = hitungJadwal(deret, '2026-11-01', '2026-11-05', '2026-11-05');
cek('jadwal jatuh tempo lewat & belum selesai = terlambat', j.terlambat === 1);
cek('jadwal hari ini masih berjalan', j.berjalan === 1);
cek('selesai + berjalan + terlambat = total', j.selesai + j.berjalan + j.terlambat === j.total);

const kini = new Date('2026-11-05T10:00:00');
const r30 = rentangPeriode('30', deret, kini);
cek('30 hari mencakup hari ini', r30.akhir === tanggalLokal(kini) && r30.mulai === '2026-10-07');
cek('tahun ini mulai 1 Januari', rentangPeriode('tahun', deret, kini).mulai === '2026-01-01');
cek('semua data mulai dari baris tertua', rentangPeriode('semua', deret, kini).mulai === '2026-09-01');
cek('rentang panjang diringkas per minggu', hitungTiket(deret, '2026-01-01', '2026-11-05').titik.length < 50);

const kosong = hitungTiket(undefined, '2026-11-01', '2026-11-05');
cek('tanpa data: persen 0, bukan NaN', kosong.persen === 0 && kosong.total === 0);

console.log(gagal ? `GAGAL: ${gagal}` : 'LULUS');
process.exit(gagal ? 1 : 0);
