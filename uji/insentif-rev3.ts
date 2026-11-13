import { calculateStandardScheme } from '@/app/(portal)/incentive-pts/_components/calc';
import { SKEMA_BAWAAN, periksaSkema, type SkemaInsentif } from '@/lib/incentive/scheme';
import { hitungSplitTahap } from '@/lib/incentive/tahap';
import { terapkanRedistribusi } from '@/lib/incentive/redistribusi';
import { siapkanDataSummary } from '@/app/(portal)/incentive-pts/_components/exportPengajuan-data';
import { readFileSync } from 'fs';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean) => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}`); } };

const POOL = 5_000_000;
const sk: SkemaInsentif = SKEMA_BAWAAN;
const dua = [{ user_id: 'u-a', user_name: 'Support A' }, { user_id: 'u-b', user_name: 'Support B' }];
const satu = [dua[0]];
const hitung = (mode: 'onsite' | 'remote', supports: typeof dua, picSupervisor = false) => calculateStandardScheme(
  sk, POOL, mode, picSupervisor ? 'u-sup' : 'u-pic', picSupervisor ? 'Supervisor' : 'PIC',
  'u-mgr', 'Manager', 'u-sup', 'Supervisor', supports, mode === 'remote' ? 'Installer Cabang' : null, null);
const rp = (r: ReturnType<typeof hitung>, peran: string) => r.filter(s => s.role === peran).map(s => s.amount);
const total = (r: ReturnType<typeof hitung>) => r.reduce((n, s) => n + s.amount, 0);

console.log('\nSkema Rev3');
cek('skema bawaan Rev3 lolos validasi (semua peta porsi = 100%)', periksaSkema(sk).filter(m => !m.peringatan).length === 0);
const rusak: SkemaInsentif = { ...sk, porsiRemote: { ...sk.porsiRemote, adaSupport: { ...sk.porsiRemote.adaSupport, pic: 33 } } };
cek('peta Remote yang totalnya bukan 100% ditolak', periksaSkema(rusak).some(m => m.bidang === 'porsiRemote'));

console.log('\n1. Onsite, 1 PIC + 2 Support');
const v1 = hitung('onsite', dua);
cek('PIC 3.000.000', rp(v1, 'pic').join() === '3000000');
cek('Support 425.000 × 2', rp(v1, 'support').join() === '425000,425000');
cek('Supervisor 750.000 · Manager 400.000', rp(v1, 'supervisor').join() === '750000' && rp(v1, 'manager').join() === '400000');
cek('total tepat 5.000.000', total(v1) === POOL);

console.log('\n2. Onsite, tahun tanpa Support (17% diserap PIC)');
const v2 = hitung('onsite', []);
cek('PIC 3.850.000 · Supervisor 750.000 · Manager 400.000',
  rp(v2, 'pic').join() === '3850000' && rp(v2, 'supervisor').join() === '750000' && rp(v2, 'manager').join() === '400000');

console.log('\n3. Remote + 1 Support');
const v3 = hitung('remote', satu);
cek('PIC 1.645.000 · Cabang 1.500.000 · Support 620.000 · Supervisor 825.000 · Manager 410.000',
  rp(v3, 'pic').join() === '1645000' && rp(v3, 'installer').join() === '1500000' && rp(v3, 'support').join() === '620000'
  && rp(v3, 'supervisor').join() === '825000' && rp(v3, 'manager').join() === '410000');
const tahap = sk.tranche.map(t => hitungSplitTahap({ sk, splits: v3, pool: POOL, nomorTahap: t.nomor, persenTahap: t.persen }));
cek('Cabang lunas 100% di Tahun 1, tidak ikut 50/35/15', tahap.map(t => t.filter(s => s.role === 'installer').reduce((n, s) => n + s.amount, 0)).join() === '1500000,0,0');
cek('PIC tetap 50/35/15 (822.500 / 575.750 / 246.750)', tahap.map(t => t.find(s => s.role === 'pic')?.amount).join() === '822500,575750,246750');
cek('jumlah semua tahap = 5.000.000', tahap.flat().reduce((n, s) => n + s.amount, 0) === POOL);

console.log('\n4. Remote tanpa Support');
const v4 = hitung('remote', []);
cek('PIC 2.265.000 · Cabang 1.500.000 · Supervisor 825.000 · Manager 410.000',
  rp(v4, 'pic').join() === '2265000' && rp(v4, 'installer').join() === '1500000'
  && rp(v4, 'supervisor').join() === '825000' && rp(v4, 'manager').join() === '410000' && rp(v4, 'support').length === 0);

console.log('\n5. Supervisor jadi PIC');
const v5 = hitung('onsite', dua, true);
cek('Onsite + 2 Support: PIC 3.000.000 · Support 425.000 × 2 · Manager 1.150.000 · tanpa baris Supervisor',
  rp(v5, 'pic').join() === '3000000' && rp(v5, 'support').join() === '425000,425000'
  && rp(v5, 'manager').join() === '1150000' && rp(v5, 'supervisor').length === 0);
const v5b = hitung('onsite', [], true);
cek('Onsite tanpa Support: PIC 77% · Manager 23%', rp(v5b, 'pic').join() === '3850000' && rp(v5b, 'manager').join() === '1150000');
const v5c = hitung('remote', satu, true);
cek('Remote: Supervisor 0% · Manager 24,7% (1.235.000)', rp(v5c, 'manager').join() === '1235000' && rp(v5c, 'supervisor').length === 0);

console.log('\n6. Resign — sisa tahap dibagi rata ke Tim PTS aktif');
const anggota = [
  { id: 'u-a', full_name: 'Support A', role: 'team', team_type: 'PTS IVP', tanggal_nonaktif: '2027-06-30' },
  { id: 'u-pic', full_name: 'PIC', role: 'team', team_type: 'PTS IVP' },
  { id: 'u-sup', full_name: 'Supervisor', role: 'team', team_type: 'PTS IVP' },
  { id: 'u-x', full_name: 'Anggota X', role: 'team', team_type: 'PTS IVP' },
  { id: 'u-keluar', full_name: 'Sudah keluar', role: 'team', team_type: 'PTS IVP', tanggal_nonaktif: '2026-01-01' },
  { id: 'u-sales', full_name: 'Sales', role: 'guest', team_type: 'Guest' },
];
const t1 = hitungSplitTahap({ sk, splits: v1, pool: POOL, nomorTahap: 1, persenTahap: 50 });
const t2 = hitungSplitTahap({ sk, splits: v1, pool: POOL, nomorTahap: 2, persenTahap: 35 });
const r1 = terapkanRedistribusi({ splits: t1, anggota, kelompokPTS: ['PTS IVP'], tahunBayar: 2027, hariIni: '2027-01-15' });
cek('Tahun 1 (jatuh tempo sebelum resign) tetap dibayar ke Support A', r1.log.length === 0 && r1.splits.some(s => s.user_id === 'u-a' && s.amount === 212500));
const r2 = terapkanRedistribusi({ splits: t2, anggota, kelompokPTS: ['PTS IVP'], tahunBayar: 2028, hariIni: '2028-01-15' });
const bagianA = t2.find(s => s.user_id === 'u-a')!.amount;
const baru = r2.splits.filter(s => s.role === 'redistribusi');
cek('Tahun 2: Support A tidak lagi menerima', !r2.splits.some(s => s.user_id === 'u-a'));
cek('bagian A dibagi rata ke 3 anggota PTS aktif (bukan sales / yang sudah keluar)',
  baru.length === 3 && baru.every(s => ['u-pic', 'u-sup', 'u-x'].includes(s.user_id)) && Math.max(...baru.map(s => s.amount)) - Math.min(...baru.map(s => s.amount)) <= 1);
cek('nominal redistribusi = bagian A, total tahap tidak berubah',
  baru.reduce((n, s) => n + s.amount, 0) === bagianA && r2.splits.reduce((n, s) => n + s.amount, 0) === t2.reduce((n, s) => n + s.amount, 0));
cek('tercatat di log redistribusi dengan sumber & penerima', r2.log.length === 1 && r2.log[0].sumber_nama === 'Support A' && r2.log[0].penerima.length === 3 && baru.every(s => s.redistribusi_dari === 'Support A'));
const r3 = terapkanRedistribusi({ splits: hitungSplitTahap({ sk, splits: v3, pool: POOL, nomorTahap: 1, persenTahap: 50 }), anggota: [...anggota, { id: '', full_name: 'Installer Cabang', tanggal_nonaktif: '2020-01-01' }], kelompokPTS: ['PTS IVP'], tahunBayar: 2027, hariIni: '2027-01-15' });
cek('porsi PTS Cabang tidak ikut redistribusi', r3.splits.some(s => s.role === 'installer' && s.amount === 1_500_000));

console.log('\nRekap Finance & batch');
const proyek = { id: 'p1', project_name: 'Proyek X', incentive_value: POOL, mode_penyelesaian: 'onsite', bast_date: '2026-03-01', pic_id: 'u-pic', assign_name: 'PIC' } as unknown as Parameters<typeof siapkanDataSummary>[0]['projects'][number];
const org = [
  { id: 'u-pic', full_name: 'PIC', jabatan: 'Staff', atasan_id: 'u-sup' },
  { id: 'u-sup', full_name: 'Supervisor', jabatan: 'Supervisor', atasan_id: 'u-mgr' },
  { id: 'u-mgr', full_name: 'Manager', jabatan: 'Manager', atasan_id: null },
  { id: 'u-a', full_name: 'Support A', jabatan: 'Staff', tanggal_nonaktif: '2027-06-30' },
];
const rekap = siapkanDataSummary({
  projects: [proyek], supportsMap: new Map([['Proyek X', [{ user_id: 'u-a', user_name: 'Support A' }]]]), orgList: org,
  managerUserId: 'u-mgr', managerName: 'Manager', sk, tahapUrut: sk.tranche, totalPersenTahap: 100,
});
const embA = rekap.perOrangTahun.get('Support A');
cek('rekap: Support A hanya menerima tahap 2027 (jatuh tempo sebelum resign)', embA?.get(2027) === 425000 && !embA?.get(2028) && !embA?.get(2029));
cek('rekap: tahap 2028 & 2029 milik A tampil sebagai baris "Redistribusi dari"',
  rekap.redistribusiList.map(r => `${r.dari}|${r.proyek}|${r.tahap}|${r.tahun}|${r.jumlah}`).join() === 'Support A|Proyek X|2|2028|297500,Support A|Proyek X|3|2029|127500');
const batch = readFileSync('app/(portal)/incentive-pts/_components/calc-batch.ts', 'utf8');
cek('batch memakai terapkanRedistribusi & mencatat log incentive_redistribusi', /terapkanRedistribusi\(/.test(batch) && /from\('incentive_redistribusi'\)\.insert/.test(batch));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
