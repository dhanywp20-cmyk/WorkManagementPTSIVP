import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser } from '@/lib/server-auth';
import { bisaInputNominal, bisaKonfigPenuh } from '@/lib/incentive-akses';

export const dynamic = 'force-dynamic';

/**
 * /api/incentive/splits - baca & hapus pembagian incentive.
 *
 * incentive_splits adalah tabel paling sensitif di platform ini ("siapa dapat
 * berapa") dan RLS-nya dikunci: anon hanya boleh INSERT. Jadi SELECT dan
 * DELETE wajib lewat route ini, yang memverifikasi pemanggil lalu memakai
 * service-role.
 */

/** Ambil pemanggil + tingkat aksesnya sekali, dipakai kedua handler. */
async function pemanggil(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) return null;
  const supabase = getAdminClient();
  const { data: row } = await supabase
    .from('users').select('incentive_akses, allow_incentive_input, access_level').eq('id', caller.id).maybeSingle();
  return { caller, supabase, hak: { role: caller.role, ...(row ?? {}) } };
}

/**
 * GET /api/incentive/splits[?projectId=...]
 *
 * - Pemegang akses input/penuh  lihat SEMUA.
 * - Selain itu  hanya baris miliknya sendiri (user_id == dia).
 */
export async function GET(request: NextRequest) {
  const p = await pemanggil(request);
  if (!p) return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });
  const { caller, supabase, hak } = p;

  const projectId = request.nextUrl.searchParams.get('projectId');
  let q = supabase.from('incentive_splits').select('*').order('created_at');
  if (projectId) q = q.eq('project_id', projectId);
  if (!bisaInputNominal(hak)) q = q.eq('user_id', caller.id); // non-privileged  jatahnya sendiri saja

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

/**
 * DELETE /api/incentive/splits?trancheIds=a,b,c  |  ?projectId=...
 *
 * INI YANG DULU HILANG, dan akibatnya besar. Tiga tempat di calc.ts menghapus
 * splits lewat klien anon: rollback Process Batch, Batalkan Batch Tahun, dan
 * Hapus Tahapan Proyek. incentive_splits tidak punya kebijakan DELETE sama
 * sekali, jadi ketiganya menghapus NOL baris - tanpa galat, karena RLS yang
 * menolak baris bukan error di PostgREST. Layar tetap melapor "Baris
 * pembagiannya dihapus", tahapannya kembali `pending`, lalu Process Batch
 * berikutnya menulis SET KEDUA di atas set lama. Itulah sebab nyata baris
 * "Bagian Saya" tampil berlipat 2-5x.
 *
 * Tahapan yang sudah `paid` TIDAK PERNAH ikut terhapus - uangnya sudah keluar,
 * dan menghapus catatannya hanya membuat pembukuan tidak lagi cocok dengan
 * kenyataan. Penjagaan itu ada di layar, dan diulang di sini karena penjagaan
 * yang hanya ada di layar bukan penjagaan.
 */
export async function DELETE(request: NextRequest) {
  const p = await pemanggil(request);
  if (!p) return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });
  const { supabase, hak } = p;

  const projectId = request.nextUrl.searchParams.get('projectId');
  const trancheIds = (request.nextUrl.searchParams.get('trancheIds') || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  if (!projectId && trancheIds.length === 0) {
    return NextResponse.json({ error: 'Sebutkan trancheIds atau projectId.' }, { status: 400 });
  }
  //  Sengaja beda tingkat: membatalkan pemrosesan satu-dua tahapan adalah
  //  pekerjaan sehari-hari petugas input; menghapus seluruh tahapan sebuah
  //  proyek adalah keputusan konfigurasi.
  const cukup = projectId ? bisaKonfigPenuh(hak) : bisaInputNominal(hak);
  if (!cukup) return NextResponse.json({ error: 'Akses Anda tidak cukup untuk menghapus pembagian.' }, { status: 403 });

  //  Kumpulkan tahapan yang disasar, lalu SISIHKAN yang sudah paid.
  let qt = supabase.from('incentive_tranches').select('id, status');
  qt = projectId ? qt.eq('project_id', projectId) : qt.in('id', trancheIds);
  const { data: tr, error: trErr } = await qt;
  if (trErr) return NextResponse.json({ error: trErr.message }, { status: 400 });

  const baris = (tr ?? []) as { id: string; status: string }[];
  const paid = baris.filter(t => t.status === 'paid').length;

  if (projectId) {
    /*
      Sekali ada tahapan Paid, SELURUH permintaan ditolak - bukan sebagian
      dihapus. Menghapus separuh pembagian sebuah proyek yang tahap lainnya
      sudah dibayar meninggalkan keadaan yang tidak bisa dijelaskan kepada
      Finance: rekapnya tidak lagi menjumlah ke nominal yang mereka terima.
    */
    if (paid > 0) {
      return NextResponse.json({ error: `Proyek ini punya ${paid} tahapan berstatus Paid — pembagiannya tidak boleh dihapus.` }, { status: 409 });
    }
    //  Dihapus lewat project_id, bukan tranche_id: baris pembagian yang
    //  tranche_id-nya NULL (dibuat sebelum tahapan ada) juga ikut, kalau tidak
    //  ia tertinggal sebagai yatim yang tetap terhitung di rekap.
    const { data: hapus, error } = await supabase
      .from('incentive_splits').delete().eq('project_id', projectId).select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ dihapus: (hapus ?? []).length, dilewati: 0 });
  }

  const sasaran = baris.filter(t => t.status !== 'paid').map(t => t.id);
  if (sasaran.length === 0) return NextResponse.json({ dihapus: 0, dilewati: paid });

  const { data: hapus, error } = await supabase
    .from('incentive_splits').delete().in('tranche_id', sasaran).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ dihapus: (hapus ?? []).length, dilewati: paid, trancheIds: sasaran });
}
