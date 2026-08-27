/**
 * /api/integrasi/rahasia - satu-satunya pintu ke tabel rahasia_integrasi.
 *
 * ATURAN YANG TIDAK BOLEH DILANGGAR BERKAS INI:
 *
 *   Nilai rahasia TIDAK PERNAH dikirim balik ke peramban. GET hanya menjawab
 *   "sudah diisi atau belum" plus empat huruf terakhir sebagai penanda - cukup
 *   untuk admin memastikan token yang terpasang memang yang ia maksud, tidak
 *   cukup untuk dipakai siapa pun.
 *
 *   Kalau suatu saat ada yang tergoda mengembalikan nilai penuh supaya kolom
 *   isian bisa "menampilkan yang tersimpan": itu mengembalikan persis lubang
 *   yang tabel ini dibuat untuk menutup. Kolom isian yang kosong dengan
 *   penanda di sebelahnya sudah cukup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { pastikanAdmin } from '@/lib/penjaga-admin';
import { KUNCI_RAHASIA, type KunciRahasia } from '@/lib/rahasia-kunci';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

//  Daftarnya di lib/, bukan di sini: berkas route Next.js hanya boleh
//  mengekspor handler HTTP dan beberapa konfigurasi tertentu - mengekspor
//  konstanta dari sini membuat build gagal dengan "does not match the
//  required types of a Next.js Route".
function sah(k: string): k is KunciRahasia {
  return (KUNCI_RAHASIA as readonly string[]).includes(k);
}

/** "abcdefgh1234" -> "…1234". Nilai pendek disamarkan seluruhnya. */
function samarkan(nilai: string): string {
  const bersih = nilai.trim();
  return bersih.length <= 6 ? '••••' : `…${bersih.slice(-4)}`;
}

export async function GET(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  const db = getAdminClient();
  const { data } = await db.from('rahasia_integrasi').select('kunci, nilai, diperbarui_pada, diperbarui_oleh');

  /*
    Token yang masih berasal dari variabel lingkungan ikut dilaporkan.

    Tanpa ini, kunci yang sebenarnya AKTIF - dipasang di Vercel sejak sebelum
    layar ini ada - tampil sebagai "belum diisi". Admin lalu mengira fiturnya
    mati, padahal ia berjalan; atau lebih buruk, mengisi ulang token baru
    padahal yang lama masih dipakai dan sah.

    Nilainya TIDAK ikut dikirim - hanya keterangan bahwa ia ada. Titik ujung
    ini memang dijaga admin, tetapi token tetap tidak punya alasan meninggalkan
    server.
  */
  const CADANGAN_ENV: Record<string, string | undefined> = {
    'whatsapp.token':     process.env.FONNTE_TOKEN,
    'telegram.bot_token': process.env.TELEGRAM_BOT_TOKEN,
    'ai.gemini_token':    process.env.GEMINI_API_KEY,
  };

  const status: Record<string, {
    terisi: boolean; penanda?: string; diperbarui?: string; oleh?: string; dariEnv?: boolean;
  }> = {};
  for (const k of KUNCI_RAHASIA) {
    status[k] = CADANGAN_ENV[k]
      ? { terisi: true, dariEnv: true, penanda: samarkan(CADANGAN_ENV[k] as string) }
      : { terisi: false };
  }
  for (const r of data ?? []) {
    if (!sah(r.kunci)) continue;
    // Baris di basis data MENIMPA cadangan env - itu memang urutan yang
    // dipakai bacaRahasia() saat mengirim, jadi layarnya harus menunjukkan
    // yang sama. Layar yang menampilkan token berbeda dari yang benar-benar
    // dipakai lebih menyesatkan daripada tidak menampilkan apa pun.
    status[r.kunci] = {
      terisi: true,
      dariEnv: false,
      penanda: samarkan(r.nilai as string),
      diperbarui: r.diperbarui_pada as string,
      oleh: (r.diperbarui_oleh as string) ?? undefined,
    };
  }
  return NextResponse.json({ ok: true, status });
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  let body: { kunci?: string; nilai?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, alasan: 'Isi permintaan bukan JSON.' }, { status: 400 }); }

  const kunci = (body.kunci ?? '').trim();
  const nilai = (body.nilai ?? '').trim();
  if (!sah(kunci)) return NextResponse.json({ ok: false, alasan: 'Kunci tidak dikenal.' }, { status: 400 });
  if (!nilai)      return NextResponse.json({ ok: false, alasan: 'Nilai kosong.' }, { status: 400 });

  const db = getAdminClient();
  const { error } = await db.from('rahasia_integrasi').upsert({
    kunci, nilai,
    diperbarui_pada: new Date().toISOString(),
    diperbarui_oleh: jaga.user.full_name || jaga.user.username,
  }, { onConflict: 'kunci' });

  if (error) return NextResponse.json({ ok: false, alasan: error.message }, { status: 500 });
  //  Yang dikembalikan penanda, bukan nilainya - lihat catatan di kepala berkas.
  return NextResponse.json({ ok: true, penanda: samarkan(nilai) });
}

export async function DELETE(req: NextRequest) {
  const jaga = await pastikanAdmin(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  const kunci = (new URL(req.url).searchParams.get('kunci') ?? '').trim();
  if (!sah(kunci)) return NextResponse.json({ ok: false, alasan: 'Kunci tidak dikenal.' }, { status: 400 });

  const db = getAdminClient();
  const { error } = await db.from('rahasia_integrasi').delete().eq('kunci', kunci);
  if (error) return NextResponse.json({ ok: false, alasan: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
