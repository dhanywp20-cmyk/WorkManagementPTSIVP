import { readFileSync } from 'fs';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

const simpan = new Map<string, string>();
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
  getItem: (k: string) => simpan.get(k) ?? null,
  setItem: (k: string, v: string) => { simpan.set(k, v); },
  removeItem: (k: string) => { simpan.delete(k); },
  clear: () => simpan.clear(), key: () => null, length: 0,
} as Storage;

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://contoh.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'x';
process.env.NEXT_PUBLIC_SUPABASE_SERVICES_URL ??= 'https://contoh.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY ??= 'x';

(async () => {
  const { setSession, getSession } = await import('../lib/auth');
  type U = Record<string, unknown>;

  console.log('\n1. setSession mempertahankan hak akses');
  setSession({ id: 'dhany', role: 'team', jabatan: 'Manager', access_level: 'full', piket_akses: true, pimpinan: false });
  setSession({ id: 'dhany', role: 'team', jabatan: 'Manager', full_name: 'Dhany Wahyu' });
  const s1 = getSession<U>()!;
  cek('access_level tetap full', s1.access_level === 'full');
  cek('piket_akses tetap', s1.piket_akses === true);
  cek('data baru ikut tersimpan', s1.full_name === 'Dhany Wahyu');
  cek('pimpinan false tidak dipaksakan', !('pimpinan' in s1) || s1.pimpinan !== true);

  setSession({ id: 'dhany', role: 'team', access_level: 'guest' });
  cek('nilai yang dikirim menang (pencabutan berlaku)', getSession<U>()!.access_level === 'guest');

  setSession({ id: 'dhany', access_level: 'full' });
  setSession({ id: 'orang-lain', role: 'team' });
  cek('tidak menular ke user lain', !('access_level' in getSession<U>()!));

  setSession({ id: 'p1', pimpinan: true });
  setSession({ id: 'p1', role: 'guest' });
  cek('pimpinan true tetap dipertahankan (perilaku lama)', getSession<U>()!.pimpinan === true);

  console.log('\n2. KerangkaPortal memuat access_level saat menyegarkan profil');
  const k = readFileSync('app/(portal)/_kerangka/KerangkaPortal.tsx', 'utf8');
  cek('select memuat access_level & piket_akses', /select\('id,username,[^']*kpi_enabled,access_level,piket_akses'\)/.test(k));
  cek('jalur mundur tanpa kolom baru', /profilPenuh\.error\s*\?\s*await supabase\.from\('users'\)\.select\('id,username,[^']*kpi_enabled'\)/.test(k));

  console.log(`\n${gagal ? 'GAGAL' : 'LULUS'}: ${lulus} lulus, ${gagal} gagal`);
  if (gagal) process.exit(1);
})();
