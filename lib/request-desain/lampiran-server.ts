import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/auth/penjaga-admin';
import { muatUser, klienSebagaiUser } from '@/lib/ai-server';

export const POLA_ID = /^[0-9a-f-]{36}$/i;
export const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });

export type Req = { id: string; project_name: string; room_name: string | null; status: string; rooms: { room_name?: string; status?: string }[] | null };

export async function muatRequest(req: NextRequest, id: string) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return { galat: gagal(jaga.alasan, jaga.status) };
  if (!POLA_ID.test(id)) return { galat: gagal('ID request tidak sah.') };
  const user = await muatUser(jaga.user.id);
  if (!user) return { galat: gagal('Akun tidak ditemukan.', 401) };
  const { data } = await klienSebagaiUser(user).from('project_requests')
    .select('id, project_name, room_name, status, rooms').eq('id', id).maybeSingle();
  if (!data) return { galat: gagal('Request tidak ditemukan atau Anda tidak punya akses.', 404) };
  return { user, request: data as Req };
}

export const jumlahRuang = (r: Req) => 1 + (r.rooms?.length ?? 0);
