/**
 * /api/tools-team/hasil-av - hasil Kalkulator AV yang disimpan ke proyek Project Progress.
 *
 *   GET ?proyek=<id>   daftar hasil satu proyek (siapa pun yang boleh melihat proyeknya).
 *   POST {proyek_id, judul, catatan?, ringkasan, lembar}
 *                      simpan potret hasil. Siapa pun yang masuk & boleh melihat proyek itu,
 *                      kecuali akun pimpinan (hanya lihat).
 *   DELETE ?id=        pembuat atau Admin/Full Access.
 *
 * Tabel tools_av_hasil ber-RLS tanpa policy (migrasi 055): hanya service role di sini.
 * Lembar dibersihkan (lib/av-hasil.ts) - hanya seksi info/tabel, tanpa HTML mentah.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ambilAkun, bolehLihatProyek, galat, NO_STORE, type Db } from '@/lib/checklist-server';
import { hasFullAccess } from '@/lib/constants';
import { PESAN_HANYA_LIHAT } from '@/lib/pimpinan';
import { periksaHasilAV } from '@/lib/av-hasil';

export const dynamic = 'force-dynamic';

const TABEL = 'tools_av_hasil';
const POLA_ID = /^[0-9a-f-]{36}$/i;
const KOLOM = 'id,proyek_id,judul,catatan,ringkasan,lembar,dibuat_oleh,dibuat_oleh_nama,created_at';

export async function GET(req: NextRequest) {
  const s = await ambilAkun(req);
  if ('galat' in s) return s.galat;
  const proyek = req.nextUrl.searchParams.get('proyek') ?? '';
  if (!POLA_ID.test(proyek)) return galat('Proyek tidak dikenal.');
  const boleh = await bolehLihatProyek(s.db, s.akun, proyek);
  if (boleh === 'tidak-ada') return galat('Proyek tidak ditemukan.', 404);
  if (!boleh) return galat('Anda tidak punya akses ke proyek ini.', 403);
  const { data, error } = await s.db.from(TABEL).select(KOLOM).eq('proyek_id', proyek).order('created_at', { ascending: false }).limit(200);
  if (error) return galat(error.message, 500);
  const kelola = await bolehKelolaSemua(s.db, s.akun.id);
  return NextResponse.json({
    hasil: ((data ?? []) as { dibuat_oleh: string | null }[]).map(({ dibuat_oleh, ...h }) => ({ ...h, bolehHapus: kelola || dibuat_oleh === s.akun.id })),
  }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const s = await ambilAkun(req);
  if ('galat' in s) return s.galat;
  if (s.akun.pimpinan) return galat(PESAN_HANYA_LIHAT, 403);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return galat('Permintaan tidak terbaca.');
  const isian = periksaHasilAV(body);
  if ('galat' in isian) return galat(isian.galat);
  const boleh = await bolehLihatProyek(s.db, s.akun, isian.proyek_id);
  if (boleh === 'tidak-ada') return galat('Proyek tidak ditemukan.', 404);
  if (!boleh) return galat('Anda tidak punya akses ke proyek ini.', 403);
  const { data, error } = await s.db.from(TABEL).insert({ ...isian, dibuat_oleh: s.akun.id, dibuat_oleh_nama: s.akun.nama }).select('id').single();
  if (error) return galat(error.message, 500);
  return NextResponse.json({ ok: true, id: (data as { id: string }).id }, { headers: NO_STORE });
}

export async function DELETE(req: NextRequest) {
  const s = await ambilAkun(req);
  if ('galat' in s) return s.galat;
  if (s.akun.pimpinan) return galat(PESAN_HANYA_LIHAT, 403);
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!POLA_ID.test(id)) return galat('Hasil tidak dikenal.');
  const { data: h } = await s.db.from(TABEL).select('dibuat_oleh').eq('id', id).maybeSingle();
  if (!h) return galat('Hasil tidak ditemukan.', 404);
  if ((h as { dibuat_oleh: string | null }).dibuat_oleh !== s.akun.id && !(await bolehKelolaSemua(s.db, s.akun.id))) {
    return galat('Hanya pembuat atau admin yang bisa menghapus.', 403);
  }
  const { error } = await s.db.from(TABEL).delete().eq('id', id);
  if (error) return galat(error.message, 500);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

async function bolehKelolaSemua(db: Db, userId: string): Promise<boolean> {
  const { data } = await db.from('users').select('role, access_level').eq('id', userId).maybeSingle();
  return hasFullAccess(data as { role?: string; access_level?: string } | null);
}
