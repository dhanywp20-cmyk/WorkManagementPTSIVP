#!/usr/bin/env node
import ts from 'typescript';
import fs from 'node:fs';

for (const berkas of process.argv.slice(2)) {
  const teks = fs.readFileSync(berkas, 'utf8');
  const sf = ts.createSourceFile(berkas, teks, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ganti = [];
  const dilewati = [];

  const adalahFungsi = n => ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n);
  (function jalan(n, dalamFungsi) {
    const sebagaiFungsi = dalamFungsi && ts.isFunctionDeclaration(n) && n.name && /^[A-Z]/.test(n.name.text) && n.body
      ? { name: n.name, initializer: n } : null;
    const decl = sebagaiFungsi ?? n;
    if (dalamFungsi && (sebagaiFungsi || (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && /^[A-Z]/.test(n.name.text)
      && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))))) {
      n = decl;
      let fungsiInduk = (sebagaiFungsi ? sebagaiFungsi.initializer : n).parent; while (fungsiInduk && !adalahFungsi(fungsiInduk)) fungsiInduk = fungsiInduk.parent;
      const badan = teks.slice(n.initializer.body.pos, n.initializer.body.end);
      if (/\buse[A-Z]\w*\s*\(/.test(badan)) dilewati.push(n.name.text);
      else if (fungsiInduk) {
        const nama = n.name.text, params = n.initializer.parameters;
        (function cari(m) {
          if ((ts.isJsxSelfClosingElement(m) || ts.isJsxElement(m))) {
            const buka = ts.isJsxElement(m) ? m.openingElement : m;
            if (ts.isIdentifier(buka.tagName) && buka.tagName.text === nama) ganti.push({ m, buka, tanpaParam: params.length === 0 });
          }
          ts.forEachChild(m, cari);
        })(fungsiInduk);
      }
    }
    ts.forEachChild(n, c => jalan(c, dalamFungsi || adalahFungsi(n)));
  })(sf, false);

  const teksDari = n => teks.slice(n.getStart(sf), n.end);
  ganti.sort((a, b) => b.m.getStart(sf) - a.m.getStart(sf));
  let hasil = teks, terakhirAwal = Infinity, n = 0;
  for (const { m, buka, tanpaParam } of ganti) {
    if (m.end > terakhirAwal) continue;
    const bagian = [];
    for (const at of buka.attributes.properties) {
      if (ts.isJsxSpreadAttribute(at)) { bagian.push(`...${teksDari(at.expression)}`); continue; }
      const k = at.name.getText(sf);
      const kunci = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
      if (!at.initializer) bagian.push(`${kunci}: true`);
      else if (ts.isStringLiteral(at.initializer)) bagian.push(`${kunci}: ${teksDari(at.initializer)}`);
      else bagian.push(`${kunci}: ${teksDari(at.initializer.expression)}`);
    }
    if (ts.isJsxElement(m) && m.children.some(c => !(ts.isJsxText(c) && !c.text.trim()))) {
      bagian.push(`children: <>${m.children.map(c => teks.slice(c.pos, c.end)).join('')}</>`);
    }
    const panggil = tanpaParam && !bagian.length ? `${buka.tagName.text}()` : `${buka.tagName.text}({ ${bagian.join(', ')} })`;
    const diAnakJsx = m.parent && (ts.isJsxElement(m.parent) || ts.isJsxFragment(m.parent));
    hasil = hasil.slice(0, m.getStart(sf)) + (diAnakJsx ? `{${panggil}}` : panggil) + hasil.slice(m.end);
    terakhirAwal = m.getStart(sf); n++;
  }
  fs.writeFileSync(berkas, hasil);
  console.log(`${berkas}: ${n} pemakaian diubah jadi panggilan fungsi${dilewati.length ? `; dilewati (memakai hook): ${[...new Set(dilewati)].join(', ')}` : ''}`);
}
