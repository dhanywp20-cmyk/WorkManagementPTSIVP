/**
 * Modul skema insentif harus bisa dimuat PERTAMA dalam urutan apa pun.
 *
 * Galat produksi "Cannot access 'l' before initialization" di /ticketing (17x, 4 orang, sejak 23 Okt):
 * incentive-scheme-aturan membaca INCENTIVE_CATEGORIES saat modul dimuat, padahal konstanta itu tinggal
 * di incentive-scheme-kategori yang mengimpor -simpan yang mengimpor -aturan (lingkaran). Bila -kategori
 * termuat lebih dulu (Ticketing mengimpornya lewat NewTicketModal), -aturan berjalan saat konstanta itu
 * belum ada. Uji ini memuat tiap modul sebagai yang pertama di proses Node baru.
 */
import { spawnSync } from 'node:child_process';

let lulus = 0, gagal = 0;
const cek = (nama: string, ok: boolean, info = '') => {
  if (ok) lulus++; else gagal++;
  console.log(`${ok ? 'lulus' : 'GAGAL'}  ${nama}${ok || !info ? '' : `\n         ${info}`}`);
};

const MODUL = [
  'lib/incentive-scheme-kategori.ts',
  'lib/incentive-scheme-simpan.ts',
  'lib/incentive-scheme-aturan.ts',
  'lib/incentive-scheme.ts',
];

for (const m of MODUL) {
  const r = spawnSync('npx', ['--yes', 'tsx@4', '-e', JSON.stringify(`import('./${m}')`)], { encoding: 'utf8', shell: process.platform === 'win32' });
  const galat = ((r.stderr || '') + (r.stdout || '')).split('\n').find(b => /^\w*Error/.test(b.trim())) ?? '';
  cek(`${m} bisa dimuat pertama`, r.status === 0, galat.trim());
}

console.log(`\n${lulus}/${lulus + gagal} lulus`);
process.exit(gagal ? 1 : 0);
