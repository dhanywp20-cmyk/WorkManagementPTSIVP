import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const keluar = process.argv[2];
if (!keluar) { console.error('Pakai: npx tsx scripts/lisensi/buat-pasangan-kunci.ts <folder-di-luar-repo>'); process.exit(1); }
const privat = path.join(keluar, 'kunci-privat-lisensi.txt');
if (existsSync(privat)) { console.error(`${privat} sudah ada. Pindahkan dulu bila memang ingin mengganti kunci.`); process.exit(1); }
mkdirSync(keluar, { recursive: true });
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
writeFileSync(privat, `${privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')}\n`, { mode: 0o600 });
const publik = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
writeFileSync(path.join(keluar, 'kunci-publik-lisensi.txt'), `${publik}\n`);
console.log(`Kunci privat: ${privat}`);
console.log(`Kunci publik (tempel ke lib/lisensi/kunci-publik.ts): ${publik}`);
console.log('Semua kunci lisensi lama tidak berlaku lagi setelah kunci publik diganti.');
