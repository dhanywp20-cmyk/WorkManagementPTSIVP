#!/usr/bin/env node
/**
 * scripts/pindah-tingkat-modul.mjs - Pindahkan deklarasi tingkat modul sebuah page.tsx ke berkas bantu.
 *
 *   node scripts/pindah-tingkat-modul.mjs <page.tsx> <tujuan.tsx>
 *
 * page.tsx Next.js hanya boleh mengekspor default (dan beberapa nama khusus), jadi helper, konstanta,
 * tipe & komponen kecil yang ditulis di atas komponen halaman tidak bisa dipakai komponen pecahan.
 * Alat ini memindah SEMUA pernyataan tingkat modul selain impor, 'use client' & export default ke
 * berkas tujuan (diekspor), menyalin impor yang dipakainya, lalu mengimpornya kembali ke page.tsx.
 * Pernyataan tanpa nama (mis. `void x;`) ikut dipindah apa adanya.
 */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const [berkas, tujuan] = process.argv.slice(2);
const teks = fs.readFileSync(berkas, 'utf8');
const sf = ts.createSourceFile(berkas, teks, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nl = teks.includes('\r\n') ? '\r\n' : '\n';

const impor = [], pindah = [], nama = [];
for (const st of sf.statements) {
  if (ts.isImportDeclaration(st)) { impor.push(st); continue; }
  if (ts.isExpressionStatement(st) && ts.isStringLiteral(st.expression)) continue; // 'use client'
  const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) ?? [] : [];
  if (mods.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) continue;
  if (ts.isExportAssignment(st)) continue;
  pindah.push(st);
  if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) && st.name) nama.push(st.name.text);
  if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) nama.push(d.name.text);
}
if (!pindah.length) { console.log('tidak ada deklarasi tingkat modul'); process.exit(0); }

// Teks yang dipindah (dengan komentar di depannya), diberi `export` bila belum.
const potong = pindah.map(st => {
  let t = teks.slice(st.getFullStart(), st.end);
  const awalKode = st.getStart(sf) - st.getFullStart();
  const kode = t.slice(awalKode);
  const sudahEkspor = /^export\s/.test(kode);
  const bernama = !(ts.isExpressionStatement(st));
  return t.slice(0, awalKode) + (bernama && !sudahEkspor ? 'export ' : '') + kode;
}).join('');

// Impor yang dipakai bagian yang dipindah (pencarian nama sederhana pada teksnya).
const dirAsal = path.dirname(path.resolve(berkas)), dirTujuan = path.dirname(path.resolve(tujuan));
const imporTujuan = [];
for (const d of impor) {
  const kl = d.importClause; if (!kl) continue;
  //  `...x` (spread) tetap dihitung dipakai; `obj.x` (properti) tidak.
  const dipakai = n => new RegExp(`(^|[^\\w.$]|\\.\\.\\.)${n}([^\\w$]|$)`).test(potong);
  const bagian = [];
  if (kl.name && dipakai(kl.name.text)) bagian.push(kl.name.text);
  const nb = kl.namedBindings;
  if (nb && ts.isNamedImports(nb)) {
    const el = nb.elements.filter(e => dipakai(e.name.text)).map(e => (e.isTypeOnly ? 'type ' : '') + (e.propertyName ? `${e.propertyName.text} as ${e.name.text}` : e.name.text));
    if (el.length) bagian.push(`{ ${el.join(', ')} }`);
  } else if (nb && ts.isNamespaceImport(nb) && dipakai(nb.name.text)) bagian.push(`* as ${nb.name.text}`);
  if (!bagian.length) continue;
  let spes = d.moduleSpecifier.text;
  if (spes.startsWith('.')) { spes = path.relative(dirTujuan, path.resolve(dirAsal, spes)).split(path.sep).join('/'); if (!spes.startsWith('.')) spes = './' + spes; }
  imporTujuan.push(`import ${kl.isTypeOnly ? 'type ' : ''}${bagian.join(', ')} from '${spes}';`);
}
const pakaiJsx = /<[A-Za-z]/.test(potong);
const isi = `${pakaiJsx ? "'use client';\n\n" : ''}/** Deklarasi tingkat modul ${path.basename(path.dirname(berkas))}/page.tsx (scripts/pindah-tingkat-modul.mjs). */\n${imporTujuan.join('\n')}\n${potong.replace(/^\s*\n/, '\n')}\n`;
fs.writeFileSync(tujuan, isi.replace(/\r?\n/g, nl));

// page.tsx: buang yang dipindah, impor kembali namanya.
let hasil = teks;
for (const st of [...pindah].reverse()) hasil = hasil.slice(0, st.getFullStart()) + hasil.slice(st.end);
let rel = path.relative(dirAsal, path.resolve(tujuan)).split(path.sep).join('/').replace(/\.tsx?$/, '');
if (!rel.startsWith('.')) rel = './' + rel;
const akhirImpor = impor[impor.length - 1].end;
hasil = hasil.slice(0, akhirImpor) + `${nl}import { ${nama.join(', ')} } from '${rel}';` + hasil.slice(akhirImpor);
fs.writeFileSync(berkas, hasil);
console.log(`${pindah.length} deklarasi (${nama.length} nama) -> ${tujuan}`);
