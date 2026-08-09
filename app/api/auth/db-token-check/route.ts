import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, isAdminRole } from '@/lib/server-auth';
import { issueDbToken } from '@/lib/db-token';

export const dynamic = 'force-dynamic';

/**
 * /api/auth/db-token-check — apakah SUPABASE_JWT_SECRET yang dipasang benar?
 *
 * Ini pemeriksaan yang HARUS lolos sebelum sql/rls-project-progress.sql
 * dijalankan. Kalau rahasianya salah, PostgREST menolak setiap token, dan
 * begitu RLS menyala seluruh modul akan tampak kosong bagi semua orang.
 *
 * Cara kerjanya: terbitkan token untuk pemanggil, lalu pakai token itu untuk
 * memanggil PostgREST sungguhan. Yang diuji bukan bentuk tokennya, melainkan
 * apakah PostgREST MENERIMA tanda tangannya — dan itu hanya terjadi bila
 * rahasia di aplikasi sama persis dengan rahasia di Supabase.
 *
 * Kode status dari PostgREST dibaca begini:
 *   401  → rahasia SALAH (tanda tangan ditolak)
 *   404  → rahasia BENAR, tapi fungsi debug_jwt_claims belum dibuat
 *   200  → rahasia benar dan fungsi sudah ada; klaim ikut dikembalikan
 *
 * Hanya admin yang boleh memanggil — hasilnya menyebut keadaan konfigurasi.
 */
export async function GET(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) {
    return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });
  }
  if (!isAdminRole(caller.role)) {
    return NextResponse.json({ error: 'Hanya admin yang boleh menjalankan pemeriksaan ini.' }, { status: 403 });
  }

  /**
   * Kesiapan environment. Yang dilaporkan hanya ADA / TIDAK ADA — nilainya
   * tidak pernah ikut, supaya endpoint ini tidak berubah jadi jalan membaca
   * rahasia lewat browser.
   */
  const env = {
    SUPABASE_JWT_SECRET: {
      ada: !!process.env.SUPABASE_JWT_SECRET,
      untuk: 'Menerbitkan token PostgREST. Tanpa ini, RLS Project Progress tidak punya identitas untuk disaring.',
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      ada: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      untuk: 'Dipakai route server & cron digest. Tanpa ini, digest berjalan sebagai anon dan — karena RLS aktif — hanya melihat nol lokasi, jadi pesannya selalu kosong.',
    },
    CRON_SECRET: {
      ada: !!process.env.CRON_SECRET,
      untuk: 'Menjaga /api/cron/*. Tanpa ini, cron escalate dan digest menolak semua panggilan dengan 401.',
    },
    GEMINI_API_KEY: {
      ada: !!process.env.GEMINI_API_KEY,
      untuk: 'Fitur AI. Opsional.',
    },
  };
  const envKurang = Object.entries(env)
    .filter(([k, v]) => !v.ada && k !== 'GEMINI_API_KEY')
    .map(([k]) => k);

  if (!process.env.SUPABASE_JWT_SECRET) {
    return NextResponse.json({
      siap: false,
      tahap: 'secret',
      pesan: 'SUPABASE_JWT_SECRET belum terbaca aplikasi. Pastikan sudah diset DAN aplikasi sudah di-deploy ulang — perubahan environment variable tidak berlaku sampai deploy berikutnya.',
      env, envKurang,
    });
  }

  const token = issueDbToken(caller);
  if (!token) {
    return NextResponse.json({
      siap: false,
      tahap: 'terbit',
      pesan: 'Token gagal diterbitkan meski rahasia terbaca.',
    });
  }

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({
      siap: false, tahap: 'env',
      pesan: 'NEXT_PUBLIC_SUPABASE_URL / ANON_KEY tidak terbaca di server.',
    });
  }

  let status = 0;
  let body: unknown = null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/debug_jwt_claims`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      cache: 'no-store',
    });
    status = res.status;
    body = await res.json().catch(() => null);
  } catch (e) {
    return NextResponse.json({
      siap: false, tahap: 'jaringan',
      pesan: `Tidak bisa menghubungi PostgREST: ${(e as { message?: string }).message ?? 'gagal'}`,
    });
  }

  if (status === 401) {
    return NextResponse.json({
      siap: false, tahap: 'rahasia', status,
      pesan: 'PostgREST MENOLAK token. Rahasianya tidak cocok — pastikan yang disalin adalah nilai dari tab "Legacy JWT Secret", bukan Key ID di daftar JWT Signing Keys.',
      balasan: body,
    });
  }

  if (status === 404) {
    return NextResponse.json({
      siap: false, tahap: 'fungsi', status,
      pesan: 'Rahasia SUDAH BENAR — token diterima PostgREST. Yang kurang tinggal fungsi debug_jwt_claims; jalankan bagian 0 dari sql/rls-project-progress.sql.',
    });
  }

  if (status === 200) {
    return NextResponse.json({
      siap: envKurang.length === 0, status,
      pesan: envKurang.length === 0
        ? 'Rahasia benar, klaim sampai ke basis data, dan seluruh environment variable wajib sudah terpasang.'
        : `Token sudah bekerja, tapi masih ada environment variable yang belum terpasang: ${envKurang.join(', ')}.`,
      env, envKurang,
      klaim_diterima_database: body,
      klaim_yang_dikirim: {
        username:  caller.username,
        full_name: caller.full_name,
        user_role: caller.role,
      },
    });
  }

  return NextResponse.json({
    siap: false, tahap: 'tak_dikenal', status,
    pesan: 'PostgREST membalas dengan status di luar dugaan.',
    balasan: body,
  });
}
