import { execFileSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const BOLEH = new Set([
  '_kerangka -> dashboard',
  'checklist -> project-progress',
  'analytics-dashboard -> kpi-team',
  'dashboard -> analytics-dashboard',
]);

const modul = p => {
  const m = p.match(/^app\/(?:\(portal\)\/)?([^/]+)/);
  return m ? m[1] : null;
};

const berkas = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'app'], { encoding: 'utf8' })
  .split('\n').filter(f => /\.(ts|tsx)$/.test(f) && existsSync(f));

const pelanggar = [];
for (const f of berkas) {
  const asal = modul(f);
  for (const [, imp] of readFileSync(f, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    let tujuan;
    if (imp.startsWith('@/app/')) tujuan = 'app/' + imp.slice(6);
    else if (imp.startsWith('.')) tujuan = path.posix.normalize(path.posix.join(path.posix.dirname(f), imp));
    else continue;
    const ke = modul(tujuan);
    if (!ke || ke === asal || !tujuan.includes('/_components/')) continue;
    if (!BOLEH.has(`${asal} -> ${ke}`)) pelanggar.push(`${f} -> ${imp}`);
  }
}

console.log(`\nBatas antar modul app/ (${berkas.length} berkas)`);
for (const p of pelanggar) console.log(`  GAGAL ${p} (pindahkan yang dipakai bersama ke lib/ atau components/shared/)`);
if (pelanggar.length) process.exit(1);
console.log('  ok   tidak ada impor _components modul lain di luar daftar BOLEH');
