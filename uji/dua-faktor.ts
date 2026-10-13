/**
 * uji/dua-faktor.ts - verifikasi dua langkah (2FA): TOTP (vektor RFC), penyimpanan terenkripsi,
 * kode cadangan, tiket login 5 menit, anti-replay, dan pemasangan di route/proxy/migrasi 049.
 *
 * Jalankan: npm test -- dua-faktor
 */
import { readFileSync } from 'fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  kodeHotp, kodeTotp, cocokTotp, base32Encode, base32Decode, enkripsiRahasia, dekripsiRahasia,
  buatKodeCadangan, cocokKodeCadangan, buatRahasia,
} from '../lib/totp';
import { buatTantangan, bacaTantangan, MASA_TANTANGAN_MS } from '../lib/tantangan-2fa';
import { periksaKode2FA, rapikanPengaturan2FA, type Baris2FA } from '../lib/dua-faktor-server';

let ok = 0, salah = 0;
const cek = (n: string, s: boolean) => { if (s) { ok++; console.log(`  ok   ${n}`); } else { salah++; console.log(`  GAGAL ${n}`); } };

console.log('\n1. TOTP & penyimpanan');
// RFC 6238 Lampiran B (SHA1, rahasia ASCII "12345678901234567890", 8 digit)
const r = Buffer.from('12345678901234567890');
for (const [t, kode] of [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']] as const) {
  cek(`RFC6238 t=${t}`, kodeHotp(r, Math.floor(t / 30), 8) === kode);
}
// RFC 4226 Lampiran D (HOTP 6 digit)
const hotp = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
hotp.forEach((k, i) => cek(`RFC4226 c=${i}`, kodeHotp(r, i) === k));
cek('base32 bolak-balik', base32Decode(base32Encode(r)).equals(r));
cek('base32 RFC vektor', base32Encode(Buffer.from('foobar')) === 'MZXW6YTBOI');
const rah = buatRahasia(); const t0 = 1_760_000_000_000;
cek('kode sekarang cocok', cocokTotp(rah, kodeTotp(rah, t0), t0) !== null);
cek('periode sebelumnya diterima (jam HP telat)', cocokTotp(rah, kodeTotp(rah, t0 - 30_000), t0) !== null);
cek('2 periode lalu ditolak', cocokTotp(rah, kodeTotp(rah, t0 - 60_000), t0) === null);
const l = cocokTotp(rah, kodeTotp(rah, t0), t0)!;
cek('kode yang sudah dipakai ditolak (anti-replay)', cocokTotp(rah, kodeTotp(rah, t0), t0, l) === null);
cek('kode salah ditolak', cocokTotp(rah, '000000', t0) === null || kodeTotp(rah, t0) === '000000');
cek('huruf/kosong ditolak', cocokTotp(rah, 'abcdef', t0) === null && cocokTotp(rah, '', t0) === null);
process.env.SUPABASE_JWT_SECRET = 'rahasia-uji';
const e = enkripsiRahasia(rah);
cek('enkripsi tidak menyimpan teks asli', !e.includes(rah));
cek('dekripsi kembali utuh', dekripsiRahasia(e) === rah);
let galat = ''; try { dekripsiRahasia(e.slice(0, -4) + 'AAAA'); } catch (x) { galat = String(x); }
cek('isi diubah -> ditolak (GCM)', !!galat);
process.env.SUPABASE_JWT_SECRET = 'kunci-lain'; galat = ''; try { dekripsiRahasia(e); } catch (x) { galat = String(x); }
cek('kunci server berbeda -> tidak bisa dibuka', !!galat);
const c = buatKodeCadangan();
cek('8 kode cadangan format XXXX-XXXX', c.teks.length === 8 && c.teks.every(k => /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(k)));
cek('kode cadangan cocok (abaikan huruf kecil & strip)', cocokKodeCadangan(c.teks[3].toLowerCase().replace('-', ''), c.hash) === 3);
cek('kode cadangan salah', cocokKodeCadangan('AAAA-AAAA', c.hash) === -1);

console.log('\n2. Tiket login (tantangan)');
process.env.SUPABASE_JWT_SECRET = 'rahasia-uji';
const t1 = 1_760_000_000_000;
const tk = buatTantangan('11111111-2222-3333-4444-555555555555', 'kode_2fa', t1);
cek('tiket sah terbaca', bacaTantangan(tk, t1 + 1000)?.uid === '11111111-2222-3333-4444-555555555555');
cek('tiket kedaluwarsa sesudah 5 menit', bacaTantangan(tk, t1 + MASA_TANTANGAN_MS + 1) === null);
const [badan, ttd] = tk.split('.');
const palsu = Buffer.from(JSON.stringify({ uid: 'lain', tahap: 'kode_2fa', exp: t1 + 99999 })).toString('base64url');
cek('isi diubah -> ditolak', bacaTantangan(`${palsu}.${ttd}`, t1) === null);
cek('tanda tangan dibuang -> ditolak', bacaTantangan(badan, t1) === null && bacaTantangan('', t1) === null && bacaTantangan(undefined, t1) === null);
process.env.SUPABASE_JWT_SECRET = 'kunci-lain';
cek('kunci server lain -> ditolak', bacaTantangan(tk, t1) === null);
process.env.SUPABASE_JWT_SECRET = 'rahasia-uji';

console.log('\n3. Pengaturan');
cek('bawaan: tidak wajib', rapikanPengaturan2FA(null).wajibAdmin === false);
cek('teks JSON terbaca', rapikanPengaturan2FA('{"wajibAdmin":true}').wajibAdmin === true);
cek('objek jsonb terbaca', rapikanPengaturan2FA({ wajibAdmin: true }).wajibAdmin === true);
cek('nilai aneh -> tidak wajib', rapikanPengaturan2FA({ wajibAdmin: 'ya' }).wajibAdmin === false);

console.log('\n4. Periksa kode (basis data tiruan)');
// Tiruan rantai supabase .from().update().eq().lt()/.contains().select() atas satu baris.
function dbTiruan(baris: Baris2FA) {
  return {
    from: () => ({
      update: (ubah: Partial<Baris2FA>) => {
        const syarat: ((b: Baris2FA) => boolean)[] = [];
        const rantai = {
          eq: (k: keyof Baris2FA, v: unknown) => { syarat.push(b => b[k] === v); return rantai; },
          lt: (k: keyof Baris2FA, v: number) => { syarat.push(b => Number(b[k]) < v); return rantai; },
          contains: (k: keyof Baris2FA, v: string[]) => { syarat.push(b => v.every(x => (b[k] as string[]).includes(x))); return rantai; },
          select: async () => {
            if (!syarat.every(f => f(baris))) return { data: [] };
            Object.assign(baris, ubah);
            return { data: [{ user_id: baris.user_id }] };
          },
        };
        return rantai;
      },
    }),
  } as unknown as SupabaseClient;
}
const rahasia2 = buatRahasia();
const cad = buatKodeCadangan();
const baris: Baris2FA = {
  user_id: 'u1', rahasia: enkripsiRahasia(rahasia2), aktif: true, cadangan: cad.hash, langkah_terakhir: -1, diaktifkan_pada: null,
};
const db = dbTiruan(baris);
(async () => {
  const kodeKini = kodeTotp(rahasia2, t1);
  cek('kode benar diterima', (await periksaKode2FA(db, { ...baris }, kodeKini, t1)).ok);
  cek('kode yang sama ditolak (dipakai ulang)', !(await periksaKode2FA(db, { ...baris }, kodeKini, t1)).ok);
  cek('kode berikutnya diterima', (await periksaKode2FA(db, { ...baris }, kodeTotp(rahasia2, t1 + 30_000), t1 + 30_000)).ok);
  cek('kode salah ditolak', !(await periksaKode2FA(db, { ...baris }, '123456'.replace(kodeTotp(rahasia2, t1 + 60_000), '654321'), t1 + 60_000)).ok);
  const c1 = await periksaKode2FA(db, { ...baris }, cad.teks[0], t1);
  cek('kode cadangan diterima & sisa 7', c1.ok && c1.pakaiCadangan === true && c1.sisaCadangan === 7);
  cek('kode cadangan sama ditolak kedua kali', !(await periksaKode2FA(db, { ...baris }, cad.teks[0], t1)).ok);
  cek('masukan kosong/terlalu panjang ditolak', !(await periksaKode2FA(db, { ...baris }, '', t1)).ok && !(await periksaKode2FA(db, { ...baris }, 'X'.repeat(30), t1)).ok);

  console.log('\n5. Pemasangan');
  const login = readFileSync('app/api/auth/login/route.ts', 'utf8');
  const iKode = login.indexOf("tahap: 'kode_2fa'"), iSesi = login.indexOf('selesaikanMasuk(supabase, user');
  cek('login: akun ber-2FA dapat tiket SEBELUM sesi dibuat', iKode > 0 && iSesi > iKode);
  cek('login: galat baca 2FA = tolak (bukan lewati)', /baca2FA[\s\S]{0,80}catch \{\s*return NextResponse\.json\([^)]*status: 503/.test(login));
  cek('login: admin wajib 2FA diminta daftar', /adalahAdmin\(user\.role\) && \(await bacaPengaturan2FA/.test(login));
  const l2 = readFileSync('app/api/auth/login-2fa/route.ts', 'utf8');
  cek('login-2fa: kode salah dihitung ke lockout', /catatPercobaan\(supabase, user\.username, ip, false\)/.test(l2) && /sedangTerkunci/.test(l2));
  const proxy = readFileSync('proxy.ts', 'utf8');
  cek('proxy: /api/auth/login-2fa publik', proxy.includes("'/api/auth/login-2fa'"));
  cek('proxy: /api/auth/2fa & /api/admin/2fa TIDAK publik', !proxy.includes("'/api/auth/2fa'") && !proxy.includes("'/api/admin/2fa'"));
  const adm = readFileSync('app/api/admin/2fa/route.ts', 'utf8');
  cek('admin: dijaga pastikanAdmin', (adm.match(/pastikanAdmin\(req\)/g) ?? []).length === 2);
  cek('admin: wajib hanya bila pemanggil sudah ber-2FA', /wajibAdmin && !\(await baca2FA\(db, jaga\.user\.id\)\)\?\.aktif/.test(adm));
  const sql = readFileSync('supabase/migrations/049_user_2fa.sql', 'utf8');
  cek('049: tabel tanpa akses peramban', /FORCE ROW LEVEL SECURITY/.test(sql) && /REVOKE ALL ON public\.user_2fa FROM PUBLIC, anon, authenticated/.test(sql));
  cek('049: keamanan_2fa terkunci dari peramban (RESTRICTIVE)', /AS RESTRICTIVE FOR ALL TO anon, authenticated\s+USING \(key <> 'keamanan_2fa'\)/.test(sql));
  const sesi = readFileSync('lib/masuk-server.ts', 'utf8');
  cek('sesi: cookie httpOnly', /httpOnly: true/.test(sesi));

  console.log(`\n${salah ? 'GAGAL' : 'OK'}: ${ok} lulus, ${salah} gagal`);
  process.exit(salah ? 1 : 0);
})();
