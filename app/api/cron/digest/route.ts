import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWA } from '@/lib/wa';

export const dynamic = 'force-dynamic';

/**
 * /api/cron/digest - ringkasan tenggat harian per orang, lewat WhatsApp.
 * Mencakup target Project Progress, jadwal reminder, dan garansi yang habis.
 *
 * Prinsip yang dijaga:
 *   - Satu pesan per orang, bukan satu per item. Sepuluh notifikasi terpisah
 *     berakhir diabaikan; satu ringkasan dibaca.
 *   - Tidak mengirim apa pun kepada orang yang tidak punya tenggat. Pesan
 *     "tidak ada apa-apa hari ini" melatih orang mengabaikan pengirimnya.
 *   - Hanya melihat ke depan sampai H+3, dan ke belakang untuk yang lewat.
 */

/** Berapa hari ke depan yang dianggap "mendekat". */
const HARI_KE_DEPAN = 3;

function berwenang(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get('authorization') === `Bearer ${secret}`) return true;
  if (request.headers.get('x-cron-secret') === secret) return true;
  return false;
}

function tanggalISO(offsetHari: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetHari);
  return d.toISOString().slice(0, 10);
}

function labelTanggal(iso: string): string {
  const hariIni = tanggalISO(0);
  const besok   = tanggalISO(1);
  if (iso === hariIni) return 'HARI INI';
  if (iso === besok)   return 'besok';
  if (iso < hariIni) {
    const lewat = Math.round(
      (new Date(hariIni).getTime() - new Date(iso).getTime()) / 86400000,
    );
    return `TERLAMBAT ${lewat} hari`;
  }
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

interface Item { label: string; tanggal: string; terlambat: boolean }

async function jalankan() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const hariIni = tanggalISO(0);
  const batas   = tanggalISO(HARI_KE_DEPAN);

  // nama lengkap  daftar tenggat miliknya
  const perOrang = new Map<string, Item[]>();
  const catat = (nama: string | null | undefined, item: Item) => {
    const n = (nama ?? '').trim();
    if (!n) return;
    const arr = perOrang.get(n) ?? [];
    arr.push(item);
    perOrang.set(n, arr);
  };

  // Lokasi Project Progress yang targetnya mendekat / lewat
  //  Yang sudah selesai dilewati: mengingatkan target pada pekerjaan yang
  //  sudah rampung hanya membuat kiriman ini terasa tidak akurat.
  const { data: lokasi } = await supabase
    .from('progress_locations')
    .select('name, pic, sales_name, target_date, status, progress')
    .not('target_date', 'is', null)
    .lte('target_date', batas)
    .neq('status', 'done');

  for (const l of (lokasi ?? []) as {
    name: string; pic: string | null; sales_name: string | null;
    target_date: string; progress: number | null;
  }[]) {
    const item: Item = {
      label: `📊 ${l.name} — progres ${l.progress ?? 0}%`,
      tanggal: l.target_date,
      terlambat: l.target_date < hariIni,
    };
    catat(l.pic, item);
    // Sales ikut diberi tahu hanya bila ia bukan PIC-nya sendiri, supaya
    // tidak menerima baris yang sama dua kali.
    if (l.sales_name && l.sales_name !== l.pic) catat(l.sales_name, item);
  }

  // Reminder yang jatuh tempo dan belum selesai
  const { data: reminders } = await supabase
    .from('reminders')
    .select('project_name, address, assign_name, due_date, status, category')
    .lte('due_date', batas)
    .not('status', 'in', '("done","cancelled")');

  for (const r of (reminders ?? []) as {
    project_name: string | null; address: string | null;
    assign_name: string | null; due_date: string; category: string | null;
  }[]) {
    catat(r.assign_name, {
      label: `🗓️ ${r.project_name ?? '-'}${r.address ? ` · ${r.address}` : ''} (${r.category ?? '-'})`,
      tanggal: r.due_date,
      terlambat: r.due_date < hariIni,
    });
  }

  if (perOrang.size === 0) {
    return { penerima: 0, terkirim: 0, gagal: 0, catatan: 'tidak ada tenggat dalam jangkauan' };
  }

  // Nomor WA, diambil sekali untuk semua penerima
  const { data: users } = await supabase
    .from('users')
    .select('full_name, phone_number')
    .in('full_name', [...perOrang.keys()]);

  const nomor = new Map(
    ((users ?? []) as { full_name: string; phone_number: string | null }[])
      .filter(u => u.phone_number)
      .map(u => [u.full_name, u.phone_number as string]),
  );

  let terkirim = 0, gagal = 0, tanpaNomor = 0;

  for (const [nama, items] of perOrang) {
    const wa = nomor.get(nama);
    if (!wa) { tanpaNomor++; continue; }

    // Terlambat lebih dulu, lalu urut tanggal - yang paling mendesak dibaca
    // pertama, karena pesan panjang sering hanya terbaca beberapa baris awal.
    items.sort((a, b) =>
      (a.terlambat === b.terlambat ? 0 : a.terlambat ? -1 : 1) || a.tanggal.localeCompare(b.tanggal));

    const jumlahTerlambat = items.filter(i => i.terlambat).length;
    const pesan =
      `*Ringkasan Tenggat — ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}*\n` +
      `Halo ${nama}, ada ${items.length} hal yang perlu perhatian` +
      (jumlahTerlambat ? ` — *${jumlahTerlambat} sudah lewat tenggat*` : '') + `:\n\n` +
      items.map(i => `${i.terlambat ? '🔴' : '•'} ${i.label}\n   _${labelTanggal(i.tanggal)}_`).join('\n') +
      `\n\nBuka Work Management untuk memperbarui progres.`;

    const hasil = await sendWA(wa, pesan, 'digest_wa');
    if (hasil.ok) terkirim++; else gagal++;
  }

  return { penerima: perOrang.size, terkirim, gagal, tanpaNomor };
}

export async function GET(request: NextRequest) {
  if (!berwenang(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await jalankan()) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as { message?: string }).message ?? 'gagal' },
      { status: 500 },
    );
  }
}

export const POST = GET;
