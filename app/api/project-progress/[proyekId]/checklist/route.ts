import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, akunAdmin, ambilAkun, buatChecklist, galat, muatChecklist } from '@/lib/checklist-server';
import { daftarId, tanggal, teks } from '@/lib/checklist-isian';
import { BATAS, validasiDraft, type DraftChecklist, type SumberChecklist } from '@/lib/checklist';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/project-progress/<proyekId>/checklist - admin membuat checklist
 * lokasi baru di proyek ini.
 *   { judul, keterangan?, start_date?, target_date?, anggota: userId[],
 *     isi: 'kosong' | 'impor' | 'salin',
 *     sumber?: 'teks'|'excel', draft?            (isi = impor)
 *     salinDari?: checklistId }                  (isi = salin - centang dikosongkan)
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ proyekId: string }> }) {
  const params = await ctx.params;
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  if (!akunAdmin(s.akun)) return galat('Hanya admin yang bisa membuat checklist.', 403);
  const { db, akun } = s;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }

  const { data: proyek } = await db.from('checklist_proyek').select('id').eq('id', params.proyekId).maybeSingle();
  if (!proyek) return galat('Proyek tidak ditemukan.', 404);

  const judul = teks(body.judul, BATAS.judul);
  if (!judul) return galat('Nama lokasi / checklist wajib diisi.');
  const start_date = tanggal(body.start_date);
  const target_date = tanggal(body.target_date);
  if (start_date && target_date && target_date < start_date) return galat('Tanggal target tidak boleh sebelum tanggal mulai.');

  let draft: DraftChecklist | null = null;
  let sumber: SumberChecklist = 'kosong';
  if (body.isi === 'impor') {
    const hasil = validasiDraft({ ...((body.draft ?? {}) as object), judul });
    if ('galat' in hasil) return galat(hasil.galat);
    draft = hasil.draft;
    sumber = body.sumber === 'excel' ? 'excel' : 'teks';
  } else if (body.isi === 'salin') {
    const asal = await muatChecklist(db, String(body.salinDari ?? ''), { publik: true });
    if (!asal) return galat('Checklist sumber tidak ditemukan.', 404);
    draft = {
      judul,
      keterangan: asal.daftar.keterangan,
      bagian: asal.bagian.map(b => ({
        judul: b.judul,
        catatan: b.catatan,
        items: asal.items.filter(i => i.bagian_id === b.id)
          .map(i => ({ kelompok: i.kelompok, teks: i.teks, catatan: i.catatan, selesai: false })),
      })).filter(b => b.items.length || b.catatan),
    };
    sumber = 'duplikat';
  }

  try {
    const id = await buatChecklist(db, params.proyekId, {
      judul,
      keterangan: teks(body.keterangan, BATAS.keterangan) || draft?.keterangan || '',
      start_date, target_date, sumber, anggota: daftarId(body.anggota),
    }, draft, akun, { baseUrl: request.nextUrl.origin });
    return NextResponse.json({ id }, { headers: NO_STORE });
  } catch (e) {
    return galat(e instanceof Error ? e.message : 'Gagal membuat checklist.', 500);
  }
}
