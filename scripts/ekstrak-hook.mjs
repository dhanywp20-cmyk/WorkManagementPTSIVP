#!/usr/bin/env node
/**
 * scripts/ekstrak-hook.mjs - Pindahkan serangkaian pernyataan (handler, efek, nilai turunan) dari
 * komponen raksasa ke custom hook sendiri, di POSISI YANG SAMA (urutan eksekusi & hook tidak berubah).
 *
 *   node scripts/ekstrak-hook.mjs <berkas.tsx> <awal> <akhir> <useNama> <tujuan.ts>
 *
 * <awal>/<akhir> = nomor baris ATAU nama const pertama/terakhir (disarankan: nama tidak bergeser
 * saat ekstraksi sebelumnya menambah baris impor di atas berkas).
 *
 * Pasangan scripts/ekstrak-jsx.mjs (yang memindah JSX). Compiler TypeScript yang menentukan:
 *   - variabel komponen yang dipakai blok -> jadi isi `konteks`, bertipe PERSIS (tipe deklarasi);
 *   - nama yang dideklarasikan blok -> dikembalikan hook & di-destructure di tempat asalnya;
 *   - impor yang dipakai blok -> disalin ke berkas hook.
 * DITOLAK bila: blok memakai variabel yang dideklarasikan SESUDAH blok (akan jadi galat TDZ saat
 * konteks dibentuk), blok mendeklarasikan `let` (penugasan ulang tidak bisa menembus hook), atau
 * blok memakai deklarasi tingkat modul page.tsx (tidak boleh diekspor).
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const [berkas, awalStr, akhirStr, nama, tujuan] = process.argv.slice(2);
if (!berkas || !awalStr || !akhirStr || !nama || !tujuan) { console.error('pakai: <berkas> <awal> <akhir> <useNama> <tujuan.ts>'); process.exit(2); }
const akar = process.cwd();
const absBerkas = path.resolve(berkas);
const cfg = ts.getParsedCommandLineOfConfigFile(path.join(akar, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
const program = ts.createProgram({ rootNames: [absBerkas], options: cfg.options });
const checker = program.getTypeChecker();
const sf = program.getSourceFile(absBerkas);
const teks = sf.getFullText();
const barisDari = pos => sf.getLineAndCharacterOfPosition(pos).line + 1;
/** Nomor baris, atau baris awal/akhir pernyataan `const <nama>` di dalam fungsi tingkat modul. */
function baris(arg, ujung) {
  if (/^\d+$/.test(arg)) return Number(arg);
  let ketemu = null;
  for (const st of sf.statements) if (ts.isFunctionDeclaration(st) && st.body) for (const s of st.body.statements) {
    if (ts.isVariableStatement(s) && s.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === arg)) ketemu = s;
  }
  if (!ketemu) { console.error('const tidak ditemukan:', arg); process.exit(1); }
  return barisDari(ujung ? ketemu.end : ketemu.getStart(sf));
}
const awal = baris(awalStr, false), akhir = baris(akhirStr, true);

// 1. Komponen terbesar di berkas = fungsi tingkat modul yang memuat baris awal.
let fungsi = null;
for (const st of sf.statements) {
  const f = ts.isFunctionDeclaration(st) ? st : null;
  if (f?.body && barisDari(f.getStart(sf)) <= awal && barisDari(f.end) >= akhir) fungsi = f;
}
if (!fungsi) { console.error('tidak ada fungsi tingkat modul yang memuat rentang itu'); process.exit(1); }
const pernyataan = fungsi.body.statements.filter(s => barisDari(s.getStart(sf)) >= awal && barisDari(s.end) <= akhir);
if (!pernyataan.length) { console.error('tidak ada pernyataan di rentang itu'); process.exit(1); }
const blokAwal = pernyataan[0].getFullStart(), blokAkhir = pernyataan[pernyataan.length - 1].end;
for (const s of pernyataan) if (ts.isReturnStatement(s)) { console.error('rentang memuat return komponen'); process.exit(1); }

// 2. Nama yang dideklarasikan blok (dikembalikan hook).
const dideklarasi = [];
const kumpulNama = (b) => { if (ts.isIdentifier(b)) dideklarasi.push(b.text); else for (const e of b.elements ?? []) if (!ts.isOmittedExpression(e)) kumpulNama(e.name); };
for (const s of pernyataan) {
  if (ts.isVariableStatement(s)) {
    if (!(s.declarationList.flags & ts.NodeFlags.Const)) { console.error('blok memuat `let`/`var` - pindahkan manual:', s.getText(sf).slice(0, 60)); process.exit(1); }
    for (const d of s.declarationList.declarations) kumpulNama(d.name);
  } else if (ts.isFunctionDeclaration(s) && s.name) dideklarasi.push(s.name.text);
}
const namaBlok = new Set(dideklarasi);

// 3. Variabel komponen yang dipakai blok (konteks) + impor yang dipakai.
const dalam = (d, a, b) => d.pos >= a && d.end <= b;
const konteks = new Map();   // nama -> tipe
const impor = new Map();     // nama -> deklarasi impor
const terlambat = [];
const modul = new Set();
function catat(id, sym) {
  if (!sym) return;
  if (sym.flags & ts.SymbolFlags.Alias) {
    let imp = sym.declarations?.[0]; while (imp && !ts.isImportDeclaration(imp)) imp = imp.parent;
    if (imp && imp.getSourceFile() === sf) impor.set(id.text, imp);
    return;
  }
  const d = sym.valueDeclaration ?? sym.declarations?.[0];
  if (!d || d.getSourceFile() !== sf) return;
  if (dalam(d, blokAwal, blokAkhir)) return;
  if (dalam(d, fungsi.pos, fungsi.end)) {
    if (konteks.has(id.text)) return;
    if (d.pos >= blokAkhir) terlambat.push(id.text);
    const t = checker.getTypeOfSymbolAtLocation(sym, d);
    konteks.set(id.text, checker.typeToString(t, d, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType));
  } else modul.add(id.text);
}
for (const s of pernyataan) (function jalan(n) {
  if (ts.isIdentifier(n)) {
    const p = n.parent;
    const namaProp = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n)
      || (ts.isQualifiedName(p) && p.right === n) || (ts.isJsxAttribute(p) && p.name === n) || (ts.isBindingElement(p) && p.propertyName === n);
    if (ts.isShorthandPropertyAssignment(p)) catat(n, checker.getShorthandAssignmentValueSymbol(p));
    else if (!namaProp) catat(n, checker.getSymbolAtLocation(n));
  }
  ts.forEachChild(n, jalan);
})(s);
if (terlambat.length) { console.error('dipakai sebelum dideklarasikan (TDZ) - geser rentang:', [...new Set(terlambat)].join(', ')); process.exit(1); }
const halamanNext = /(^|[\\/])(page|layout)\.tsx?$/.test(absBerkas);
const modulNilai = [...modul].filter(n => sf.statements.some(s => (ts.isFunctionDeclaration(s) && s.name?.text === n) || (ts.isVariableStatement(s) && s.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === n))));
if (modulNilai.length && halamanNext) { console.error('deklarasi tingkat modul dipakai (pindahkan dulu):', modulNilai.join(', ')); process.exit(1); }

// 4. Tipe import("C:/...") -> import("@/..."), nama tipe polos yang diimpor induk ikut diimpor.
const keAlias = t => t.replace(/import\("([^"]+)"\)/g, (_, p) => {
  const rel = path.relative(akar, p).split(path.sep).join('/');
  return rel.startsWith('node_modules/') ? `import("${rel.replace(/^node_modules\/(@types\/)?/, '').replace(/\/index$/, '')}")` : `import("@/${rel}")`;
});
const semuaImpor = new Map();
for (const st of sf.statements) {
  if (!ts.isImportDeclaration(st) || !st.importClause) continue;
  const kl = st.importClause;
  if (kl.name) semuaImpor.set(kl.name.text, st);
  if (kl.namedBindings && ts.isNamedImports(kl.namedBindings)) for (const e of kl.namedBindings.elements) semuaImpor.set(e.name.text, st);
}
const teksTipe = [...konteks.values()].join(' ');
for (const [n, st] of semuaImpor) if (new RegExp(`(^|[^.\\w"])${n}\\b`).test(teksTipe)) impor.set(n, st);

const dirTujuan = path.dirname(path.resolve(tujuan));
const barisImpor = [];
const perImpor = new Map();
for (const [n, d] of impor) { if (!perImpor.has(d)) perImpor.set(d, new Set()); perImpor.get(d).add(n); }
for (const [d, nama2] of perImpor) {
  let spes = d.moduleSpecifier.text;
  if (spes.startsWith('.')) { spes = path.relative(dirTujuan, path.resolve(path.dirname(absBerkas), spes)).split(path.sep).join('/'); if (!spes.startsWith('.')) spes = './' + spes; }
  const kl = d.importClause; const bagian = [];
  if (kl?.name && nama2.has(kl.name.text)) bagian.push(kl.name.text);
  const nb = kl?.namedBindings;
  if (nb && ts.isNamedImports(nb)) {
    const el = nb.elements.filter(e => nama2.has(e.name.text)).map(e => (e.isTypeOnly ? 'type ' : '') + (e.propertyName ? `${e.propertyName.text} as ${e.name.text}` : e.name.text));
    if (el.length) bagian.push(`{ ${el.join(', ')} }`);
  } else if (nb && ts.isNamespaceImport(nb) && nama2.has(nb.name.text)) bagian.push(`* as ${nb.name.text}`);
  if (bagian.length) barisImpor.push(`import ${kl?.isTypeOnly ? 'type ' : ''}${bagian.join(', ')} from '${spes}';`);
}

// 5. Tulis hook & ganti blok di induk dengan pemanggilan hook di posisi yang sama.
const isiBlok = teks.slice(pernyataan[0].getStart(sf), blokAkhir);
const indentAsal = teks.slice(teks.lastIndexOf('\n', pernyataan[0].getStart(sf)) + 1, pernyataan[0].getStart(sf));
const badan = isiBlok.split('\n').map((l, i) => (i === 0 ? '  ' + l : (l.startsWith(indentAsal) ? '  ' + l.slice(indentAsal.length) : l))).join('\n');
const kunci = [...konteks.keys()].sort();
const namaTipe = nama.replace(/^use/, '') + 'Konteks';
const out = `'use client';

/** ${nama} - dipecah dari ${path.relative(akar, absBerkas).split(path.sep).join('/')} (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
${barisImpor.join('\n')}

export interface ${namaTipe} {
${kunci.map(k => `  ${k}: ${keAlias(konteks.get(k))};`).join('\n')}
}

export function ${nama}(k: ${namaTipe}) {
  const { ${kunci.join(', ')} } = k;
${badan}
  return { ${dideklarasi.join(', ')} };
}
`;
fs.mkdirSync(dirTujuan, { recursive: true });
fs.writeFileSync(tujuan, out);

let relImpor = path.relative(path.dirname(absBerkas), path.resolve(tujuan)).split(path.sep).join('/').replace(/\.tsx?$/, '');
if (!relImpor.startsWith('.')) relImpor = './' + relImpor;
const panggil = `${dideklarasi.length ? `const { ${dideklarasi.join(', ')} } = ` : ''}${nama}({ ${kunci.join(', ')} });`;
const terakhirImpor = [...sf.statements].filter(ts.isImportDeclaration).pop();
const suntingan = [
  { awal: pernyataan[0].getStart(sf), akhir: blokAkhir, isi: panggil },
  { awal: terakhirImpor.end, akhir: terakhirImpor.end, isi: `\nimport { ${nama} } from '${relImpor}';` },
].sort((x, y) => y.awal - x.awal);
let induk = teks;
for (const s of suntingan) induk = induk.slice(0, s.awal) + s.isi + induk.slice(s.akhir);
fs.writeFileSync(absBerkas, induk);
console.log(`${nama}: ${kunci.length} konteks, ${dideklarasi.length} dikembalikan, ${isiBlok.split('\n').length} baris -> ${tujuan}`);
