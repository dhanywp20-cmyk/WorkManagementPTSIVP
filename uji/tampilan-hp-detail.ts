/**
 * uji/tampilan-hp-detail.ts - popup detail jadwal rapi di HP (laporan 13 Okt 2026, 2 tangkapan layar).
 *
 * 1. Panel Riwayat & Mode Penyelesaian berdampingan dengan detail -> di HP detail terjepit jadi garis.
 * 2. Label alur ("Diteruskan", "Dikerjakan") terpotong di tengah kata.
 * 3. Lencana header tertimpa tombol Riwayat/Tutup; email keluar dari kartu "Assign To".
 *
 * Jalankan: npm test -- tampilan-hp-detail
 */
import { readFileSync } from 'fs';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const D = 'app/(portal)/reminder-schedule/_components/';
const popup = readFileSync(D + 'ReminderDetailPopup.tsx', 'utf8');
const mode = readFileSync(D + 'ModePenyelesaianPanel.tsx', 'utf8');
const state = readFileSync(D + 'useStateApproval.ts', 'utf8');
const alur = readFileSync('components/shared/FlowSteps.tsx', 'utf8');
const PANEL_HP = /fixed inset-3 z-20 md:static md:inset-auto md:z-auto md:max-w-sm/;

console.log('\n1. Panel samping jadi lapisan penuh di HP');
cek('panel Riwayat', PANEL_HP.test(popup));
cek('panel Mode Penyelesaian', PANEL_HP.test(mode));
cek('Riwayat tertutup bawaan di layar < 768px', /matchMedia\('\(min-width: 768px\)'\)/.test(state));

console.log('\n2. Label alur tidak terpotong di tengah kata');
cek('kolom tahap tanpa min-w-0 (tidak lebih sempit dari kata terpanjang)', !/flex-1 min-w-0 flex flex-col items-center/.test(alur));
cek('label tanpa break-words', !/font-bold text-center mt-1\.5 leading-tight[^"]*break-words/.test(alur));
cek('garis penghubung per sisi (tetap menyambung)', /left: 0, right: '50%'/.test(alur) && /left: '50%', right: 0/.test(alur));

console.log('\n3. Header & kartu tidak bertumpuk');
cek('lencana memberi ruang tombol kanan atas', /flex flex-wrap gap-2 mb-3 pr-24 sm:pr-40/.test(popup));
cek('email Assign To dipotong rapi', /<div className="min-w-0">\s*<p className="text-sm font-bold text-slate-800 break-words">/.test(popup) && /text-xs truncate/.test(popup));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
