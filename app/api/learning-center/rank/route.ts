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

  /*
    TANPA embed users(...) - dua kueri terpisah, digabung di JS.

    Embed (`.select('user_id, score, ..., users(role, sales_division)')`)
    bergantung pada PostgREST BERHASIL mengenali relasi FK dari
    lc_quiz_attempts.user_id ke users.id. Di basis data ini relasi itu TIDAK
    selalu terbaca - kolomnya ada yang sekadar uuid/text tanpa constraint
    REFERENCES sungguhan (lihat catatan sql/kunci-tabel-lanjutan-2.sql).
    Saat embed gagal, PostgREST tidak melempar error - ia hanya mengembalikan
    `users: null` untuk SETIAP baris, lalu `hitungPeringkat` membuang semuanya
    lewat penyaring `!a.role`, dan peringkat SIAPA PUN jadi kosong tanpa
    pesan galat apa pun. AdminDashboard.tsx sudah pernah menabrak masalah yang
    sama persis dan menghindarinya dengan cara ini - polanya disalin dari sana.
  */
  const [attRes, usersRes] = await Promise.all([
    //  '*' disengaja, bukan daftar kolom. PostgREST menolak SELURUH kueri bila
    //  satu kolom belum ada di skema, jadi menyebut tab_switches/grading_status
    //  eksplisit membuat papan kosong total di basis data yang migrasinya belum
    //  jalan - tanpa pesan galat apa pun. Alasan yang sama dicatat di
    //  AdminDashboard.tsx untuk kueri yang setara.
    supabase.from('lc_quiz_attempts').select('*').eq('is_submitted', true),
    supabase.from('users').select('id, full_name, role, sales_division'),
  ]);

  if (attRes.error) return NextResponse.json({ error: attRes.error.message }, { status: 400 });
  if (usersRes.error) return NextResponse.json({ error: usersRes.error.message }, { status: 400 });

  type BarisUser = { id: string; full_name: string | null; role: string | null; sales_division: string | null };
  const petaUser = new Map<string, BarisUser>();
  for (const u of (usersRes.data ?? []) as BarisUser[]) petaUser.set(u.id, u);

  type Baris = {
    user_id: string; score: number | null; grading_status: string | null;
    passed: boolean | null; tab_switches: number | null;
  };
  const diratakan: BarisAttempt[] = ((attRes.data ?? []) as Baris[]).map(a => {
    const u = petaUser.get(a.user_id);
    return {
      user_id: a.user_id, score: a.score, grading_status: a.grading_status,
      passed: a.passed, tab_switches: a.tab_switches,
      full_name: u?.full_name ?? null,
      role: u?.role ?? null, sales_division: u?.sales_division ?? null,
    };
  });

  const hasil = hitungPeringkat(diratakan, {
    id: caller.id, role: caller.role, sales_division: caller.sales_division,
  });

  return NextResponse.json(hasil);
}
