import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * /api/health - penanda "aplikasi hidup" untuk pemantau uptime (UptimeRobot, Better Stack, dst).
 *
 * Publik dan SENGAJA tidak menyentuh basis data: titik yang bisa dipanggil siapa saja tidak boleh
 * menjadi pintu beban ke Supabase. Yang diuji hanya bahwa fungsi serverless bisa jalan. Kesehatan
 * database tersedia untuk admin di Admin Panel -> Kesehatan Sistem.
 */
const tubuh = () => ({ ok: true, waktu: new Date().toISOString() });
const kepala = { 'Cache-Control': 'no-store' };

export function GET() {
  return NextResponse.json(tubuh(), { headers: kepala });
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: kepala });
}
