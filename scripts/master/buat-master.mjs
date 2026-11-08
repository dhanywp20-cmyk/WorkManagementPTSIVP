import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { berkasMasuk, buangMenuPemilik, bersihkanSql, cariRahasia, rapikanPaket } from './inti.mjs';

const arg = (nama, awal = null) => { const i = process.argv.indexOf(`--${nama}`); return i > 0 ? process.argv[i + 1] : awal; };
const ada = nama => process.argv.includes(`--${nama}`);

const akar = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const komit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', cwd: akar }).trim();
const versi = arg('versi', new Date().toISOString().slice(0, 10));
const skema = arg('skema');
const keluar = path.resolve(arg('keluar', path.join(akar, 'hasil-master')));
if (!skema && !ada('tanpa-skema')) {
  console.error('Sertakan --skema <folder hasil ekspor skema>, atau --tanpa-skema untuk uji paket tanpa database.');
  process.exit(1);
}

const nama = `work-management-master-${versi}`;
const tahap = path.join(keluar, nama);
fs.rmSync(tahap, { recursive: true, force: true });
fs.mkdirSync(tahap, { recursive: true });

const daftar = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', cwd: akar }).split('\0').filter(Boolean).filter(berkasMasuk);
const UBAH = {
  'app/(portal)/_kerangka/daftar-menu.tsx': buangMenuPemilik,
  'package.json': rapikanPaket,
};
for (const f of daftar) {
  const asal = path.join(akar, f), tujuan = path.join(tahap, f);
  if (!fs.existsSync(asal)) continue;
  fs.mkdirSync(path.dirname(tujuan), { recursive: true });
  if (UBAH[f]) fs.writeFileSync(tujuan, UBAH[f](fs.readFileSync(asal, 'utf8')));
  else fs.copyFileSync(asal, tujuan);
}

const panduan = path.join(akar, 'docs', 'master');
fs.mkdirSync(path.join(tahap, 'PANDUAN'), { recursive: true });
for (const f of fs.readdirSync(panduan)) {
  if (f === 'README.md') fs.copyFileSync(path.join(panduan, f), path.join(tahap, 'README.md'));
  else fs.copyFileSync(path.join(panduan, f), path.join(tahap, 'PANDUAN', f));
}

if (skema) {
  const tujuanSkema = path.join(tahap, 'skema');
  fs.mkdirSync(tujuanSkema, { recursive: true });
  for (const f of fs.readdirSync(skema).filter(x => x.endsWith('.sql')).sort()) {
    fs.writeFileSync(path.join(tujuanSkema, f), bersihkanSql(fs.readFileSync(path.join(skema, f), 'utf8')));
  }
  const demo = path.join(akar, 'scripts/master/demo');
  for (const f of fs.readdirSync(demo).filter(x => x.endsWith('.sql'))) fs.copyFileSync(path.join(demo, f), path.join(tujuanSkema, f));
}

fs.writeFileSync(path.join(tahap, 'VERSI.txt'), [
  `Work Management Platform - file master ${versi}`,
  `Komit sumber: ${komit}`,
  `Dibuat: ${new Date().toISOString()}`,
  `Skema database: ${skema ? 'ada di folder skema/' : 'TIDAK disertakan (paket uji)'}`,
  '',
].join('\n'));

const temuan = [];
const telusur = d => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { telusur(p); continue; }
    if (!/\.(ts|tsx|js|mjs|cjs|json|md|sql|txt|example|yml|yaml)$/.test(e.name) && !e.name.startsWith('.env')) continue;
    const r = cariRahasia(fs.readFileSync(p, 'utf8'));
    if (r.length) temuan.push(`${path.relative(tahap, p)}: ${r.join(', ')}`);
  }
};
telusur(tahap);
if (temuan.length) {
  console.error(`Paket dibatalkan, ada data rahasia:\n${temuan.join('\n')}`);
  process.exit(1);
}

const zip = path.join(keluar, `${nama}.zip`);
fs.rmSync(zip, { force: true });
if (process.platform === 'win32') {
  execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${tahap}\\*' -DestinationPath '${zip}' -Force`], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-qr', zip, '.'], { cwd: tahap, stdio: 'inherit' });
}
if (!ada('simpan-folder')) fs.rmSync(tahap, { recursive: true, force: true });
console.log(`File master: ${zip} (${daftar.length} berkas kode, komit ${komit})`);
