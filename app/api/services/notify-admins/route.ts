import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server-auth';
import { getServicesAdminClient } from '@/lib/supabase-services-admin';

export const dynamic = 'force-dynamic';

/**
 * /api/services/notify-admins - kabari admin Team Services bahwa ada ticket masuk.
 *
 * Dulu halaman Ticketing membaca sendiri tabel users basis data Services dari
 * browser untuk mengambil nomor telepon admin di sana. Artinya kontak orang
 * dari organisasi lain terunduh ke perangkat setiap user PTS yang kebetulan
 * meng-assign ticket. Pembacaan itu dipindah ke sini: nomornya dipakai untuk
 * mengirim WA lalu berhenti di server.
 *
 * Isi pesannya sengaja disusun di sini juga - kalau formatnya dikirim dari
 * klien, endpoint ini berubah jadi jalan untuk mengirim WA sembarangan ke
 * kontak yang tidak bisa dilihat pemanggilnya.
 */
interface RingkasanTicket {
  project_name?: string | null;
  issue_case?: string | null;
  product?: string | null;
  sn_unit?: string | null;
  customer_phone?: string | null;
  sales_name?: string | null;
  catatan?: string | null;
}

function susunPesan(t: RingkasanTicket): string {
  return [
    '🔔 *TICKET MASUK — Servisindo*',
    '━━━━━━━━━━━━━━━━━━',
    `📌 *Project:* ${t.project_name ?? '-'}`,
    `⚠️ *Issue:* ${t.issue_case ?? '-'}`,
    t.product ? `📦 *Product:* ${t.product}` : null,
    t.sn_unit ? `🔢 *SN:* ${t.sn_unit}` : null,
    t.customer_phone ? `📱 *Telepon:* ${t.customer_phone}` : null,
    `👤 *Sales:* ${t.sales_name || '-'}`,
    t.catatan ? `📝 *Catatan:* ${t.catatan}` : null,
    '━━━━━━━━━━━━━━━━━━',
    'Silakan buka platform Servisindo untuk menerima dan assign ticket.',
  ].filter(Boolean).join('\n');
}

async function kirimWA(target: string, message: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return;
  try {
    await fetch(`${url}/functions/v1/swift-responder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anon}`,
        apikey: anon,
      },
      body: JSON.stringify({ type: 'reminder_wa', target, message }),
    });
  } catch {
    // Gagal kirim WA tidak boleh menggagalkan assign ticket.
  }
}

export async function POST(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) {
    return NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });
  }

  const client = getServicesAdminClient();
  if (!client) {
    return NextResponse.json({ terkirim: 0, alasan: 'services_belum_dikonfigurasi' });
  }

  let ticket: RingkasanTicket;
  try {
    ticket = (await request.json()) as RingkasanTicket;
  } catch {
    return NextResponse.json({ error: 'Body tidak terbaca.' }, { status: 400 });
  }
  if (!ticket?.project_name) {
    return NextResponse.json({ error: 'project_name wajib.' }, { status: 400 });
  }

  //  Termasuk pemegang Full Access (Manager PTS IVP), bukan hanya role
  //  admin - lihat lib/penerima-admin.ts.
  const { data: admins, error } = await client
    .from('users')
    .select('phone_number')
    .or('role.in.(admin,superadmin),access_level.eq.full')
    .not('phone_number', 'is', null)
    .neq('phone_number', '');
  if (error) {
    return NextResponse.json({ terkirim: 0, alasan: 'gagal_membaca_admin' });
  }

  const pesan = susunPesan(ticket);
  const nomor = ((admins ?? []) as { phone_number?: string }[])
    .map((a) => a.phone_number)
    .filter((n): n is string => !!n);
  for (const n of nomor) await kirimWA(n, pesan);

  // Yang dikembalikan hanya jumlahnya - nomornya tidak pernah keluar dari server.
  return NextResponse.json({ terkirim: nomor.length });
}
