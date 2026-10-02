import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, cariChecklistShare, galat, muatChecklist, setCentang, setKendala } from '@/lib/checklist-server';
import { BATAS, validasiNama } from '@/lib/checklist';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * /api/checklist/share/<token> - PUBLIK (tanpa sesi), dipakai halaman
 * /checklist/share/<token> untuk tim lapangan yang menerima link checklist
 * satu lokasi.
 *
 *   GET  -> isi checklist (tanpa token, anggota, riwayat)
 *   POST -> { aksi: 'centang', itemId, selesai, nama }
 *           { aksi: 'kendala', itemId, kendala, catatan, nama }
 *
 * Keamanan:
 *  - service_role di server; anon key tidak bisa menulis tabel checklist_*.
 *  - token dicocokkan persis; salah / share_aktif=false -> 404 yang sama.
 *  - jalur tulis HANYA status satu item milik checklist itu sendiri.
 *    Judul, item, anggota, dan link tidak bisa diubah dari sini.
 *  - tiap perubahan dicatat dengan nama pengirim (checklist_riwayat).
 */

// Batas wajar perubahan per checklist per menit. Satu tim yang bekerja cepat
// tidak mendekatinya; skrip yang mengirim permintaan beruntun tertahan.
const BATAS_PER_MENIT = 120;
const TIDAK_ADA = 'Link tidak ditemukan atau sudah dinonaktifkan.';

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
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

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const ketemu = await cariChecklistShare((params.token ?? '').trim());
  if (!ketemu) return galat(TIDAK_ADA, 404);
  const { db, id } = ketemu;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }

  const nama = validasiNama(body.nama);
  if (!nama) return galat('Isi nama Anda (2-60 karakter) sebelum mengubah checklist.');

  const semenitLalu = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db.from('checklist_riwayat').select('id', { count: 'exact', head: true })
    .eq('daftar_id', id).gte('created_at', semenitLalu);
  if ((count ?? 0) >= BATAS_PER_MENIT) return galat('Terlalu banyak perubahan dalam satu menit. Coba lagi sebentar.', 429);

  const itemId = String(body.itemId ?? '');
  if (body.aksi === 'kendala') {
    const kendala = body.kendala === true;
    const catatan = String(body.catatan ?? '').replace(/\r/g, '').trim().slice(0, BATAS.catatan);
    if (kendala && !catatan) return galat('Tulis kendalanya supaya admin tahu apa yang menghambat.');
    const hasil = await setKendala(db, id, itemId, kendala, catatan, nama, 'link');
    if ('galat' in hasil) return galat(hasil.galat, hasil.status);
    return NextResponse.json(hasil, { headers: NO_STORE });
  }

  const hasil = await setCentang(db, id, itemId, body.selesai === true, nama, 'link');
  if ('galat' in hasil) return galat(hasil.galat, hasil.status);
  return NextResponse.json(hasil, { headers: NO_STORE });
}
