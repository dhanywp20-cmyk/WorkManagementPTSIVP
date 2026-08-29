import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser } from '@/lib/server-auth';
import { hitungPeringkat, type BarisAttempt } from '@/lib/learning-rank';

export const dynamic = 'force-dynamic';

/**
 * GET /api/learning-center/rank
 *
 * Peringkat quiz SESEORANG - dihitung di server, bukan di klien.
 *
 * ScorePage.tsx sebelumnya menghitung "Top Performers" dengan menarik
 * SELURUH baris lc_quiz_attempts berikut nama semua peserta ke browser, lalu
 * menyamarkan nama orang lain dengan CSS blur() di sisi klien. Itu bukan
 * proteksi sungguhan - siapa pun yang membuka DevTools/Network tab tetap
 * melihat nama dan skor asli semua orang lain persis di response JSON-nya.
 * Sementara itu policy RLS `lca_milik` pada lc_quiz_attempts (lihat
 * sql/kunci-tabel-lanjutan-2.sql) sudah menahan role guest/sales membaca
 * baris SIAPA PUN selain dirinya sendiri - jadi query lintas-peserta itu
 * untuk mereka pasti kembali kosong. Dua masalah dari satu akar yang sama:
 * bocor untuk Team (semua data terkirim, cuma disembunyikan CSS), rusak
 * untuk Guest/Sales (query-nya ditolak RLS sejak awal).
 *
 * Di sini datanya diagregasi di server dengan service-role key (melewati
 * RLS secara sah, karena inilah satu-satunya tempat agregasi lintas-peserta
 * boleh terjadi - lihat hitungPeringkat di lib/learning-rank.ts), dan yang
 * dikembalikan ke klien HANYA angka milik si pemanggil: peringkat dan jumlah
 * peserta. Nama serta skor peserta lain TIDAK PERNAH dikirim ke browser.
 */
export async function GET(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) {
    return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });
  }

  const supabase = getAdminClient();

  const { data: rows, error } = await supabase
    .from('lc_quiz_attempts')
    .select('user_id, score, grading_status, users(role, sales_division)')
    .eq('is_submitted', true);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  type Penerima = { role: string | null; sales_division: string | null } | { role: string | null; sales_division: string | null }[] | null;
  type Baris = { user_id: string; score: number | null; grading_status: string | null; users: Penerima };

  const diratakan: BarisAttempt[] = ((rows ?? []) as Baris[]).map(a => {
    const u = Array.isArray(a.users) ? a.users[0] : a.users;
    return {
      user_id: a.user_id, score: a.score, grading_status: a.grading_status,
      role: u?.role ?? null, sales_division: u?.sales_division ?? null,
    };
  });

  const hasil = hitungPeringkat(diratakan, {
    id: caller.id, role: caller.role, sales_division: caller.sales_division,
  });

  return NextResponse.json(hasil);
}
