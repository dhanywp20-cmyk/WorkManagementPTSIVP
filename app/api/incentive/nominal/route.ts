import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSessionUser } from '@/lib/server-auth';
import { bisaInputNominal, bisaKonfigPenuh } from '@/lib/incentive-akses';
import {
  KUNCI_ATURAN_NOMINAL, bolehLihatBrand, nominalTerbuka, rapikanAturanNominal,
  type BarisNominal,
} from '@/lib/incentive-nominal';

export const dynamic = 'force-dynamic';

/**
 * /api/incentive/nominal - nominal total proyek insentif.
 *
 * Nominalnya hidup di tabel `incentive_nominal` yang terkunci (RLS tanpa
 * kebijakan, hak anon/authenticated dicabut): satu-satunya jalan baca & tulis
 * adalah route ini, yang memverifikasi pemanggil dengan service role.
 *
 *   GET  -> { data: { [reminderId]: nominal }, terbuka, aturan }
 *           Hanya proyek yang BERHAK dilihat pemanggil yang ikut (lihat
 *           lib/incentive-nominal.ts). Selebihnya tidak ada - bukan 0.
 *   POST -> simpan nominal satu proyek (seluruh baris sebatch). Input/penuh.
 *   PUT  -> ubah aturan siapa yang melihat nominal. Konfigurasi penuh.
 */

type Hak = { role: string; incentive_akses?: string | null; allow_incentive_input?: boolean | null; access_level?: string | null };

async function pemanggil(request: NextRequest) {
  const caller = await getSessionUser(request);
  if (!caller) return null;
  const supabase = getAdminClient();
  const { data: row } = await supabase
    .from('users').select('incentive_akses, allow_incentive_input, access_level, incentive_brand_scope').eq('id', caller.id).maybeSingle();
  const hak: Hak = { role: caller.role, ...(row ?? {}) };
  const lingkupBrand = (row as { incentive_brand_scope?: string | null } | null)?.incentive_brand_scope ?? null;
  return { caller, supabase, hak, lingkupBrand };
}

const tolak = () => NextResponse.json({ error: 'Sesi tidak valid. Login ulang.' }, { status: 401 });

async function bacaAturan(supabase: ReturnType<typeof getAdminClient>) {
  const { data } = await supabase.from('app_settings').select('value').eq('key', KUNCI_ATURAN_NOMINAL).maybeSingle();
  return rapikanAturanNominal(data?.value);
}

export async function GET(request: NextRequest) {
  const p = await pemanggil(request);
  if (!p) return tolak();
  const { caller, supabase, hak, lingkupBrand } = p;

  const petugas = bisaInputNominal(hak);
  const aturan = await bacaAturan(supabase);
  //  Bukan petugas & aturannya "petugas saja": tidak ada yang perlu dibaca.
  if (!petugas && aturan.lihat === 'petugas') {
    return NextResponse.json({ data: {}, terbuka: false, aturan });
  }

  const { data, error } = await supabase
    .from('incentive_nominal')
    .select('reminder_id, nominal, reminders(brand, pic_id, assigned_to, assign_name)');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  //  Proyek yang sudah punya baris bagian atas namanya (untuk aturan "terlibat").
  let punyaBagian = new Set<string>();
  if (!petugas) {
    const { data: bag } = await supabase.from('incentive_splits').select('project_id').eq('user_id', caller.id);
    punyaBagian = new Set(((bag ?? []) as { project_id: string }[]).map(b => b.project_id));
  }

  const peta: Record<string, number> = {};
  type Baris = { reminder_id: string; nominal: number | string; reminders: Omit<BarisNominal, 'id'> | Omit<BarisNominal, 'id'>[] | null };
  for (const r of (data ?? []) as unknown as Baris[]) {
    const rem = Array.isArray(r.reminders) ? r.reminders[0] : r.reminders;
    const boleh = nominalTerbuka({
      hak, lingkupBrand, aturan,
      baris: { id: r.reminder_id, ...(rem ?? {}) },
      pengguna: { id: caller.id, username: caller.username, full_name: caller.full_name },
      punyaBagian: punyaBagian.has(r.reminder_id),
    });
    if (boleh) peta[r.reminder_id] = Number(r.nominal) || 0;
  }
  return NextResponse.json({ data: peta, terbuka: petugas, aturan });
}

export async function POST(request: NextRequest) {
  const p = await pemanggil(request);
  if (!p) return tolak();
  const { caller, supabase, hak, lingkupBrand } = p;
  if (!bisaInputNominal(hak)) {
    return NextResponse.json({ error: 'Tidak berwenang mengisi nominal.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { reminderId?: string; nominal?: number } | null;
  const nominal = Number(body?.nominal);
  if (!body?.reminderId || !Number.isFinite(nominal) || nominal <= 0 || nominal > 1e12) {
    return NextResponse.json({ error: 'Nominal harus berupa angka lebih dari 0.' }, { status: 400 });
  }

  const { data: acuan } = await supabase
    .from('reminders').select('id, batch_id, brand').eq('id', body.reminderId).maybeSingle();
  if (!acuan) return NextResponse.json({ error: 'Proyek tidak ditemukan.' }, { status: 404 });
  if (!bolehLihatBrand(lingkupBrand, (acuan as { brand?: string | null }).brand)) {
    return NextResponse.json({ error: 'Proyek ini di luar lingkup brand Anda.' }, { status: 403 });
  }

  //  Jadwal berhari-hari tersimpan sebagai beberapa baris sebatch; semuanya
  //  menyimpan nominal yang sama, persis seperti perilaku sebelum dikunci.
  const batchId = (acuan as { batch_id?: string | null }).batch_id;
  let ids = [body.reminderId];
  if (batchId) {
    const { data: sebatch } = await supabase.from('reminders').select('id').eq('batch_id', batchId);
    ids = [...new Set([...((sebatch ?? []) as { id: string }[]).map(r => r.id), body.reminderId])];
  }

  //  Nominal terkunci begitu tahapan pencairan dibuat. Diulang di sini karena
  //  penjagaan yang hanya ada di layar bukan penjagaan.
  const { data: adaTahapan } = await supabase
    .from('incentive_tranches').select('id').in('project_id', ids).limit(1);
  if (adaTahapan && adaTahapan.length > 0) {
    return NextResponse.json({
      error: 'Nominal terkunci — tahapan pencairan proyek ini sudah dibuat. Hapus tahapannya lebih dulu bila nominalnya memang keliru.',
    }, { status: 409 });
  }

  const sekarang = new Date().toISOString();
  const { error } = await supabase.from('incentive_nominal').upsert(
    ids.map(id => ({ reminder_id: id, nominal, diubah_oleh: caller.username, diubah_pada: sekarang })),
    { onConflict: 'reminder_id' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, ids });
}

export async function PUT(request: NextRequest) {
  const p = await pemanggil(request);
  if (!p) return tolak();
  const { supabase, hak } = p;
  if (!bisaKonfigPenuh(hak)) {
    return NextResponse.json({ error: 'Butuh akses konfigurasi penuh Incentive PTS.' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const aturan = rapikanAturanNominal(body);
  const { error } = await supabase.from('app_settings')
    .upsert({ key: KUNCI_ATURAN_NOMINAL, value: aturan, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, aturan });
}
