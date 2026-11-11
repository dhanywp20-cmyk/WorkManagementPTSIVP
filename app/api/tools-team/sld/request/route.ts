import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/auth/penjaga-admin';
import { klienSebagaiUser, muatUser } from '@/lib/ai-server';
import { bolehUbahTautan, statusRuangan } from '@/lib/tools-team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });

type Req = { id: string; project_name: string; room_name: string | null; status: string; rooms: { room_name?: string; status?: string }[] | null; created_at: string };

export async function GET(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const user = await muatUser(jaga.user.id);
  if (!user) return gagal('Akun tidak ditemukan.', 401);
  const cari = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80).replace(/[%_,()]/g, ' ');
  let q = klienSebagaiUser(user).from('project_requests').select('id, project_name, room_name, status, rooms, created_at')
    .order('created_at', { ascending: false }).limit(30);
  if (cari) q = q.ilike('project_name', `%${cari}%`);
  const { data, error } = await q;
  if (error) return gagal('Daftar Request Design tidak bisa dimuat.', 500);
  const daftar = ((data ?? []) as Req[]).map(r => {
    const jumlah = 1 + (r.rooms?.length ?? 0);
    const ruang = Array.from({ length: jumlah }, (_, i) => {
      const nama = (i === 0 ? r.room_name : r.rooms?.[i - 1]?.room_name)?.trim() || `Ruangan ${i + 1}`;
      const izin = bolehUbahTautan(user.role, statusRuangan(r, i));
      return { idx: i, nama, boleh: izin.ok, alasan: izin.ok ? '' : izin.alasan };
    });
    return { id: r.id, nama: r.project_name, dibuat: r.created_at, ruang };
  });
  return NextResponse.json({ ok: true, daftar });
}
