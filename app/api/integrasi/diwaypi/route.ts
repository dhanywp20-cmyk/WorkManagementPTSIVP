/**
 * /api/integrasi/diwaypi - satu-satunya pintu yang menerima token DIWAYPI (Authorization: Bearer dwp_...).
 *   GET  -> siapa pemilik token + cakupannya (dipakai DIWAYPI untuk memeriksa token)
 *   POST -> { aksi, args } -> jalankan SATU aksi dari daftar tetap (lib/integrasi-aksi.ts)
 *
 * Dikecualikan dari gerbang sesi di proxy.ts (jalur persis), seperti /api/monitor: route ini
 * memeriksa tokennya sendiri. Setiap aksi berjalan SEBAGAI pemilik token (klienSebagaiUser),
 * peran dibaca ulang dari tabel users tiap permintaan - pencabutan hak berlaku seketika.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { klienSebagaiUser, muatUser } from '@/lib/ai-server';
import { ambilBearer, verifikasiToken } from '@/lib/token-integrasi';
import { AKSI_BACA, AKSI_TULIS, jalankanAksi } from '@/lib/integrasi-aksi';
import { buatEfekServer } from '@/lib/efek-server';
import { muatKelompok } from '@/lib/kelompok-inti';
import { muatKategoriInsentif } from '@/lib/incentive-scheme';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const KEPALA = { 'Cache-Control': 'no-store' };

async function pemilik(req: NextRequest) {
  const admin = getAdminClient();
  const p = await verifikasiToken(admin, ambilBearer(req.headers.get('authorization')));
  if (!p) return { galat: NextResponse.json({ ok: false, galat: 'Token tidak sah atau sudah dicabut.' },
    { status: 401, headers: { ...KEPALA, 'WWW-Authenticate': 'Bearer' } }) };
  const u = await muatUser(p.userId);
  if (!u) return { galat: NextResponse.json({ ok: false, galat: 'Akun pemilik token tidak ditemukan.' }, { status: 401, headers: KEPALA }) };
  return { p, u, admin };
}

export async function GET(req: NextRequest) {
  const s = await pemilik(req);
  if ('galat' in s) return s.galat;
  return NextResponse.json({
    ok: true, nama: s.u.full_name ?? s.u.username, username: s.u.username, peran: s.u.role, cakupan: s.p.cakupan,
    aksi: { baca: AKSI_BACA, tulis: s.p.cakupan.includes('tulis') ? AKSI_TULIS : [] },
  }, { headers: KEPALA });
}

export async function POST(req: NextRequest) {
  const s = await pemilik(req);
  if ('galat' in s) return s.galat;
  let body: { aksi?: unknown; args?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, galat: 'Body tidak sah.' }, { status: 400, headers: KEPALA }); }
  const aksi = String(body.aksi ?? '').trim();
  const args = body.args && typeof body.args === 'object' && !Array.isArray(body.args) ? body.args as Record<string, unknown> : {};
  try {
    const db = klienSebagaiUser(s.u);
    const hasil = await jalankanAksi(aksi, args, {
      db, admin: s.admin, u: s.u, cakupan: s.p.cakupan,
      //  WA/Telegram, in-app + push, audit: padanan server dari fungsi peramban (lib/efek-server.ts).
      efek: buatEfekServer(db, s.admin, s.u.id),
      //  Yang di peramban dimuat saat halaman Reminder Schedule dibuka.
      muatAturan: async () => { await Promise.all([muatKelompok(), muatKategoriInsentif()]); },
    });
    return NextResponse.json(hasil, { status: hasil.ok ? 200 : 400, headers: KEPALA });
  } catch (e) {
    console.error('[integrasi/diwaypi]', aksi, e);
    return NextResponse.json({ ok: false, galat: 'Aksi gagal dijalankan di server.' }, { status: 500, headers: KEPALA });
  }
}
