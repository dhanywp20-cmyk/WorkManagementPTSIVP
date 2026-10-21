/**
 * uji/status-seragam.ts - status yang SAMA berwarna sama di menu mana pun.
 *
 * Aturan (lib/desain.ts STATUS_KE_WARNA): menunggu (Pending, Waiting Approval, Perlu Revisi) = amber,
 * sedang berjalan = biru, selesai (Completed/Solved/Done/Approved/Paid) = hijau, ditolak/terlambat = merah,
 * batal = abu-abu. Dulu Completed ungu di Request Design Project, Rejected abu-abu di Tech Note, dan
 * Pending ticket biru di chart KPI tapi kuning di lencana Ticketing.
 *
 * Jalankan: npm test -- status-seragam
 */
import { readFileSync } from 'fs';
import { warnaUntukStatus, WARNA_STATUS_TICKET } from '../lib/desain';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean, ket = '') => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}${ket ? ' - ' + ket : ''}`); } };

console.log('\n1. Peta semantik bersama');
for (const [s, w] of [
  ['Pending', 'awas'], ['Waiting Approval', 'awas'], ['Perlu Revisi', 'awas'], ['pending review', 'awas'],
  ['In Progress', 'info'], ['in_progress', 'info'], ['Processed', 'info'],
  ['Completed', 'berhasil'], ['Solved', 'berhasil'], ['done', 'berhasil'], ['Approved', 'berhasil'], ['Paid', 'berhasil'],
  ['Rejected', 'bahaya'], ['Ditolak', 'bahaya'], ['Overdue', 'bahaya'],
  ['Cancelled', 'netral'], ['tak dikenal', 'netral'],
] as const) cek(`${s} -> ${w}`, warnaUntukStatus(s) === w, warnaUntukStatus(s));

console.log('\n2. Keluarga warna per menu (dibaca dari sumbernya)');
//  Keluarga dari kelas Tailwind atau hex yang dipakai peta status tiap menu.
const HEX: Record<string, string> = {
  '#d97706': 'amber', '#f59e0b': 'amber', '#92400e': 'amber', '#b45309': 'amber',
  '#059669': 'hijau', '#10b981': 'hijau', '#065f46': 'hijau', '#047857': 'hijau', '#15803d': 'hijau',
  '#dc2626': 'merah', '#ef4444': 'merah', '#b91c1c': 'merah',
  '#2563eb': 'biru', '#3b82f6': 'biru', '#1e40af': 'biru', '#0284c7': 'biru',
  '#6b7280': 'abu', '#374151': 'abu', '#4b5563': 'abu',
  '#7c3aed': 'ungu', '#8b5cf6': 'ungu',
};
const TW: Record<string, string> = { amber: 'amber', yellow: 'kuning', emerald: 'hijau', green: 'hijau', red: 'merah', rose: 'merah', blue: 'biru', purple: 'ungu', violet: 'ungu', slate: 'abu', gray: 'abu' };
function keluarga(baris: string): string {
  const tw = baris.match(/(?:text|bg)-(amber|yellow|emerald|green|red|rose|blue|purple|violet|slate|gray)-\d00/);
  if (tw) return TW[tw[1]];
  const hx = baris.match(/(?:color|border|utama)\s*:\s*'(#[0-9a-f]{6})'/i) ?? baris.match(/'(#[0-9a-f]{6})'/i);
  return hx ? (HEX[hx[1].toLowerCase()] ?? hx[1]) : '?';
}
function baris(f: string, kunci: string): string {
  const s = readFileSync(f, 'utf8');
  const m = s.match(new RegExp(`^\\s*['"]?${kunci}['"]?\\s*:.*$`, 'm'));
  return m ? m[0] : '';
}
const P = 'app/(portal)/';
const HARUS: [string, string, string][] = [
  //  [berkas, kunci status, keluarga]
  [`${P}ticketing/_components/shared.ts`, 'Pending', 'amber'],
  [`${P}ticketing/_components/shared.ts`, 'Solved', 'hijau'],
  [`${P}ticketing/_components/shared.ts`, 'Rejected', 'merah'],
  [`${P}ticketing/_components/shared.ts`, 'In Progress', 'biru'],
  [`${P}form-require-project/_components/shared.ts`, 'pending', 'amber'],
  [`${P}form-require-project/_components/shared.ts`, 'in_progress', 'biru'],
  [`${P}form-require-project/_components/shared.ts`, 'completed', 'hijau'],
  [`${P}form-require-project/_components/shared.ts`, 'rejected', 'merah'],
  [`${P}reminder-schedule/_components/shared.ts`, 'pending', 'amber'],
  [`${P}reminder-schedule/_components/shared.ts`, 'done', 'hijau'],
  [`${P}reminder-schedule/_components/shared.ts`, 'cancelled', 'abu'],
  [`${P}tech-note/_components/shared.ts`, 'pending', 'amber'],
  [`${P}tech-note/_components/shared.ts`, 'approved', 'hijau'],
  [`${P}tech-note/_components/shared.ts`, 'revision', 'amber'],
  [`${P}tech-note/_components/shared.ts`, 'rejected', 'merah'],
  [`${P}daily-report/_components/bantu-halaman.tsx`, 'pending', 'amber'],
  [`${P}daily-report/_components/bantu-halaman.tsx`, 'completed', 'hijau'],
  [`${P}incentive-pts/_components/calc-format.ts`, 'pending', 'amber'],
  [`${P}incentive-pts/_components/calc-format.ts`, 'paid', 'hijau'],
];
for (const [f, k, w] of HARUS) {
  const b = baris(f, k);
  cek(`${f.replace(P, '').split('/')[0]} ${k} = ${w}`, keluarga(b) === w, b.trim().slice(0, 110) || 'kunci tidak ketemu');
}

console.log('\n3. Chart ticket sejalan dengan lencana');
cek('Pending amber', HEX[WARNA_STATUS_TICKET['Pending']] === 'amber', WARNA_STATUS_TICKET['Pending']);
cek('Solved hijau', HEX[WARNA_STATUS_TICKET['Solved']] === 'hijau');
cek('Overdue merah', HEX[WARNA_STATUS_TICKET['Overdue']] === 'merah');
cek('Process Repair biru (sedang dikerjakan)', HEX[WARNA_STATUS_TICKET['Process Repair']] === 'biru');
cek('warna seri chart tetap berbeda satu sama lain', new Set(Object.values(WARNA_STATUS_TICKET)).size === Object.keys(WARNA_STATUS_TICKET).length);

console.log('\n4. Kepala halaman tanpa warna per menu');
const kepala = readFileSync('components/shared/PageHeader.tsx', 'utf8');
cek('PageHeader memakai warna merek', /inset 0 2px 0 var\(--merek-utama\)/.test(kepala) && !/\$\{color\}/.test(kepala));
const { execSync } = require('child_process') as typeof import('child_process');
const pemanggil = execSync('git grep -l "<PageHeader" -- app', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const berwarna = pemanggil.filter(f => /<PageHeader\b[^>]*\scolor=/.test(readFileSync(f, 'utf8')));
cek(`tidak ada menu yang memberi warna sendiri ke PageHeader (${pemanggil.length} halaman)`, pemanggil.length > 5 && berwarna.length === 0, berwarna.join(', '));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
