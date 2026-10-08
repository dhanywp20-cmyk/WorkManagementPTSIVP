/**
 * uji/nav-bawah.ts - urutan & label menu bawah HP / APK (app/dashboard/_components/nav-bawah.ts).
 *
 * Jalankan: npx tsx uji/nav-bawah.ts
 */
import { LABEL_PENDEK, PRIORITAS_MENU, TOMBOL_TERLIHAT, urutNav } from '../app/(portal)/dashboard/_components/nav-bawah';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}
const k = (xs: { key: string }[]) => xs.map(x => x.key).join(',');

//  Urutan sidebar (kelompok Learning -> Project -> Internal Daily).
const sidebar = ['kpi-team', 'learning-center', 'summary-project', 'reminder-schedule', 'request-design-project',
  'ticket-troubleshooting', 'project-progress', 'tools-team', 'picket-showroom', 'daily-report'].map(key => ({ key }));

const u = urutNav(sidebar);
cek('semua menu tetap ada (tidak ada yang hilang)', u.length === sidebar.length && new Set(u.map(x => x.key)).size === sidebar.length);
cek('menu harian di depan: Schedule, Ticketing, Progress', k(u.slice(0, 3)) === 'reminder-schedule,ticket-troubleshooting,project-progress', k(u));
cek('4 menu pertama + Dashboard = 5 tombol layar pertama', TOMBOL_TERLIHAT === 5);
cek('urutan mengikuti prioritas', k(u) === PRIORITAS_MENU.filter(p => sidebar.some(s => s.key === p)).join(','), k(u));

//  Akun sales / guest: menu terbatas -> urutan tetap rapi.
const terbatas = urutNav([{ key: 'tech-note' }, { key: 'request-design-project' }, { key: 'form-bast' }]);
cek('akun terbatas: menu yang ada maju ke depan', k(terbatas) === 'request-design-project,form-bast,tech-note', k(terbatas));
const asing = urutNav([{ key: 'menu-baru' }, { key: 'daily-report' }, { key: 'menu-lain' }]);
cek('menu baru (tak dikenal) di belakang, urutan asli', k(asing) === 'daily-report,menu-baru,menu-lain', k(asing));
cek('urutNav tidak mengubah array asli', k(sidebar).startsWith('kpi-team'));
cek('setiap menu prioritas punya label pendek', PRIORITAS_MENU.every(p => !!LABEL_PENDEK[p]));
cek('label pendek muat 1/5 layar (<= 13 huruf)', Object.values(LABEL_PENDEK).every(l => l.length <= 13), Object.values(LABEL_PENDEK).filter(l => l.length > 13).join(', '));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
