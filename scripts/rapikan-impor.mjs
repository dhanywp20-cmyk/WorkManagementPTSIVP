#!/usr/bin/env node
/**
 * scripts/rapikan-impor.mjs - buang impor yang tidak terpakai (TypeScript organizeImports) lalu rapikan
 * daftar impor jadi satu baris `{ a, b }`. Dipakai setelah menghapus/memindah kode.
 *
 *   node scripts/rapikan-impor.mjs <berkas> [...]
 */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const semua = process.argv.slice(2).map(f => path.resolve(f));
const cfg = ts.getParsedCommandLineOfConfigFile(path.resolve('tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
const ls = ts.createLanguageService({
  getScriptFileNames: () => semua, getScriptVersion: () => '1',
  getScriptSnapshot: (f) => fs.existsSync(f) ? ts.ScriptSnapshot.fromString(fs.readFileSync(f, 'utf8')) : undefined,
  getCurrentDirectory: () => process.cwd(), getCompilationSettings: () => cfg.options,
  getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
  fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, readDirectory: ts.sys.readDirectory,
}, ts.createDocumentRegistry());
for (const f of semua) {
  let t = fs.readFileSync(f, 'utf8');
  const nl = t.includes('\r\n') ? '\r\n' : '\n';
  const ubah = ls.organizeImports({ type: 'file', fileName: f, skipDestructiveCodeActions: false }, { newLineCharacter: nl }, undefined);
  for (const fc of ubah) for (const c of [...fc.textChanges].sort((a, b) => b.span.start - a.span.start)) t = t.slice(0, c.span.start) + c.newText + t.slice(c.span.start + c.span.length);
  t = t.replace(/import (type )?\{([^}]*)\}\s*from\s*'([^']+)';/g, (_, tipe, isi, dari) => `import ${tipe ?? ''}{ ${isi.split(',').map(x => x.trim()).filter(Boolean).join(', ')} } from '${dari}';`);
  fs.writeFileSync(f, t);
  console.log(`${path.relative(process.cwd(), f)}: ${t.split(/\r?\n/).length} baris`);
}
