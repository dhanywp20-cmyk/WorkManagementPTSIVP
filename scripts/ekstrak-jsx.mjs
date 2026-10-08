#!/usr/bin/env node
/**
 * scripts/ekstrak-jsx.mjs - Pindahkan satu blok JSX `{...}` dari komponen raksasa ke komponen sendiri.
 *
 *   node scripts/ekstrak-jsx.mjs <berkas.tsx> <baris-awal> <NamaKomponen> <berkas-tujuan.tsx>
 *
 * Alat bantu pemecahan berkas besar (target <= 300 baris/berkas). Blok yang dipindah biasanya modal
 * yang memakai puluhan state & handler milik induk; menyalinnya manual rawan salah. Di sini compiler
 * TypeScript yang menentukan:
 *   - variabel lokal induk yang dipakai blok -> jadi props, dengan TIPE PERSIS dari checker
 *     (import("@/...").Tipe, jadi tidak perlu mengurus impor tipe);
 *   - impor berkas induk yang dipakai blok -> disalin ke berkas baru;
 *   - deklarasi tingkat-modul berkas induk yang dipakai blok -> ditolak (pindahkan dulu ke berkas
 *     bersama), karena page.tsx Next.js tidak boleh mengekspor nama lain.
 * Induk diganti `<NamaKomponen a={a} ... />`. Perilaku tidak berubah: nilai yang sama, render sama.
 */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const [berkas, barisStr, nama, tujuan] = process.argv.slice(2);
if (!berkas || !barisStr || !nama || !tujuan) { console.error('pakai: <berkas> <baris> <Nama> <tujuan>'); process.exit(2); }
const akar = process.cwd();
const absBerkas = path.resolve(berkas);
const cfg = ts.getParsedCommandLineOfConfigFile(path.join(akar, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
const program = ts.createProgram({ rootNames: [absBerkas], options: cfg.options });
const checker = program.getTypeChecker();
const sf = program.getSourceFile(absBerkas);
const teks = sf.getFullText();
const baris = Number(barisStr);

// 1. Blok JSX: JsxExpression terluar yang mulai di baris itu.
let blok = null;
(function cari(n) {
  if (blok) return;
  //  Blok `{…}` atau elemen JSX (<div>…</div>, <X/>, <>…</>) yang mulai di baris itu - yang terluar.
  const jenis = ts.isJsxExpression(n) || ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n);
  if (jenis && n.parent && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))
    && sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 === baris) { blok = n; return; }
  ts.forEachChild(n, cari);
})(sf);
if (!blok) { console.error(`tidak ada {…} JSX di baris ${baris}`); process.exit(1); }

// 2. Fungsi komponen yang memuatnya.
let fungsi = blok.parent;
while (fungsi && !(ts.isFunctionDeclaration(fungsi) || ts.isArrowFunction(fungsi) || ts.isFunctionExpression(fungsi)) ) fungsi = fungsi.parent;
// naik sampai fungsi TERLUAR (komponen), bukan callback di dalamnya
for (let p = fungsi?.parent; p; p = p.parent) if (ts.isFunctionDeclaration(p) || ts.isArrowFunction(p) || ts.isFunctionExpression(p)) fungsi = p;
if (!fungsi) { console.error('blok tidak di dalam fungsi'); process.exit(1); }

const dalam = (d, n) => d.pos >= n.pos && d.end <= n.end;
const lokal = new Map();   // nama -> tipe
const impor = new Map();   // nama lokal -> deklarasi impor
const modul = new Set();   // deklarasi tingkat modul berkas ini

function catat(id, sym) {
  if (!sym) return;
  if (sym.flags & ts.SymbolFlags.Alias) {
    const d = sym.declarations?.[0];
    let imp = d; while (imp && !ts.isImportDeclaration(imp)) imp = imp.parent;
    if (imp && imp.getSourceFile() === sf) impor.set(id.text, imp);
    return;
  }
  const d = sym.valueDeclaration ?? sym.declarations?.[0];
  if (!d || d.getSourceFile() !== sf) return;
  if (dalam(d, blok)) return;                        // dideklarasikan di dalam blok sendiri
  if (dalam(d, fungsi)) {
    if (!lokal.has(id.text)) {
      //  Tipe DI TITIK PAKAI (sudah dipersempit, mis. `x && …` membuat x bukan null) - di titik
      //  pemanggilan komponen baru penyempitan yang sama berlaku, jadi tipe ini tetap terpenuhi.
      const diPakai = ts.isShorthandPropertyAssignment(id.parent) ? null : checker.getTypeAtLocation(id);
      const t = diPakai ?? checker.getTypeOfSymbolAtLocation(sym, d);
      lokal.set(id.text, checker.typeToString(t, d, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType));
    }
  } else modul.add(id.text);
}

(function jalan(n) {
  if (ts.isIdentifier(n)) {
    const p = n.parent;
    const namaProp = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isJsxAttribute(p) && p.name === n)
      || (ts.isPropertyAssignment(p) && p.name === n) || (ts.isQualifiedName(p) && p.right === n);
    if (ts.isShorthandPropertyAssignment(p)) catat(n, checker.getShorthandAssignmentValueSymbol(p));
    else if (!namaProp) catat(n, checker.getSymbolAtLocation(n));
  }
  ts.forEachChild(n, jalan);
})(blok);

if (modul.size) { console.error('deklarasi tingkat modul dipakai blok (pindahkan dulu):', [...modul].join(', ')); process.exit(1); }

// 3. Tipe: import("C:/.../x") -> import("@/x")
const keAlias = t => t.replace(/import\("([^"]+)"\)/g, (_, p) => {
  const rel = path.relative(akar, p).split(path.sep).join('/');
  return rel.startsWith('node_modules/') ? `import("${rel.replace(/^node_modules\/(@types\/)?/, '').replace(/\/index$/, '')}")` : `import("@/${rel}")`;
});

// 3b. Nama tipe yang tercetak polos di props (mis. `RoomDetail`) & diimpor induk -> ikut diimpor.
const semuaImpor = new Map();
for (const st of sf.statements) {
  if (!ts.isImportDeclaration(st) || !st.importClause) continue;
  const kl = st.importClause;
  if (kl.name) semuaImpor.set(kl.name.text, st);
  if (kl.namedBindings && ts.isNamedImports(kl.namedBindings)) for (const e of kl.namedBindings.elements) semuaImpor.set(e.name.text, st);
}
const teksTipe = [...lokal.values()].join(' ');
for (const [n, st] of semuaImpor) if (new RegExp(`(^|[^.\\w"])${n}\\b`).test(teksTipe)) impor.set(n, st);

// 4. Impor yang dipakai: salin deklarasi impor, saring ke nama yang dipakai.
const dirTujuan = path.dirname(path.resolve(tujuan));
const baris_impor = [];
const perImpor = new Map();
for (const [n, d] of impor) { if (!perImpor.has(d)) perImpor.set(d, new Set()); perImpor.get(d).add(n); }
for (const [d, nama2] of perImpor) {
  let spes = d.moduleSpecifier.text;
  if (spes.startsWith('.')) {
    spes = path.relative(dirTujuan, path.resolve(path.dirname(absBerkas), spes)).split(path.sep).join('/');
    if (!spes.startsWith('.')) spes = './' + spes;
  }
  const kl = d.importClause; const bagian = [];
  if (kl?.name && nama2.has(kl.name.text)) bagian.push(kl.name.text);
  const nb = kl?.namedBindings;
  if (nb && ts.isNamedImports(nb)) {
    const el = nb.elements.filter(e => nama2.has(e.name.text)).map(e => (e.isTypeOnly ? 'type ' : '') + (e.propertyName ? `${e.propertyName.text} as ${e.name.text}` : e.name.text));
    if (el.length) bagian.push(`{ ${el.join(', ')} }`);
  } else if (nb && ts.isNamespaceImport(nb) && nama2.has(nb.name.text)) bagian.push(`* as ${nb.name.text}`);
  if (bagian.length) baris_impor.push(`import ${kl?.isTypeOnly ? 'type ' : ''}${bagian.join(', ')} from '${spes}';`);
}

const props = [...lokal.keys()].sort();
const isiBlok = teks.slice(blok.getStart(sf), blok.end);
const indentAsal = teks.slice(teks.lastIndexOf('\n', blok.getStart(sf)) + 1, blok.getStart(sf));
const jsx = isiBlok.split('\n').map((l, i) => (i === 0 ? '      ' + l : (l.startsWith(indentAsal) ? '      ' + l.slice(indentAsal.length) : l))).join('\n');
const out = `'use client';

/** ${nama} - dipecah dari ${path.relative(akar, absBerkas).split(path.sep).join('/')} (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
${baris_impor.join('\n')}

export interface ${nama}Props {
${props.map(p => `  ${p}: ${keAlias(lokal.get(p))};`).join('\n')}
}

export function ${nama}({ ${props.join(', ')} }: ${nama}Props) {
  return (
    <>
${jsx}
    </>
  );
}
`;
fs.writeFileSync(tujuan, out);

// 5. Induk: ganti blok dengan elemen, tambah impor.
const elemen = `<${nama}\n${indentAsal}  ${props.map(p => `${p}={${p}}`).join(' ')}\n${indentAsal}/>`;
let induk = teks.slice(0, blok.getStart(sf)) + elemen + teks.slice(blok.end);
let relImpor = path.relative(path.dirname(absBerkas), path.resolve(tujuan)).split(path.sep).join('/').replace(/\.tsx$/, '');
if (!relImpor.startsWith('.')) relImpor = './' + relImpor;
const terakhirImpor = [...sf.statements].filter(ts.isImportDeclaration).pop();
const posImpor = terakhirImpor.end;
induk = induk.slice(0, posImpor) + `\nimport { ${nama} } from '${relImpor}';` + induk.slice(posImpor);
fs.writeFileSync(absBerkas, induk);
console.log(`${nama}: ${props.length} props, ${isiBlok.split('\n').length} baris dipindah -> ${tujuan}`);
