/**
 * /api/tools-team/led - hitungan Kalkulator LED yang disimpan untuk tim.
 *
 *   GET              siapa pun yang masuk: daftar (ringkasan, tanpa isian), ?q= cari.
 *   GET ?id=         satu hitungan lengkap untuk dibuka lagi.
 *   POST {id?, nama, data, ringkasan}
 *                    simpan. Tanpa id = baru. Dengan id = timpa, hanya pembuat
 *                    atau Admin/Full Access; lainnya 403 -> peramban menyimpan
 *                    sebagai salinan.
 *   DELETE ?id=      pembuat atau Admin/Full Access.
 *
 * Tabel tools_led_simpan ber-RLS tanpa policy (migrasi 029): hanya service
 * role di sini yang menyentuhnya, sesi diperiksa di server.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { hasFullAccess } from '@/lib/constants';
import { pimpinanDiDb, PESAN_HANYA_LIHAT } from '@/lib/pimpinan';
import { periksaIsianLED, bersihkanRingkasanLED } from '@/lib/tools-team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABEL = 'tools_led_simpan';
const POLA_ID = /^[0-9a-f-]{36}$/i;
const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });

type Db = ReturnType<typeof getAdminClient>;
async function kelolaSemua(db: Db, userId: string) {
  const { data } = await db.from('users').select('role, access_level').eq('id', userId).maybeSingle();
  return hasFullAccess(data as { role?: string; access_level?: string } | null);
}

export async function GET(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  const semua = await kelolaSemua(db, jaga.user.id);
  const sp = req.nextUrl.searchParams;
  const id = sp.get('id');
  if (id) {
    if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
    const { data, error } = await db.from(TABEL).select('id, nama, data, dibuat_oleh, dibuat_oleh_nama, diubah_oleh_nama, updated_at').eq('id', id).maybeSingle();
    if (error) return gagal(error.message, 500);
    if (!data) return gagal('Hitungan tidak ditemukan.', 404);
    return NextResponse.json({ ok: true, file: { ...data, bolehUbah: semua || data.dibuat_oleh === jaga.user.id } });
  }
  let q = db.from(TABEL).select('id, nama, ringkasan, dibuat_oleh, dibuat_oleh_nama, diubah_oleh_nama, updated_at')
    .order('updated_at', { ascending: false }).limit(sp.get('q') ? 50 : 100);
  const cari = (sp.get('q') ?? '').trim().slice(0, 80).replace(/[%_,()]/g, ' ');
  if (cari) q = q.or(`nama.ilike.%${cari}%,dibuat_oleh_nama.ilike.%${cari}%,ringkasan->>project.ilike.%${cari}%,ringkasan->>customer.ilike.%${cari}%`);
  const { data, error } = await q;
  if (error) return gagal(error.message, 500);
  return NextResponse.json({
    ok: true,
    daftar: (data ?? []).map((d: { dibuat_oleh: string | null }) => ({ ...d, bolehUbah: semua || d.dibuat_oleh === jaga.user.id })),
  });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  if (await pimpinanDiDb(getAdminClient(), jaga.user.id)) return gagal(PESAN_HANYA_LIHAT, 403);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }
  const nama = String(b.nama ?? '').trim().slice(0, 120);
  if (!nama) return gagal('Nama hitungan wajib diisi.');
  const cek = periksaIsianLED(b.data);
  if (!cek.ok) return gagal(cek.alasan);
  const ringkasan = bersihkanRingkasanLED(b.ringkasan);

  const db = getAdminClient();
  const id = typeof b.id === 'string' ? b.id : null;
  const waktu = new Date().toISOString();
  if (id) {
    if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
    const { data: lama } = await db.from(TABEL).select('dibuat_oleh').eq('id', id).maybeSingle();
    if (!lama) return gagal('Hitungan tidak ditemukan.', 404);
    if (lama.dibuat_oleh !== jaga.user.id && !(await kelolaSemua(db, jaga.user.id))) {
      return gagal('Hitungan ini milik orang lain - simpan sebagai salinan.', 403);
    }
    const { data, error } = await db.from(TABEL).update({ nama, data: cek.data, ringkasan, diubah_oleh_nama: jaga.user.full_name, updated_at: waktu })
      .eq('id', id).select('id, nama, updated_at').single();
    if (error) return gagal(error.message, 500);
    return NextResponse.json({ ok: true, file: { ...data, bolehUbah: true } });
  }
  const { data, error } = await db.from(TABEL).insert({
    nama, data: cek.data, ringkasan, dibuat_oleh: jaga.user.id, dibuat_oleh_nama: jaga.user.full_name, diubah_oleh_nama: jaga.user.full_name,
  }).select('id, nama, updated_at').single();
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true, file: { ...data, bolehUbah: true } });
}

export async function DELETE(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
  const db = getAdminClient();
  if (await pimpinanDiDb(db, jaga.user.id)) return gagal(PESAN_HANYA_LIHAT, 403);
  const { data: lama } = await db.from(TABEL).select('dibuat_oleh').eq('id', id).maybeSingle();
  if (!lama) return gagal('Hitungan tidak ditemukan.', 404);
  if (lama.dibuat_oleh !== jaga.user.id && !(await kelolaSemua(db, jaga.user.id))) {
    return gagal('Hanya pembuat atau Admin yang boleh menghapus.', 403);
  }
  const { error } = await db.from(TABEL).delete().eq('id', id);
  if (error) return gagal(error.message, 500);
  return NextResponse.json({ ok: true });
}
