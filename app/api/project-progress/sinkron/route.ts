import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, ambilAkun, galat } from '@/lib/checklist-server';
import { daftarId } from '@/lib/checklist-isian';
import { sinkronkanReminderKeProgress } from '@/lib/sinkron-progress-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/project-progress/sinkron { reminderIds } - jembatan Request
 * Schedule -> Project Progress. Dipanggil sesudah reminder kategori
 * Konfigurasi dibuat / disetujui.
 *
 * Yang dikirim klien HANYA id reminder; isinya dibaca ulang di server,
 * jadi nama proyek, Sales, dan penangan tidak bisa dipalsukan dari peramban.
 *
 * Pemetaan (snapshot saat reminder dibuat - sesudahnya kedua sisi mandiri):
 *   project_name          -> proyek (dicocokkan tanpa beda besar-kecil huruf)
 *   sales_name / division -> Sales proyek baru
 *   address               -> nama checklist lokasi (bisa diganti admin)
 *   assign_name           -> anggota checklist (dicocokkan ke akun)
 *   progress_start/target -> jadwal checklist
 * Isi checklist sengaja kosong: diimpor atau disalin menyusul.
 *
 * Langkahnya di lib/sinkron-progress-server.ts (dipakai juga DIWAYPI).
 */
export async function POST(request: NextRequest) {
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  const { db, akun } = s;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }
  const ids = daftarId(body.reminderIds).slice(0, 100);
  try {
    const out = await sinkronkanReminderKeProgress(db, akun, ids, request.nextUrl.origin);
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (e) {
    return galat(e instanceof Error ? e.message : String(e), 500);
  }
}
