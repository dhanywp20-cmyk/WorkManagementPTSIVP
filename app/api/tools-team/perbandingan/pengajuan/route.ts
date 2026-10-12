/**
 * /api/tools-team/perbandingan/pengajuan - verifikasi Product Comparison oleh orang produk.
 *
 * Sales / Marketing bukan orang produk: PDF mereka baru boleh diunduh setelah diverifikasi. Siapa verifikator,
 * siapa mengunduh langsung, lama simpan & batas pengajuan diatur Admin Panel (app_settings 'tools.perbandingan',
 * lib/perbandingan-aturan.ts) - dibaca ulang tiap permintaan, tanpa nilai tertanam di kode.
 *
 *   GET                 daftar ringkas: verifikator = semua (menunggu dulu); pengaju = miliknya. + peran.
 *   GET ?id=            satu pengajuan lengkap (pengaju itu sendiri atau verifikator).
 *   POST { data }       ajukan (status menunggu) -> notifikasi in-app + WA ke verifikator.
 *   PATCH { id, aksi: 'setujui' | 'tolak', catatan?, data? }
 *                       verifikator; setujui boleh membawa data hasil koreksi (tanpa nilai 'cek').
 *
 * Yang disimpan hanya JSON hasil perbandingan (migrasi 045) - bukan brosur / PDF - dan dihapus otomatis
 * 30 hari setelah dibuat (dibersihkan di tiap permintaan). Isi tidak pernah ditulis ke log.
 */
import { NextRequest, NextResponse } from 'next/server';
import '@/lib/wa-server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { sendWA } from '@/lib/wa';
import { bolehPerbandingan, jumlahCek, periksaKartu } from '@/lib/perbandingan';
import { type AturanPerbandingan, bolehLangsungUnduh, bolehVerifikasi, KUNCI_ATURAN_PERBANDINGAN, rapikanAturan } from '@/lib/perbandingan-aturan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TABEL = 'tools_perbandingan';
const POLA_ID = /^[0-9a-f-]{36}$/i;
const URL_MENU = '/tools-team?alat=banding';
const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });
type Db = ReturnType<typeof getAdminClient>;
type Akun = { id: string; full_name: string | null; role: string | null; team_type: string | null; jabatan: string | null; allowed_menus: string[] | null; pimpinan: boolean | null };

async function akun(req: NextRequest): Promise<{ db: Db; u: Akun; aturan: AturanPerbandingan } | NextResponse> {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const db = getAdminClient();
  const { data } = await db.from('users').select('id, full_name, role, team_type, jabatan, allowed_menus, pimpinan').eq('id', jaga.user.id).maybeSingle();
  const u = data as Akun | null;
  if (!u || !bolehPerbandingan(u)) return gagal('Product Comparison hanya untuk akun yang diberi akses AV Solution Tools.', 403);
  const { data: setel } = await db.from('app_settings').select('value').eq('key', KUNCI_ATURAN_PERBANDINGAN).maybeSingle();
  const aturan = rapikanAturan(setel?.value);
  //  Bersihkan pengajuan kedaluwarsa (hemat kuota) - murah, berindeks created_at.
  await db.from(TABEL).delete().lt('created_at', new Date(Date.now() - aturan.simpanHari * 86_400_000).toISOString());
  return { db, u, aturan };
}

/** Notifikasi in-app (+ push via trigger tabel) & WA - kegagalan satu kanal tidak menggagalkan permintaan. */
async function beritahu(db: Db, penerima: { id: string; phone_number?: string | null }[], judul: string, isi: string, refId: string, oleh: string) {
  if (!penerima.length) return;
  await db.from('notifications').insert(penerima.map(p => ({
    user_id: p.id, type: 'system', title: judul, body: isi, action_url: URL_MENU, ref_id: refId, created_by: oleh, is_read: false, created_at: new Date().toISOString(),
  })));
  await Promise.all(penerima.filter(p => p.phone_number).map(p => sendWA(p.phone_number!, `*${judul}*\n${isi}\n\nBuka: AV Solution Tools → Product Comparison`, 'tools_perbandingan', 'tools.perbandingan').catch(() => null)));
}

export async function GET(req: NextRequest) {
  const a = await akun(req); if (a instanceof NextResponse) return a;
  const { db, u, aturan } = a;
  const verifikator = bolehVerifikasi(u, aturan);
  const peran = { verifikator, langsung: bolehLangsungUnduh(u, aturan), lolosSemua: aturan.lolosSemua };
  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    if (!POLA_ID.test(id)) return gagal('ID tidak sah.');
    const { data } = await db.from(TABEL).select('*').eq('id', id).maybeSingle();
    const r = data as { dibuat_oleh: string } | null;
    if (!r || (!verifikator && r.dibuat_oleh !== u.id)) return gagal('Pengajuan tidak ditemukan.', 404);
    return NextResponse.json({ ok: true, peran, pengajuan: r });
  }
  let q = db.from(TABEL).select('id, judul, status, dibuat_oleh, dibuat_nama, catatan_verifikator, diverifikasi_nama, diverifikasi_at, created_at').order('created_at', { ascending: false }).limit(100);
  if (!verifikator) q = q.eq('dibuat_oleh', u.id);
  const { data } = await q;
  const daftar = (data ?? []) as { status: string }[];
  daftar.sort((x, y) => Number(y.status === 'menunggu') - Number(x.status === 'menunggu'));
  return NextResponse.json({ ok: true, peran, daftar });
}

export async function POST(req: NextRequest) {
  const a = await akun(req); if (a instanceof NextResponse) return a;
  const { db, u, aturan } = a;
  const body = await req.json().catch(() => null) as { data?: unknown } | null;
  const k = periksaKartu(body?.data);
  if (!k.ok) return gagal(k.alasan);
  const { count } = await db.from(TABEL).select('id', { count: 'exact', head: true }).eq('dibuat_oleh', u.id).eq('status', 'menunggu');
  if ((count ?? 0) >= aturan.maksMenunggu) return gagal(`Masih ada ${count} pengajuan menunggu verifikasi - tunggu diproses dulu.`, 429);
  const judul = k.data.judul || k.data.produk.map(p => p.nama).join(' vs ');
  const { data: baru, error } = await db.from(TABEL).insert({ dibuat_oleh: u.id, dibuat_nama: u.full_name, judul, data: k.data }).select('id').single();
  if (error || !baru) return gagal('Gagal menyimpan pengajuan.', 500);
  //  Penerima = semua yang lolos bolehVerifikasi menurut aturan Admin Panel.
  const kutip = (xs: string[]) => xs.map(t => `"${t.replace(/"/g, '')}"`).join(',');
  const filter = [`role.in.(${kutip(aturan.verifikatorRole)})`, ...(aturan.verifikatorTim.length ? [`team_type.in.(${kutip(aturan.verifikatorTim)})`] : [])].join(',');
  const { data: calon } = await db.from('users').select('id, role, team_type, jabatan, phone_number').or(filter);
  const penerima = ((calon ?? []) as (Akun & { phone_number: string | null })[]).filter(x => bolehVerifikasi(x, aturan) && x.id !== u.id);
  await beritahu(db, penerima, 'Product Comparison menunggu verifikasi', `${u.full_name ?? 'Sales'} mengajukan "${judul}". Periksa isinya sebelum boleh dibagikan ke customer.`, (baru as { id: string }).id, u.full_name ?? '');
  return NextResponse.json({ ok: true, id: (baru as { id: string }).id });
}

export async function PATCH(req: NextRequest) {
  const a = await akun(req); if (a instanceof NextResponse) return a;
  const { db, u, aturan } = a;
  if (!bolehVerifikasi(u, aturan)) return gagal('Akun ini tidak termasuk verifikator Product Comparison (Admin Panel).', 403);
  const body = await req.json().catch(() => null) as { id?: string; aksi?: string; catatan?: string; data?: unknown } | null;
  if (!body?.id || !POLA_ID.test(body.id) || !['setujui', 'tolak'].includes(body.aksi ?? '')) return gagal('Permintaan tidak sah.');
  const { data: r0 } = await db.from(TABEL).select('id, judul, status, dibuat_oleh').eq('id', body.id).maybeSingle();
  const r = r0 as { id: string; judul: string; status: string; dibuat_oleh: string } | null;
  if (!r) return gagal('Pengajuan tidak ditemukan.', 404);
  if (r.status !== 'menunggu') return gagal('Pengajuan ini sudah diproses.', 409);
  const catatan = typeof body.catatan === 'string' ? body.catatan.trim().slice(0, 600) : '';
  const ubah: Record<string, unknown> = {
    status: body.aksi === 'setujui' ? 'disetujui' : 'ditolak', catatan_verifikator: catatan || null,
    diverifikasi_oleh: u.id, diverifikasi_nama: u.full_name, diverifikasi_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  if (body.aksi === 'setujui' && body.data !== undefined) {
    const k = periksaKartu(body.data);
    if (!k.ok) return gagal(k.alasan);
    if (jumlahCek(k.data)) return gagal('Masih ada nilai bertanda "cek" - putuskan dulu sebelum menyetujui.');
    ubah.data = k.data;
  }
  if (body.aksi === 'tolak' && !catatan) return gagal('Tulis alasan penolakan supaya pengaju tahu yang harus diperbaiki.');
  const { error } = await db.from(TABEL).update(ubah).eq('id', r.id).eq('status', 'menunggu');
  if (error) return gagal('Gagal menyimpan verifikasi.', 500);
  const { data: pengaju } = await db.from('users').select('id, phone_number').eq('id', r.dibuat_oleh).maybeSingle();
  if (pengaju) {
    const disetujui = body.aksi === 'setujui';
    await beritahu(db, [pengaju as { id: string; phone_number: string | null }], disetujui ? 'Product Comparison disetujui' : 'Product Comparison ditolak',
      disetujui ? `"${r.judul}" sudah diverifikasi ${u.full_name ?? ''} - PDF siap diunduh.` : `"${r.judul}" ditolak ${u.full_name ?? ''}: ${catatan}`, r.id, u.full_name ?? '');
  }
  return NextResponse.json({ ok: true });
}
