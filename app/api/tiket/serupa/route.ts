/**
 * /api/tiket/serupa - tiket Solved dengan kasus mirip + Tech Note terkait,
 * untuk panel "Solusi serupa" di detail tiket. Tanpa AI (lib/solusi-serupa.ts);
 * dibaca dengan hak akses si pembuka (RLS), bukan service role.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { klienSebagaiUser, muatUser } from '@/lib/ai-server';
import { cariSolusiSerupa } from '@/lib/solusi-serupa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
  let b: { teks?: unknown; kecualiId?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, alasan: 'Body tidak sah.' }, { status: 400 }); }
  const teks = String(b.teks ?? '').slice(0, 600);
  const kecualiId = typeof b.kecualiId === 'string' && /^[0-9a-f-]{36}$/i.test(b.kecualiId) ? b.kecualiId : undefined;
  const u = await muatUser(jaga.user.id);
  if (!u) return NextResponse.json({ ok: false, alasan: 'Akun tidak ditemukan.' }, { status: 401 });
  const hasil = await cariSolusiSerupa(klienSebagaiUser(u), teks, { kecualiId, batas: 4 });
  return NextResponse.json({ ok: true, ...hasil }, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
