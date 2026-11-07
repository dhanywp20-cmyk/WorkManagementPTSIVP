import { execFileSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

const berkas = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'lib', 'components'], { encoding: 'utf8' })
  .split('\n').filter(f => /\.(ts|tsx)$/.test(f) && existsSync(f));
const pelanggar = berkas.filter(f => /from ['"](@\/app\/|(\.\.\/)+app\/)/.test(readFileSync(f, 'utf8')));

console.log(`\nBatas lib/components -> app (${berkas.length} berkas)`);
for (const f of pelanggar) console.log(`  GAGAL ${f} mengimpor dari app/`);
if (pelanggar.length) process.exit(1);
console.log('  ok   tidak ada impor dari app/');
