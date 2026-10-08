import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, cariChecklistShare, galat, muatChecklist, simpanPerubahan } from '@/lib/checklist-server';
import { validasiNama } from '@/lib/checklist';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * /api/checklist/share/<token> - PUBLIK (tanpa sesi), dipakai halaman
 * /checklist/share/<token> untuk tim lapangan yang menerima link checklist
 * satu lokasi.
 *
 *   GET  -> isi checklist (tanpa token, anggota, riwayat)
 *   POST -> { aksi: 'simpan', perubahan: [{ itemId, selesai?, kendala?, catatan?, waktu? }], nama }
 *           Semua centang & kendala satu sesi dikirim sekali saat tombol
 *           Simpan ditekan - bukan per klik (hemat kuota paket gratis).
 *
 * Keamanan:
 *  - service_role di server; anon key tidak bisa menulis tabel checklist_*.
 *  - token dicocokkan persis; salah / share_aktif=false -> 404 yang sama.
 *  - jalur tulis HANYA status satu item milik checklist itu sendiri.
 *    Judul, item, anggota, dan link tidak bisa diubah dari sini.
 *  - tiap perubahan dicatat dengan nama pengirim (checklist_riwayat).
 */

// Jeda minimum antar-simpan per checklist. Satu simpan berisi banyak
// perubahan, jadi tim yang bekerja normal tidak pernah tertahan.
const JEDA_SIMPAN_MS = 3_000;
const TIDAK_ADA = 'Link tidak ditemukan atau sudah dinonaktifkan.';

export async function GET(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const params = await ctx.params;
  const ketemu = await cariChecklistShare((params.token ?? '').trim());
  if (!ketemu) return galat(TIDAK_ADA, 404);
  try {
    const detail = await muatChecklist(ketemu.db, ketemu.id, { publik: true });
    if (!detail) return galat(TIDAK_ADA, 404);
    return NextResponse.json(detail, { headers: NO_STORE });
  } catch (e) {
    return galat(e instanceof Error ? e.message : 'Gagal memuat checklist.', 500);
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const params = await ctx.params;
  const ketemu = await cariChecklistShare((params.token ?? '').trim());
  if (!ketemu) return galat(TIDAK_ADA, 404);
  const { db, id } = ketemu;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }

  const nama = validasiNama(body.nama);
  if (!nama) return galat('Isi nama Anda (2-60 karakter) sebelum mengubah checklist.');

  // Dihitung dari waktu simpan terakhir di server (updated_at checklist),
  // bukan dari riwayat - waktu riwayat mengikuti jam pengerjaan di perangkat.
  const { data: d } = await db.from('checklist_daftar').select('updated_at').eq('id', id).single();
  const terakhir = d?.updated_at ? Date.parse(d.updated_at) : 0;
  if (Date.now() - terakhir < JEDA_SIMPAN_MS) return galat('Terlalu cepat. Tunggu beberapa detik lalu simpan lagi.', 429);

  if (body.aksi !== 'simpan') return galat('Aksi tidak dikenal. Muat ulang halaman.');
  const hasil = await simpanPerubahan(db, id, body.perubahan, nama, 'link');
  if ('galat' in hasil) return galat(hasil.galat, hasil.status);
  return NextResponse.json(hasil, { headers: NO_STORE });
}
