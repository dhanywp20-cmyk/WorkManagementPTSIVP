/**
 * uji/desain3d-template-lensa.ts - Template Mapping & Immersive memakai lensa NYATA Panasonic PT-MZ882:
 *  - data lensa template (inti/lensaPanasonic.ts) = Pustaka (migrasi 057, kalkulator Panasonic) - bidang demi bidang;
 *  - tiap proyektor template: zoom di dalam rentang lensanya, lens shift di dalam daerah lensa;
 *  - jarak lempar template = rumus Panasonic L = A × diagonal − B pada zoom itu (lewat jarakUntukLebar).
 *
 * Jalankan: npx tsx uji/desain3d-template-lensa.ts
 */
import { readFileSync } from 'fs';
import type { EntriPustaka } from '../lib/pustaka';
import {
  batasShift, bendaBaru, daftarRuang, isiDariPustaka, LENSA_MZ882, lensaMZ882, templateRuang, zoomLensa, type Benda,
} from '../app/(portal)/tools-team/_components/desain3d/inti';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, catatan = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${catatan ? ' - ' + catatan : ''}`); }
}

const sql = readFileSync('supabase/migrations/057_pustaka_proyektor_panasonic.sql', 'utf8');
const entri: EntriPustaka[] = [...sql.matchAll(/\('proyektor', '((?:[^']|'')+)', '((?:[^']|'')+)'\)/g)]
  .map((m, i) => ({ id: `e${i}`, jenis: 'proyektor', nama: m[1].replace(/''/g, "'"), data: JSON.parse(m[2].replace(/''/g, "'")) }));

console.log('\n1. Lensa template = Pustaka (kalkulator Panasonic)');
const K = daftarRuang({ p: 10, l: 10, t: 4, lantai: 'polos', r2: null })[0];
const BIDANG: (keyof Benda)[] = ['trMin', 'trMax', 'koreksiJarak', 'koreksiJarakTele', 'shiftAtasMaks', 'shiftBawahMaks', 'shiftHMaks', 'poligonShift', 'rasioProyektor', 'resolusiProyektor', 'lumen', 'kontrasAsli', 'offsetTetap'];
for (const [kunci, l] of Object.entries(LENSA_MZ882)) {
  const e = entri.find(x => x.nama === l.nama);
  if (!e) { cek(`${kunci}: ada di Pustaka`, false, l.nama); continue; }
  const b = bendaBaru('proyektor', K, { pasangProyektor: 'plafon' });
  const dariPustaka = isiDariPustaka(b, e)!, dariTemplate = lensaMZ882(l, l.trMin);
  const beda = BIDANG.filter(k => JSON.stringify(dariPustaka[k]) !== JSON.stringify(dariTemplate[k]));
  cek(`${kunci}: ${BIDANG.length} bidang lensa sama dengan "${l.nama}"`, beda.length === 0, beda.map(k => `${k}: ${JSON.stringify(dariPustaka[k])} vs ${JSON.stringify(dariTemplate[k])}`).join('; '));
}
cek('zoom di luar rentang dijepit ke lensa (ELU20 TR 0,25 -> 0,33827)', lensaMZ882(LENSA_MZ882.ELU20, 0.25).throwRatio === 0.33827);

console.log('\n2. Proyektor template: zoom & lens shift di dalam kemampuan lensa');
for (const id of ['mapping-lengkung', 'mapping-cembung', 'mapping-objek', 'immersive'] as const) {
  const p = templateRuang(id).benda.filter(b => b.jenis === 'proyektor');
  const lensa = new Set(p.map(q => `${q.trMin}-${q.trMax}`));
  const nyata = p.every(q => Object.values(LENSA_MZ882).some(l => l.trMin === q.trMin && l.trMax === q.trMax && l.koreksiJarak === q.koreksiJarak));
  cek(`${id}: ${p.length} proyektor, lensa Panasonic nyata (${[...lensa].join(', ')})`, p.length > 0 && nyata);
  cek(`${id}: zoom di dalam rentang lensa`, p.every(q => { const [lo, hi] = zoomLensa(q); return (q.throwRatio ?? 0) >= lo - 1e-9 && (q.throwRatio ?? 0) <= hi + 1e-9; }),
    p.map(q => q.throwRatio).join(', '));
  cek(`${id}: lens shift di dalam daerah lensa`, p.every(q => { const s = batasShift(q); return !s.lewatV && !s.lewatH && !s.lewatGabungan; }),
    p.map(q => `${q.offsetLensa}/${q.geserLensaH ?? 0}`).join(', '));
  cek(`${id}: panel WUXGA 16:10 (piksel blending dari 1920 × 1200)`, p.every(q => q.resolusiProyektor === 'WUXGA' && q.rasioProyektor === '16:10'));
}

console.log(`\n${lulus}/${lulus + gagal} lulus`);
process.exit(gagal ? 1 : 0);
