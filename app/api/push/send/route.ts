/**
 * /api/push/send - satu-satunya jalur pengiriman push notification asli.
 * Dipanggil dari lib/notifications.ts setiap kali sebuah notifikasi in-app
 * dibuat (createNotification / createNotificationForAdmins), sehingga SEMUA
 * alur yang sudah memicu notifikasi hari ini (tiket, jadwal, project
 * request, KPI, dst) otomatis ikut memicu push tanpa menyentuh satu pun
 * dari titik pemanggilan itu.
 *
 * Dijaga pastikanMasuk() (bukan pastikanAdmin) - sama seperti Telegram/
 * WhatsApp, seluruh tim memicunya lewat pekerjaan sehari-hari (mis. admin
 * meng-assign ticket ke anggota tim lain memicu push KE anggota tim itu).
 * Ini SAMA PERSIS model keamanan `notifications` yang sudah ada (RLS
 * nt_own: WITH CHECK (true) - siapa pun yang login boleh menulis notifikasi
 * ATAS NAMA orang lain sebagai TARGET, karena begitulah "tiket di-assign ke
 * X" bekerja) - bukan celah baru yang diperkenalkan di sini.
 *
 * Selalu menjawab 200 - kegagalan kirim push TIDAK BOLEH menggagalkan alur
 * utama (notifikasi in-app-nya sendiri sudah tersimpan lebih dulu).
 */

import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { kirimPushKeUser } from '@/lib/web-push-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  let body: { user_ids?: string[]; title?: string; body?: string; url?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, alasan: 'Isi permintaan bukan JSON.' }, { status: 400 }); }

  const userIds = (body.user_ids ?? []).filter((s): s is string => typeof s === 'string' && !!s);
  const title = (body.title ?? '').trim();
  if (!userIds.length || !title) return NextResponse.json({ ok: false, alasan: 'user_ids/title kosong.' });

  // Fire-and-forget dari sudut pandang pemanggil - tapi ditunggu di sini
  // (bukan void) supaya serverless function tidak mati sebelum pengiriman
  // selesai. kirimPushKeUser tidak pernah throw, jadi ini tidak memperlambat
  // dengan risiko galat tak tertangani.
  await kirimPushKeUser(userIds, { title, body: body.body, url: body.url });
  return NextResponse.json({ ok: true });
}
