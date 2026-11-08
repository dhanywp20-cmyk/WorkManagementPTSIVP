import { readFileSync } from 'node:fs';
import { periksaIsianTerbit } from '../../lib/lisensi/inti';
import { periksaKunci, terbitkanKunci } from '../../lib/lisensi/server';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const berkasPrivat = arg('privat');
const privat = process.env.LISENSI_KUNCI_PRIVAT || (berkasPrivat ? readFileSync(berkasPrivat, 'utf8') : '');
if (!privat.trim()) {
  console.error('Pakai: npx tsx scripts/lisensi/terbitkan.ts --privat <berkas> --pelanggan "PT Contoh" --edisi pro|lite [--domain a.com,b.com] [--sampai YYYY-MM-DD] [--demo] [--pemilik]');
  process.exit(1);
}
const hariIni = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const cek = periksaIsianTerbit({
  pelanggan: arg('pelanggan'), edisi: arg('edisi'), domain: (arg('domain') ?? '').split(','), kedaluwarsa: arg('sampai') ?? null,
  pemilik: process.argv.includes('--pemilik'), demo: process.argv.includes('--demo'),
}, hariIni);
if (!cek.ok) { console.error(cek.galat); process.exit(1); }
const { kunci, klaim } = terbitkanKunci(cek.isian, privat);
const contoh = klaim.domain.find(d => !d.includes('*')) ?? 'localhost';
console.log(JSON.stringify(klaim, null, 2));
console.log(`\nPeriksa (${contoh}):`, periksaKunci(kunci, contoh).sah ? 'sah' : 'TIDAK sah');
console.log(`\nLISENSI_KUNCI=${kunci}`);
