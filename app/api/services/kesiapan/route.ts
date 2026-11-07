import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, isAdminRole } from '@/lib/auth/server';
import { getServicesAdminClient } from '@/lib/supabase-services-admin';
import { periksaKonfigurasiServices } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const TABEL_SERVICES = [
  { tabel: 'tickets', untuk: 'Salinan ticket yang di-assign ke Team Services' },
  { tabel: 'activity_logs', untuk: 'Riwayat aktivitas ticket Services' },
  { tabel: 'overdue_settings', untuk: 'Batas overdue ticket Services' },
  { tabel: 'users', untuk: 'Admin Services yang dikirimi notifikasi WA' },
] as const;

const BATAS_TUNGGU_MS = 8_000;

export async function GET(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) {
    return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });
  }
  if (!isAdminRole(caller.role)) {
    return NextResponse.json({ error: 'Hanya admin yang boleh menjalankan pemeriksaan ini.' }, { status: 403 });
  }

  const konfigurasi = periksaKonfigurasiServices();
  const env = {
    NEXT_PUBLIC_SUPABASE_SERVICES_URL: !!process.env.NEXT_PUBLIC_SUPABASE_SERVICES_URL,
    NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_SERVICES_ANON_KEY,
    SUPABASE_SERVICES_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICES_SERVICE_ROLE_KEY,
  };

  if (konfigurasi.servicesBelumDiset) {
    return NextResponse.json({
      siap: false, tahap: 'env', env,
      pesan: 'URL / anon key DB Services belum diisi di environment Vercel. Isi lalu deploy ulang.',
    });
  }
  if (konfigurasi.urlSama) {
    return NextResponse.json({
      siap: false, tahap: 'url_sama', env,
      pesan: 'URL DB Services sama dengan DB utama. Arahkan ke project Supabase Services yang terpisah.',
    });
  }

  const client = getServicesAdminClient();
  if (!client) {
    return NextResponse.json({ siap: false, tahap: 'klien', env, pesan: 'Klien DB Services tidak bisa dibuat.' });
  }

  const tabel = await Promise.all(TABEL_SERVICES.map(async t => {
    try {
      const { error } = await client
        .from(t.tabel)
        .select('*', { count: 'exact', head: true })
        .limit(0)
        .abortSignal(AbortSignal.timeout(BATAS_TUNGGU_MS));
      return { ...t, ok: !error, pesan: error ? error.message || error.code || 'gagal' : 'terjangkau' };
    } catch (e) {
      return { ...t, ok: false, pesan: (e as { message?: string }).message ?? 'tidak terjangkau' };
    }
  }));

  const gagal = tabel.filter(t => !t.ok);
  return NextResponse.json({
    siap: gagal.length === 0,
    tahap: gagal.length === 0 ? 'siap' : 'tabel',
    env,
    pesan: gagal.length === 0
      ? 'DB Services terjangkau dan semua tabel yang dipakai aplikasi tersedia.'
      : `DB Services belum siap: ${gagal.map(t => t.tabel).join(', ')} tidak terjangkau. Kalau project di-pause, aktifkan dulu di Supabase.`,
    tabel,
    catatan: env.SUPABASE_SERVICES_SERVICE_ROLE_KEY
      ? undefined
      : 'SUPABASE_SERVICES_SERVICE_ROLE_KEY kosong: notifikasi WA ke admin Services memakai anon key dan tunduk pada RLS DB Services.',
  });
}
