/**
 * /api/tools-team/referensi-led - tabel referensi Kalkulator LED (modul,
 * sending card, video processor) yang dipakai bersama seluruh tim.
 *
 *   GET     siapa pun yang masuk: referensi bersama (null = pakai bawaan).
 *   PUT     Admin/Full Access: simpan untuk seluruh tim.
 *   DELETE  Admin/Full Access: kembalikan ke tabel bawaan.
 *
 * Disimpan sebagai satu baris app_settings lewat service role, divalidasi
 * ketat (lib/tools-team.ts) sebelum ditulis.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { hasFullAccess } from '@/lib/constants';
import { KUNCI_REFERENSI_LED, bersihkanReferensiLED } from '@/lib/tools-team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });

async function penjaga(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return { jaga, boleh: false, db: null };
  const db = getAdminClient();
  const { data } = await db.from('users').select('role, access_level').eq('id', jaga.user.id).maybeSingle();
  return { jaga, boleh: hasFullAccess(data as { role?: string; access_level?: string } | null), db };
}

export async function GET(req: NextRequest) {
  const { jaga, boleh, db } = await penjaga(req);
  if (!jaga.ok || !db) return gagal(jaga.ok ? 'Gagal.' : jaga.alasan, jaga.ok ? 500 : jaga.status);
  const { data, error } = await db.from('app_settings').select('value, updated_at').eq('key', KUNCI_REFERENSI_LED).maybeSingle();
  if (error) return gagal(error.message, 500);
  const v = (data?.value ?? null) as { data?: unknown; oleh?: string } | null;
  return NextResponse.json({
    ok: true, bolehUbah: boleh,
    referensi: v?.data ? bersihkanReferensiLED(v.data) : null,
    oleh: v?.oleh ?? null, diubahPada: data?.updated_at ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const { jaga, boleh, db } = await penjaga(req);
  if (!jaga.ok || !db) return gagal(jaga.ok ? 'Gagal.' : jaga.alasan, jaga.ok ? 500 : jaga.status);
  if (!boleh) return gagal('Hanya Admin / Full Access yang boleh menyimpan referensi untuk seluruh tim.', 403);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }
  const ref = bersihkanReferensiLED(b.referensi);
  if (!ref) return gagal('Tabel referensi tidak sah - periksa isian yang kosong atau di luar batas.');
  const { error } = await db.from('app_settings').upsert({
    key: KUNCI_REFERENSI_LED, value: { data: ref, oleh: jaga.user.full_name }, updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { jaga, boleh, db } = await penjaga(req);
  if (!jaga.ok || !db) return gagal(jaga.ok ? 'Gagal.' : jaga.alasan, jaga.ok ? 500 : jaga.status);
  if (!boleh) return gagal('Hanya Admin / Full Access yang boleh mengubah referensi bersama.', 403);
  const { error } = await db.from('app_settings').delete().eq('key', KUNCI_REFERENSI_LED);
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true });
}
