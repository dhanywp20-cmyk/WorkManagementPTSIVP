#!/usr/bin/env node
/**
 * scripts/fungsi-ke-const.mjs - `function X() {}` / `async function X() {}` di DALAM komponen default
 * menjadi `const X = (...) => {};`, supaya bisa dipindah scripts/ekstrak-hook.mjs (yang bekerja pada const).
 *
 *   node scripts/fungsi-ke-const.mjs <berkas.tsx> [NamaKomponen]
 *
 * Beda satu-satunya: const tidak di-hoist. Pemakaian SEBELUM deklarasi saat render akan ditangkap tsc
 * (TS2448); pemakaian di dalam closure (efek, handler) tetap aman karena dijalankan sesudah render.
 */
import ts from 'typescript';
import fs from 'node:fs';
const f = process.argv[2];
const teks = fs.readFileSync(f, 'utf8');
const sf = ts.createSourceFile(f, teks, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const namaKomp = process.argv[3];   // opsional: nama komponen; bawaan = export default
const komp = sf.statements.find(s => ts.isFunctionDeclaration(s) && (namaKomp ? s.name?.text === namaKomp : s.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)));
if (!komp) { console.error('komponen tidak ditemukan'); process.exit(1); }
const ubah = [];
for (const st of komp.body.statements) {
  if (!ts.isFunctionDeclaration(st) || !st.name || !st.body) continue;
  const asinkron = st.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
  const tp = st.typeParameters ? `<${st.typeParameters.map(t => t.getText(sf)).join(', ')}>` : '';
  const param = st.parameters.map(p => p.getText(sf)).join(', ');
  const tipe = st.type ? `: ${st.type.getText(sf)}` : '';
  const kepala = `const ${st.name.text} = ${asinkron ? 'async ' : ''}${tp}(${param})${tipe} => `;
  ubah.push({ awal: st.getStart(sf), akhirKepala: st.body.getStart(sf), akhir: st.getEnd(), kepala });
}
let t = teks;
for (const u of ubah.sort((a, b) => b.awal - a.awal)) t = t.slice(0, u.akhir) + ';' + t.slice(u.akhir), t = t.slice(0, u.awal) + u.kepala + t.slice(u.akhirKepala);
fs.writeFileSync(f, t);
console.log(`${ubah.length} fungsi -> const`);
