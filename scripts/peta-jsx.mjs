#!/usr/bin/env node
/**
 * scripts/peta-jsx.mjs - Daftar blok JSX besar di sebuah berkas (baris awal-akhir, panjang, cuplikan).
 *
 *   node scripts/peta-jsx.mjs <berkas.tsx> [min-baris=40]
 *
 * Pasangan scripts/ekstrak-jsx.mjs: menunjukkan blok mana yang layak dipindah ke komponen sendiri.
 * Yang dicetak hanya blok yang panjangnya >= min-baris dan TIDAK berada di dalam blok lain yang juga
 * dicetak pada kedalaman yang sama (supaya terbaca sebagai peta, bukan daftar bersarang penuh).
 */
import ts from 'typescript';
import fs from 'node:fs';

const [berkas, minStr] = process.argv.slice(2);
const min = Number(minStr ?? 40);
const teks = fs.readFileSync(berkas, 'utf8');
const sf = ts.createSourceFile(berkas, teks, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const baris = p => sf.getLineAndCharacterOfPosition(p).line + 1;
const hasil = [];
(function jalan(n, kedalaman) {
  const jsx = ts.isJsxExpression(n) || ts.isJsxElement(n) || ts.isJsxFragment(n);
  if (jsx && n.parent && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) {
    const a = baris(n.getStart(sf)), b = baris(n.end), pj = b - a + 1;
    if (pj >= min) {
      hasil.push({ a, b, pj, kedalaman, cuplik: teks.slice(n.getStart(sf), n.getStart(sf) + 90).replace(/\s+/g, ' ') });
      if (pj < 250) return; // blok sedang: cukup dicetak, tidak perlu diurai lagi
    }
  }
  ts.forEachChild(n, c => jalan(c, kedalaman + (jsx ? 1 : 0)));
})(sf, 0);
for (const h of hasil) console.log(`${String(h.a).padStart(5)}-${String(h.b).padEnd(5)} ${String(h.pj).padStart(4)} baris  ${'  '.repeat(h.kedalaman)}${h.cuplik}`);
