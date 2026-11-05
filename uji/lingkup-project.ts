import { filterLingkup, hitungLingkupProject, type LingkupProject } from '@/lib/project-scope';

const kasus: { nama: string; l: LingkupProject; bocor: boolean }[] = [
  { nama: 'Admin / Team PTS (lingkup penuh)',
    l: { semua: true, divisi: [], namaSendiri: 'Dhany' }, bocor: true },
  { nama: 'Sales biasa (guest)',
    l: { semua: false, divisi: [], namaSendiri: 'Fajar Setiawan' }, bocor: false },
  { nama: 'Sales Internal (punya divisi terpetakan)',
    l: { semua: false, divisi: ['Enterprise', 'SGP'], namaSendiri: 'Surya' }, bocor: false },
  { nama: 'Tanpa user (belum login)',
    l: { semua: false, divisi: [], namaSendiri: ' ' }, bocor: false },
];

let gagal = 0;
for (const k of kasus) {
  const f = filterLingkup(k.l);
  const tanpaBatas = f === null;
  const ok = tanpaBatas === k.bocor;
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'}  ${k.nama}`);
  console.log(`        filter = ${f === null ? 'TIDAK ADA (lihat semua)' : f}`);
}

function jumlahKondisi(f: string): number {
  let dalamKutip = false, n = 1;
  for (const c of f) {
    if (c === '"') dalamKutip = !dalamKutip;
    else if (c === ',' && !dalamKutip) n++;
  }
  return n;
}

const jahat = filterLingkup({ semua: false, divisi: [], namaSendiri: 'X","sales_name.neq."zz' })!;
const n = jumlahKondisi(jahat);
const aman = n === 1;
console.log(`${aman ? 'OK  ' : 'GAGAL'}  Nama berisi kutip tetap 1 kondisi (dapat ${n})`);
console.log(`        filter = ${jahat}`);
if (!aman) gagal++;

const jahatDivisi = filterLingkup({ semua: false, divisi: ['A","sales_division.neq."B'], namaSendiri: 'Z' })!;
const n2 = jumlahKondisi(jahatDivisi);
const aman2 = n2 === 2;
console.log(`${aman2 ? 'OK  ' : 'GAGAL'}  Divisi berisi kutip tetap 2 kondisi (dapat ${n2})`);
console.log(`        filter = ${jahatDivisi}`);
if (!aman2) gagal++;

type Profil = { nama: string; u: any; bolehSemua: boolean };
const profil: Profil[] = [
  { nama: 'admin',                       u: { id: '1', full_name: 'Admin',  role: 'admin' },                              bolehSemua: true  },
  { nama: 'superadmin',                  u: { id: '2', full_name: 'Super',  role: 'superadmin' },                          bolehSemua: true  },
  { nama: "team PTS access_level 'full'",u: { id: '3', full_name: 'Yoga',   role: 'team', access_level: 'full' },          bolehSemua: true  },
  { nama: "team PTS access_level 'guest'",u:{ id: '4', full_name: 'Pandu',  role: 'team', access_level: 'guest' },         bolehSemua: true  },
  { nama: 'SALES biasa (guest)',         u: { id: '5', full_name: 'Fajar',  role: 'guest', sales_division: 'Enterprise' }, bolehSemua: false },
  { nama: 'SALES role="sales"',          u: { id: '6', full_name: 'Sutarno',role: 'sales', sales_division: 'SGP' },        bolehSemua: false },
];

async function jalankan() {
 for (const p of profil) {
  const l = await hitungLingkupProject(p.u);
  const f = filterLingkup(l);
  const bocor = f === null;
  const ok = bocor === p.bolehSemua;
  if (!ok) gagal++;
  console.log(`${ok ? 'OK  ' : 'GAGAL'}  ${p.nama.padEnd(24)} -> ${bocor ? 'CARI SEMUA' : 'dibatasi: ' + f}`);
 }

 const lSales = await hitungLingkupProject({ id: 's1', full_name: 'Fajar', role: 'guest' } as never);
 const tanpaOpsi  = filterLingkup(lSales, 'nama_sales', 'sales_division');
 const denganOpsi = filterLingkup(lSales, 'nama_sales', 'sales_division', { sertakanTanpaPemilik: true });
 const uji: [string, boolean][] = [
   ['bawaan TIDAK memuat baris tanpa pemilik', !(tanpaOpsi ?? '').includes('is.null')],
   ['opsi memuat baris tanpa pemilik', (denganOpsi ?? '').includes('nama_sales.is.null')],
   ['batas nama sendiri tetap ada', (denganOpsi ?? '').includes('nama_sales.eq."Fajar"')],
   ['yang boleh lihat semua tetap tanpa filter',
     filterLingkup({ semua: true, divisi: [], namaSendiri: 'X' }, 'nama_sales', 'sales_division', { sertakanTanpaPemilik: true }) === null],
 ];
 for (const [nama, ok] of uji) {
   if (!ok) gagal++;
   console.log(`${ok ? 'OK  ' : 'GAGAL'}  ${nama}`);
 }
}
jalankan().then(() => {

  console.log(gagal === 0 ? '\nLULUS' : `\n${gagal} GAGAL`);
  process.exit(gagal ? 1 : 0);
});
