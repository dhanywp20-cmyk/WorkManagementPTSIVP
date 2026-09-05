import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server-auth';
import { getServicesAdminClient } from '@/lib/supabase-services-admin';
import { bacaPengaturan } from '@/lib/notifikasi/pengaturan';
import { kirimWA as kirimWAPenyedia } from '@/lib/wa-kirim-server';

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

/**
 * Dulu berkas ini mem-POST langsung ke Edge Function swift-responder (Fonnte
 * tertanam, tanpa mengecek apa pun) - artinya notifikasi lintas-org ini TIDAK
 * IKUT ketika admin mematikan saklar WhatsApp atau berpindah penyedia di
 * Admin Panel -> Integrations. Sekarang lewat kirimWA() dari
 * lib/wa-kirim-server.ts (penyedia Fonnte/Meta Cloud/kustom yang sedang
 * dipilih, dibaca segar tiap panggilan) - didahului cek saklar induk sendiri
 * di sini karena helper itu sengaja tidak mengeceknya (ia juga dipakai tombol
 * Tes Koneksi admin, yang harus tetap jalan walau saklarnya mati).
 *
 * Tidak ikut mengirim Telegram: kirimTelegramKeNomor() mencocokkan nomor ke
 * tabel users organisasi PTS sendiri, sedangkan nomor di sini milik admin
 * organisasi Services yang terpisah - mencocokkannya berisiko salah kirim ke
 * orang PTS yang kebetulan punya nomor sama.
 */
async function kirimWA(target: string, message: string): Promise<void> {
  try {
    const p = await bacaPengaturan();
    if (!p.aktif.whatsapp) return;
    await kirimWAPenyedia(target, message);
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
