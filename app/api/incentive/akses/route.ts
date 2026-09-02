import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser } from '@/lib/server-auth';
import { aksesSah, bisaKonfigPenuh, tingkatAkses } from '@/lib/incentive-akses';

export const dynamic = 'force-dynamic';

/**
 * /api/incentive/akses - mengatur SIAPA BOLEH APA di modul Incentive PTS.
 *
 * Terpisah dari /api/admin/users karena penjaganya berbeda: yang boleh
 * memakai route ini adalah pemegang akses PENUH modul insentif, bukan hanya
 * role 'admin'. Itu justru inti perubahannya - Manager PTS harus bisa
 * mengatur timnya sendiri tanpa menunggu admin platform.
 *
 * Kolom `incentive_akses` & `incentive_brand_scope` dibekukan untuk anon oleh
 * trigger guard_users_privileged_columns, jadi route inilah satu-satunya jalan
 * sah mengubahnya - tidak ada yang bisa menaikkan aksesnya sendiri lewat REST
 * dengan anon key.
 */

async function penjaga(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) return { galat: NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 }) };

  const supabase = getAdminClient();
  const { data: row } = await supabase
    .from('users').select('incentive_akses, allow_incentive_input, access_level').eq('id', caller.id).maybeSingle();

  const pemanggil = { role: caller.role, ...(row ?? {}) };
  if (!bisaKonfigPenuh(pemanggil)) {
    return { galat: NextResponse.json({ error: 'Butuh akses konfigurasi penuh Incentive PTS.' }, { status: 403 }) };
  }
  return { caller, supabase };
}

export async function POST(request: NextRequest) {
  try {
    const { galat, caller, supabase } = await penjaga(request);
    if (galat) return galat;

    const body = await request.json();
    const userId = body?.userId as string;
    if (!userId) return NextResponse.json({ error: 'userId wajib.' }, { status: 400 });

    if (body?.action === 'setAkses') {
      const nilai = aksesSah(body.value);
      if (!nilai) return NextResponse.json({ error: 'Tingkat akses harus penuh, input, atau lihat.' }, { status: 400 });

      /*
        Tidak boleh menurunkan akses DIRI SENDIRI dari layar ini. Bukan soal
        keamanan - orang yang melakukannya langsung kehilangan layar yang
        baru saja ia pakai, dan tidak ada jalan kembali selain meminta admin.
        Lebih baik ditolak dengan kalimat yang menjelaskan sebabnya.
      */
      if (userId === caller!.id && nilai !== 'penuh') {
        return NextResponse.json({ error: 'Tidak bisa menurunkan akses Anda sendiri. Minta pemegang akses penuh lain yang melakukannya.' }, { status: 400 });
      }

      const { error } = await supabase!.from('users')
        //  allow_incentive_input ikut disamakan supaya layar/route lama yang
        //  masih membaca kolom itu tidak berbeda pendapat dengan kolom baru.
        .update({ incentive_akses: nilai, allow_incentive_input: nilai !== 'lihat' })
        .eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, akses: nilai });
    }

    if (body?.action === 'setBrandScope') {
      const v = (body.value ?? null) as string | null;
      const scope = v === null || v === 'MVI' || v === 'IVP' ? v : undefined;
      if (scope === undefined) {
        return NextResponse.json({ error: 'Lingkup brand harus MVI, IVP, atau kosong.' }, { status: 400 });
      }
      const { error } = await supabase!.from('users').update({ incentive_brand_scope: scope }).eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses permintaan.' }, { status: 500 });
  }
}

/** GET - tingkat akses PEMANGGIL sendiri, untuk halaman yang perlu memastikan ke server. */
export async function GET(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });
  const supabase = getAdminClient();
  const { data: row } = await supabase
    .from('users').select('incentive_akses, allow_incentive_input, incentive_brand_scope, access_level').eq('id', caller.id).maybeSingle();
  return NextResponse.json({
    akses: tingkatAkses({ role: caller.role, ...(row ?? {}) }),
    brandScope: (row as { incentive_brand_scope?: string | null } | null)?.incentive_brand_scope ?? null,
  });
}
