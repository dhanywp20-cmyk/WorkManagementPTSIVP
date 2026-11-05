import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean, ket = '') => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}${ket ? ' - ' + ket : ''}`); } };
const baca = (f: string) => readFileSync(f, 'utf8');
function semua(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? semua(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}
const tanpaKomentar = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const berkas = [...semua('app/(portal)'), ...semua('components')];
console.log('\n1. Konfirmasi & peringatan bawaan peramban');
const confirmBawaan = berkas.filter(f => /window\.confirm\(|(?<![\w.])confirm\(/.test(tanpaKomentar(baca(f))));
cek('tidak ada window.confirm / confirm()', confirmBawaan.length === 0, confirmBawaan.join(', '));
const alertBawaan = berkas.filter(f => /window\.alert\(|(?<![\w.])alert\(/.test(tanpaKomentar(baca(f))));
cek('tidak ada alert()', alertBawaan.length === 0, alertBawaan.join(', '));
cek('Admin Panel 2FA & token DIWAYPI memakai ConfirmDialog',
  /<ConfirmDialog/.test(baca('app/(portal)/dashboard/_components/modal-keamanan.tsx')) && /<ConfirmDialog/.test(baca('app/(portal)/dashboard/_components/profil-integrasi.tsx')));

console.log('\n2. Pemberitahuan memakai Toast bersama');
cek('useNotif tersedia di components/shared', /export function useNotif/.test(baca('components/shared/Toast.tsx')) && /useNotif/.test(baca('components/shared/index.ts')));
cek('Brand PIC memakai InlineToast (bukan kotak sendiri)', (baca('app/(portal)/dashboard/_components/modal-brand-pic.tsx').match(/<InlineToast notif=\{notif\} \/>/g) ?? []).length === 2);
cek('Pustaka memakai Toast bersama', /<Toast notif=\{notif\} \/>/.test(baca('app/(portal)/tools-team/_components/pustaka/DaftarPustaka.tsx')));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
