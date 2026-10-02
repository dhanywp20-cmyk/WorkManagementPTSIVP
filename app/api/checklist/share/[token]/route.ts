import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { NO_STORE, galat, muatDetail, setCentang, tokenSah } from '@/lib/checklist-server';
import { validasiNama } from '@/lib/checklist';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * /api/checklist/share/<token> - PUBLIK (tanpa sesi), dipakai halaman
 * /checklist/share/<token> untuk tim yang menerima link dari admin.
 *
 *   GET  -> isi checklist (tanpa share_token & riwayat)
 *   POST -> { itemId, selesai, nama } centang / batal satu item
 *
 * Keamanan:
 *  - service_role di server; tabel checklist_* tertutup untuk anon key.
 *  - token dicocokkan persis; salah / share_aktif=false -> 404 yang sama,
 *    jadi tidak bisa ditebak mana yang "ada tapi dimatikan".
 *  - jalur tulis HANYA kolom centang satu item milik checklist itu sendiri.
 *    Judul, item, dan link tidak bisa diubah dari sini.
 *  - tiap centang dicatat dengan nama pencentang (checklist_riwayat).
 */

// Batas wajar centang per checklist per menit. Satu tim yang bekerja cepat
// tidak mendekatinya; skrip yang mengirim permintaan beruntun tertahan.
const BATAS_PER_MENIT = 120;

async function cariDaftar(token: string) {
  if (!tokenSah(token)) return null;
  const db = getAdminClient();
  const { data } = await db.from('checklist_daftar')
    .select('id,share_aktif').eq('share_token', token).maybeSingle();
  if (!data || !data.share_aktif) return null;
  return { db, id: data.id as string };
}

const TIDAK_ADA = 'Link tidak ditemukan atau sudah dinonaktifkan.';

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const ketemu = await cariDaftar((params.token ?? '').trim());
  if (!ketemu) return galat(TIDAK_ADA, 404);
  try {
    const detail = await muatDetail(ketemu.db, ketemu.id, true);
    if (!detail) return galat(TIDAK_ADA, 404);
    return NextResponse.json(detail, { headers: NO_STORE });
  } catch (e) {
    return galat(e instanceof Error ? e.message : 'Gagal memuat checklist.', 500);
  }
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const ketemu = await cariDaftar((params.token ?? '').trim());
  if (!ketemu) return galat(TIDAK_ADA, 404);
  const { db, id } = ketemu;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }

  const nama = validasiNama(body.nama);
  if (!nama) return galat('Isi nama Anda (2-60 karakter) sebelum mencentang.');

  const semenitLalu = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db.from('checklist_riwayat').select('id', { count: 'exact', head: true })
    .eq('daftar_id', id).gte('created_at', semenitLalu);
  if ((count ?? 0) >= BATAS_PER_MENIT) return galat('Terlalu banyak perubahan dalam satu menit. Coba lagi sebentar.', 429);

  const hasil = await setCentang(db, id, String(body.itemId ?? ''), body.selesai === true, nama, 'link');
  if ('galat' in hasil) return galat(hasil.galat, hasil.status);
  return NextResponse.json(hasil, { headers: NO_STORE });
}
