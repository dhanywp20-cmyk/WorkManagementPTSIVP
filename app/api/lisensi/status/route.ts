import { NextRequest, NextResponse } from 'next/server';
import { statusLisensi } from '@/lib/lisensi/server';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const s = statusLisensi(req.nextUrl.host);
  return NextResponse.json({
    sah: s.sah, edisi: s.edisi, pemilik: s.pemilik, pelanggan: s.pelanggan, kedaluwarsa: s.kedaluwarsa,
    sisaHari: s.sisaHari, alasan: s.alasan, pengembangan: s.pengembangan, demo: s.demo,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
