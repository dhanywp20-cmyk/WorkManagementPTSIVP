/**
 * /api/tools-team/desain - desain ruang 3D yang dibagikan ke seluruh tim.
 *
 *   GET                 siapa pun yang masuk: daftar desain aktif (tanpa isi
 *                       benda & tanpa gambar - gambar lewat /gambar yang
 *                       di-cache peramban). ?q= cari nama.
 *   GET ?id=            satu desain lengkap (versi terbaru).
 *   GET ?id=&versi=N    isi versi N (riwayat, tidak pernah berubah).
 *   GET ?id=&riwayat=1  daftar versi (tanpa isi) untuk dibuka ulang.
 *   POST {id?, versi?, nama, data, gambar?}
 *                       simpan. Tanpa id = desain baru (v1). Dengan id = versi
 *                       baru; `versi` = versi yang sedang dibuka peramban -
 *                       bila desain sudah diubah orang lain sejak itu, 409
 *                       (tidak menimpa diam-diam). Hanya pembuat atau
 *                       Admin/Full Access; lainnya 403 -> peramban menyimpan
 *                       sebagai salinan.
 *   DELETE ?id=         pembuat atau Admin/Full Access. Desain yang masih
 *                       ditautkan ke Request Design diarsipkan, bukan dihapus,
 *                       supaya request itu tetap bisa menampilkan versinya.
 *
 * Tabel ber-RLS tanpa policy (migrasi 027/028): hanya service role di sini
 * yang menyentuhnya, sesi diperiksa di server.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { hasFullAccess } from '@/lib/constants';
import { pimpinanDiDb, PESAN_HANYA_LIHAT } from '@/lib/pimpinan';
import { periksaDesain, ringkasanDesain, bersihkanGambar, MAKS_BYTE_GAMBAR_HD, SIMPAN_VERSI } from '@/lib/tools-team';
import { bersihkanGambarDesain, rujukGambarDesain } from '@/lib/gambar-desain-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABEL = 'tools_desain_ruang';
const VERSI = 'tools_desain_ruang_versi';
const POLA_ID = /^[0-9a-f-]{36}$/i;
const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });

type Db = ReturnType<typeof getAdminClient>;

/** Admin / Full Access dibaca ulang dari tabel users (bukan klaim token). */
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

  if (id && sp.get('riwayat') === '1') {
    if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
    const { data, error } = await db.from(VERSI).select('versi, created_at, dibuat_oleh_nama')
      .eq('desain_id', id).order('versi', { ascending: false }).limit(100);
    if (error) return gagal(error.message, 500);
    return NextResponse.json({ ok: true, versi: data ?? [] });
  }

  if (id) {
    if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
    const { data, error } = await db.from(TABEL)
      .select('id, nama, data, versi, dibuat_oleh, dibuat_oleh_nama, diubah_oleh_nama, updated_at, diarsipkan_at').eq('id', id).maybeSingle();
    if (error) return gagal(error.message, 500);
    if (!data) return gagal('Desain tidak ditemukan.', 404);
    const bolehUbah = semua || data.dibuat_oleh === jaga.user.id;
    const versi = Number(sp.get('versi'));
    if (Number.isInteger(versi) && versi >= 1 && versi !== data.versi) {
      const { data: v, error: e2 } = await db.from(VERSI).select('nama, data, versi, created_at, dibuat_oleh_nama')
        .eq('desain_id', id).eq('versi', versi).maybeSingle();
      if (e2) return gagal(e2.message, 500);
      if (!v) return gagal(`Versi ${versi} tidak ditemukan.`, 404);
      return NextResponse.json({ ok: true, desain: { ...data, ...v, versiTerbaru: data.versi, updated_at: v.created_at, bolehUbah } });
    }
    return NextResponse.json({ ok: true, desain: { ...data, versiTerbaru: data.versi, bolehUbah } });
  }

  let q = db.from(TABEL)
    .select('id, nama, versi, jumlah_benda, dibuat_oleh, dibuat_oleh_nama, diubah_oleh_nama, updated_at, ruang:data->ruang')
    .is('diarsipkan_at', null)
    .order('updated_at', { ascending: false }).limit(sp.get('q') ? 50 : 100);
  const cari = (sp.get('q') ?? '').trim().slice(0, 80).replace(/[%_,()]/g, ' ');
  if (cari) q = q.or(`nama.ilike.%${cari}%,dibuat_oleh_nama.ilike.%${cari}%`);
  const { data, error } = await q;
  if (error) return gagal(error.message, 500);
  const daftar = (data ?? []) as { id: string; versi: number; dibuat_oleh: string | null }[];
  return NextResponse.json({ ok: true, daftar: daftar.map(d => ({ ...d, bolehUbah: semua || d.dibuat_oleh === jaga.user.id })) });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  if (await pimpinanDiDb(getAdminClient(), jaga.user.id)) return gagal(PESAN_HANYA_LIHAT, 403);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return gagal('Body tidak sah.'); }

  const nama = String(b.nama ?? '').trim().slice(0, 120);
  if (!nama) return gagal('Nama desain wajib diisi.');
  const cek = periksaDesain(b.data);
  if (!cek.ok) return gagal(cek.alasan);
  const gambar = bersihkanGambar(b.gambar);
  const gambarHd = bersihkanGambar(b.gambar_hd, MAKS_BYTE_GAMBAR_HD);

  const db = getAdminClient();
  const id = typeof b.id === 'string' ? b.id : null;
  let versiLama: number | null = null;
  if (id) {
    if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
    const { data: lama } = await db.from(TABEL).select('dibuat_oleh, versi').eq('id', id).maybeSingle();
    if (!lama) return gagal('Desain tidak ditemukan.', 404);
    if (lama.dibuat_oleh !== jaga.user.id && !(await kelolaSemua(db, jaga.user.id))) {
      return gagal('Desain ini milik orang lain - simpan sebagai salinan.', 403);
    }
    const dikirim = Number(b.versi);
    versiLama = Number.isInteger(dikirim) && dikirim >= 1 ? dikirim : lama.versi;
    if (versiLama !== lama.versi) {
      return gagal(`Desain ini sudah diubah sejak Anda buka (sekarang v${lama.versi}). Simpan sebagai desain baru atau buka ulang versi terbaru.`, 409);
    }
  }

  //  Gambar layar & tekstur: disimpan sekali per isi, data desain hanya membawa ref:<hash>.
  const rujuk = await rujukGambarDesain(db, cek.data, jaga.user.id);
  if (!rujuk.ok) return gagal(rujuk.alasan);
  const { data, error } = await db.rpc('tools_simpan_desain', {
    p_id: id, p_versi: versiLama, p_nama: nama, p_data: rujuk.data, p_jumlah: cek.jumlah,
    p_ringkasan: ringkasanDesain(cek.data), p_gambar: gambar, p_user: jaga.user.id, p_user_nama: jaga.user.full_name,
  });
  if (error) {
    if (/konflik/.test(error.message)) return gagal('Desain ini baru saja diubah orang lain. Buka ulang versi terbaru.', 409);
    return gagal(error.message, 500);
  }
  const hasil = (Array.isArray(data) ? data[0] : data) as { id: string; versi: number; updated_at: string } | null;
  if (!hasil) return gagal('Gagal menyimpan.', 500);
  //  Gambar cetak resolusi tinggi: ditulis sekali untuk versi ini (gagal = cetak memakai pratinjau kecil).
  if (gambarHd) await db.rpc('tools_simpan_desain_hd', { p_desain: hasil.id, p_versi: hasil.versi, p_gambar_hd: gambarHd });
  await pangkasRiwayat(db, hasil.id, hasil.versi);
  return NextResponse.json({ ok: true, desain: { id: hasil.id, nama, versi: hasil.versi, updated_at: hasil.updated_at, bolehUbah: true } });
}

/**
 * Hemat ruang basis data (paket gratis): gambar HD hanya disimpan untuk versi
 * terbaru & versi yang ditautkan ke Request Design; versi yang lebih lama dari
 * SIMPAN_VERSI terakhir dan tidak ditautkan dihapus. Gagal = diabaikan.
 */
async function pangkasRiwayat(db: Db, id: string, versiKini: number) {
  try {
    const { data: t } = await db.from('request_desain_ruang').select('versi').eq('desain_id', id);
    const dipakai = [...new Set(((t ?? []) as { versi: number }[]).map(x => x.versi))];
    const kecuali = (q: ReturnType<ReturnType<Db['from']>['update']> | ReturnType<ReturnType<Db['from']>['delete']>) =>
      (dipakai.length ? q.not('versi', 'in', `(${dipakai.join(',')})`) : q);
    await kecuali(db.from(VERSI).update({ gambar_hd: null }).eq('desain_id', id).lt('versi', versiKini).not('gambar_hd', 'is', null));
    if (versiKini > SIMPAN_VERSI) {
      await kecuali(db.from(VERSI).delete().eq('desain_id', id).lte('versi', versiKini - SIMPAN_VERSI));
      await bersihkanGambarDesain(db);
    }
  } catch { /* pemangkasan bukan bagian penting penyimpanan */ }
}

export async function DELETE(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
  const db = getAdminClient();
  if (await pimpinanDiDb(db, jaga.user.id)) return gagal(PESAN_HANYA_LIHAT, 403);
  const { data: lama } = await db.from(TABEL).select('dibuat_oleh').eq('id', id).maybeSingle();
  if (!lama) return gagal('Desain tidak ditemukan.', 404);
  if (lama.dibuat_oleh !== jaga.user.id && !(await kelolaSemua(db, jaga.user.id))) {
    return gagal('Hanya pembuat desain atau Admin yang boleh menghapus.', 403);
  }
  const { count } = await db.from('request_desain_ruang').select('id', { count: 'exact', head: true }).eq('desain_id', id);
  if (count) {
    const { error } = await db.from(TABEL).update({ diarsipkan_at: new Date().toISOString() }).eq('id', id);
    if (error) return gagal(error.message, 500);
    return NextResponse.json({ ok: true, diarsipkan: true, tautan: count });
  }
  const { error } = await db.from(TABEL).delete().eq('id', id);
  if (error) return gagal(error.message, 500);
  await bersihkanGambarDesain(db);
  return NextResponse.json({ ok: true });
}
