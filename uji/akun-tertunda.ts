import { readFileSync } from 'fs';
import { NextRequest } from 'next/server';
import { akunTertunda, TIM_TERTUNDA } from '../lib/auth/akun-tertunda';
import { selesaikanMasuk } from '../lib/auth/masuk-server';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

(async () => {
  console.log('\n1. Penanda akun tertunda');
  cek('Pending Approval tertunda', akunTertunda({ team_type: TIM_TERTUNDA }));
  cek('Guest aktif tidak tertunda', !akunTertunda({ team_type: 'Guest' }));
  cek('tanpa team_type tidak tertunda', !akunTertunda({}) && !akunTertunda(null));

  console.log('\n2. selesaikanMasuk menolak tanpa membuat sesi');
  let disentuh = false;
  const db = new Proxy({}, { get() { disentuh = true; throw new Error('db tidak boleh dipakai'); } });
  const res = await selesaikanMasuk(db as never, { id: 'u', username: 'calon', full_name: 'Calon', role: 'guest', team_type: TIM_TERTUNDA }, new NextRequest('http://localhost/api/auth/login'), '1.1.1.1');
  const isi = await res.json();
  cek('status 403', res.status === 403);
  cek('tanpa cookie sesi', !res.cookies.get('ivp_session'));
  cek('tanpa db_token', !('db_token' in isi));
  cek('basis data tidak disentuh', !disentuh);

  console.log('\n3. Semua jalur sesi server memeriksa akun tertunda');
  const jalur: [string, RegExp][] = [
    ['app/api/auth/login/route.ts', /if \(akunTertunda\(user\)\)[\s\S]*?status: 403[\s\S]*?baca2FA/],
    ['app/api/auth/session/route.ts', /akunTertunda\(user\)[\s\S]*?user_sessions'\)\.delete\(\)[\s\S]*?issueDbToken/],
    ['lib/auth/server.ts', /team_type'\)[\s\S]*?akunTertunda\(user\)\) return null/],
    ['lib/auth/penjaga-admin.ts', /team_type'\)[\s\S]*?akunTertunda\(user\)\) return \{ ok: false, status: 403/],
  ];
  for (const [p, re] of jalur) cek(p, re.test(readFileSync(p, 'utf8')));

  console.log(`\n${gagal ? 'GAGAL' : 'LULUS'}: ${lulus} lulus, ${gagal} gagal`);
  if (gagal) process.exit(1);
})();
