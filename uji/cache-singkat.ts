/**
 * uji/cache-singkat.ts - ingatan singkat data rujukan: satu permintaan untuk banyak pemanggil,
 * hasil gagal tidak diingat, dan lupakan() memaksa ambil ulang.
 *
 * Jalankan: npx tsx uji/cache-singkat.ts
 */
import { ingat, lupakan } from '../lib/cache-singkat';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

(async () => {
  console.log('\nCache singkat');
  let panggil = 0;
  const ambil = () => { panggil++; return Promise.resolve({ data: [panggil], error: null }); };
  const [a, b] = await Promise.all([ingat('u', ambil), ingat('u', ambil)]);
  cek('dua pemanggil bersamaan -> satu permintaan, hasil sama', panggil === 1 && a === b);
  await ingat('u', ambil);
  cek('dalam umurnya -> tidak meminta lagi', panggil === 1);
  await ingat('u', ambil, 0);
  cek('umur habis -> meminta lagi', panggil === 2);

  let coba = 0;
  const galatSupabase = () => { coba++; return Promise.resolve({ data: null, error: { message: 'jaringan' } }); };
  await ingat('g', galatSupabase); await ingat('g', galatSupabase);
  cek('hasil Supabase ber-error tidak diingat', coba === 2);

  let lempar = 0;
  const gagalLempar = () => { lempar++; return Promise.reject(new Error('putus')); };
  await ingat('l', gagalLempar).catch(() => {}); await ingat('l', gagalLempar).catch(() => {});
  cek('janji yang ditolak tidak diingat', lempar === 2);

  panggil = 0;
  await ingat('pengguna:a', ambil); await ingat('pengguna:b', ambil); await ingat('lain', ambil);
  lupakan('pengguna:');
  await ingat('pengguna:a', ambil); await ingat('lain', ambil);
  cek('lupakan(awalan) hanya membuang kunci berawalan itu', panggil === 4);

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  if (gagal) process.exit(1);
})();
