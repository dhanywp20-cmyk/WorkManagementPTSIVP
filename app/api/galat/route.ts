import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser } from '@/lib/server-auth';
import { BATAS_JENIS_PER_HARI, rapikanLaporan, type LaporanGalat } from '@/lib/galat-klien';

export const dynamic = 'force-dynamic';

/**
 * /api/galat - terima laporan galat dari layar pengguna (lib/lapor-galat.ts).
 *
 * Publik (galat bisa terjadi di layar login), jadi dijaga dari sisi biaya: badan maksimal 4 KB,
 * galat yang sama di hari yang sama hanya menambah hitungan (satu baris), dan paling banyak
 * BATAS_JENIS_PER_HARI jenis baru per hari. Selalu membalas 204 - pengirim tidak perlu tahu hasilnya.
 */
const KOSONG = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  try {
    const teks = await request.text();
    if (!teks || teks.length > 4096) return KOSONG();
    const mentah = JSON.parse(teks) as LaporanGalat;
    if (typeof mentah?.pesan !== 'string') return KOSONG();
    const l = rapikanLaporan(mentah);
    if (!l.pesan) return KOSONG();

    const hari = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);   // tanggal WIB
    const sidik = createHash('sha1').update(`${l.pesan}|${l.jalur}|${hari}`).digest('hex');
    const db = getAdminClient();

    //  Jenis baru melewati batas harian -> abaikan; galat yang sudah tercatat tetap dihitung.
    const { data: ada } = await db.from('galat_klien').select('sidik').eq('sidik', sidik).maybeSingle();
    if (!ada) {
      const { count } = await db.from('galat_klien').select('sidik', { count: 'exact', head: true }).eq('hari', hari);
      if ((count ?? 0) >= BATAS_JENIS_PER_HARI) return KOSONG();
    }
    const pengguna = await getSessionUser(request).catch(() => null);
    await db.rpc('catat_galat_klien', {
      p_sidik: sidik, p_pesan: l.pesan, p_jalur: l.jalur ?? null, p_sumber: l.sumber, p_digest: l.digest ?? null,
      p_ua: (request.headers.get('user-agent') ?? '').slice(0, 160), p_user: pengguna?.id ?? null,
    });
    //  Pembersihan sesekali: catatan lebih dari 30 hari dibuang (tanpa cron tambahan).
    if (Math.random() < 0.02) {
      const batas = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      await db.from('galat_klien').delete().lt('hari', batas);
    }
  } catch { /* laporan rusak / basis data sibuk: abaikan */ }
  return KOSONG();
}
