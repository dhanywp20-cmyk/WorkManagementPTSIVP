#!/usr/bin/env node
import ts from 'typescript';
import fs from 'node:fs';
let masalah = 0;
for (const f of process.argv.slice(2)) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  for (const st of sf.statements) {
    if (!ts.isFunctionDeclaration(st) || !st.name || !/^use[A-Z]/.test(st.name.text) || !st.body) continue;
    const isi = st.body.statements;
    isi.forEach((s, i) => (function cari(n) {
      if (ts.isFunctionLike(n)) return;
      if (ts.isReturnStatement(n) && !(i === isi.length - 1 && n === s)) { masalah++; console.log(`${f}: ${st.name.text} - return di luar akhir: ${n.getText(sf).slice(0, 70)}`); }
      ts.forEachChild(n, cari);
    })(s));
  }
}
console.log(masalah ? `${masalah} masalah` : 'bersih');
process.exit(masalah ? 1 : 0);
