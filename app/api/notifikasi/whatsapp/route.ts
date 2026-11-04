
import { NextRequest, NextResponse } from 'next/server';
import { pastikanAdmin } from '@/lib/penjaga-admin';
import { cekKoneksiWA, kirimWA } from '@/lib/wa-kirim-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  let body: { aksi?: string; target?: string; pesan?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, alasan: 'Isi permintaan bukan JSON.' }); }

  const hasil = body.aksi === 'cek'
    ? await cekKoneksiWA()
    : await kirimWA(body.target ?? '', body.pesan ?? '');

  return NextResponse.json(hasil);
}
