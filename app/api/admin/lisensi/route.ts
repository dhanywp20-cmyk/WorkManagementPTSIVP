import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanAdmin } from '@/lib/auth/penjaga-admin';
import { periksaIsianTerbit } from '@/lib/lisensi/inti';
import { adaKunciPrivat, statusLisensi, terbitkanKunci } from '@/lib/lisensi/server';

export const dynamic = 'force-dynamic';

const KUNCI_CATATAN = 'lisensi_terbit';
const MAKS_CATATAN = 500;

interface CatatanTerbit {
  id: string; pelanggan: string; edisi: string; domain: string[]; terbit: string; kedaluwarsa: string | null;
  oleh: string; kunci: string; catatan: string;
}

async function bacaCatatan(): Promise<CatatanTerbit[]> {
  const { data } = await getAdminClient().from('app_settings').select('value').eq('key', KUNCI_CATATAN).maybeSingle();
  return Array.isArray(data?.value) ? (data.value as CatatanTerbit[]) : [];
}

export async function GET(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
  const status = statusLisensi(req.nextUrl.host);
  const manager = status.sah && status.pemilik;
  return NextResponse.json({
    ok: true, status, manager, kunciPrivat: manager && adaKunciPrivat(),
    terbit: manager ? await bacaCatatan() : [],
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });
  const status = statusLisensi(req.nextUrl.host);
  if (!status.sah || !status.pemilik) return NextResponse.json({ ok: false, alasan: 'License Manager hanya tersedia di server pemilik.' }, { status: 404 });
  const privat = process.env.LISENSI_KUNCI_PRIVAT;
  if (!privat?.trim()) return NextResponse.json({ ok: false, alasan: 'LISENSI_KUNCI_PRIVAT belum diisi di environment server.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  const hariIni = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  const cek = periksaIsianTerbit(body, hariIni);
  if (!cek.ok) return NextResponse.json({ ok: false, alasan: cek.galat }, { status: 400 });
  let hasil: ReturnType<typeof terbitkanKunci>;
  try {
    hasil = terbitkanKunci({ ...cek.isian, pemilik: undefined }, privat);
  } catch {
    return NextResponse.json({ ok: false, alasan: 'LISENSI_KUNCI_PRIVAT tidak bisa dibaca. Periksa isinya.' }, { status: 500 });
  }
  const catatan = typeof (body as Record<string, unknown>)?.catatan === 'string' ? String((body as Record<string, unknown>).catatan).trim().slice(0, 200) : '';
  const baru: CatatanTerbit = {
    id: hasil.klaim.id, pelanggan: hasil.klaim.pelanggan, edisi: hasil.klaim.edisi, domain: hasil.klaim.domain,
    terbit: hasil.klaim.terbit, kedaluwarsa: hasil.klaim.kedaluwarsa, oleh: jaga.user.full_name || jaga.user.username, kunci: hasil.kunci, catatan,
  };
  const daftar = [baru, ...(await bacaCatatan())].slice(0, MAKS_CATATAN);
  const { error } = await getAdminClient().from('app_settings').upsert({ key: KUNCI_CATATAN, value: daftar, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ ok: false, alasan: 'Kunci dibuat tetapi catatannya gagal disimpan. Salin kuncinya sekarang.', kunci: hasil.kunci }, { status: 500 });
  return NextResponse.json({ ok: true, kunci: hasil.kunci, catatan: baru });
}
