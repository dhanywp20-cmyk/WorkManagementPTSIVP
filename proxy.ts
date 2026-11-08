import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jalurPro } from './lib/lisensi/inti';
import { statusLisensi } from './lib/lisensi/server';

const BERKAS_STATIS = /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp|wav|mp3|ogg|m4a|mp4|webm|woff2?|ttf|otf|eot|txt|map|webmanifest)$/i;

const PUBLIC_PREFIXES = [
  '/_next/', '/favicon', '/IVP_Background',
  '/project-progress/share/',
  '/api/project-progress/share/',
  '/checklist/share/',
  '/api/checklist/share/',
  '/kelas/',
  '/api/kelas/',
  '/icons/',
];

const PUBLIC_EXACT = [
  '/dashboard',
  '/',
  '/manifest.webmanifest',
  '/sw.js',
  '/api/health',
  '/api/galat',
  '/api/auth/login',
  '/api/auth/login-2fa',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/verify-otp',
  '/api/auth/hash',
  '/api/auth/session',
  '/api/auth/set-credential',
  '/api/auth/register',
];

const BEBAS_LISENSI = ['/api/lisensi/status', '/api/admin/lisensi', '/api/auth/session', '/api/auth/logout'];

const CRON_PREFIX = '/api/cron/';
const MONITOR_PATH = '/api/monitor';
const INTEGRASI_DIWAYPI_PATH = '/api/integrasi/diwaypi';

function tolakLisensi(request: NextRequest, pathname: string, pesan: string) {
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: pesan, lisensi: true }, { status: 403 });
  const ke = new URL('/dashboard', request.url);
  ke.searchParams.set('lisensi', 'tolak');
  return NextResponse.redirect(ke);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const lisensi = statusLisensi(request.nextUrl.host);
  const bebas = pathname === '/dashboard' || pathname === '/' || BEBAS_LISENSI.includes(pathname) || pathname.startsWith('/_next/')
    || (!pathname.startsWith('/api/') && BERKAS_STATIS.test(pathname)) || pathname === '/api/health' || pathname.startsWith('/api/auth/');
  if (!bebas && !lisensi.sah) return tolakLisensi(request, pathname, 'Lisensi platform tidak aktif.');
  if (lisensi.sah && lisensi.edisi !== 'pro' && jalurPro(pathname)) return tolakLisensi(request, pathname, 'Menu ini hanya tersedia di edisi Pro.');

  if (PUBLIC_EXACT.includes(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next();
  if (!pathname.startsWith('/api/') && BERKAS_STATIS.test(pathname)) return NextResponse.next();
  if (pathname.startsWith(CRON_PREFIX)) return NextResponse.next();
  if (pathname === MONITOR_PATH) return NextResponse.next();
  if (pathname === INTEGRASI_DIWAYPI_PATH) return NextResponse.next();

  const session = request.cookies.get('ivp_session');
  if (!session?.value) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const keLogin = new URL('/dashboard', request.url);
    keLogin.searchParams.set('lanjut', pathname + request.nextUrl.search);
    return NextResponse.redirect(keLogin);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    {
      source: '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|bmp|wav|mp3|ogg|m4a|mp4|webm|woff2?|ttf|otf|eot|txt|map)$).*)',
      missing: [{ type: 'header', key: 'rsc' }],
    },
  ],
};
