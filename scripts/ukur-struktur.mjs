#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

export const BATAS = { baris: 400, karakter: 300, props: 25 };

export function daftarBerkas() {
  return execSync('git ls-files --cached --others --exclude-standard -- app lib components', { encoding: 'utf8' })
    .split('\n').filter(f => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts') && existsSync(f));
}

export function ukurIsi(isi) {
  const baris = isi.split('\n');
  let barisPanjang = 0, propsMaks = 0;
  for (const b of baris) {
    if (b.length > BATAS.karakter) barisPanjang++;
    const props = (b.match(/[A-Za-z_][\w]*=\{/g) ?? []).length;
    if (props > propsMaks) propsMaks = props;
  }
  const n = baris.length - (baris[baris.length - 1] === '' ? 1 : 0);
  return { baris: n, barisPanjang, propsMaks };
}

const DIREKTIF = /^(\/\/\s*(eslint-|@ts-|prettier-ignore)|\/\*\s*(eslint-|eslint |global |webpack|[@#]__PURE__)|\/\/\/\s*<reference)/;

export function komentarPenjelasan(isi, nama = 'x.tsx') {
  const jenis = nama.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(nama, isi, ts.ScriptTarget.Latest, true, jenis);
  const temuan = new Map();
  const ambil = (r) => { for (const k of r ?? []) { const t = isi.slice(k.pos, k.end); if (!DIREKTIF.test(t)) temuan.set(k.pos, t); } };
  const kunjungi = (n) => {
    if (n.kind === ts.SyntaxKind.JsxText) return;
    if (n.kind === ts.SyntaxKind.JsxExpression && !n.expression) { temuan.set(n.getStart(sf), n.getText(sf)); return; }
    const anak = n.getChildren(sf);
    if (!anak.length) { ambil(ts.getLeadingCommentRanges(isi, n.pos)); ambil(ts.getTrailingCommentRanges(isi, n.end)); return; }
    for (const c of anak) kunjungi(c);
  };
  kunjungi(sf);
  return [...temuan.values()];
}

export function ukurSemua() {
  const hasil = {};
  for (const f of daftarBerkas()) hasil[f] = ukurIsi(readFileSync(f, 'utf8'));
  return hasil;
}

export function pelanggar(hasil) {
  const keluar = {};
  for (const [f, u] of Object.entries(hasil)) {
    if (u.baris > BATAS.baris || u.barisPanjang > 0 || u.propsMaks >= BATAS.props) keluar[f] = u;
  }
  return keluar;
}

const JALUR_BASELINE = 'uji/data/struktur-baseline.json';

if (import.meta.url === `file://${process.argv[1]}`) {
  const semua = ukurSemua();
  const p = pelanggar(semua);
  if (process.argv.includes('--baseline')) {
    const urut = Object.fromEntries(Object.entries(p).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(JALUR_BASELINE, JSON.stringify({ batas: BATAS, berkas: urut }, null, 2) + '\n');
    console.log(`Baseline ditulis: ${Object.keys(urut).length} berkas -> ${JALUR_BASELINE}`);
  } else {
    const total = Object.values(semua).reduce((t, u) => ({ baris: t.baris + u.baris, panjang: t.panjang + u.barisPanjang }), { baris: 0, panjang: 0 });
    console.log(`${Object.keys(semua).length} berkas, ${total.baris} baris, ${total.panjang} baris > ${BATAS.karakter} karakter, ${Object.keys(p).length} berkas melewati ambang\n`);
    const tampil = (judul, kunci, n = 12) => {
      console.log(judul);
      Object.entries(semua).sort((a, b) => b[1][kunci] - a[1][kunci]).slice(0, n)
        .forEach(([f, u]) => console.log(`  ${String(u[kunci]).padStart(5)}  ${f}`));
      console.log('');
    };
    tampil('Baris per berkas:', 'baris');
    tampil(`Baris > ${BATAS.karakter} karakter:`, 'barisPanjang');
    tampil('Props terbanyak di satu baris:', 'propsMaks');
  }
}
