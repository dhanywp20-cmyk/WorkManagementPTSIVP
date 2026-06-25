import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Static assets + auth API endpoints that don't require a session
const PUBLIC_PREFIXES = ['/_next/', '/favicon', '/IVP_Background'];

// Exact public paths (pages + API routes that handle their own auth or need no auth)
const PUBLIC_EXACT = [
  '/dashboard',
  '/',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/verify-otp',
  '/api/auth/hash',
  '/api/auth/session',
  '/api/auth/set-credential', // registrasi publik: set password user baru (first-time only)
];

// Cron jobs are called by Vercel scheduler with CRON_SECRET, not a user session
const CRON_PREFIX = '/api/cron/';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_EXACT.includes(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next();
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
