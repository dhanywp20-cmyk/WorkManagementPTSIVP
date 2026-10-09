#!/usr/bin/env node
/**
 * npm test - jalankan semua uji/*.ts (tsx) dengan env Supabase dummy yang sama seperti CI.
 *
 * Beberapa modul membuat klien Supabase saat dimuat, jadi tanpa env ini uji gagal dengan
 * "supabaseUrl is required" walau logikanya benar. Tidak ada uji yang menghubungi server.
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://x.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy',
  NEXT_PUBLIC_SUPABASE_SERVICES_URL: process.env.NEXT_PUBLIC_SUPABASE_SERVICES_URL || 'https://y.supabase.co',
  NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY || 'dummy',
};

const pilihan = process.argv.slice(2);
const berkas = readdirSync('uji').filter(f => f.endsWith('.ts')).map(f => f.replace(/\.ts$/, ''))
  .filter(f => !pilihan.length || pilihan.includes(f)).sort();

const gagal = [];
for (const f of berkas) {
  const r = spawnSync('npx', ['--yes', 'tsx@4', `uji/${f}.ts`], { env, encoding: 'utf8', shell: process.platform === 'win32' });
  const ok = r.status === 0;
  if (!ok) gagal.push(f);
  console.log(`${ok ? 'lulus' : 'GAGAL'}  uji/${f}.ts`);
  if (!ok) console.log((r.stdout || '') + (r.stderr || ''));
}
console.log(`\n${berkas.length - gagal.length}/${berkas.length} berkas uji lulus${gagal.length ? ` - gagal: ${gagal.join(', ')}` : ''}`);
process.exit(gagal.length ? 1 : 0);
