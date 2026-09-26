import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Berkas statis di /public dikenali dari EKSTENSINYA, bukan dari daftar nama.
 *
 * Ini menutup satu kelas bug, bukan satu bug. Sebelumnya tiap berkas publik
 * harus didaftarkan namanya di PUBLIC_PREFIXES; berkas baru yang lupa
 * didaftarkan ikut kena gerbang sesi, jadi pengunjung yang BELUM login
 * dialihkan ke /dashboard saat memintanya - peramban menerima HTML, bukan
 * gambar, dan <img>-nya gagal. Persis yang terjadi pada /logo-mark.png: logo
 * hilang di halaman login, lalu muncul sendiri sesudah login karena cookie
 * sesinya sudah ada. Itu juga yang membuatnya terasa "sesekali".
 *
 * Berkas di /public memang tidak pernah rahasia - ia dilayani CDN dan bisa
 * diambil siapa saja yang tahu URL-nya. Gerbang sesi ada untuk HALAMAN dan
 * API, bukan untuk gambar dan suara. `.html` sengaja TIDAK ikut: beberapa
 * berkas pratinjau di /public berupa HTML dan tidak perlu dibuka ke publik.
 */
const BERKAS_STATIS = /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp|wav|mp3|ogg|m4a|mp4|webm|woff2?|ttf|otf|eot|txt|map|webmanifest)$/i;

// Static assets + auth API endpoints that don't require a session.
// /project-progress/share/ = link View-Only yang sengaja dibagikan ke user luar;
// datanya dibaca lewat /api/project-progress/share/ (service_role, read-only).
const PUBLIC_PREFIXES = [
  '/_next/', '/favicon', '/IVP_Background',
  '/project-progress/share/',
  '/api/project-progress/share/',
  '/icons/',
  // Digital Asset Links: Android memverifikasi aplikasi TWA (tanpa login).
  '/.well-known/',
];

// Exact public paths (pages + API routes that handle their own auth or need no auth)
const PUBLIC_EXACT = [
  '/dashboard',
  '/',
  // PWA installability: Chrome fetches ini SEBELUM login (dari layar login) -
  // kalau diblok jadi 302 ke /dashboard, Chrome dapat HTML bukan JSON/JS dan
  // diam-diam menganggap app tidak installable (menu "Install app" tak muncul).
  '/manifest.webmanifest',
  '/sw.js',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/verify-otp',
  '/api/auth/hash',
  '/api/auth/session',
  '/api/auth/set-credential', // registrasi publik: set password user baru (first-time only)
  '/api/auth/register', // registrasi publik: buat akun baru (guest/Pending Approval, atau bypass event LC)
];

// Cron jobs are called by Vercel scheduler with CRON_SECRET, not a user session
const CRON_PREFIX = '/api/cron/';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_EXACT.includes(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next();
  //  Cek /api/ lebih dulu: rute API tidak boleh lolos hanya karena ujung
  //  jalurnya kebetulan berakhiran seperti nama berkas.
  if (!pathname.startsWith('/api/') && BERKAS_STATIS.test(pathname)) return NextResponse.next();
  if (pathname.startsWith(CRON_PREFIX)) return NextResponse.next();

  const session = request.cookies.get('ivp_session');
  if (!session?.value) {
    // API calls return 401 instead of redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
