/**
 * uji/olah-reminder.ts - pengelompokan & data pie Reminder Schedule (app/reminder-schedule/_components/olah-data.ts).
 *
 * Fungsi-fungsi itu dipindah dari page.tsx dan ditulis ulang lebih ringkas. Tes ini menjalankan
 * KODE ASLINYA (disalin apa adanya di bawah sebagai acuan) dan versi baru pada data acak, lalu
 * membandingkan hasilnya persis sama.
 *
 * Jalankan: npx tsx uji/olah-reminder.ts
 */
import { kelompokkanReminder, pieKategori, pieDivisiSales, pieTeamPts, pieProduk } from '../app/(portal)/reminder-schedule/_components/olah-data';
import { PIE_COLORS } from '../app/(portal)/reminder-schedule/_components/shared';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

interface R { batch_id?: string | null; project_name?: string | null; title?: string | null; category: string; due_date: string; due_time?: string | null;
  sales_division?: string | null; assign_name?: string | null; product?: string | null }

// ── KODE ASLI (disalin dari page.tsx sebelum dipindah) ──
const asliGrup = (filteredReminders: R[]) => {
  const map = new Map<string, R[]>();
  for (const r of filteredReminders) {
    const key = r.batch_id ? `batch:${r.batch_id}` : `${(r.project_name || r.title || '').trim()}|${r.category}|${r.due_date}|${r.due_time || ''}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.values());
};
const asliProject = (sourceReminders: R[]) => {
  const map: Record<string, number> = {};
  sourceReminders.forEach(r => { const k = r.category; map[k] = (map[k] || 0) + 1; });
  return Object.entries(map).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
};
const asliSales = (sourceReminders: R[]) => {
  const map: Record<string, number> = {};
  sourceReminders.forEach(r => { if (r.sales_division) { map[r.sales_division] = (map[r.sales_division] || 0) + 1; } });
  return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
};
const asliTeam = (sourceReminders: R[]) => {
  const map: Record<string, number> = {};
  sourceReminders.forEach(r => { if (r.assign_name) { map[r.assign_name] = (map[r.assign_name] || 0) + 1; } });
  return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
};
const asliProduk = (sourceReminders: R[]) => {
  const map: Record<string, number> = {};
  sourceReminders.forEach(r => { if (r.product) { map[r.product] = (map[r.product] || 0) + 1; } });
  return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([label, value], i) => ({ label, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
};

// ── data acak deterministik ──
let benih = 12345;
const acak = () => { benih = (benih * 1664525 + 1013904223) % 4294967296; return benih / 4294967296; };
const pilih = <T,>(a: T[]) => a[Math.floor(acak() * a.length)];
const KAT = ['Instalasi', 'Troubleshooting', 'Maintenance', 'Training', 'Internal', ''];
const DIV = ['IVP', 'MVI', 'MLDS', 'DPS', 'FNB', 'SBY', 'MDN', 'BDG', 'JKT', 'SMG', 'BLI', null, undefined, ''];
const buat = (n: number): R[] => Array.from({ length: n }, (_, i) => ({
  batch_id: acak() < 0.3 ? `b${Math.floor(acak() * 6)}` : null,
  project_name: acak() < 0.8 ? `Proyek ${Math.floor(acak() * 9)}` : null, title: acak() < 0.5 ? ` Judul ${i % 4} ` : null,
  category: pilih(KAT), due_date: `2026-10-${String(1 + Math.floor(acak() * 5)).padStart(2, '0')}`, due_time: acak() < 0.5 ? '09:00' : null,
  sales_division: pilih(DIV), assign_name: acak() < 0.7 ? `Orang ${Math.floor(acak() * 15)}` : null, product: acak() < 0.7 ? `Produk ${Math.floor(acak() * 20)}` : '',
}));

console.log('\nOlah data Reminder Schedule setara dengan kode asli');
let semuaSama = true;
for (let uji = 0; uji < 200; uji++) {
  const d = buat(Math.floor(acak() * 80));
  const sama = JSON.stringify(kelompokkanReminder(d)) === JSON.stringify(asliGrup(d))
    && JSON.stringify(pieKategori(d as { category: string }[])) === JSON.stringify(asliProject(d))
    && JSON.stringify(pieDivisiSales(d)) === JSON.stringify(asliSales(d))
    && JSON.stringify(pieTeamPts(d)) === JSON.stringify(asliTeam(d))
    && JSON.stringify(pieProduk(d)) === JSON.stringify(asliProduk(d));
  if (!sama) { semuaSama = false; break; }
}
cek('200 himpunan data acak: grup + 4 pie persis sama dengan versi asli', semuaSama);
cek('daftar kosong -> tanpa kelompok & pie kosong', kelompokkanReminder([]).length === 0 && pieProduk([]).length === 0);
const contoh: R[] = [
  { batch_id: 'x', project_name: 'A', category: 'K', due_date: '2026-10-01' }, { batch_id: 'x', project_name: 'A', category: 'K', due_date: '2026-10-02' },
  { project_name: 'B', category: 'K', due_date: '2026-10-01', due_time: '09:00' }, { project_name: ' B ', category: 'K', due_date: '2026-10-01', due_time: '09:00' },
];
cek('satu batch_id digabung walau tanggal beda; nama dengan spasi ikut digabung', kelompokkanReminder(contoh).map(g => g.length).join(',') === '2,2');
cek('pie divisi sales dibatasi 8, produk 12', pieDivisiSales(Array.from({ length: 20 }, (_, i) => ({ sales_division: `D${i}` }))).length === 8
  && pieProduk(Array.from({ length: 30 }, (_, i) => ({ product: `P${i}` }))).length === 12);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
