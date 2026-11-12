import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser } from '@/lib/auth/server';
import { BATAS_JENIS_PER_HARI, rapikanLaporan, type LaporanGalat } from '@/lib/galat/klien';

export const dynamic = 'force-dynamic';

const KOSONG = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  try {
    const teks = await request.text();
    if (!teks || teks.length > 4096) return KOSONG();
    const mentah = JSON.parse(teks) as LaporanGalat;
    if (typeof mentah?.pesan !== 'string') return KOSONG();
    const l = rapikanLaporan(mentah);
    if (!l.pesan) return KOSONG();

    const hari = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    const sidik = createHash('sha1').update(`${l.pesan}|${l.jalur}|${hari}`).digest('hex');
    const db = getAdminClient();

    const { data: ada } = await db.from('galat_klien').select('sidik').eq('sidik', sidik).maybeSingle();
    if (!ada) {
      const { count } = await db.from('galat_klien').select('sidik', { count: 'exact', head: true }).eq('hari', hari);
      if ((count ?? 0) >= BATAS_JENIS_PER_HARI) return KOSONG();
    }
    const pengguna = await getSessionUser(request).catch(() => null);
    await db.rpc('catat_galat_klien', {
      p_sidik: sidik, p_pesan: l.pesan, p_jalur: (l.jalur ?? null) as string, p_sumber: l.sumber, p_digest: (l.digest ?? null) as string,
      p_ua: (request.headers.get('user-agent') ?? '').slice(0, 160), p_user: (pengguna?.id ?? null) as string,
    });
    if (Math.random() < 0.02) {
      const batas = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      await db.from('galat_klien').delete().lt('hari', batas);
    }
  } catch {  }
  return KOSONG();
}
