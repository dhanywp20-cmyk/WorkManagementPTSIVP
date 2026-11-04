#!/usr/bin/env node
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const [berkas, ...spek] = process.argv.slice(2);
if (!berkas || spek.length === 0) { console.error('pakai: <berkas> <baris>:<nama> ...'); process.exit(2); }
const abs = path.resolve(berkas);
const dir = path.dirname(abs);
const ext = path.extname(abs);
const dasar = path.basename(abs, ext);
const teks = fs.readFileSync(abs, 'utf8');
const nl = teks.includes('\r\n') ? '\r\n' : '\n';
const sf = ts.createSourceFile(abs, teks, ts.ScriptTarget.Latest, true, ext === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const rentang = spek.map(s => { const [b, n] = s.split(':'); return { baris: Number(b), nama: n }; }).sort((a, b) => a.baris - b.baris);
const TETAP = '_';
const barisDari = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
const modulUntuk = (st) => {
  const b = barisDari(st.getStart(sf));
  let m = null;
  for (const r of rentang) if (b >= r.baris) m = r.nama;
  return m;
};

const direktif = [];
const impor = [];
const tetapDiBarrel = [];
const tetapAsli = [];
const isi = new Map(rentang.filter(r => r.nama !== TETAP).map(r => [r.nama, []]));
const asal = new Map();
let masihProlog = true;
for (const st of sf.statements) {
  if (masihProlog && ts.isExpressionStatement(st) && ts.isStringLiteral(st.expression)) { direktif.push(st); continue; }
  masihProlog = false;
  if (ts.isImportDeclaration(st)) { impor.push(st); continue; }
  if (ts.isExportDeclaration(st)) { tetapDiBarrel.push(st); continue; }
  const m = modulUntuk(st);
  if (!m) { tetapDiBarrel.push(st); continue; }
  if (m === TETAP) { tetapAsli.push(st); continue; }
  isi.get(m).push(st);
  const nama = [];
  if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) && st.name) nama.push(st.name.text);
  if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) nama.push(d.name.text);
  for (const n of nama) asal.set(n, m);
}

function dipakai(st) {
  const hasil = new Set();
  (function jalan(n) {
    if (ts.isIdentifier(n) && asal.has(n.text)) {
      const p = n.parent;
      const bukanRujukan = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n)
        || ((ts.isFunctionDeclaration(p) || ts.isVariableDeclaration(p) || ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p) || ts.isParameter(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p)) && p.name === n);
      if (!bukanRujukan) hasil.add(n.text);
    }
    ts.forEachChild(n, jalan);
  })(st);
  return hasil;
}
const perluEkspor = new Set();
const imporSaudara = new Map([...[...isi.keys()].map(m => [m, new Map()]), [TETAP, new Map()]]);
for (const [m, daftar] of [...isi, [TETAP, tetapAsli]]) for (const st of daftar) for (const n of dipakai(st)) {
  const a = asal.get(n);
  if (a === m) continue;
  perluEkspor.add(n);
  const peta = imporSaudara.get(m);
  if (!peta.has(a)) peta.set(a, new Set());
  peta.get(a).add(n);
}

const tanpaBarisKosongAwal = (t) => t.replace(/^(\r?\n)+/, '');
const teksPernyataan = (st) => {
  let t = tanpaBarisKosongAwal(teks.slice(st.getFullStart(), st.getEnd()));
  const namaSt = ts.isVariableStatement(st) ? st.declarationList.declarations.map(d => d.name.getText(sf)) : st.name ? [st.name.text] : [];
  const sudahEkspor = st.modifiers?.some(x => x.kind === ts.SyntaxKind.ExportKeyword);
  if (!sudahEkspor && namaSt.some(n => perluEkspor.has(n))) {
    const awal = st.getStart(sf) - st.getFullStart() - (teks.slice(st.getFullStart(), st.getEnd()).length - t.length);
    t = t.slice(0, awal) + 'export ' + t.slice(awal);
  }
  return t;
};
const prolog = direktif.map(d => d.getText(sf)).join(nl);
const blokImpor = impor.map(i => i.getText(sf)).join(nl);
const imporDari = (peta) => [...peta].map(([a, s]) => `import { ${[...s].sort().join(', ')} } from './${dasar}-${a}';`).join(nl);

const berkasBaru = [];
for (const [m, daftar] of isi) {
  if (daftar.length === 0) continue;
  const kepala = `/** ${dasar}-${m}${ext} - dipecah dari ${dasar}${ext} (scripts/pecah-modul.mjs); ${dasar}${ext} tetap mengekspor ulang semuanya. */`;
  const isiBerkas = [prolog, kepala, blokImpor, imporDari(imporSaudara.get(m))].filter(Boolean).join(nl) + nl + nl + daftar.map(teksPernyataan).join(nl + nl) + nl;
  const tujuan = path.join(dir, `${dasar}-${m}${ext}`);
  fs.writeFileSync(tujuan, isiBerkas);
  berkasBaru.push(tujuan);
}

const asli = [
  prolog,
  blokImpor,
  imporDari(imporSaudara.get(TETAP)),
  ...tetapDiBarrel.map(st => tanpaBarisKosongAwal(teks.slice(st.getFullStart(), st.getEnd()))),
  ...tetapAsli.map(st => nl + tanpaBarisKosongAwal(teks.slice(st.getFullStart(), st.getEnd()))),
  ...[...isi].filter(([, d]) => d.length).map(([m]) => `export * from './${dasar}-${m}';`),
].filter(Boolean).join(nl) + nl;
fs.writeFileSync(abs, asli);

const cfg = ts.getParsedCommandLineOfConfigFile(path.resolve('tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
const semua = [abs, ...berkasBaru];
const host = {
  getScriptFileNames: () => semua,
  getScriptVersion: () => '1',
  getScriptSnapshot: (f) => fs.existsSync(f) ? ts.ScriptSnapshot.fromString(fs.readFileSync(f, 'utf8')) : undefined,
  getCurrentDirectory: () => process.cwd(),
  getCompilationSettings: () => cfg.options,
  getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
  fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, readDirectory: ts.sys.readDirectory,
};
const ls = ts.createLanguageService(host, ts.createDocumentRegistry());
for (const f of semua) {
  if (f === abs && tetapAsli.length === 0) continue;
  const ubah = ls.organizeImports({ type: 'file', fileName: f, skipDestructiveCodeActions: false }, { newLineCharacter: nl }, undefined);
  let t = fs.readFileSync(f, 'utf8');
  for (const fc of ubah) for (const c of [...fc.textChanges].sort((a, b) => b.span.start - a.span.start)) {
    t = t.slice(0, c.span.start) + c.newText + t.slice(c.span.start + c.span.length);
  }
  t = t.replace(/import (type )?\{([^}]*)\}\s*from\s*'([^']+)';/g, (_, tipe, isiImpor, dari) =>
    `import ${tipe ?? ''}{ ${isiImpor.split(',').map(x => x.trim()).filter(Boolean).join(', ')} } from '${dari}';`);
  fs.writeFileSync(f, t);
}
for (const f of berkasBaru) console.log(`${path.relative(process.cwd(), f)}: ${fs.readFileSync(f, 'utf8').split(/\r?\n/).length} baris`);
console.log(`${path.relative(process.cwd(), abs)}: ${fs.readFileSync(abs, 'utf8').split(/\r?\n/).length} baris; ${perluEkspor.size} nama lintas modul diekspor`);
