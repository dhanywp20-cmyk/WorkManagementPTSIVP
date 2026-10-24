import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * /api/health - penanda "aplikasi hidup" untuk pemantau uptime (UptimeRobot, Better Stack, dst).
 *
 * Publik dan SENGAJA tidak menyentuh basis data: titik yang bisa dipanggil siapa saja tidak boleh
 * menjadi pintu beban ke Supabase. Yang diuji hanya bahwa fungsi serverless bisa jalan. Kesehatan
 * database tersedia untuk admin di Admin Panel -> Kesehatan Sistem.
 */
/**
 * `komit` = versi web yang sedang live (7 huruf komit Vercel). Halaman yang sudah lama terbuka - tab yang ditinggal
 * berhari-hari, atau WebView aplikasi Android yang tidak pernah memuat ulang - membandingkannya dengan komit yang
 * tertanam di kodenya sendiri (components/shared/PantauVersiWeb.tsx) untuk tahu ada versi baru.
 */
const tubuh = () => ({ ok: true, waktu: new Date().toISOString(), komit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null });
const kepala = { 'Cache-Control': 'no-store' };

export function GET() {
  return NextResponse.json(tubuh(), { headers: kepala });
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: kepala });
}
