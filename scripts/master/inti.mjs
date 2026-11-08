export const KECUALI_AWALAN = [
  '.github/', '.claude/', 'docs/', 'arsip/', 'android/', 'sql/', 'hasil/', 'hasil-master/', 'e2e/', 'uji/',
];
export const KECUALI_PERSIS = ['LICENSE', 'README.md', 'DEPLOYMENT.md'];

export const berkasMasuk = f => !KECUALI_AWALAN.some(a => f.startsWith(a)) && (!f.startsWith('scripts/') || f.startsWith('scripts/master/')) && !KECUALI_PERSIS.includes(f) && !/(^|\/)\.env(\.|$)/.test(f.replace(/\.env\.example$/, ''));

export function buangMenuPemilik(teks) {
  let s = teks.replace(/\r\n/g, '\n');
  s = s.replace(/\n {2}\{\n {4}title: 'Database PTS',[\s\S]*?\n {2}\},(?=\n)/, '');
  s = s.replace(/'database-pts', ?/g, '').replace(/, ?'database-pts'/g, '');
  s = s.replace(/\n {2}'database-pts': [^\n]*/g, '');
  if (/database-pts|Database PTS|1drv\.ms\/f\//.test(s)) throw new Error('Menu Database PTS masih tersisa di daftar-menu.tsx');
  return s;
}

export function rapikanPaket(teks) {
  const p = JSON.parse(teks);
  if (p.scripts) {
    delete p.scripts.test;
    p.scripts['buat-admin'] = 'node scripts/master/buat-admin.mjs';
  }
  return `${JSON.stringify(p, null, 2)}\n`;
}

const POLA_JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const POLA_URL_SUPABASE = /https:\/\/[a-z0-9]{20}\.supabase\.co/g;

export function bersihkanSql(teks) {
  let s = teks.replace(/\r\n/g, '\n');
  s = s.split('\n').filter(b => !/^\\(un)?restrict\b/.test(b) && !/^SET transaction_timeout\b/.test(b)).join('\n');
  s = s.replace(/^CREATE SCHEMA public;$/m, 'CREATE SCHEMA IF NOT EXISTS public;');
  s = s.replace(/'database-pts'::text,\s*/g, '').replace(/,\s*'database-pts'::text/g, '');
  s = s.replace(POLA_JWT, '<GANTI_SERVICE_ROLE_KEY>').replace(POLA_URL_SUPABASE, 'https://<GANTI_PROJECT_REF>.supabase.co');
  return s;
}

const POLA_RAHASIA = [
  { nama: 'JWT / kunci Supabase', re: POLA_JWT },
  { nama: 'kunci rahasia Supabase', re: /sb_secret_[A-Za-z0-9_-]{10,}/g },
  { nama: 'kunci privat', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { nama: 'tautan OneDrive pemilik', re: /1drv\.ms\/f\/c\/25d404c0b5ee2b43/g },
];

export function cariRahasia(teks) {
  return POLA_RAHASIA.filter(p => { p.re.lastIndex = 0; return p.re.test(teks); }).map(p => p.nama);
}
