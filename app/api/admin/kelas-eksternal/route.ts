/**
 * /api/admin/kelas-eksternal - Learning Center -> Kelas Eksternal (pengelolaan).
 *  GET                 -> daftar kelas + jumlah peserta, selesai, rata-rata
 *  GET ?id=<kelas>     -> satu kelas + peserta & nilai terakhir
 *  POST { aksi:'simpan', id?, ...isian }  -> buat / ubah (token link dibuat sekali)
 *  POST { aksi:'hapus', id }              -> hapus kelas (peserta & hasil ikut terhapus)
 * Ubah: admin / Full Access. Lihat: juga pimpinan (hanya baca).
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { hasFullAccess } from '@/lib/constants';
import { rapikanKelas, type KelasEksternal } from '@/lib/kelas-eksternal';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const jawab = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });

async function hak(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return { ok: false as const, status: jaga.status, alasan: jaga.alasan };
  const db = getAdminClient();
  const { data } = await db.from('users').select('role,access_level').eq('id', jaga.user.id).maybeSingle();
  const { data: pim } = await db.from('users').select('pimpinan').eq('id', jaga.user.id).maybeSingle();
  const ubah = hasFullAccess((data ?? {}) as { role?: string; access_level?: string });
  const lihat = ubah || (pim as { pimpinan?: boolean } | null)?.pimpinan === true;
  if (!lihat) return { ok: false as const, status: 403, alasan: 'Hanya admin Learning Center.' };
  return { ok: true as const, ubah, user: jaga.user, db };
}

export async function GET(req: NextRequest) {
  const h = await hak(req);
  if (!h.ok) return jawab({ error: h.alasan }, h.status);
  const { db } = h;
  const id = req.nextUrl.searchParams.get('id');

  if (id) {
    if (!UUID.test(id)) return jawab({ error: 'Kelas tidak dikenal.' }, 400);
    const [{ data: kelas }, { data: peserta }, { data: hasil }] = await Promise.all([
      db.from('lc_eks_kelas').select('*').eq('id', id).maybeSingle(),
      db.from('lc_eks_peserta').select('id,nama,created_at').eq('kelas_id', id).order('created_at'),
      db.from('lc_eks_hasil').select('peserta_id,percobaan,mulai_pada,selesai_pada,benar,jumlah,skor,lulus,durasi_detik,lewat_waktu')
        .eq('kelas_id', id).order('percobaan', { ascending: false }),
    ]);
    if (!kelas) return jawab({ error: 'Kelas tidak ditemukan.' }, 404);
    const terakhir = new Map<string, Record<string, unknown>>();
    const percobaan = new Map<string, number>();
    for (const r of (hasil ?? []) as Record<string, unknown>[]) {
      const pid = r.peserta_id as string;
      percobaan.set(pid, (percobaan.get(pid) ?? 0) + 1);
      if (!terakhir.has(pid)) terakhir.set(pid, r);
    }
    return jawab({
      kelas, ubah: h.ubah,
      peserta: ((peserta ?? []) as { id: string; nama: string; created_at: string }[]).map(p => ({ ...p, percobaan: percobaan.get(p.id) ?? 0, hasil: terakhir.get(p.id) ?? null })),
    });
  }

  const [{ data: kelas }, { data: peserta }, { data: hasil }] = await Promise.all([
    db.from('lc_eks_kelas').select('*').order('created_at', { ascending: false }),
    db.from('lc_eks_peserta').select('kelas_id'),
    db.from('lc_eks_hasil').select('kelas_id,skor').not('selesai_pada', 'is', null),
  ]);
  const nPeserta = new Map<string, number>();
  for (const p of (peserta ?? []) as { kelas_id: string }[]) nPeserta.set(p.kelas_id, (nPeserta.get(p.kelas_id) ?? 0) + 1);
  const skor = new Map<string, number[]>();
  for (const r of (hasil ?? []) as { kelas_id: string; skor: number }[]) skor.set(r.kelas_id, [...(skor.get(r.kelas_id) ?? []), r.skor]);
  return jawab({
    ubah: h.ubah,
    kelas: ((kelas ?? []) as KelasEksternal[]).map(k => {
      const s = skor.get(k.id) ?? [];
      return { ...k, jumlahPeserta: nPeserta.get(k.id) ?? 0, jumlahSelesai: s.length, rataRata: s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null };
    }),
  });
}

export async function POST(req: NextRequest) {
  const h = await hak(req);
  if (!h.ok) return jawab({ error: h.alasan }, h.status);
  if (!h.ubah) return jawab({ error: 'Akun ini hanya bisa melihat.' }, 403);
  const { db, user } = h;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  if (body.aksi === 'simpan') {
    const isian = rapikanKelas(body);
    if ('galat' in isian) return jawab({ error: isian.galat }, 400);
    const id = String(body.id ?? '');
    if (id) {
      if (!UUID.test(id)) return jawab({ error: 'Kelas tidak dikenal.' }, 400);
      const { data, error } = await db.from('lc_eks_kelas').update({ ...isian, updated_at: new Date().toISOString() }).eq('id', id).select('*').maybeSingle();
      if (error || !data) return jawab({ error: error?.message ?? 'Kelas tidak ditemukan.' }, error ? 500 : 404);
      return jawab({ kelas: data });
    }
    const { data, error } = await db.from('lc_eks_kelas').insert({
      ...isian, token: crypto.randomBytes(16).toString('base64url'), dibuat_oleh: user.id, dibuat_nama: user.full_name,
    }).select('*').single();
    if (error) return jawab({ error: error.message }, 500);
    return jawab({ kelas: data });
  }

  if (body.aksi === 'hapus') {
    const id = String(body.id ?? '');
    if (!UUID.test(id)) return jawab({ error: 'Kelas tidak dikenal.' }, 400);
    const { error } = await db.from('lc_eks_kelas').delete().eq('id', id);
    if (error) return jawab({ error: error.message }, 500);
    return jawab({ ok: true });
  }

  return jawab({ error: 'Permintaan tidak dikenal.' }, 400);
}
